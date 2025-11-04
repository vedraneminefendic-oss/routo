// ============================================
// PROPORTION CHECK - VALIDERA TIDSPROPORTIONER
// ============================================

export interface ProportionCheckResult {
  passed: boolean;
  warnings: string[];
  corrections: Array<{ workItem: string; proportion: number; expected: string }>;
}

/**
 * Validerar att tidsproportionerna för badrumsmoment är realistiska
 * 
 * Förväntat: Rivning 10-20%, VVS 15-25%, El 10-20%, Kakel 25-35%
 */
export function checkBathroomProportions(quote: any): ProportionCheckResult {
  const warnings: string[] = [];
  const corrections: any[] = [];
  
  const totalHours = quote.workItems?.reduce((sum: number, item: any) => sum + item.hours, 0) || 0;
  
  if (totalHours === 0) {
    return { passed: true, warnings: [], corrections: [] };
  }
  
  const proportions = {
    rivning: { actual: 0, expected: '10-20%', min: 0.10, max: 0.20 },
    vvs: { actual: 0, expected: '15-25%', min: 0.15, max: 0.25 },
    el: { actual: 0, expected: '10-20%', min: 0.10, max: 0.20 },
    kakel: { actual: 0, expected: '25-35%', min: 0.25, max: 0.35 }
  };
  
  quote.workItems?.forEach((item: any) => {
    const proportion = item.hours / totalHours;
    const name = item.name.toLowerCase();
    
    // Flagga om något enskilt moment är >50% av totalen
    if (proportion > 0.50) {
      warnings.push(`⚠️ ${item.name} är ${Math.round(proportion * 100)}% av totala tiden (${item.hours.toFixed(1)}h / ${totalHours.toFixed(1)}h) - extremt högt!`);
      corrections.push({ 
        workItem: item.name, 
        proportion: Math.round(proportion * 100), 
        expected: '<50%' 
      });
    }
    
    // Kategorisera arbetsmoment
    if (name.includes('rivning') || name.includes('demontering')) {
      proportions.rivning.actual += proportion;
    } else if (name.includes('vvs') || name.includes('rör') || name.includes('vatten')) {
      proportions.vvs.actual += proportion;
    } else if (name.includes('el') || name.includes('elektr')) {
      proportions.el.actual += proportion;
    } else if (name.includes('kakel') || name.includes('klinker')) {
      proportions.kakel.actual += proportion;
    }
  });
  
  // Validera proportioner mot förväntade intervall
  Object.entries(proportions).forEach(([key, data]) => {
    if (data.actual > 0) {
      const actualPercent = Math.round(data.actual * 100);
      const minPercent = Math.round(data.min * 100);
      const maxPercent = Math.round(data.max * 100);
      
      if (data.actual < data.min || data.actual > data.max) {
        warnings.push(
          `⚠️ ${key.toUpperCase()}: ${actualPercent}% av total tid (förväntat: ${data.expected})`
        );
        corrections.push({
          workItem: key,
          proportion: actualPercent,
          expected: data.expected
        });
      } else {
        console.log(`✅ ${key.toUpperCase()}: ${actualPercent}% (inom intervall ${minPercent}-${maxPercent}%)`);
      }
    }
  });
  
  return {
    passed: warnings.length === 0,
    warnings,
    corrections
  };
}

/**
 * Generisk proportion-check för andra jobbtyper
 */
export function checkGeneralProportions(quote: any, jobType: string): ProportionCheckResult {
  const warnings: string[] = [];
  const corrections: any[] = [];
  
  const totalHours = quote.workItems?.reduce((sum: number, item: any) => sum + item.hours, 0) || 0;
  
  if (totalHours === 0) {
    return { passed: true, warnings: [], corrections: [] };
  }
  
  // Generell regel: Inget enskilt moment ska vara >60% av totalen
  quote.workItems?.forEach((item: any) => {
    const proportion = item.hours / totalHours;
    
    if (proportion > 0.60) {
      warnings.push(
        `⚠️ ${item.name} är ${Math.round(proportion * 100)}% av totala tiden - orimligt högt för ${jobType}`
      );
      corrections.push({ 
        workItem: item.name, 
        proportion: Math.round(proportion * 100), 
        expected: '<60%' 
      });
    }
  });
  
  return {
    passed: warnings.length === 0,
    warnings,
    corrections
  };
}
