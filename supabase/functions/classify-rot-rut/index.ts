import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const TEXT_MODEL = 'google/gemini-2.5-flash';

interface ClassificationRequest {
  projectDescription: string;
  workType?: string;
  conversationSummary?: any;
  workItems?: Array<{ name: string; description?: string }>;
}

interface ClassificationResponse {
  deductionType: 'rot' | 'rut' | 'none';
  confidence: number;
  reasoning: string;
  source: string;
  workItemClassifications?: Array<{
    name: string;
    rotEligible: boolean;
    reasoning: string;
    source: string;
  }>;
}

// Official ROT work types according to Skatteverket 2025
const ROT_APPROVED_WORK = [
  'rivning', 'demontering', 'montering', 'installation',
  'vvs', 'el', 'elinstallation', 'elektriker',
  'murning', 'murare', 'kakelsättning', 'kakel',
  'målning', 'måla', 'spackling', 'slipning',
  'golvläggning', 'golv', 'parkett', 'klinker',
  'takarbete', 'takläggning', 'taktäckning',
  'fönsterbyte', 'fönster', 'dörrbyte', 'dörr',
  'badrumsrenovering', 'våtrumsarbete', 'tätskikt',
  'köksrenovering', 'köksmontage',
  'ventilation', 'golvvärme', 'värmesystem',
  'isolering', 'fasad', 'puts',
  'snickeri', 'byggnadsarbete', 'renovering'
];

