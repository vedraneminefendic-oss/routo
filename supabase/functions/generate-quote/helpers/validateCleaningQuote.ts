/**
 * STÄDNINGSVALIDERING
 * 
 * Validerar offerter för städjobb (vanlig städning, flyttstädning, etc.)
 */

import { CLEANING_REQUIREMENTS } from './cleaningRequirements.ts';

export interface CleaningValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  missingItems: string[];
  underHouredItems: Array<{ name: string; actual: number; minimum: number }>;
  totalIssue?: { actual: number; minimum: number; recommended: number };
}

export function validateCleaningQuote(quote: any, area: number): CleaningValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingItems: string[] = [];
  const underHouredItems: Array<{ name: string; actual: number; minimum: number }> = [];
  
  console.log(`🧹 Validerar städningsoffert för ${area} kvm`);
  
  const workItems = quote.workItems || [];
  const summary = quote.summary || {};
  const totalCost = summary.totalBeforeVAT || 0;
  const materialCost = summary.materialCost || 0;
  
  // ============================================
  // VALIDERING 1: Obligatoriska arbetsmoment
  // ============================================
  for (const required of CLEANING_REQUIREMENTS.minimumWorkItems) {
    if (required.optional) continue; // Skippa valfria moment
    
    const found = workItems.find((item: any) => 
      item.name?.toLowerCase().includes(required.name.toLowerCase()) ||
      item.name?.toLowerCase().includes(required.description.toLowerCase().split(' ')[0])
    );
    
    if (!found) {
      missingItems.push(required.name);
      errors.push(`Saknar obligatoriskt moment: "${required.name}" (minst ${required.minHours}h)`);
      console.error(`   ❌ Saknas: ${required.name}`);
    } else if (found.hours < required.minHours) {
      underHouredItems.push({
        name: required.name,
        actual: found.hours,
        minimum: required.minHours
      });
      warnings.push(
        `"${required.name}" har för få timmar: ${found.hours.toFixed(1)}h ` +
        `(minimum ${required.minHours}h)`
      );
      console.warn(`   ⚠️ För få timmar: ${required.name} (${found.hours}h < ${required.minHours}h)`);
    } else {
      console.log(`   ✅ ${required.name}: ${found.hours.toFixed(1)}h`);
    }
  }
  
  // ============================================
  // VALIDERING 2: Total kostnad
  // ============================================
  const minTotalCost = area * CLEANING_REQUIREMENTS.minimumCostPerSqm;
  const recTotalCost = area * CLEANING_REQUIREMENTS.recommendedCostPerSqm;
  
  if (totalCost < minTotalCost) {
    errors.push(
      `Total kostnad är för låg: ${totalCost.toFixed(0)} kr för ${area} kvm. ` +
      `Minimum: ${minTotalCost.toFixed(0)} kr (${CLEANING_REQUIREMENTS.minimumCostPerSqm} kr/kvm)`
    );
    console.error(`   ❌ För låg total: ${totalCost.toFixed(0)} kr (minimum: ${minTotalCost.toFixed(0)} kr)`);
  } else if (totalCost < recTotalCost * 0.7) {
    warnings.push(
      `Total kostnad är låg: ${totalCost.toFixed(0)} kr för ${area} kvm. ` +
      `Rekommenderat för flyttstädning: ${recTotalCost.toFixed(0)} kr`
    );
    console.warn(`   ⚠️ Låg total: ${totalCost.toFixed(0)} kr (rec: ${recTotalCost.toFixed(0)} kr)`);
  } else {
    console.log(`   ✅ Total kostnad OK: ${totalCost.toFixed(0)} kr`);
  }
  
  // ============================================
  // VALIDERING 3: Material
  // ============================================
  const hasMaterial = materialCost > 0 || workItems.some((item: any) => 
    item.name?.toLowerCase().includes('städmaterial') ||
    item.name?.toLowerCase().includes('rengöringsmedel')
  );
  
  if (!hasMaterial) {
    warnings.push('Ingen materialkostnad för städmaterial/rengöringsmedel');
    console.warn(`   ⚠️ Saknar material`);
  } else {
    console.log(`   ✅ Material inkluderat: ${materialCost.toFixed(0)} kr`);
  }
  
  // ============================================
  // VALIDERING 4: Timpris
  // ============================================
  const totalHours = workItems.reduce((sum: number, item: any) => sum + (item.hours || 0), 0);
  const workCost = summary.workCost || 0;
  const effectiveHourlyRate = totalHours > 0 ? workCost / totalHours : 0;
  
  if (effectiveHourlyRate < CLEANING_REQUIREMENTS.minimumHourlyRate) {
    warnings.push(
      `Timpris är lågt: ${effectiveHourlyRate.toFixed(0)} kr/h ` +
      `(minimum ${CLEANING_REQUIREMENTS.minimumHourlyRate} kr/h)`
    );
    console.warn(`   ⚠️ Lågt timpris: ${effectiveHourlyRate.toFixed(0)} kr/h`);
  } else {
    console.log(`   ✅ Timpris OK: ${effectiveHourlyRate.toFixed(0)} kr/h`);
  }
  
  // ============================================
  // SAMMANFATTNING
  // ============================================
  const passed = errors.length === 0;
  
  const totalIssue = totalCost < minTotalCost ? {
    actual: totalCost,
    minimum: minTotalCost,
    recommended: recTotalCost
  } : undefined;
  
  if (passed && warnings.length === 0) {
    console.log('✅ Städningsvalidering: Alla krav uppfyllda');
  } else if (passed) {
    console.log(`⚠️ Städningsvalidering: OK med ${warnings.length} varningar`);
  } else {
    console.error(`❌ Städningsvalidering: ${errors.length} kritiska fel`);
  }
  
  return {
    passed,
    errors,
    warnings,
    missingItems,
    underHouredItems,
    totalIssue
  };
}

