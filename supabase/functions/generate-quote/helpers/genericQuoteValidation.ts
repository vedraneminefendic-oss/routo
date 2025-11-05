/**
 * GENERISK QUOTE-VALIDERING
 * 
 * Fallback-validering för alla jobbtyper som INTE har dedikerad validering.
 * Kontrollerar grundläggande rimlighetsgränser för att förhindra absurda offerter.
 */

export interface GenericValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  details: {
    totalHours?: number;
    totalCost?: number;
    workCost?: number;
    materialCost?: number;
    equipmentCost?: number;
    calculatedMinCost?: number;
    calculatedMaxCost?: number;
    effectiveHourlyRate?: number;
    materialToWorkRatio?: number;
    equipmentToWorkRatio?: number;
  };
}

// Rimlighetsgränser för alla typer av jobb
const GENERIC_LIMITS = {
  MIN_HOURLY_RATE: 500,        // Minimum 500 kr/h (under detta är det misstänkt)
  MAX_HOURLY_RATE: 1500,       // Maximum 1500 kr/h (över detta är det ovanligt)
  WARN_HOURLY_RATE: 1200,      // Varning vid över 1200 kr/h
  MIN_TOTAL_HOURS: 1,          // Minst 1 timme för alla jobb
  MAX_WORK_ITEM_PERCENT: 0.70, // Inget arbetsmoment får vara >70% av totalen
  MIN_WORK_ITEMS: 1,           // Minst 1 arbetsmoment
  MAX_MATERIAL_TO_WORK: 3.0,   // Material högst 3× arbetskostnad (byggjobb kan ha hög materialandel)
  MIN_MATERIAL_TO_WORK: 0.05,  // Om material finns, minst 5% av arbete
  MAX_EQUIPMENT_TO_WORK: 1.0,  // Utrustning högst 100% av arbetskostnad (nästan alltid fel om högre)
  WARN_EQUIPMENT_TO_WORK: 0.5, // Varning om utrustning > 50% av arbete
};

/**
 * Validerar en quote mot generiska rimlighetsgränser
 */
