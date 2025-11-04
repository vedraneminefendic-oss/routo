import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { JOB_REGISTRY } from '../generate-quote/helpers/jobRegistry.ts';

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
