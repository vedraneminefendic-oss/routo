/**
 * EL-VALIDERING
 */

import { ELECTRICAL_REQUIREMENTS } from './electricalRequirements.ts';

export interface ElectricalValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  missingItems: string[];
  underHouredItems: Array<{ name: string; actual: number; minimum: number }>;
  totalIssue?: { actual: number; minimum: number };
}

export function validateElectricalQuote(quote: any): ElectricalValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingItems: string[] = [];
  const underHouredItems: Array<{ name: string; actual: number; minimum: number }> = [];
  
  console.log(`⚡ Validerar el-offert`);
  
  const workItems = quote.workItems || [];
  const summary = quote.summary || {};
  const totalCost = summary.totalBeforeVAT || 0;
  const materialCost = summary.materialCost || 0;
  
  // ============================================
  // VALIDERING 1: Obligatoriska arbetsmoment
  // ============================================
  for (const required of ELECTRICAL_REQUIREMENTS.minimumWorkItems) {
    const found = workItems.find((item: any) => 
      item.name?.toLowerCase().includes(required.name.toLowerCase().split(' ')[0]) ||
      (required.name.includes('Installation') && (item.name?.toLowerCase().includes('install') || item.name?.toLowerCase().includes('dra'))) ||
      (required.name.includes('Inkoppling') && (item.name?.toLowerCase().includes('koppla') || item.name?.toLowerCase().includes('test')))
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
  const totalHours = workItems.reduce((sum: number, item: any) => sum + (item.hours || 0), 0);
  const calculatedMinCost = Math.max(
    totalHours * ELECTRICAL_REQUIREMENTS.minimumHourlyRate,
    ELECTRICAL_REQUIREMENTS.minimumTotalCost
  );
  
  if (totalCost < calculatedMinCost) {
    errors.push(
      `Total kostnad är för låg: ${totalCost.toFixed(0)} kr för ${totalHours.toFixed(1)}h elarbete. ` +
      `Minimum: ${calculatedMinCost.toFixed(0)} kr`
    );
    console.error(`   ❌ För låg total: ${totalCost.toFixed(0)} kr (minimum: ${calculatedMinCost.toFixed(0)} kr)`);
  } else {
    console.log(`   ✅ Total kostnad OK: ${totalCost.toFixed(0)} kr`);
  }
  
  // ============================================
  // VALIDERING 3: Material
  // ============================================
  if (materialCost < 1000) {
    warnings.push(
      `Materialkostnad är låg: ${materialCost.toFixed(0)} kr. ` +
      `El-material (kablar, uttag, kopplingsdon) kostar vanligtvis minst 1000-3000 kr.`
    );
    console.warn(`   ⚠️ Låg materialkostnad: ${materialCost.toFixed(0)} kr`);
  } else {
    console.log(`   ✅ Material inkluderat: ${materialCost.toFixed(0)} kr`);
  }
  
  // ============================================
  // VALIDERING 4: Timpris (behörig elektriker)
  // ============================================
  const workCost = summary.workCost || 0;
  const effectiveHourlyRate = totalHours > 0 ? workCost / totalHours : 0;
  
  if (effectiveHourlyRate < ELECTRICAL_REQUIREMENTS.minimumHourlyRate) {
    errors.push(
      `Timpris är för lågt: ${effectiveHourlyRate.toFixed(0)} kr/h. ` +
      `Behöriga elektriker tar minst ${ELECTRICAL_REQUIREMENTS.minimumHourlyRate} kr/h.`
    );
    console.error(`   ❌ För lågt timpris: ${effectiveHourlyRate.toFixed(0)} kr/h`);
  } else if (effectiveHourlyRate < ELECTRICAL_REQUIREMENTS.recommendedHourlyRate) {
    warnings.push(
      `Timpris är lågt: ${effectiveHourlyRate.toFixed(0)} kr/h ` +
      `(rekommenderat ${ELECTRICAL_REQUIREMENTS.recommendedHourlyRate} kr/h)`
    );
    console.warn(`   ⚠️ Lågt timpris: ${effectiveHourlyRate.toFixed(0)} kr/h`);
  } else {
    console.log(`   ✅ Timpris OK: ${effectiveHourlyRate.toFixed(0)} kr/h`);
  }
  
  // ============================================
  // SAMMANFATTNING
  // ============================================
  const passed = errors.length === 0;
  
  const totalIssue = totalCost < calculatedMinCost ? {
    actual: totalCost,
    minimum: calculatedMinCost
  } : undefined;
  
  if (passed && warnings.length === 0) {
    console.log('✅ El-validering: Alla krav uppfyllda');
  } else if (passed) {
    console.log(`⚠️ El-validering: OK med ${warnings.length} varningar`);
  } else {
    console.error(`❌ El-validering: ${errors.length} kritiska fel`);
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

export function generateElectricalValidationSummary(validation: ElectricalValidationResult): string {
  const lines: string[] = [];
  
  lines.push('⚡ EL-VALIDERING:');
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
    lines.push('✅ El-offerten uppfyller alla minimikrav');
  } else {
    lines.push('❌ El-offerten måste kompletteras innan den kan godkännas');
  }
  
  return lines.join('\n');
}
