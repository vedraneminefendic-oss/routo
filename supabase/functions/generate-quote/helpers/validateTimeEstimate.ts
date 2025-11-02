// ============================================
// TIME ESTIMATE VALIDATION
// ============================================

import { JobStandard, findStandard } from './industryStandards.ts';

export interface TimeValidationResult {
  isRealistic: boolean;
  warning?: string;
  suggestedRange: { min: number; max: number };
  correctedTime?: number;
}

/**
 * Validerar att tidsåtgången är realistisk baserat på branschstandarder
 */
export function validateTimeEstimate(
  workItemName: string,
  estimatedHours: number,
  measurements: { area?: number; rooms?: number; quantity?: number; length?: number },
  standard?: JobStandard
): TimeValidationResult {
  
  // Om ingen standard finns, antag att det är OK
  if (!standard) {
    return { 
      isRealistic: true, 
      suggestedRange: { min: 0, max: 999 } 
    };
  }
  
  // Beräkna förväntad tid baserat på mått
  const unit = standard.timePerUnit.unit;
  let amount = 1;
  
  if (unit === 'kvm' && measurements.area) {
    amount = measurements.area;
  } else if (unit === 'rum' && measurements.rooms) {
    amount = measurements.rooms;
  } else if (unit === 'styck' && measurements.quantity) {
    amount = measurements.quantity;
  } else if (unit === 'meter' && measurements.length) {
    amount = measurements.length;
  }
  
  const minTime = amount * standard.timePerUnit.min;
  const maxTime = amount * standard.timePerUnit.max * 1.3; // 30% marginal
  const typicalTime = amount * standard.timePerUnit.typical;
  
  // Om estimerad tid är för låg
  if (estimatedHours < minTime * 0.7) {
    return {
      isRealistic: false,
      warning: `⚠️ VARNING: ${estimatedHours.toFixed(1)}h är för lågt för "${workItemName}"! Branschstandard: ${minTime.toFixed(1)}-${maxTime.toFixed(1)}h för ${amount} ${unit}.`,
      suggestedRange: { min: minTime, max: maxTime },
      correctedTime: typicalTime
    };
  }
  
  // Om estimerad tid är för hög
  if (estimatedHours > maxTime) {
    return {
      isRealistic: false,
      warning: `⚠️ VARNING: ${estimatedHours.toFixed(1)}h är för högt för "${workItemName}"! Branschstandard: ${minTime.toFixed(1)}-${maxTime.toFixed(1)}h för ${amount} ${unit}.`,
      suggestedRange: { min: minTime, max: maxTime },
      correctedTime: typicalTime
    };
  }
  
  return { 
    isRealistic: true, 
    suggestedRange: { min: minTime, max: maxTime } 
  };
}

/**
 * Validerar alla arbetsmoment i en offert
 */
export function validateQuoteTimeEstimates(
  quote: any,
  measurements: { area?: number; rooms?: number; quantity?: number; length?: number }
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
  
  for (const workItem of quote.workItems) {
    const standard = findStandard(workItem.name);
    
    if (!standard) {
      console.log(`ℹ️ No standard found for work item: ${workItem.name}`);
      continue;
    }
    
    const validation = validateTimeEstimate(
      workItem.name,
      workItem.hours,
      measurements,
      standard
    );
    
    if (!validation.isRealistic) {
      warnings.push(validation.warning!);
      
      if (validation.correctedTime) {
        corrections.push({
          workItem: workItem.name,
          originalHours: workItem.hours,
          suggestedHours: validation.correctedTime
        });
      }
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
  applyCorrections: boolean = true
): {
  corrected: boolean;
  corrections: Array<{ workItem: string; before: number; after: number }>;
} {
  const corrections: Array<{ workItem: string; before: number; after: number }> = [];
  
  if (!quote.workItems || quote.workItems.length === 0) {
    return { corrected: false, corrections: [] };
  }
  
  for (let i = 0; i < quote.workItems.length; i++) {
    const workItem = quote.workItems[i];
    const standard = findStandard(workItem.name);
    
    if (!standard) continue;
    
    const validation = validateTimeEstimate(
      workItem.name,
      workItem.hours,
      measurements,
      standard
    );
    
    if (!validation.isRealistic && validation.correctedTime) {
      const before = workItem.hours;
      const after = validation.correctedTime;
      
      if (applyCorrections) {
        // Uppdatera offerten
        quote.workItems[i].hours = after;
        quote.workItems[i].subtotal = after * workItem.hourlyRate;
        
        // Lägg till notering om auto-korrigering
        quote.workItems[i].reasoning = (workItem.reasoning || '') + 
          ` [AUTO-KORRIGERAD: Ursprunglig tid ${before.toFixed(1)}h överskred branschstandard]`;
      }
      
      corrections.push({
        workItem: workItem.name,
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
