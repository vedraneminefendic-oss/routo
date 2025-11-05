/**
 * TRÄDGÅRDSVALIDERING (främst trädfällning)
 */

import { GARDENING_REQUIREMENTS } from './gardeningRequirements.ts';

export interface GardeningValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  missingItems: string[];
  underHouredItems: Array<{ name: string; actual: number; minimum: number }>;
  totalIssue?: { actual: number; minimum: number; recommended: number };
}

export function validateGardeningQuote(quote: any, quantity: number): GardeningValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingItems: string[] = [];
  const underHouredItems: Array<{ name: string; actual: number; minimum: number }> = [];
  
  console.log(`🌲 Validerar trädfällningsoffert för ${quantity} träd`);
  
  const reqs = GARDENING_REQUIREMENTS.treeFelling;
  const workItems = quote.workItems || [];
  const summary = quote.summary || {};
  const totalCost = summary.totalBeforeVAT || 0;
  const equipmentCost = summary.equipmentCost || 0;
  
  // ============================================
  // VALIDERING 1: Obligatoriska arbetsmoment
  // ============================================
  for (const required of reqs.minimumWorkItems) {
    if (required.optional) continue;
    
    const found = workItems.find((item: any) => 
      item.name?.toLowerCase().includes(required.name.toLowerCase()) ||
      (required.name.includes('Trädfällning') && item.name?.toLowerCase().includes('fäll')) ||
      (required.name.includes('Kapning') && (item.name?.toLowerCase().includes('kap') || item.name?.toLowerCase().includes('bortfors')))
    );
    
    if (!found) {
      missingItems.push(required.name);
      errors.push(`Saknar obligatoriskt moment: "${required.name}" (minst ${required.minHours * quantity}h för ${quantity} träd)`);
      console.error(`   ❌ Saknas: ${required.name}`);
    } else {
      const minHours = required.minHours * quantity;
      if (found.hours < minHours) {
        underHouredItems.push({
          name: required.name,
          actual: found.hours,
          minimum: minHours
        });
        warnings.push(
          `"${required.name}" har för få timmar: ${found.hours.toFixed(1)}h ` +
          `(minimum ${minHours}h för ${quantity} träd)`
        );
        console.warn(`   ⚠️ För få timmar: ${required.name} (${found.hours}h < ${minHours}h)`);
      } else {
        console.log(`   ✅ ${required.name}: ${found.hours.toFixed(1)}h`);
      }
    }
  }
  
  // ============================================
  // VALIDERING 2: Total kostnad
  // ============================================
  const minTotalCost = quantity * reqs.minimumCostPerTree;
  const recTotalCost = quantity * reqs.recommendedCostPerTree;
  
  if (totalCost < minTotalCost) {
    errors.push(
      `Total kostnad är för låg: ${totalCost.toFixed(0)} kr för ${quantity} träd. ` +
      `Minimum: ${minTotalCost.toFixed(0)} kr (${reqs.minimumCostPerTree} kr/träd)`
    );
    console.error(`   ❌ För låg total: ${totalCost.toFixed(0)} kr (minimum: ${minTotalCost.toFixed(0)} kr)`);
  } else if (totalCost < recTotalCost * 0.6) {
    warnings.push(
      `Total kostnad är låg: ${totalCost.toFixed(0)} kr för ${quantity} träd. ` +
      `Rekommenderat: ${recTotalCost.toFixed(0)} kr (${reqs.recommendedCostPerTree} kr/träd)`
    );
    console.warn(`   ⚠️ Låg total: ${totalCost.toFixed(0)} kr (rec: ${recTotalCost.toFixed(0)} kr)`);
  } else {
    console.log(`   ✅ Total kostnad OK: ${totalCost.toFixed(0)} kr`);
  }
  
  // ============================================
  // VALIDERING 3: Utrustning
  // ============================================
  const hasEquipment = equipmentCost > 0 || workItems.some((item: any) => 
    item.name?.toLowerCase().includes('motorsåg') ||
    item.name?.toLowerCase().includes('utrustning')
  );
  
  if (!hasEquipment) {
    warnings.push('Ingen utrustningskostnad för motorsåg/säkerhetsutrustning - kontrollera att detta ingår i timpriset');
    console.warn(`   ⚠️ Saknar utrustning`);
  } else {
    console.log(`   ✅ Utrustning inkluderat: ${equipmentCost.toFixed(0)} kr`);
  }
  
  // ============================================
  // VALIDERING 4: Timpris
  // ============================================
  const totalHours = workItems.reduce((sum: number, item: any) => sum + (item.hours || 0), 0);
  const workCost = summary.workCost || 0;
  const effectiveHourlyRate = totalHours > 0 ? workCost / totalHours : 0;
  
  if (effectiveHourlyRate < reqs.minimumHourlyRate) {
    warnings.push(
      `Timpris är lågt för farligt arbete: ${effectiveHourlyRate.toFixed(0)} kr/h ` +
      `(minimum ${reqs.minimumHourlyRate} kr/h)`
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
    console.log('✅ Trädfällningsvalidering: Alla krav uppfyllda');
  } else if (passed) {
    console.log(`⚠️ Trädfällningsvalidering: OK med ${warnings.length} varningar`);
  } else {
    console.error(`❌ Trädfällningsvalidering: ${errors.length} kritiska fel`);
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

export function generateGardeningValidationSummary(validation: GardeningValidationResult): string {
  const lines: string[] = [];
  
  lines.push('🌲 TRÄDFÄLLNINGSVALIDERING:');
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
    lines.push('✅ Trädfällningsofferten uppfyller alla minimikrav');
  } else {
    lines.push('❌ Trädfällningsofferten måste kompletteras innan den kan godkännas');
  }
  
  return lines.join('\n');
}
