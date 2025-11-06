// ============================================
// TIME ESTIMATE VALIDATION
// ============================================

import { JobStandard, findStandard } from './industryStandards.ts';

export interface TimeValidationResult {
  isRealistic: boolean;
  warning?: string;
  warnings?: string[];
  suggestedRange: { min: number; max: number } | null;
  correctedHours?: number;
  standard?: JobStandard | null;
}

/**
 * Validerar att tidsåtgången är realistisk baserat på branschstandarder
 */
export function validateTimeEstimate(
  workItemName: string,
  estimatedHours: number,
  measurements: { area?: number; rooms?: number; quantity?: number; length?: number },
  standard?: JobStandard,
  context?: { jobType?: string }  // NY PARAMETER för kontext-medveten validering
): TimeValidationResult {
  
  // If no standard provided, try to find one based on context
  if (!standard) {
    standard = findStandard(workItemName, context) || undefined;
  }
  
  // If still no standard found, return pass (but with warning if area is missing for kvm-based jobs)
  if (!standard) {
    const warnings: string[] = [];
    
    // Check if this looks like a kvm-based job but area is missing
    const kvmKeywords = ['kakel', 'målning', 'golv', 'tak', 'vägg'];
    if (kvmKeywords.some(kw => workItemName.toLowerCase().includes(kw)) && !measurements.area) {
      warnings.push(`⚠️ Yta saknas för "${workItemName}" - kan inte validera tidestimatet`);
    }
    
    return {
      isRealistic: true,
      warnings,
      suggestedRange: null,
      correctedHours: estimatedHours,
      standard: null
    };
  }
  
  // Calculate amount based on standard unit with fallback assumptions
  let amount = 1;
  const warnings: string[] = [];
  
  if (standard.timePerUnit.unit === 'kvm') {
    if (measurements.area) {
      amount = measurements.area;
    } else {
      // CONTEXT-BASERAD FALLBACK: Använd projektkontext först, sedan workItemName
      const job = (context?.jobType || '').toLowerCase();
      let fallbackArea = 1; // default
      
      // Prioritera projektkontext
      if (job.includes('badrum')) {
        fallbackArea = 4;
      } else if (job.includes('kök')) {
        fallbackArea = 8;
      } else if (job.includes('målning')) {
        fallbackArea = 50;
      } else if (job.includes('fasad')) {
        fallbackArea = 100;
      } else {
        // Fallback till workItemName om kontext inte hjälper
        const itemLower = workItemName.toLowerCase();
        if (itemLower.includes('badrum') || itemLower.includes('våtrum')) {
          fallbackArea = 4;
        } else if (itemLower.includes('målning') || itemLower.includes('måla')) {
          fallbackArea = 50;
        } else if (itemLower.includes('kök')) {
          fallbackArea = 8;
        } else if (itemLower.includes('fasad')) {
          fallbackArea = 100;
        }
      }
      
      amount = fallbackArea;
      warnings.push(`⚠️ [ANTAGANDE] Område saknas – använde ${amount} kvm baserat på projektkontext '${job || 'okänd'}'. Justera i efterhand.`);
      console.log(`🧭 Context fallback area=${amount} for "${workItemName}" (context=${job})`);
    }
  } else if (standard.timePerUnit.unit === 'rum' && measurements.rooms) {
    amount = measurements.rooms;
  } else if (standard.timePerUnit.unit === 'styck' && measurements.quantity) {
    amount = measurements.quantity;
  } else if (standard.timePerUnit.unit === 'meter' && measurements.length) {
    amount = measurements.length;
  }
  
  const typicalHours = standard.timePerUnit.typical * amount;
  const minHours = standard.timePerUnit.min * amount;
  const maxHours = standard.timePerUnit.max * amount;
  
  // KRITISKT SANITY CHECK: Flagga om något moment är >50h för badrum
  if (estimatedHours > 50 && workItemName.toLowerCase().includes('badrum')) {
    warnings.push(`🚨 KRITISK: ${estimatedHours.toFixed(1)}h är orimligt högt för ett badrumsmoment "${workItemName}"! Detta är troligen ett fel i beräkningen.`);
    return {
      isRealistic: false,
      warnings,
      suggestedRange: { min: minHours, max: maxHours },
      correctedHours: typicalHours,
      standard
    };
  }
  
  // Om estimerad tid är för låg - KORRIGERA TILL MINTIME (inte typical)
  // För badrum: strängare gräns (< minHours istället för < minHours * 0.7)
  const job = (context?.jobType || '').toLowerCase();
  const isBathroom = job.includes('badrum');
  const threshold = isBathroom ? minHours : minHours * 0.7;
  
  if (estimatedHours < threshold) {
    warnings.push(`⚠️ VARNING: ${estimatedHours.toFixed(1)}h är för lågt för "${workItemName}"! Branschstandard: ${minHours.toFixed(1)}-${maxHours.toFixed(1)}h för ${amount} ${standard.timePerUnit.unit}. Justerat till minimum ${minHours.toFixed(1)}h.`);
    return {
      isRealistic: false,
      warnings,
      suggestedRange: { min: minHours, max: maxHours },
      correctedHours: Math.max(estimatedHours, minHours),  // Aldrig under minTime
      standard
    };
  }
  
  // Om estimerad tid är för hög - KORRIGERA TILL MAXTIME (inte typical)
  if (estimatedHours > maxHours * 1.3) {
    const correctedTime = Math.min(estimatedHours, maxHours);
    const reductionPercent = ((estimatedHours - correctedTime) / estimatedHours) * 100;
    
    // Check if deviation is >70% - likely wrong standard but ALWAYS apply correction with warning
    if (reductionPercent > 70) {
      console.warn(`⚠️ STOR AVVIKELSE MEN KORRIGERAR ÄNDÅ: ${workItemName}`);
      console.warn(`   Original: ${estimatedHours.toFixed(1)}h`);
      console.warn(`   Korrigerad: ${correctedTime.toFixed(1)}h (-${reductionPercent.toFixed(0)}%)`);
      console.warn(`   Standard: ${standard?.jobType} (${minHours.toFixed(1)}-${maxHours.toFixed(1)}h för ${amount} ${standard.timePerUnit.unit})`);
      
      warnings.push(
        `⚠️ STOR AVVIKELSE: "${workItemName}" har ${estimatedHours.toFixed(1)}h men standard "${standard?.jobType}" är ${minHours.toFixed(1)}-${maxHours.toFixed(1)}h. ` +
        `Korrigerar till ${maxHours.toFixed(1)}h. Kontrollera att rätt standard används!`
      );
      
      return {
        isRealistic: false,
        warnings,
        suggestedRange: { min: minHours, max: maxHours },
        correctedHours: maxHours, // Use max of standard range
        standard
      };
    }
    
    warnings.push(`⚠️ VARNING: ${estimatedHours.toFixed(1)}h är för högt för "${workItemName}"! Branschstandard: ${minHours.toFixed(1)}-${maxHours.toFixed(1)}h för ${amount} ${standard.timePerUnit.unit}. Justerat till maximum ${maxHours.toFixed(1)}h.`);
    return {
      isRealistic: false,
      warnings,
      suggestedRange: { min: minHours, max: maxHours },
      correctedHours: correctedTime,
      standard
    };
  }
  
  return { 
    isRealistic: true,
    warnings,
    suggestedRange: { min: minHours, max: maxHours },
    correctedHours: estimatedHours,
    standard
  };
}