export function validateGenericQuote(
  quote: any,
  projectType: string,
  description: string
): GenericValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  console.log(`🔍 GENERISK VALIDERING för jobbtyp: ${projectType}`);
  console.log(`   Beskrivning: ${description.substring(0, 100)}...`);
  
  // Extrahera data från quote
  const workItems = quote.workItems || [];
  const summary = quote.summary || {};
  
  const totalHours = workItems.reduce((sum: number, item: any) => sum + (item.hours || 0), 0);
  const workCost = summary.workCost || 0;
  const materialCost = summary.materialCost || 0;
  const equipmentCost = summary.equipmentCost || 0;
  const totalCost = summary.totalBeforeVAT || 0;
  
  // Beräkna effektiv timpris
  const effectiveHourlyRate = totalHours > 0 ? workCost / totalHours : 0;
  
  // Detaljer för response
  const details = {
    totalHours,
    totalCost,
    workCost,
    materialCost,
    equipmentCost,
    effectiveHourlyRate,
    materialToWorkRatio: workCost > 0 ? materialCost / workCost : 0,
    equipmentToWorkRatio: workCost > 0 ? equipmentCost / workCost : 0,
    calculatedMinCost: 0,
    calculatedMaxCost: 0,
  };
  
  // ============================================
  // VALIDERING 1: Minimalt antal timmar
  // ============================================
  if (totalHours < GENERIC_LIMITS.MIN_TOTAL_HOURS) {
    errors.push(`För få arbetade timmar: ${totalHours.toFixed(1)}h (minimum ${GENERIC_LIMITS.MIN_TOTAL_HOURS}h)`);
    console.error(`   ❌ För få timmar: ${totalHours.toFixed(1)}h`);
  } else {
    console.log(`   ✅ Totala timmar OK: ${totalHours.toFixed(1)}h`);
  }
  
  // ============================================
  // VALIDERING 2: Minimum total kostnad baserat på timmar
  // ============================================
  const calculatedMinCost = totalHours * GENERIC_LIMITS.MIN_HOURLY_RATE;
  const calculatedMaxCost = totalHours * GENERIC_LIMITS.MAX_HOURLY_RATE;
  
  details.calculatedMinCost = calculatedMinCost;
  details.calculatedMaxCost = calculatedMaxCost;
  
  if (totalCost < calculatedMinCost) {
    errors.push(
      `Total kostnad är för låg: ${totalCost.toFixed(0)} kr för ${totalHours.toFixed(1)}h arbete. ` +
      `Minimum borde vara ${calculatedMinCost.toFixed(0)} kr (${GENERIC_LIMITS.MIN_HOURLY_RATE} kr/h).`
    );
    console.error(`   ❌ För låg totalkostnad: ${totalCost.toFixed(0)} kr (minimum: ${calculatedMinCost.toFixed(0)} kr)`);
  } else if (totalCost > calculatedMaxCost) {
    warnings.push(
      `Total kostnad är mycket hög: ${totalCost.toFixed(0)} kr för ${totalHours.toFixed(1)}h arbete. ` +
      `Detta ger ett timpris på ${effectiveHourlyRate.toFixed(0)} kr/h (över ${GENERIC_LIMITS.MAX_HOURLY_RATE} kr/h).`
    );
    console.warn(`   ⚠️ Mycket hög totalkostnad: ${totalCost.toFixed(0)} kr (${effectiveHourlyRate.toFixed(0)} kr/h)`);
  } else {
    console.log(`   ✅ Total kostnad inom rimligt intervall: ${totalCost.toFixed(0)} kr (${effectiveHourlyRate.toFixed(0)} kr/h)`);
  }
  
  // ============================================
  // VALIDERING 3: Effektivt timpris
  // ============================================
  if (effectiveHourlyRate < GENERIC_LIMITS.MIN_HOURLY_RATE) {
    errors.push(
      `Timpriset är för lågt: ${effectiveHourlyRate.toFixed(0)} kr/h ` +
      `(minimum ${GENERIC_LIMITS.MIN_HOURLY_RATE} kr/h)`
    );
    console.error(`   ❌ För lågt timpris: ${effectiveHourlyRate.toFixed(0)} kr/h`);
  } else if (effectiveHourlyRate > GENERIC_LIMITS.WARN_HOURLY_RATE) {
    warnings.push(
      `Timpriset är ovanligt högt: ${effectiveHourlyRate.toFixed(0)} kr/h ` +
      `(normalt: ${GENERIC_LIMITS.MIN_HOURLY_RATE}-${GENERIC_LIMITS.WARN_HOURLY_RATE} kr/h)`
    );
    console.warn(`   ⚠️ Högt timpris: ${effectiveHourlyRate.toFixed(0)} kr/h`);
  } else {
    console.log(`   ✅ Timpris OK: ${effectiveHourlyRate.toFixed(0)} kr/h`);
  }
  
  // ============================================
  // VALIDERING 4: Antal arbetsmoment
  // ============================================
  if (workItems.length < GENERIC_LIMITS.MIN_WORK_ITEMS) {
    errors.push('Offerten måste innehålla minst ett arbetsmoment');
    console.error(`   ❌ Inga arbetsmoment definierade`);
  } else {
    console.log(`   ✅ Antal arbetsmoment: ${workItems.length}`);
  }
  
  // ============================================
  // VALIDERING 5: Inget moment får dominera helt
  // ============================================
  if (workItems.length > 1 && totalHours > 0) {
    for (const item of workItems) {
      const itemPercent = item.hours / totalHours;
      if (itemPercent > GENERIC_LIMITS.MAX_WORK_ITEM_PERCENT) {
        warnings.push(
          `"${item.name}" utgör ${(itemPercent * 100).toFixed(0)}% av totala tiden - ` +
          `överväg att dela upp i mindre moment`
        );
        console.warn(`   ⚠️ Stort moment: "${item.name}" = ${(itemPercent * 100).toFixed(0)}% av tiden`);
      }
    }
  }
  
  // ============================================
  // VALIDERING 6: Material-till-arbete-ratio
  // ============================================
  if (materialCost > 0 && workCost > 0) {
    const materialRatio = materialCost / workCost;
    
    if (materialRatio > GENERIC_LIMITS.MAX_MATERIAL_TO_WORK) {
      warnings.push(
        `Material (${materialCost.toFixed(0)} kr) är mycket hög jämfört med arbete (${workCost.toFixed(0)} kr). ` +
        `Ratio: ${materialRatio.toFixed(1)}:1 (normalt: <3:1)`
      );
      console.warn(`   ⚠️ Hög materialandel: ${materialRatio.toFixed(1)}:1`);
    } else if (materialRatio < GENERIC_LIMITS.MIN_MATERIAL_TO_WORK) {
      warnings.push(
        `Material (${materialCost.toFixed(0)} kr) är ovanligt låg jämfört med arbete (${workCost.toFixed(0)} kr). ` +
        `Kontrollera att allt material är inkluderat.`
      );
      console.warn(`   ⚠️ Låg materialandel: ${materialRatio.toFixed(2)}:1`);
    } else {
      console.log(`   ✅ Material-till-arbete OK: ${materialRatio.toFixed(1)}:1`);
    }
  }
  
  // ============================================
  // VALIDERING 7: Utrustning vs arbete
  // ============================================
  if (equipmentCost > 0 && workCost > 0) {
    const equipmentRatio = equipmentCost / workCost;
    
    if (equipmentRatio > GENERIC_LIMITS.MAX_EQUIPMENT_TO_WORK) {
      errors.push(
        `Utrustningskostnad (${equipmentCost.toFixed(0)} kr) är högre än arbetskostnad (${workCost.toFixed(0)} kr). ` +
        `Detta är nästan alltid ett fel.`
      );
      console.error(`   ❌ Utrustning > Arbete: ${equipmentRatio.toFixed(1)}:1`);
    } else if (equipmentRatio > GENERIC_LIMITS.WARN_EQUIPMENT_TO_WORK) {
      warnings.push(
        `Utrustningskostnad (${equipmentCost.toFixed(0)} kr) är hög jämfört med arbete (${workCost.toFixed(0)} kr). ` +
        `Ratio: ${equipmentRatio.toFixed(1)}:1`
      );
      console.warn(`   ⚠️ Hög utrustningskostnad: ${equipmentRatio.toFixed(1)}:1`);
    } else {
      console.log(`   ✅ Utrustningskostnad OK: ${equipmentRatio.toFixed(1)}:1`);
    }
  }
  
  // ============================================
  // SAMMANFATTNING
  // ============================================
  const passed = errors.length === 0;
  
  if (passed && warnings.length === 0) {
    console.log(`✅ GENERISK VALIDERING: Alla kontroller OK`);
  } else if (passed) {
    console.log(`⚠️ GENERISK VALIDERING: OK med ${warnings.length} varningar`);
  } else {
    console.error(`❌ GENERISK VALIDERING: BLOCKERAD med ${errors.length} fel`);
  }
  
  return {
    passed,
    errors,
    warnings,
    details,
  };
}

