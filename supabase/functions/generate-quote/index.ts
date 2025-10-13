import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description, user_id, customer_id, detailLevel = 'standard' } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Generating quote for:', description);

    // Skapa Supabase-klient för att hämta timpriser
    const supabaseClient = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!
    );

    // Hämta användarens timpriser
    const { data: hourlyRates, error: ratesError } = await supabaseClient
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

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: `Du är en AI-assistent som hjälper hantverkare att skapa professionella offerter. 

${ratesText}
${equipmentText}
${customerHistoryText}
${pricingHistoryText}

VIKTIGA PRINCIPER FÖR KONSEKVENTA OFFERTER:
- Använd EXAKT de angivna timpriserna ovan för varje arbetstyp
- Basera tidsestimat på branschstandarder och erfarenhet
- Samma beskrivning ska alltid ge samma resultat - var konsekvent!
- Avrunda alltid timmar till närmaste heltal
- Använd realistiska och konsekventa materialpriser baserat på 2025 års priser
- Specificera tydligt vad som ingår och inte ingår i offerten
- Matcha arbetstypen i offerten mot beskrivningen och använd korrekt timpris för varje workItem
- Om beskrivningen innehåller flera typer av arbeten, använd det timpris som passar bäst för varje specifikt arbetsmoment

DETALJNIVÅ OCH INNEHÅLL (användarens val: ${detailLevel}):

**QUICK (Snabboffert - 5 min arbete):**
- Maximalt 2-3 huvudarbetsmoment (ex: "Rivning", "Installation", "Slutstädning")
- Inga detaljerade beskrivningar - endast arbetsmomentets namn
- Maximalt 3-5 huvudmaterial (ex: "Kakel", "Lim och fog", "VVS-delar")
- Notes: Max 2 korta meningar (ex: "Pris gäller i 30 dagar. Offererade material kan varieras efter önskemål.")
- Total längd notes: Max 100 tecken

**STANDARD (Normal offert - 15 min arbete):**
- 4-6 arbetsposter med korta beskrivningar (1 mening per post)
- Beskrivningar ska vara konkreta men kortfattade (ex: "Rivning av befintligt kakel, bortforsling av rivningsmaterial")
- 5-10 material med kategorisering (ex: "Kakel Cementi Grå 30x60", "Weber Flex kakellim", etc.)
- Notes: 3-5 meningar som täcker:
  * Giltighetstid för offert
  * Vad som ingår/inte ingår
  * Betalningsvillkor
  * Ev. ROT-info
- Total längd notes: 200-300 tecken

**DETAILED (Detaljerad offert - 30 min arbete):**
- 6-10 arbetsposter med utförliga beskrivningar (2-3 meningar per post)
- Beskrivningar ska inkludera metod och omfattning (ex: "Noggrann rivning av befintligt kakel med skonsam behandling av underliggande yta. Bortforsling av allt rivningsmaterial. Kontroll av väggars skick efter rivning.")
- 10-15 material med fullständiga specifikationer
- Fasindelning i notes med tidsplan:
  * Fas 1: Förberedelser och rivning (Dag 1-2)
  * Fas 2: Underarbeten (Dag 3-4)
  * Fas 3: Installation (Dag 5-7)
  * Fas 4: Slutarbete (Dag 8)
- Notes ska även inkludera:
  * Detaljerad arbetsgång
  * Vad som ingår/inte ingår (punkt för punkt)
  * Garantier och ansvarsområden
  * Betalplan (ex: 30% vid start, 40% vid halvtid, 30% vid slutbesiktning)
- Total längd notes: 500-800 tecken

**CONSTRUCTION (Byggprojekt - 60 min arbete):**
- 10-15 arbetsposter inklusive:
  * Projektledning (timmar för planering, koordinering, möten)
  * Alla underarbeten i detalj
  * Huvudarbeten uppdelade i delfaser
  * Kvalitetskontroller och besiktningar
  * Slutstädning och överlämning
- Varje arbetspost ska ha omfattande beskrivningar (3-5 meningar)
- 15-25 material med fullständiga produktnamn, artikelnummer (om relevant), leverantör
- Notes ska vara en komplett projektplan och inkludera:
  * **Projektorganisation:** Ansvarig projektledare, underentreprenörer
  * **Detaljerad tidsplan:** Fas 1-5 med veckoindelning
  * **Bygglovsinfo:** Om bygglov krävs, vem ansvarar
  * **Försäkringar:** Ansvarsförsäkring, allriskförsäkring
  * **Besiktningar:** Kontrollplan med 3 besiktningar (start, mellan, slut)
  * **Garantier:** 2-5 års garanti på arbete och material
  * **Avtalspunkter:** Betalplan (5 delposter), ändringshantering, force majeure
  * **Avvikelserapportering:** Hur avvikelser hanteras
  * **Överlämning:** Slutdokumentation, bruksanvisningar, garantihandlingar
  * **Kontaktuppgifter:** Projektledare, jour, kundtjänst
- Total längd notes: 1200-2000 tecken

**VIKTIGT FÖR ALLA NIVÅER:**
- Använd ALLTID samma timpriser oavsett detaljnivå (baserat på angivna rates)
- Använd ALLTID samma materialpriser oavsett detaljnivå
- Samma uppdrag ska ge samma totalbelopp, oavsett detaljnivå
- Skillnaden är ENDAST i detaljrikedom och dokumentation, INTE i pris

**PRISKONSISTENS (KRITISKT):**
För att garantera att samma uppdrag ger samma pris oavsett detaljnivå:
1. Beräkna FÖRST den totala arbetstiden som uppdraget kräver (oberoende av detaljnivå)
2. Beräkna FÖRST den totala materialkostnaden (oberoende av detaljnivå)
3. Fördela sedan arbetstiden och materialen över fler eller färre poster beroende på detaljnivå
4. Exempel:
   - Quick: "Installation badrum 40h à 899 kr = 35 960 kr"
   - Standard: "Rivning 8h, Underarbeten 12h, Kakelsättning 15h, VVS 5h = totalt 40h à olika priser"
   - Samma totala arbetstid (40h), bara fördelat olika!
            
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
    "rotDeduction": 5625,
    "customerPays": 13125
  },
  "notes": "Eventuella anteckningar eller villkor"
}

Viktig information:
- Använd realistiska svenska priser (2025)
- Använd de angivna timpriserna ovan för varje arbetsmoment
- ROT-avdrag är 50% av arbetskostnaden (max 50 000 kr per person/år)
- Inkludera moms (25%)
- Specificera material och kvantiteter
- Var tydlig med vad som ingår och inte ingår`
          },
          {
            role: 'user',
            content: description
          }
        ],
        response_format: { type: "json_object" }
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
    const generatedQuote = JSON.parse(data.choices[0].message.content);

    console.log('Generated quote successfully with detail level:', detailLevel);

    return new Response(
      JSON.stringify({ 
        quote: generatedQuote,
        hasCustomRates,
        hasEquipment,
        detailLevel
      }),
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