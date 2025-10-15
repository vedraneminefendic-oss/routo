import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation function to ensure AI output matches base totals
function validateQuoteOutput(quote: any, baseTotals: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // 1. Validate work hours by type
  const workHoursByType = new Map<string, number>();
  quote.workItems.forEach((item: any) => {
    const type = item.name.split(' - ')[0]; // "Snickare - Rivning" → "Snickare"
    workHoursByType.set(type, (workHoursByType.get(type) || 0) + item.hours);
  });
  
  Object.entries(baseTotals.workHours).forEach(([type, hours]) => {
    const actualHours = workHoursByType.get(type) || 0;
    const tolerance = 0.5;
    if (Math.abs(actualHours - (hours as number)) > tolerance) {
      errors.push(`${type}: Förväntade ${hours}h men fick ${actualHours}h`);
    }
  });
  
  // 2. Validate material cost
  const totalMaterialCost = quote.materials.reduce((sum: number, m: any) => sum + m.subtotal, 0);
  const expectedMaterialCost = baseTotals.materialCost + baseTotals.equipmentCost;
  const costTolerance = 100;
  if (Math.abs(totalMaterialCost - expectedMaterialCost) > costTolerance) {
    errors.push(`Material: Förväntade ${expectedMaterialCost} kr men fick ${totalMaterialCost} kr`);
  }
  
  // 3. Validate summary calculations
  const actualWorkCost = quote.workItems.reduce((sum: number, w: any) => sum + w.subtotal, 0);
  if (Math.abs(quote.summary.workCost - actualWorkCost) > 1) {
    errors.push('summary.workCost matchar inte summan av workItems');
  }
  
  if (Math.abs(quote.summary.materialCost - totalMaterialCost) > 1) {
    errors.push('summary.materialCost matchar inte summan av materials');
  }
  
  return { valid: errors.length === 0, errors };
}

// Auto-correct function to force mathematical consistency
function autoCorrectQuote(quote: any, baseTotals: any): any {
  const correctedQuote = JSON.parse(JSON.stringify(quote)); // Deep clone
  
  // Force correct work hours distribution
  Object.entries(baseTotals.workHours).forEach(([type, expectedHours]) => {
    const typeItems = correctedQuote.workItems.filter((item: any) => 
      item.name.startsWith(type + ' -') || item.name === type
    );
    
    if (typeItems.length > 0) {
      const totalActualHours = typeItems.reduce((sum: number, item: any) => sum + item.hours, 0);
      const ratio = (expectedHours as number) / totalActualHours;
      
      typeItems.forEach((item: any) => {
        item.hours = Math.round(item.hours * ratio * 10) / 10;
        item.subtotal = item.hours * item.hourlyRate;
      });
    }
  });
  
  // Force correct material cost
  const expectedMaterialCost = baseTotals.materialCost + baseTotals.equipmentCost;
  const actualMaterialCost = correctedQuote.materials.reduce((sum: number, m: any) => sum + m.subtotal, 0);
  
  if (actualMaterialCost > 0) {
    const materialRatio = expectedMaterialCost / actualMaterialCost;
    correctedQuote.materials.forEach((item: any) => {
      item.subtotal = Math.round(item.subtotal * materialRatio);
      item.pricePerUnit = Math.round(item.subtotal / item.quantity);
    });
  }
  
  // Recalculate summary
  correctedQuote.summary.workCost = correctedQuote.workItems.reduce((sum: number, w: any) => sum + w.subtotal, 0);
  correctedQuote.summary.materialCost = correctedQuote.materials.reduce((sum: number, m: any) => sum + m.subtotal, 0);
  correctedQuote.summary.totalBeforeVAT = correctedQuote.summary.workCost + correctedQuote.summary.materialCost;
  correctedQuote.summary.vat = Math.round(correctedQuote.summary.totalBeforeVAT * 0.25);
  correctedQuote.summary.totalWithVAT = correctedQuote.summary.totalBeforeVAT + correctedQuote.summary.vat;
  
  return correctedQuote;
}