/**
 * Genererar läsbar sammanfattning av valideringsresultat
 */
export function generateGenericValidationSummary(validation: GenericValidationResult): string {
  const lines: string[] = [];
  
  lines.push('🔍 GENERISK VALIDERING:');
  lines.push('');
  
  // Details
  if (validation.details) {
    const d = validation.details;
    lines.push('📊 Sammanfattning:');
    lines.push(`   • Total tid: ${d.totalHours?.toFixed(1)}h`);
    lines.push(`   • Arbetskostnad: ${d.workCost?.toFixed(0)} kr`);
    lines.push(`   • Materialkostnad: ${d.materialCost?.toFixed(0)} kr`);
    lines.push(`   • Utrustning: ${d.equipmentCost?.toFixed(0)} kr`);
    lines.push(`   • Total: ${d.totalCost?.toFixed(0)} kr`);
    lines.push(`   • Effektivt timpris: ${d.effectiveHourlyRate?.toFixed(0)} kr/h`);
    lines.push('');
    lines.push(`   Rimlig kostnad för ${d.totalHours?.toFixed(1)}h:`);
    lines.push(`   ${d.calculatedMinCost?.toFixed(0)} kr - ${d.calculatedMaxCost?.toFixed(0)} kr`);
    lines.push('');
  }
  
  // Fel
  if (validation.errors.length > 0) {
    lines.push('❌ FEL:');
    validation.errors.forEach(err => lines.push(`   • ${err}`));
    lines.push('');
  }
  
  // Varningar
  if (validation.warnings.length > 0) {
    lines.push('⚠️ VARNINGAR:');
    validation.warnings.forEach(warn => lines.push(`   • ${warn}`));
    lines.push('');
  }
  
  // Slutsats
  if (validation.passed) {
    lines.push('✅ Offerten uppfyller grundläggande rimlighetskrav');
  } else {
    lines.push('❌ Offerten uppfyller INTE grundläggande rimlighetskrav');
  }
  
  return lines.join('\n');
}

/**
 * Identifierar om en jobbtyp saknar dedikerad validering
 */
export function needsGenericValidation(projectType: string, description: string): boolean {
  const desc = description.toLowerCase();
  const type = (projectType || '').toLowerCase();
  
  // Dessa har dedikerad validering - SKIPPA
  const hasSpecificValidation = 
    // Kök
    type === 'kitchen' ||
    type === 'kök' ||
    desc.includes('kök') ||
    desc.includes('kok') ||
    
    // Badrum
    type === 'bathroom' ||
    type === 'badrum' ||
    desc.includes('badrum') ||
    
    // Målning (nyligen implementerad)
    type === 'painting' ||
    type === 'målning' ||
    desc.includes('målning') ||
    desc.includes('måla');
  
  if (hasSpecificValidation) {
    console.log(`   ℹ️ Jobbtyp "${projectType}" har dedikerad validering - skippar generisk`);
    return false;
  }
  
  console.log(`   ✅ Jobbtyp "${projectType}" saknar dedikerad validering - använder generisk`);
  return true;
}