function isRotEligible(workItemName: string, description?: string): { eligible: boolean; reasoning: string; source: string } {
  const searchText = `${workItemName} ${description || ''}`.toLowerCase();
  
  // Check against approved ROT work list
  const matchedWork = ROT_APPROVED_WORK.find(work => searchText.includes(work));
  
  if (matchedWork) {
    return {
      eligible: true,
      reasoning: `${workItemName} klassificeras som ROT-arbete (${matchedWork})`,
      source: 'Skatteverket ROT-lista'
    };
  }
  
  // Exclude material costs explicitly
  if (searchText.includes('material') || searchText.includes('inköp') || searchText.includes('leverans')) {
    return {
      eligible: false,
      reasoning: 'Materialkostnad är inte ROT-avdragsgill',
      source: 'Skatteverket ROT-regler'
    };
  }
  
  // Default to not eligible if uncertain
  return {
    eligible: false,
    reasoning: 'Arbetet matchar inte ROT-kriterierna',
    source: 'Skatteverket ROT-lista'
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectDescription, workType, conversationSummary, workItems }: ClassificationRequest = await req.json();

    console.log('🔍 Classifying ROT/RUT for:', { projectDescription, workType, workItems: workItems?.length });

    // If workItems provided, classify each one
    let workItemClassifications;
    if (workItems && workItems.length > 0) {
      workItemClassifications = workItems.map(item => {
        const result = isRotEligible(item.name, item.description);
        return {
          name: item.name,
          rotEligible: result.eligible,
          reasoning: result.reasoning,
          source: result.source
        };
      });
      console.log('📋 Work item classifications:', workItemClassifications);
    }

    const prompt = `Du är en expert på svenska ROT- och RUT-avdrag enligt Skatteverket 2025.

**AKTUELLA REGLER 2025:**
- **ROT-avdrag**: 50% avdrag på arbetskostnaden (max 75,000 kr/person/år) för:
  - Ombyggnad, tillbyggnad, renovering av permanentbostad eller fritidshus
  - Badrum, kök, målning, golvläggning, takarbete
  - VVS och el-installation
  - Fasadrenovering, fönsterbyte
  - Installation av golvvärme, ventilation
  - Byggnation av carport eller garage
  
- **RUT-avdrag**: 50% avdrag på arbetskostnaden (max 75,000 kr/person/år) för:
  - Städning av bostad
  - Trädgårdsarbete (klippning, beskärning, gräsklippning)
  - Flyttjänster
  - Snöskottning
  - Klädvård (tvätt, strykning)
  - IT-support i hemmet

- **INGET AVDRAG** för:
  - Nybyggnation av helt ny byggnad
  - Material och utrustning (endast arbetskostnad är avdragsgill)
  - Arbete på kommersiella fastigheter
  - Trädfällning (endast beskärning är RUT)
  - Dränering och markanläggning

**ROT-UNDANTAG (klassas som "none"):**
❌ Nybyggnation av helt ny byggnad
❌ Fritidshus som INTE är permanentbostad
❌ Arbete i lokaler (kontor, butiker) - endast bostäder
❌ Material som kunden köper själv (endast arbete berättigas)
❌ Byggnation av helt ny pool, garage som inte är i anslutning till befintlig byggnad

**RUT-UNDANTAG (klassas som "none"):**
❌ Trädfällning (endast beskärning av levande träd berättigas)
❌ Trädfällning på ANNANS fastighet
❌ Stubbfräsning (är markarbete, inte trädgårdsskötsel)
❌ Läxhjälp, språkundervisning
❌ Djurskötsel utöver hushållsarbete
❌ Arbete utanför bostaden (t.ex. gräsklippning i en park)
❌ Dränering och markanläggning

**VIKTIGA DETALJER:**
- Stubbfräsning = INGET avdrag (är markarbete, inte trädgårdsskötsel)
- Trädfällning = INGET avdrag (endast beskärning av levande träd är RUT)
- Dränering = INGET avdrag (är markarbete)
- Badrumsrenovering = ROT
- Köksbyte = ROT
- Målning = ROT
- Golvläggning = ROT
- Städning = RUT
- Trädgårdsbeskärning = RUT

**PROJEKTBESKRIVNING:**
${projectDescription}

**ARBETSTYP:**
${workType || 'Ej specificerad'}

**KONVERSATIONSKONTEXT:**
${conversationSummary ? JSON.stringify(conversationSummary, null, 2) : 'Ingen ytterligare kontext'}

**UPPGIFT:**
Klassificera detta arbete som ROT, RUT eller ingen baserat på Skatteverkets regler. 

Svara med JSON:
{
  "deductionType": "rot" | "rut" | "none",
  "confidence": 0-100,
  "reasoning": "Kort förklaring varför (1-2 meningar)",
  "source": "Skatteverket 2025 - [specifik regel]"
}

**EXEMPEL PÅ KORREKT KLASSIFICERING:**

För "Renovera badrum 8 kvm":
{
  "deductionType": "rot",
  "confidence": 95,
  "reasoning": "Badrumsrenovering klassificeras som ROT-arbete enligt Skatteverkets regler för ombyggnad av permanentbostad.",
  "source": "Skatteverket 2025 - ROT-avdrag för ombyggnad"
}

För "Fälla 3 granar":
{
  "deductionType": "none",
  "confidence": 100,
  "reasoning": "Trädfällning berättigar inte till skatteavdrag. Endast beskärning av levande träd är RUT-berättigat.",
  "source": "Skatteverket 2025 - RUT-avdrag för trädgårdsskötsel"
}

För "Bygga nytt garage 50 kvm":
{
  "deductionType": "none",
  "confidence": 95,
  "reasoning": "Nybyggnation av garage klassas inte som ROT enligt Skatteverket. ROT gäller endast renovering, ombyggnad eller underhåll av BEFINTLIG byggnad.",
  "source": "Skatteverket SKV 399"
}

För "Fälla 2 träd i min grannes trädgård":
{
  "deductionType": "none",
  "confidence": 90,
  "reasoning": "RUT-avdrag gäller endast hushållsarbete på den egna fastigheten. Arbete på annans fastighet berättigar inte till avdrag.",
  "source": "Skatteverket SKV 410"
}

**VIKTIGT:** Om deductionType = "none", MÅSTE du ge en tydlig förklaring i reasoning!

Returnera bara JSON, inget annat.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), 
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your Lovable AI workspace.' }), 
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const result: ClassificationResponse = JSON.parse(data.choices[0].message.content);

    console.log('✅ Classification result:', result);

    // Add work item classifications if available
    if (workItemClassifications) {
      result.workItemClassifications = workItemClassifications;
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in classify-rot-rut:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        deductionType: 'rot', // Fallback
        confidence: 50,
        reasoning: 'Kunde inte klassificera automatiskt. Använder ROT som standard.',
        source: 'Fallback'
      }),
      { 
        status: 200, // Return 200 with fallback instead of error
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