// Industry standard validation
function validateRealism(quote: any, description: string): string[] {
  const warnings: string[] = [];
  const descLower = description.toLowerCase();
  
  // Bathroom renovation should take at least 30h
  if ((descLower.includes('badrum') || descLower.includes('våtrum')) && 
      descLower.includes('renovering')) {
    const totalHours = quote.workItems.reduce((sum: number, w: any) => sum + w.hours, 0);
    if (totalHours < 30) {
      warnings.push(`Badrumsrenovering: ${totalHours}h verkar orealistiskt lågt (branschstandard: 40-80h)`);
    }
  }
  
  // Tree felling should cost at least 800 kr/h
  if (descLower.includes('träd') && (descLower.includes('fälla') || descLower.includes('fällning'))) {
    const treeWorkItem = quote.workItems.find((w: any) => 
      w.name.toLowerCase().includes('träd') || w.name.toLowerCase().includes('arborist')
    );
    if (treeWorkItem && treeWorkItem.hourlyRate < 800) {
      warnings.push(`Trädfällning: ${treeWorkItem.hourlyRate} kr/h är för lågt (branschstandard: 800-1200 kr/h)`);
    }
  }
  
  // Cleaning should not use carpenter rates
  if ((descLower.includes('städ') || descLower.includes('rengör')) && 
      !descLower.includes('renovering')) {
    const carpenterItem = quote.workItems.find((w: any) => 
      w.name.toLowerCase().includes('snickare')
    );
    if (carpenterItem) {
      warnings.push('Städning kräver inte snickare - kontrollera arbetstyper');
    }
  }
  
  return warnings;
}

