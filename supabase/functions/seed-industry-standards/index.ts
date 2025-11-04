import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// NOTE: Do not import from other functions' folders. Keep data local to this function for bundling.

type UnitType = 'kvm' | 'lm' | 'st' | 'tim';

interface MinimalJobSpec {
  jobType: string;
  category: 'rot' | 'rut' | 'none';
  unitType: UnitType;
  timePerUnit: { simple: number; normal: number; complex: number };
  hourlyRateRange: { min: number; typical: number; max: number };
  materialRatio: number;
  standardWorkItems: Array<{ name: string; mandatory: boolean; typicalHours: number }>;
  applicableDeduction: 'rot' | 'rut' | 'none';
  deductionPercentage: number;
  source: string;
  lastUpdated: string;
}

const JOB_REGISTRY: MinimalJobSpec[] = [
  {
    jobType: 'flyttstadning',
    category: 'rut',
    unitType: 'kvm',
    timePerUnit: { simple: 0.15, normal: 0.18, complex: 0.25 },
    hourlyRateRange: { min: 350, typical: 450, max: 550 },
    materialRatio: 0.0,
    standardWorkItems: [
      { name: 'Grundstädning', mandatory: true, typicalHours: 0.18 }
    ],
    applicableDeduction: 'rut',
    deductionPercentage: 50,
    source: 'Webben (Hemfrid, Byggfakta 2025)',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'badrum',
    category: 'rot',
    unitType: 'kvm',
    timePerUnit: { simple: 35, normal: 50, complex: 70 },
    hourlyRateRange: { min: 550, typical: 750, max: 950 },
    materialRatio: 0.45,
    standardWorkItems: [
      { name: 'Rivning och demontering', mandatory: true, typicalHours: 12 },
      { name: 'Golvarbete och vattenisolering', mandatory: true, typicalHours: 16 },
      { name: 'Kakelsättning', mandatory: true, typicalHours: 24 },
      { name: 'Installation av inredning', mandatory: true, typicalHours: 8 }
    ],
    applicableDeduction: 'rot',
    deductionPercentage: 30,
    source: 'Webben (Byggfakta, Svensk Byggtjänst 2025)',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'kök',
    category: 'rot',
    unitType: 'st',
    timePerUnit: { simple: 80, normal: 120, complex: 180 },
    hourlyRateRange: { min: 600, typical: 750, max: 900 },
    materialRatio: 0.55,
    standardWorkItems: [
      { name: 'Rivning och demontering', mandatory: true, typicalHours: 16 },
      { name: 'El- och rörarbete', mandatory: true, typicalHours: 24 },
      { name: 'Montering köksinredning', mandatory: true, typicalHours: 32 },
      { name: 'Installation vitvaror', mandatory: false, typicalHours: 8 }
    ],
    applicableDeduction: 'rot',
    deductionPercentage: 30,
    source: 'Webben (Byggfakta 2025)',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'målning',
    category: 'rut',
    unitType: 'kvm',
    timePerUnit: { simple: 0.3, normal: 0.4, complex: 0.6 },
    hourlyRateRange: { min: 400, typical: 500, max: 650 },
    materialRatio: 0.2,
    standardWorkItems: [
      { name: 'Förberedelse (spackling, slipning)', mandatory: true, typicalHours: 0.15 },
      { name: 'Målning', mandatory: true, typicalHours: 0.25 }
    ],
    applicableDeduction: 'rut',
    deductionPercentage: 50,
    source: 'Webben (Målarföretagen, Byggfakta 2025)',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'trädgård',
    category: 'rut',
    unitType: 'kvm',
    timePerUnit: { simple: 0.5, normal: 0.8, complex: 1.2 },
    hourlyRateRange: { min: 350, typical: 450, max: 600 },
    materialRatio: 0.25,
    standardWorkItems: [
      { name: 'Markberedning', mandatory: false, typicalHours: 0.3 },
      { name: 'Plantering', mandatory: true, typicalHours: 0.5 }
    ],
    applicableDeduction: 'rut',
    deductionPercentage: 50,
    source: 'Webben (Trädgårdsföretagen 2025)',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'ai_driven',
    category: 'none',
    unitType: 'tim',
    timePerUnit: { simple: 0.8, normal: 1.0, complex: 1.3 },
    hourlyRateRange: { min: 450, typical: 650, max: 850 },
    materialRatio: 0.3,
    standardWorkItems: [],
    applicableDeduction: 'none',
    deductionPercentage: 0,
    source: 'AI-genererad fallback',
    lastUpdated: '2025-11-04'
  }
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('📚 Seeding industry standards to database...');
    
    let successCount = 0;
    let errorCount = 0;

    for (const standard of JOB_REGISTRY) {
      try {
        // Spara tid per enhet
        const { error: timeError } = await supabase
          .from('industry_benchmarks')
          .upsert({
            work_category: standard.jobType,
            metric_type: 'time_per_unit',
            median_value: standard.timePerUnit.normal,
            min_value: standard.timePerUnit.simple,
            max_value: standard.timePerUnit.complex,
            sample_size: 100, // Markera som "verified standard"
            last_updated: standard.lastUpdated
          }, {
            onConflict: 'work_category,metric_type'
          });

        if (timeError) {
          console.error(`❌ Error saving time standard for ${standard.jobType}:`, timeError);
          errorCount++;
          continue;
        }

        // Spara timpris
        const { error: rateError } = await supabase
          .from('industry_benchmarks')
          .upsert({
            work_category: standard.jobType,
            metric_type: 'hourly_rate',
            median_value: standard.hourlyRateRange.typical,
            min_value: standard.hourlyRateRange.min,
            max_value: standard.hourlyRateRange.max,
            sample_size: 100,
            last_updated: standard.lastUpdated
          }, {
            onConflict: 'work_category,metric_type'
          });

        if (rateError) {
          console.error(`❌ Error saving rate standard for ${standard.jobType}:`, rateError);
          errorCount++;
          continue;
        }

        // Spara material ratio (om det finns)
        if (standard.materialRatio > 0) {
          const { error: materialError } = await supabase
            .from('industry_benchmarks')
            .upsert({
              work_category: standard.jobType,
              metric_type: 'material_ratio',
              median_value: standard.materialRatio,
              min_value: standard.materialRatio * 0.8,
              max_value: standard.materialRatio * 1.2,
              sample_size: 100,
              last_updated: standard.lastUpdated
            }, {
              onConflict: 'work_category,metric_type'
            });

          if (materialError) {
            console.error(`❌ Error saving material ratio for ${standard.jobType}:`, materialError);
            errorCount++;
            continue;
          }
        }

        // Spara metadata till industry_knowledge
        const { error: knowledgeError } = await supabase
          .from('industry_knowledge')
          .upsert({
            category: 'standard_work_items',
            project_type: standard.jobType,
            content: {
              category: standard.category,
              unitType: standard.unitType,
              timePerUnit: standard.timePerUnit,
              hourlyRateRange: standard.hourlyRateRange,
              materialRatio: standard.materialRatio,
              standardWorkItems: standard.standardWorkItems,
              applicableDeduction: standard.applicableDeduction,
              deductionPercentage: standard.deductionPercentage
            },
            source: standard.source,
            last_updated: standard.lastUpdated
          }, {
            onConflict: 'category,project_type'
          });

        if (knowledgeError) {
          console.error(`❌ Error saving knowledge for ${standard.jobType}:`, knowledgeError);
          errorCount++;
          continue;
        }

        console.log(`✅ Seeded ${standard.jobType} (${standard.category})`);
        successCount++;

      } catch (error) {
        console.error(`❌ Error processing ${standard.jobType}:`, error);
        errorCount++;
      }
    }

    console.log(`✅ Industry standards seeding complete. Success: ${successCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        total: JOB_REGISTRY.length,
        succeeded: successCount,
        failed: errorCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error seeding industry standards:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
