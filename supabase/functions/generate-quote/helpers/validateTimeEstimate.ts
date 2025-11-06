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
      // FALLBACK: Assume typical areas to avoid 2.6h problem
      const fallbackAreas: Record<string, number> = {
        'badrum': 4,
        'målning': 10,
        'golv': 8,
        'kök': 8
      };
      
      // Detect job type from work item name
      const itemLower = workItemName.toLowerCase();
      let fallbackArea = 1; // default
      
      if (itemLower.includes('badrum') || itemLower.includes('våtrum')) {
        fallbackArea = fallbackAreas['badrum'];
      } else if (itemLower.includes('målning') || itemLower.includes('måla')) {
        fallbackArea = fallbackAreas['målning'];
      } else if (itemLower.includes('golv')) {
        fallbackArea = fallbackAreas['golv'];
      } else if (itemLower.includes('kök')) {
        fallbackArea = fallbackAreas['kök'];
      }
      
      amount = fallbackArea;
      warnings.push(`⚠️ [ANTAGANDE] Yta saknas för "${workItemName}" - använde ${fallbackArea} kvm. Justera i efterhand.`);
      console.log(`⚠️ Missing area for kvm-based job "${workItemName}" - using fallback: ${fallbackArea} kvm`);
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
  if (estimatedHours < minHours * 0.7) {
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
    
    // ⚠️ FAS 1.1: SAFETY CHECK - Förhindra extrema reduktioner (>70%) som ofta indikerar fel standard
    if (reductionPercent > 70) {
      console.error(`🚨 KRITISK VARNING: ${workItemName}`);
      console.error(`   Original: ${estimatedHours.toFixed(1)}h`);
      console.error(`   Skulle korrigeras till: ${correctedTime.toFixed(1)}h (-${reductionPercent.toFixed(0)}%)`);
      console.error(`   Standard: ${standard?.jobType} (${minHours.toFixed(1)}-${maxHours.toFixed(1)}h för ${amount} ${standard.timePerUnit.unit})`);
      console.error(`   → Detta verkar FEL! Troligen fel standard. Behåller originaltid.`);
      
      // TILLÅT INTE extrema reduktioner - returnera varning men behåll originaltid
      warnings.push(`🚨 KRITISKT: "${workItemName}" har ${estimatedHours.toFixed(1)}h men standard "${standard?.jobType}" är ${minHours.toFixed(1)}-${maxHours.toFixed(1)}h. Detta skulle reducera med ${reductionPercent.toFixed(0)}% vilket indikerar fel standard. Behåller ${estimatedHours.toFixed(1)}h - kontrollera manuellt!`);
      return {
        isRealistic: false,
        warnings,
        suggestedRange: { min: minHours, max: maxHours },
        correctedHours: estimatedHours,  // BEHÅLL original istället för att korrigera fel
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