/**
 * Validerar alla arbetsmoment i en offert
 */
export function validateQuoteTimeEstimates(
  quote: any,
  measurements: { area?: number; rooms?: number; quantity?: number; length?: number },
  projectType?: string
): {
  isValid: boolean;
  warnings: string[];
  corrections: Array<{ workItem: string; originalHours: number; suggestedHours: number }>;
} {
  const warnings: string[] = [];
  const corrections: Array<{ workItem: string; originalHours: number; suggestedHours: number }> = [];
  
  if (!quote.workItems || quote.workItems.length === 0) {
    return { isValid: true, warnings: [], corrections: [] };
  }
  
  for (const item of quote.workItems || []) {
    // FAS 1: Normalisera fält - läs från både name/workItemName och hours/estimatedHours
    const workItemName = item.workItemName || item.name || '';
    const estimatedHours = Number(item.estimatedHours ?? item.hours ?? 0);
    
    const validation = validateTimeEstimate(
      workItemName,
      estimatedHours,
      measurements,
      undefined, // standard will be found automatically
      { jobType: projectType } // pass context
    );
    
    if (validation.warnings && validation.warnings.length > 0) {
      warnings.push(...validation.warnings);
    }
    
    if (!validation.isRealistic && validation.correctedHours && validation.correctedHours !== estimatedHours) {
      corrections.push({
        workItem: workItemName,
        originalHours: estimatedHours,
        suggestedHours: validation.correctedHours
      });
    }
  }
  
  return {
    isValid: warnings.length === 0,
    warnings,
    corrections
  };
}

/**
 * Auto-korrigerar orealistiska tidsestimat
 */
export function autoCorrectTimeEstimates(
  quote: any,
  measurements: { area?: number; rooms?: number; quantity?: number; length?: number },
  applyCorrections: boolean = true,
  projectType?: string
): {
  corrected: boolean;
  corrections: Array<{ workItem: string; before: number; after: number }>;
} {
  const corrections: Array<{ workItem: string; before: number; after: number }> = [];
  
  if (!quote.workItems || quote.workItems.length === 0) {
    return { corrected: false, corrections: [] };
  }
  
  for (const item of quote.workItems || []) {
    // FAS 1: Normalisera fält - läs från både name/workItemName och hours/estimatedHours
    const workItemName = item.workItemName || item.name || '';
    const estimatedHours = Number(item.estimatedHours ?? item.hours ?? 0);
    
    const validation = validateTimeEstimate(
      workItemName,
      estimatedHours,
      measurements,
      undefined,
      { jobType: projectType }
    );
    
    if (!validation.isRealistic && validation.correctedHours && validation.correctedHours !== estimatedHours) {
      const before = estimatedHours;
      const after = validation.correctedHours;
      
      if (applyCorrections) {
        // FAS 1: Skriv tillbaka till BÅDA fälten för att säkerställa att UI och totals använder rätt värde
        item.hours = after;
        item.estimatedHours = after;
        
        // KRITISKT: Räkna om subtotal baserat på korrigerade timmar
        if (item.hourlyRate && item.hourlyRate > 0) {
          item.subtotal = Math.round(after * item.hourlyRate);
          console.log(`  💰 Uppdaterade subtotal för "${workItemName}": ${after}h × ${item.hourlyRate} kr/h = ${item.subtotal} kr`);
        }
        
        // Update reasoning to explain the correction with details
        const direction = after > before ? 'ökad' : 'minskad';
        const changePercent = Math.round(Math.abs((after - before) / before * 100));
        const standardName = validation.standard?.jobType || 'generell standard';
        
        item.reasoning = `[AUTO-KORRIGERING] Original: ${before}h → Korrigerad: ${after}h (${direction} ${changePercent}%) baserat på branschstandard "${standardName}". ${item.reasoning || ''}`;
      }
      
      corrections.push({
        workItem: workItemName,
        before,
        after
      });
    }
  }
  
  return {
    corrected: corrections.length > 0,
    corrections
  };
}
