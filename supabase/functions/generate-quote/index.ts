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
    const { description, user_id } = await req.json();
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

VIKTIGA PRINCIPER FÖR KONSEKVENTA OFFERTER:
- Använd EXAKT de angivna timpriserna ovan för varje arbetstyp
- Basera tidsestimat på branschstandarder och erfarenhet
- Samma beskrivning ska alltid ge samma resultat - var konsekvent!
- Avrunda alltid timmar till närmaste heltal
- Använd realistiska och konsekventa materialpriser baserat på 2025 års priser
- Specificera tydligt vad som ingår och inte ingår i offerten
- Matcha arbetstypen i offerten mot beskrivningen och använd korrekt timpris för varje workItem
- Om beskrivningen innehåller flera typer av arbeten, använd det timpris som passar bäst för varje specifikt arbetsmoment

AUTOMATISK DETALJNIVÅ (anpassa innehåll efter uppskattat värde):
1. Uppskatta först total kostnad (totalWithVAT)
2. Anpassa sedan detaljnivån automatiskt:
   - Under 15,000 kr: "Snabboffert" - grundläggande arbetsposter och material
   - 15,000-50,000 kr: "Standard" - arbetsposter, material, grundläggande villkor
   - 50,000-150,000 kr: "Detaljerad" - lägg till tidsplan och fasindelning i notes
   - Över 150,000 kr: "Byggprojekt" - lägg till projektledning, försäkringar och besiktningar i notes

Anpassa mängden detaljer i beskrivningar och notes efter vald nivå.
            
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

    // Beräkna detaljnivå baserat på total kostnad
    const estimatedTotal = generatedQuote.summary?.totalWithVAT || 0;
    let detailLevel = 'standard';
    if (estimatedTotal < 15000) {
      detailLevel = 'quick';
    } else if (estimatedTotal < 50000) {
      detailLevel = 'standard';
    } else if (estimatedTotal < 150000) {
      detailLevel = 'detailed';
    } else {
      detailLevel = 'construction';
    }

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