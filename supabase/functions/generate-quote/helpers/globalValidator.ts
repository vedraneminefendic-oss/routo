// ============================================================================
// GLOBAL VALIDATOR - FAS 0: TOTAL-GUARD & AUTO-KORRIGERING
// ============================================================================

import { JobDefinition } from './jobRegistry.ts';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  autoCorrections: Array<{
    field: string;
    before: any;
    after: any;
    reason: string;
  }>;
}

/**
 * KRITISK: Validerar HELA offerten mot JobDefinition + benchmarks
 * FAS 0: Total-guard per enhet
 */
export function validateQuote(
  quote: any,
  jobDef: JobDefinition,
  benchmarks: any[]
): ValidationResult {
  
  console.log('🔍 GLOBAL VALIDATOR: Starting validation...', {
    jobType: jobDef.jobType,
    totalCost: quote.summary?.totalBeforeVAT
  });
  
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  const autoCorrections: any[] = [];
  
  // 1. TOTAL-GUARD: Pris per enhet
  const totalCost = quote.summary?.totalBeforeVAT || 0;
  const unitQty = quote.measurements?.area || quote.measurements?.quantity || 1;
  const costPerUnit = totalCost / unitQty;
  
  console.log('📊 Checking price per unit:', {
    totalCost,
    unitQty,
    costPerUnit: costPerUnit.toFixed(0),
    unitType: jobDef.unitType
  });
  
  // Hämta median från benchmarks
  const medianCostPerUnit = benchmarks.find(b => 
    b.work_category === jobDef.jobType && b.metric_type === 'price_per_unit'
  )?.median_value || (jobDef.hourlyRateRange.typical * jobDef.timePerUnit.normal);
  
  // KRITISK: Flagga om >25% avvikelse från median
  const deviation = Math.abs(costPerUnit - medianCostPerUnit) / medianCostPerUnit;
  
  if (deviation > 0.25) {
    const isOverpriced = costPerUnit > medianCostPerUnit;
    warnings.push(
      `⚠️ TOTAL-GUARD: Pris per ${jobDef.unitType} (${costPerUnit.toFixed(0)} kr) avviker ${(deviation * 100).toFixed(0)}% från median (${medianCostPerUnit.toFixed(0)} kr). ${isOverpriced ? 'För högt' : 'För lågt'}!`
    );
    console.log('⚠️ Price deviation detected:', {
      costPerUnit,
      medianCostPerUnit,
      deviation: (deviation * 100).toFixed(0) + '%'
    });
  }
  
  // 2. Validera mot priceBounds
  if (costPerUnit < jobDef.priceBounds.minPerUnit) {
    errors.push(
      `❌ Pris per ${jobDef.unitType} (${costPerUnit.toFixed(0)} kr) är under minimum (${jobDef.priceBounds.minPerUnit} kr). Orealistiskt lågt!`
    );
  }
  
  if (costPerUnit > jobDef.priceBounds.maxPerUnit) {
    warnings.push(
      `⚠️ Pris per ${jobDef.unitType} (${costPerUnit.toFixed(0)} kr) överskrider maximum (${jobDef.priceBounds.maxPerUnit} kr). Kontrollera beräkningen!`
    );
  }
  
  // 3. Total arbetstid (för låg)
  const totalHours = quote.workItems?.reduce((sum: number, item: any) => sum + (item.hours || 0), 0) || 0;
  const expectedMinHours = unitQty * jobDef.timePerUnit.simple;
  
  console.log('⏱️ Checking total work hours:', {
    totalHours: totalHours.toFixed(1),
    expectedMinHours: expectedMinHours.toFixed(1)
  });
  
  if (totalHours < expectedMinHours * 0.7) {
    errors.push(
      `❌ Total arbetstid (${totalHours.toFixed(1)}h) är orealistiskt låg för ${unitQty} ${jobDef.unitType}. Minimum: ${expectedMinHours.toFixed(1)}h.`
    );
  }
  
  // 4. ROT/RUT-klassning
  const currentDeductionType = quote.deduction?.type || quote.deductionType || 'none';
  
  if (jobDef.applicableDeduction !== 'none' && currentDeductionType !== jobDef.applicableDeduction) {
    errors.push(
      `❌ Felaktig avdragstyp: ${jobDef.jobType} kvalificerar för ${jobDef.applicableDeduction}, inte ${currentDeductionType}!`
    );
    
    // AUTO-FIX
    autoCorrections.push({
      field: 'deduction.type',
      before: currentDeductionType,
      after: jobDef.applicableDeduction,
      reason: `Auto-korrigerad till korrekt avdragstyp enligt ${jobDef.source}`
    });
    
    console.log('🔧 Auto-correction: ROT/RUT type', {
      before: currentDeductionType,
      after: jobDef.applicableDeduction
    });
  }
  
  // 5. Kontrollera korrekt procentsats för ROT/RUT
  const currentPercentage = quote.deduction?.percentage;
  if (jobDef.applicableDeduction !== 'none' && currentPercentage !== jobDef.deductionPercentage) {
    warnings.push(
      `⚠️ Felaktig avdragsprocent: ${jobDef.applicableDeduction.toUpperCase()} är ${jobDef.deductionPercentage}%, inte ${currentPercentage}%`
    );
    
    autoCorrections.push({
      field: 'deduction.percentage',
      before: currentPercentage,
      after: jobDef.deductionPercentage,
      reason: `ROT = 30%, RUT = 50% (enligt Skatteverket)`
    });
  }
  
  // 6. Saknade obligatoriska moment
  const missingMandatory = jobDef.standardWorkItems
    .filter(item => item.mandatory)
    .filter(item => !quote.workItems?.some((w: any) => 
      w.name.toLowerCase().includes(item.name.toLowerCase())
    ));
  
  if (missingMandatory.length > 0) {
    suggestions.push(
      `💡 Överväg att lägga till obligatoriska moment: ${missingMandatory.map(m => m.name).join(', ')}`
    );
  }
  
  const result = {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions,
    autoCorrections
  };
  
  console.log('✅ GLOBAL VALIDATOR: Validation complete', {
    isValid: result.isValid,
    errors: errors.length,
    warnings: warnings.length,
    suggestions: suggestions.length,
    autoCorrections: autoCorrections.length
  });
  
  return result;
}

/**
 * Applicera auto-korrigeringar
 */
export function applyAutoCorrections(
  quote: any,
  corrections: ValidationResult['autoCorrections']
): any {
  const correctedQuote = JSON.parse(JSON.stringify(quote));
  
  corrections.forEach(corr => {
    const path = corr.field.split('.');
    let obj = correctedQuote;
    
    // Navigate to the correct nested object
    for (let i = 0; i < path.length - 1; i++) {
      if (!obj[path[i]]) {
        obj[path[i]] = {};
      }
      obj = obj[path[i]];
    }
    
    obj[path[path.length - 1]] = corr.after;
    
    console.log(`🔧 AUTO-FIX: ${corr.field} = ${corr.before} → ${corr.after} (${corr.reason})`);
  });
  
  return correctedQuote;
}