async function calculateBaseTotals(
  description: string, 
  apiKey: string,
  hourlyRates: any[] | null,
  equipmentRates: any[] | null
) {
  const ratesContext = hourlyRates && hourlyRates.length > 0
    ? `Timpriserna är: ${hourlyRates.map(r => `${r.work_type}: ${r.rate} kr/h`).join(', ')}`
    : 'Standardpris: 650 kr/h';

  const equipmentContext = equipmentRates && equipmentRates.length > 0
    ? `\n\nTillgänglig utrustning: ${equipmentRates.map(e => `${e.name} (${e.price_per_day || e.price_per_hour} kr/${e.price_per_day ? 'dag' : 'tim'})`).join(', ')}`
    : '';

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `Du beräknar ENDAST total arbetstid och materialkostnad för projekt. 

VIKTIGT: Identifiera vilka FAKTISKA arbetstyper som krävs för detta uppdrag.

Exempel:
- Städning → "Städare"
- Fönsterputsning → "Fönsterputsare"
- Trädfällning → "Arborist" eller "Trädvård"
- Badrumsrenovering → "Snickare", "VVS", "Elektriker"
- Målning → "Målare"
- Gräsklippning → "Trädgårdsskötare"

${ratesContext}${equipmentContext}

Returnera ENDAST JSON i detta format:
{
  "workHours": { "Städare": 8, "Fönsterputsare": 2 },
  "materialCost": 500,
  "equipmentCost": 0
}

Regler:
- workHours: Total arbetstid per FAKTISK arbetstyp som projektet kräver (använd svenska yrkestitlar)
- materialCost: Total materialkostnad i kronor (realistiska 2025 priser)
- equipmentCost: Total kostnad för maskiner/utrustning om projektet kräver det (annars 0)
- Använd INTE "Snickare" för städning eller "VVS" för trädgårdsskötsel - var specifik!`
        },
        {
          role: 'user',
          content: `Beräkna totaler för: "${description}"`
        }
      ],
      response_format: { type: "json_object" }
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to calculate base totals: ${response.status}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Input validation schema
    const requestSchema = z.object({
      description: z.string().trim().min(10, "Description too short").max(5000, "Description too long"),
      customer_id: z.string().uuid().optional(),
      detailLevel: z.enum(['quick', 'standard', 'detailed', 'construction']).default('standard'),
      deductionType: z.enum(['rot', 'rut', 'none', 'auto']).default('auto')
    });

    // Parse and validate request body
    const body = await req.json();
    const validatedData = requestSchema.parse(body);

    // Extract user_id from JWT token instead of trusting client
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Create admin client to verify JWT and get user
    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user_id = user.id;
    const { description, customer_id, detailLevel, deductionType } = validatedData;

    console.log('Generating quote for user:', user_id);
    console.log('Description:', description);
    console.log('Deduction type requested:', deductionType);

    // Skapa Supabase-klient för att hämta timpriser
    const supabaseClient = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!
    );

    // Detect deduction type if set to auto
    let finalDeductionType = deductionType;
    if (deductionType === 'auto') {
      console.log('Auto-detecting deduction type...');
      finalDeductionType = await detectDeductionType(description, LOVABLE_API_KEY);
      console.log('Detected deduction type:', finalDeductionType);
    }

    // Hämta användarens timpriser
    const { data: hourlyRates, error: ratesError} = await supabaseClient
      .from('hourly_rates')
      .select('work_type, rate')
      .eq('user_id', user_id);

    if (ratesError) {
      console.error('Error fetching hourly rates:', ratesError);
    }

    // Hämta användarens maskiner och utrustning
    const { data: equipmentRates, error: equipmentError } = await supabaseClient
      .from('equipment_rates')
      .select('name, equipment_type, price_per_day, price_per_hour, is_rented, default_quantity')
      .eq('user_id', user_id);

    if (equipmentError) {
      console.error('Error fetching equipment rates:', equipmentError);
    }

    // Hämta kundspecifik historik (om customer_id finns)
    let customerHistoryText = '';
    if (customer_id) {
      const { data: customerQuotes } = await supabaseClient
        .from('quotes')
        .select('title, generated_quote, edited_quote, status, created_at')
        .eq('user_id', user_id)
        .eq('customer_id', customer_id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (customerQuotes && customerQuotes.length > 0) {
        customerHistoryText = '\n\nTidigare offerter för denna kund:\n' +
          customerQuotes.map(q => {
            const quote = q.edited_quote || q.generated_quote;
            const totalCost = quote?.summary?.totalWithVAT || 0;
            return `- ${q.title}: ${totalCost} kr (Status: ${q.status}, ${new Date(q.created_at).toLocaleDateString('sv-SE')})`;
          }).join('\n') +
          '\n\nAnvänd denna historik för att matcha priser och nivå om liknande arbete.';
      }
    }

    // Hämta prishistorik från alla användarens offerter
    const { data: recentQuotes } = await supabaseClient
      .from('quotes')
      .select('generated_quote, edited_quote')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(20);

    let pricingHistoryText = '';
    if (recentQuotes && recentQuotes.length > 0) {
      const allWorkItems: any[] = [];
      recentQuotes.forEach(q => {
        const quote = q.edited_quote || q.generated_quote;
        if (quote?.workItems) {
          allWorkItems.push(...quote.workItems);
        }
      });
      
      const workTypeAverages = new Map();
      allWorkItems.forEach(item => {
        const name = item.name.toLowerCase();
        if (!workTypeAverages.has(name)) {
          workTypeAverages.set(name, []);
        }
        workTypeAverages.get(name).push(item.hourlyRate);
      });
      
      if (workTypeAverages.size > 0) {
        pricingHistoryText = '\n\nDina genomsnittliga priser från tidigare offerter:\n';
        workTypeAverages.forEach((rates, workType) => {
          const avg = rates.reduce((a: number, b: number) => a + b, 0) / rates.length;
          pricingHistoryText += `- ${workType}: ~${Math.round(avg)} kr/h (baserat på ${rates.length} tidigare poster)\n`;
        });
        pricingHistoryText += '\nAnvänd dessa som referens för konsekvent prissättning.';
      }
    }

    // Bygg rates-text för prompten
    let ratesText = '';
    let hasCustomRates = false;
    
    if (hourlyRates && hourlyRates.length > 0) {
      ratesText = 'Använd EXAKT dessa timpriser som användaren har angivit:\n' + 
                  hourlyRates.map(r => `- ${r.work_type}: ${r.rate} kr/h`).join('\n');
      hasCustomRates = true;
      console.log('Using custom hourly rates:', hourlyRates);
    } else {
      ratesText = 'Användaren har inte angivit specifika timpriser. Använd standardpris 650 kr/h.';
      console.log('No custom rates found, using default 650 kr/h');
    }

    // Bygg equipment-text för prompten
    let equipmentText = '';
    let hasEquipment = false;
    
    if (equipmentRates && equipmentRates.length > 0) {
      equipmentText = '\n\nAnvändarens maskiner och utrustning:\n' + 
        equipmentRates.map(e => {
          const priceInfo = e.price_per_day 
            ? `${e.price_per_day} kr/dag`
            : `${e.price_per_hour} kr/timme`;
          const status = e.is_rented ? 'hyrd' : 'ägd';
          return `- ${e.name} (${e.equipment_type}): ${priceInfo} (${status}, standard antal: ${e.default_quantity})`;
        }).join('\n') +
        '\n\nOm uppdraget kräver maskiner eller utrustning, använd dessa och lägg till dem i offerten. Lägg maskinkostnader under materials-array med lämplig beskrivning.';
      hasEquipment = true;
      console.log('Using equipment rates:', equipmentRates);
    }

    // Build deduction info based on type
    const deductionInfo = finalDeductionType === 'rot' 
      ? `ROT-avdrag: 50% av arbetskostnaden (max 50 000 kr per person/år). Gäller renovering, reparation, ombyggnad.`
      : finalDeductionType === 'rut'
      ? `RUT-avdrag: 50% av arbetskostnaden (max 75 000 kr per person/år). Gäller städning, underhåll, trädgård, hemservice.`
      : `Inget skatteavdrag tillämpas på detta arbete.`;

    // STEG 1: Beräkna bastotaler först (för priskonsistens)
    console.log('Step 1: Calculating base totals for price consistency...');
    const baseTotals = await calculateBaseTotals(description, LOVABLE_API_KEY!, hourlyRates, equipmentRates);
    console.log('Base totals calculated:', baseTotals);

    // Define strict JSON schema for tool calling
    const quoteSchema = {
      type: "object",
      properties: {
        title: { type: "string", description: "Kort beskrivande titel för offerten" },
        workItems: {
          type: "array",
          description: "Lista över arbetsmoment",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Namn på arbetsmoment" },
              description: { type: "string", description: "Beskrivning av momentet" },
              hours: { type: "number", description: "Antal timmar" },
              hourlyRate: { type: "number", description: "Timpris i kronor" },
              subtotal: { type: "number", description: "Totalkostnad (hours × hourlyRate)" }
            },
            required: ["name", "description", "hours", "hourlyRate", "subtotal"],
            additionalProperties: false
          }
        },
        materials: {
          type: "array",
          description: "Lista över material",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Namn på material/produkt" },
              quantity: { type: "number", description: "Antal" },
              unit: { type: "string", description: "Enhet (st/m2/m/kg)" },
              pricePerUnit: { type: "number", description: "Pris per enhet" },
              subtotal: { type: "number", description: "Totalkostnad (quantity × pricePerUnit)" }
            },
            required: ["name", "quantity", "unit", "pricePerUnit", "subtotal"],
            additionalProperties: false
          }
        },
        summary: {
          type: "object",
          description: "Sammanfattning av kostnader",
          properties: {
            workCost: { type: "number", description: "Total arbetskostnad" },
            materialCost: { type: "number", description: "Total materialkostnad" },
            totalBeforeVAT: { type: "number", description: "Summa före moms" },
            vat: { type: "number", description: "Moms (25%)" },
            totalWithVAT: { type: "number", description: "Totalt inkl moms" },
            deductionAmount: { type: "number", description: "ROT/RUT-avdrag" },
            deductionType: { type: "string", enum: ["rot", "rut", "none"], description: "Typ av avdrag" },
            customerPays: { type: "number", description: "Kund betalar efter avdrag" }
          },
          required: ["workCost", "materialCost", "totalBeforeVAT", "vat", "totalWithVAT", "deductionAmount", "deductionType", "customerPays"],
          additionalProperties: false
        },
        notes: { type: "string", description: "Anteckningar och villkor" }
      },
      required: ["title", "workItems", "materials", "summary"],
      additionalProperties: false
    };

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        temperature: 0,
        tools: [{
          type: "function",
          function: {
            name: "create_quote",
            description: "Skapa en strukturerad offert baserat på jobbeskrivning och förutberäknade totaler",
            parameters: quoteSchema
          }
        }],
        tool_choice: { type: "function", function: { name: "create_quote" } },
        messages: [
          {
            role: 'system',
            content: `Du är en AI-assistent som hjälper hantverkare att skapa professionella offerter. 

${ratesText}
${equipmentText}
${customerHistoryText}
${pricingHistoryText}

**TIMPRIS-MATCHNING:**
När du skapar workItems, följ dessa regler:

1. Om arbetstypen (t.ex. "Snickare") finns i användarens timpriser → Använd EXAKT det priset
2. Om arbetstypen (t.ex. "Städare") INTE finns i listan → Använd branschstandard-priser:
   - Städare: 450-550 kr/h
   - Arborist/Trädfällning: 800-1200 kr/h (komplext arbete)
   - Trädgårdsskötare: 500-650 kr/h
   - Målare: 650-750 kr/h
   - Elektriker: 850-950 kr/h (om ej angiven)
   - VVS: 900-1100 kr/h (om ej angiven)
   - Fönsterputsare: 400-500 kr/h

3. VIKTIGT: Matcha INTE fel arbetstyper! 
   - Städning kräver INTE en snickare
   - Trädfällning kräver INTE en elektriker
   - Använd logiska arbetstyper baserat på uppdraget

Exempel på korrekt matching:

❌ FEL:
Uppdrag: "Städning 70 kvm"
workItems: [{ name: "Snickare - Städning", hours: 8, hourlyRate: 799 }]

✅ RÄTT:
Uppdrag: "Städning 70 kvm"
workItems: [{ name: "Städare - Hemstädning", hours: 6, hourlyRate: 500 }]

---

❌ FEL:
Uppdrag: "Fälla två ekar"
workItems: [{ name: "Snickare - Trädfällning", hours: 16, hourlyRate: 799 }]

✅ RÄTT:
Uppdrag: "Fälla två ekar"
workItems: [{ name: "Arborist - Trädfällning", hours: 16, hourlyRate: 1100 }]

VIKTIGA PRINCIPER FÖR KONSEKVENTA OFFERTER:
- Använd EXAKT de angivna timpriserna ovan för matchande arbetstyper
- Basera tidsestimat på branschstandarder och erfarenhet
- Samma beskrivning ska alltid ge samma resultat - var konsekvent!
- Avrunda alltid timmar till närmaste heltal
- Använd realistiska och konsekventa materialpriser baserat på 2025 års priser
- Specificera tydligt vad som ingår och inte ingår i offerten

**🔒 KRITISKT - LÅS DESSA FÖRUTBERÄKNADE TOTALER:**

Du MÅSTE använda EXAKT dessa värden som redan beräknats för projektet:
${JSON.stringify(baseTotals, null, 2)}

**DU FÅR ABSOLUT INTE:**
- Ändra totalsumman
- Lägga till eller ta bort arbetstimmar
- Ändra materialkostnaden
- "Anpassa" priserna

**DIN ENDA UPPGIFT:**
Fördela dessa EXAKTA totaler över arbetsposter och material enligt detaljnivån nedan.

---

DETALJNIVÅ OCH INNEHÅLL (användarens val: ${detailLevel}):

**QUICK (Snabboffert - 5 min arbete):**
- Dela upp baseTotals.workHours över 2-3 huvudarbetsmoment
  * Exempel: Om totalt 40h Snickare → skapa 2 poster à 20h vardera
- Dela upp baseTotals.materialCost över 3-5 huvudmaterial
  * Exempel: Om totalt 18 500 kr → fördela på "Kakel 8000 kr", "VVS-delar 7000 kr", "Övrigt 3500 kr"
- Notes: Max 2 korta meningar
- Total längd notes: Max 100 tecken

**STANDARD (Normal offert - 15 min arbete):**
- Dela upp baseTotals.workHours över 4-6 arbetsposter med korta beskrivningar (1 mening per post)
  * Exempel: Om totalt 40h Snickare → "Rivning 8h", "Underarbeten 12h", "Kakelsättning 15h", "Slutarbete 5h"
- Dela upp baseTotals.materialCost över 5-10 material med kategorisering
  * Exempel: Om totalt 18 500 kr → specificera "Kakel Cementi Grå 30x60: 8000 kr", "Weber Flex kakellim: 2500 kr", etc.
- Notes: 3-5 meningar (giltighetstid, betalning, ROT-info)
- Total längd notes: 200-300 tecken

**DETAILED (Detaljerad offert - 30 min arbete):**
- Dela upp baseTotals.workHours över 6-10 arbetsposter med utförliga beskrivningar (2-3 meningar per post)
  * Exempel: Om totalt 40h Snickare → dela upp i 8 poster med detaljerade beskrivningar av metod
- Dela upp baseTotals.materialCost över 10-15 material med fullständiga specifikationer
- Fasindelning i notes med tidsplan (Fas 1-4)
- Notes ska inkludera: Arbetsgång, garantier, betalplan
- Total längd notes: 500-800 tecken

**CONSTRUCTION (Byggprojekt - 60 min arbete):**
- Dela upp baseTotals.workHours över 10-15 arbetsposter inklusive projektledning
  * Exempel: Om totalt 40h Snickare → dela upp i 12-15 poster inkl. "Projektledning 8h", detaljerade delfaser
- Dela upp baseTotals.materialCost över 15-25 material med artikelnummer och leverantör
- Notes ska vara en komplett projektplan (1200-2000 tecken)
  * Projektorganisation, tidsplan, bygglov, försäkringar, besiktningar, garantier, avtal, överlämning
- Total längd notes: 1200-2000 tecken

**🎯 ABSOLUT KRAV - MATEMATIK MÅSTE STÄMMA:**
- Summan av alla workItems.hours PER arbetstyp MÅSTE exakt matcha baseTotals.workHours
- Summan av alla materials.subtotal MÅSTE exakt matcha baseTotals.materialCost + baseTotals.equipmentCost
- Om baseTotals säger "Snickare: 40h" → totalt i workItems för Snickare MÅSTE vara exakt 40h
- Om baseTotals säger "materialCost: 18500" → totalt i materials MÅSTE vara exakt 18500 kr
            
Baserat på uppdragsbeskrivningen ska du returnera en strukturerad offert i JSON-format med följande struktur:

{
  "title": "Kort beskrivande titel",
  "workItems": [
    {
      "name": "Arbetsmoment",
      "description": "Beskrivning av momentet",
      "hours": 10,
      "hourlyRate": 650,
      "subtotal": 6500
    }
  ],
  "materials": [
    {
      "name": "Material/produkt",
      "quantity": 1,
      "unit": "st/m2/m",
      "pricePerUnit": 1000,
      "subtotal": 1000
    }
  ],
        "summary": {
          "workCost": 10000,
          "materialCost": 5000,
          "totalBeforeVAT": 15000,
          "vat": 3750,
          "totalWithVAT": 18750,
          "deductionAmount": ${finalDeductionType !== 'none' ? '5000' : '0'},
          "deductionType": "${finalDeductionType}",
          ${finalDeductionType === 'rot' ? '"rotDeduction": 5000,' : ''}
          ${finalDeductionType === 'rut' ? '"rutDeduction": 5000,' : ''}
          "customerPays": ${finalDeductionType !== 'none' ? '13750' : '18750'}
        },
  "deductionType": "${finalDeductionType}",
  "notes": "Eventuella anteckningar eller villkor"
}

**VIKTIGT - SKATTEAVDRAGSTYP:**
Du MÅSTE inkludera exakt detta i ditt svar:
- "deductionType": "${finalDeductionType}"
${finalDeductionType === 'rot' ? '- Använd fältet "rotDeduction" för avdraget (INTE rutDeduction)' : ''}
${finalDeductionType === 'rut' ? '- Använd fältet "rutDeduction" för avdraget (INTE rotDeduction)' : ''}
${finalDeductionType === 'none' ? '- Inkludera INGET avdragsfält (varken rotDeduction eller rutDeduction)' : ''}

**SKATTEAVDRAG:**
${deductionInfo}

${finalDeductionType !== 'none' ? `
VIKTIGT för ${finalDeductionType.toUpperCase()}-arbeten:
1. Var tydlig med vad som är arbetskostnad (avdragsgillt)
2. Material och utrustning är INTE avdragsgilla
3. Kunden får avdraget preliminärt direkt på fakturan
4. Visa tydligt i sammanfattningen: "Kund betalar efter ${finalDeductionType.toUpperCase()}-avdrag"
` : ''}

Viktig information:
- Använd realistiska svenska priser (2025)
- Använd de angivna timpriserna ovan för varje arbetsmoment
- Inkludera moms (25%)
- Specificera material och kvantiteter
- Var tydlig med vad som ingår och inte ingår`
          },
          {
            role: 'user',
            content: description
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'För många förfrågningar. Försök igen om en stund.' }), 
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Tjänsten kräver betalning. Kontakta support.' }), 
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract quote from tool call response
    let generatedQuote;
    if (data.choices[0].message.tool_calls && data.choices[0].message.tool_calls[0]) {
      // Tool calling response format
      generatedQuote = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
    } else {
      // Fallback to old format if tool calling not used
      generatedQuote = JSON.parse(data.choices[0].message.content);
    }
    
    // VALIDATION STEP 1: Validate AI output against base totals
    console.log('Validating quote output...');
    const validation = validateQuoteOutput(generatedQuote, baseTotals);
    const realismWarnings = validateRealism(generatedQuote, description);
    
    let finalQuote = generatedQuote;
    let wasAutoCorrected = false;
    let retryCount = 0;
    
    if (!validation.valid) {
      console.error('Quote validation failed:', validation.errors);
      retryCount = 1;
      
      // RETRY: Try one more time with more specific instructions about errors
      console.log('Retrying with more specific instructions...');
      const retryResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          temperature: 0,
          tools: [{
            type: "function",
            function: {
              name: "create_quote",
              description: "Skapa en strukturerad offert",
              parameters: quoteSchema
            }
          }],
          tool_choice: { type: "function", function: { name: "create_quote" } },
          messages: [
            {
              role: 'system',
              content: `Du misslyckades med valideringen förra gången. Felen var: ${validation.errors.join(', ')}
              
Korrigera detta och följ dessa EXAKTA totaler:
${JSON.stringify(baseTotals, null, 2)}

Du MÅSTE:
- Fördela exakt ${Object.entries(baseTotals.workHours).map(([type, hours]) => `${hours}h ${type}`).join(', ')}
- Total materialkostnad MÅSTE bli exakt ${baseTotals.materialCost + baseTotals.equipmentCost} kr
- Ingen avvikelse accepteras!`
            },
            {
              role: 'user',
              content: description
            }
          ]
        }),
      });
      
      if (retryResponse.ok) {
        const retryData = await retryResponse.json();
        let retryQuote;
        if (retryData.choices[0].message.tool_calls && retryData.choices[0].message.tool_calls[0]) {
          retryQuote = JSON.parse(retryData.choices[0].message.tool_calls[0].function.arguments);
        } else {
          retryQuote = JSON.parse(retryData.choices[0].message.content);
        }
        
        const retryValidation = validateQuoteOutput(retryQuote, baseTotals);
        
        if (retryValidation.valid) {
          console.log('Retry successful!');
          finalQuote = retryQuote;
        } else {
          console.warn('Retry also failed, applying auto-correction');
          finalQuote = autoCorrectQuote(retryQuote, baseTotals);
          wasAutoCorrected = true;
        }
      } else {
        console.warn('Retry failed, applying auto-correction to original');
        finalQuote = autoCorrectQuote(generatedQuote, baseTotals);
        wasAutoCorrected = true;
      }
    }
    
    // Add deduction type to the quote
    finalQuote.deductionType = finalDeductionType;

    // Normalize deduction fields for consistent display
    if (finalDeductionType === 'rot' && finalQuote.summary.rotDeduction) {
      finalQuote.summary.deductionAmount = finalQuote.summary.rotDeduction;
      finalQuote.summary.deductionType = 'rot';
    } else if (finalDeductionType === 'rut' && finalQuote.summary.rutDeduction) {
      finalQuote.summary.deductionAmount = finalQuote.summary.rutDeduction;
      finalQuote.summary.deductionType = 'rut';
    } else {
      finalQuote.summary.deductionAmount = 0;
      finalQuote.summary.deductionType = 'none';
    }

    console.log('Generated quote successfully with detail level:', detailLevel);
    
    // Prepare response with quality indicators
    const responseData: any = {
      quote: finalQuote,
      hasCustomRates,
      hasEquipment,
      detailLevel,
      deductionType: finalDeductionType
    };
    
    // Add quality warnings if any
    if (wasAutoCorrected) {
      responseData.qualityWarning = 'auto_corrected';
      responseData.warningMessage = 'Offerten har korrigerats automatiskt för att säkerställa korrekt matematik. Granska noggrannt.';
    }
    
    if (!validation.valid && !wasAutoCorrected) {
      responseData.validationErrors = validation.errors;
    }
    
    if (realismWarnings.length > 0) {
      responseData.realismWarnings = realismWarnings;
    }

    return new Response(
      JSON.stringify(responseData),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in generate-quote:', error);
    return new Response(
      JSON.stringify({ error: "Ett fel uppstod vid generering av offert. Kontakta support om problemet kvarstår." }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// AI function to detect deduction type based on job description
async function detectDeductionType(description: string, apiKey: string): Promise<'rot' | 'rut' | 'none'> {
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Du är expert på svenska skatteregler för ROT och RUT-avdrag. Avgör om ett jobb klassificeras som ROT, RUT eller inget avdrag.

**ROT-arbeten (Reparation, Ombyggnad, Tillbyggnad):**
- Renovering av badrum, kök, våtrum
- Målning, tapetsering, golvläggning, kakelläggning
- El- och VVS-installation som kräver byggarbete
- Värmepump, solpaneler, fönsterbyte
- Fasadrenovering, takläggning, takbyte
- Tillbyggnad, ombyggnad av bostaden
- Installation av hiss
- Dränering runt huset
- KRÄVER OFTA SPECIALISTKUNSKAP OCH BYGGARBETE

**RUT-arbeten (Rengöring, Underhåll, Trädgård):**
- Städning (hemstädning, storstädning, trappstädning)
- Fönsterputs, rengöring
- Gräsklippning, snöskottning, ogräsrensning
- Trädfällning, häckklippning, trädgårdsskötsel
- Flyttjänster, flyttstädning
- Klädtvätt, matlagning (hemservice)
- IT-support i hemmet
- Reparation av vitvaror (diskmaskin, tvättmaskin, spis)
- Enkel reparation och underhåll som inte kräver bygglov
- SAKER SOM HUSHÅLL KAN GÖRA SJÄLVA

**Viktiga skillnader:**
- "Installera värmepump" = ROT (kräver byggarbete)
- "Rengöra värmepumpens filter" = RUT (underhåll)
- "Renovera badrum" = ROT (bygg och installation)
- "Städa badrum" = RUT (rengöring)
- "Måla fasad" = ROT (renovering av byggnad)
- "Tvätta fönster" = RUT (hemservice)
- "Bygga altandäck" = ROT (tillbyggnad)
- "Sopa och rensa däck" = RUT (underhåll)
- "Rensa stuprör" = RUT (underhåll)
- "Byta taket" = ROT (renovering)

Returnera ENDAST ett JSON-objekt med detta format:
{"type": "rot"} eller {"type": "rut"} eller {"type": "none"}`
          },
          {
            role: 'user',
            content: `Klassificera följande arbete: "${description}"`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0
      }),
    });

    if (!response.ok) {
      console.error('AI detection failed, defaulting to ROT');
      return 'rot';
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    
    if (result.type === 'rot' || result.type === 'rut' || result.type === 'none') {
      return result.type;
    }
    
    console.warn('Invalid deduction type from AI, defaulting to ROT');
    return 'rot';
  } catch (error) {
    console.error('Error detecting deduction type:', error);
    return 'rot'; // Default fallback
  }
}