export function generateCleaningValidationSummary(validation: CleaningValidationResult): string {
  const lines: string[] = [];
  
  lines.push('🧹 STÄDNINGSVALIDERING:');
  lines.push('');
  
  if (validation.missingItems.length > 0) {
    lines.push('❌ SAKNADE OBLIGATORISKA MOMENT:');
    validation.missingItems.forEach(item => lines.push(`   • ${item}`));
    lines.push('');
  }
  
  if (validation.underHouredItems.length > 0) {
    lines.push('⚠️ MOMENT MED FÖR FÅ TIMMAR:');
    validation.underHouredItems.forEach(item => 
      lines.push(`   • ${item.name}: ${item.actual.toFixed(1)}h (minimum ${item.minimum}h)`)
    );
    lines.push('');
  }
  
  if (validation.totalIssue) {
    lines.push('❌ TOTALPRIS FÖR LÅGT:');
    lines.push(`   • Aktuellt: ${validation.totalIssue.actual.toFixed(0)} kr`);
    lines.push(`   • Minimum: ${validation.totalIssue.minimum.toFixed(0)} kr`);
    lines.push(`   • Rekommenderat: ${validation.totalIssue.recommended.toFixed(0)} kr`);
    lines.push('');
  }
  
  if (validation.errors.length > 0) {
    lines.push('❌ FEL:');
    validation.errors.forEach(err => lines.push(`   • ${err}`));
    lines.push('');
  }
  
  if (validation.warnings.length > 0) {
    lines.push('⚠️ VARNINGAR:');
    validation.warnings.forEach(warn => lines.push(`   • ${warn}`));
    lines.push('');
  }
  
  if (validation.passed) {
    lines.push('✅ Städningsofferten uppfyller alla minimikrav');
  } else {
    lines.push('❌ Städningsofferten måste kompletteras innan den kan godkännas');
  }
  
  return lines.join('\n');
}
