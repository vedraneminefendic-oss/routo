import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Generating quote for:', description);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Du är en AI-assistent som hjälper hantverkare att skapa professionella offerter. 
            
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
- Timkostnad 600-750 kr beroende på kompetens
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

    console.log('Generated quote successfully');

    return new Response(
      JSON.stringify({ quote: generatedQuote }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in generate-quote:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ett fel uppstod vid generering av offerten';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});