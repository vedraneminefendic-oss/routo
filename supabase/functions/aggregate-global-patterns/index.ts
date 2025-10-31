import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📊 Starting global pattern aggregation...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 1. Hämta alla accepterade mönster de senaste 90 dagarna
    const { data: patterns, error } = await supabase
      .from('accepted_work_patterns')
      .select('*')
      .eq('customer_accepted', true)
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());
    
    if (error) throw error;
    
    console.log(`Found ${patterns?.length || 0} accepted patterns`);
    
    if (!patterns || patterns.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No patterns to aggregate yet',
          patternsAnalyzed: 0,
          standardWorkItems: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // 2. Gruppera per arbetstyp
    const grouped: Record<string, { 
      count: number; 
      avgConfidence: number; 
      users: Set<string>;
      totalHours: number;
      totalCost: number;
    }> = {};
    
    for (const pattern of patterns) {
      const key = pattern.work_item_name.toLowerCase().trim();
      
      if (!grouped[key]) {
        grouped[key] = { 
          count: 0, 
          avgConfidence: 0, 
          users: new Set(),
          totalHours: 0,
          totalCost: 0
        };
      }
      
      grouped[key].count++;
      grouped[key].avgConfidence += pattern.confidence_score || 0.8;
      grouped[key].users.add(pattern.user_id);
      grouped[key].totalHours += pattern.hours_spent || 0;
      grouped[key].totalCost += pattern.subtotal || 0;
    }
    
    // 3. Uppdatera industry_knowledge för populära moment
    let updatedCount = 0;
    
    for (const [workItem, stats] of Object.entries(grouped)) {
      // Kräv minst 3 OLIKA användare (inte bara 3 offerter från samma användare)
      if (stats.users.size >= 3) {
        const avgHours = stats.totalHours / stats.count;
        const avgCost = stats.totalCost / stats.count;
        const avgConfidence = stats.avgConfidence / stats.count;
        
        await supabase.from('industry_knowledge').upsert({
          category: 'standard_work_items',
          project_type: 'all',
          content: {
            workItem,
            acceptanceRate: stats.count,
            uniqueUsers: stats.users.size,
            avgConfidence,
            avgHours,
            avgCost
          },
          source: 'aggregated_user_data',
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'category,project_type'
        });
        
        updatedCount++;
        console.log(`✅ Learned: "${workItem}" is standard (${stats.users.size} users, ${stats.count} acceptances, ~${Math.round(avgHours)}h, ~${Math.round(avgCost)} kr)`);
      }
    }
    
    console.log(`📊 Aggregation complete: ${updatedCount} standard work items identified`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        patternsAnalyzed: patterns.length,
        standardWorkItems: updatedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in aggregate-global-patterns:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
