// ============================================================================
// PROMPT GENERATOR - FAS 2: DATA-DRIVEN PROMPT GENERATION
// ============================================================================

import { JobDefinition, getJobDefinition } from './jobRegistry.ts';

/**
 * Genererar jobbspecifika instruktioner baserat på JobDefinition
 * Ersätter alla hårdkodade if-satser i layeredPrompt.ts
 */
export function generateJobInstructions(
  jobDef: JobDefinition,
  measurements: any
): string {
  const area = measurements?.area || jobDef.fallbackBehavior?.defaultUnitQty || 1;
  
  let instructions = `\n**🔧 INSTRUKTIONER FÖR ${jobDef.jobType.toUpperCase()}**\n\n`;
  
  // ============ 1. STANDARDMOMENT FRÅN JOB REGISTRY ============
  if (jobDef.standardWorkItems && jobDef.standardWorkItems.length > 0) {
    instructions += `För ${jobDef.jobType} ska du dela upp arbetet i följande moment:\n\n`;
    
    jobDef.standardWorkItems.forEach((item, index) => {
      const hourRange = calculateHourRange(item.typicalHours, area, jobDef.unitType);
      const rateRange = jobDef.hourlyRateRange;
      
      instructions += `${index + 1}. **${item.name}** ${item.mandatory ? '(OBLIGATORISKT)' : '(VALFRITT)'}\n`;
      instructions += `   - Standard: ${hourRange.min}-${hourRange.max}h per ${jobDef.unitType} (typical: ${item.typicalHours}h/${jobDef.unitType})\n`;
      instructions += `   - Timpris: ${rateRange.min}-${rateRange.max} kr/h (standard: ${rateRange.typical} kr/h)\n`;
      
      if (measurements?.area) {
        const estimatedHours = item.typicalHours * area;
        instructions += `   - För ${area} ${jobDef.unitType}: ${estimatedHours.toFixed(1)}h\n`;
      } else if (jobDef.fallbackBehavior) {
        instructions += `   - ${jobDef.fallbackBehavior.assumptionText}\n`;
      }
      
      instructions += `\n`;
    });
    
    // Beräkna totala timmar
    const totalHours = jobDef.standardWorkItems.reduce((sum, item) => 
      sum + (item.typicalHours * area), 0
    );
    instructions += `**TOTALT för ${area} ${jobDef.unitType} ${jobDef.jobType}: ${totalHours.toFixed(0)} timmar**\n\n`;
  }
  
  // ============ 2. VIKTIGA REGLER FRÅN PROPORTIONRULES ============
  if (jobDef.proportionRules) {
    instructions += `**⚠️ VIKTIGA REGLER:**\n`;
    
    if (jobDef.proportionRules.maxSingleItemShare) {
      instructions += `- Inget enskilt moment får överstiga ${(jobDef.proportionRules.maxSingleItemShare * 100).toFixed(0)}% av total arbetstid\n`;
    }
    
    if (jobDef.proportionRules.demolitionMaxShare) {
      instructions += `- Rivning/demontering max ${(jobDef.proportionRules.demolitionMaxShare * 100).toFixed(0)}% av total arbetstid\n`;
    }
    
    if (jobDef.proportionRules.minWorkItems) {
      instructions += `- Minst ${jobDef.proportionRules.minWorkItems} separata arbetsmoment krävs\n`;
    }
    
    instructions += `\n`;
  }
  
  // ============ 3. BERÄKNINGSREGEL (UNIVERSELL) ============
  instructions += `**🚨 BERÄKNINGSREGEL:**\n`;
  instructions += `Multiplicera ALLTID standard (h/${jobDef.unitType}) med faktisk mängd i ${jobDef.unitType}!\n`;
  
  if (jobDef.standardWorkItems && jobDef.standardWorkItems.length > 0) {
    const firstItem = jobDef.standardWorkItems[0];
    const exampleHours = (firstItem.typicalHours * area).toFixed(1);
    instructions += `Exempel: ${firstItem.name} = ${firstItem.typicalHours}h/${jobDef.unitType} × ${area} ${jobDef.unitType} = ${exampleHours}h\n`;
  }
  instructions += `\n`;
  
  // ============ 4. ANVÄND ALDRIG TOTAL-STANDARDER FÖR ENSKILDA MOMENT ============
  if (['badrum', 'kök', 'målning', 'fasadmålning', 'parkettläggning'].includes(jobDef.jobType)) {
    instructions += `**⚠️ ANVÄND ALDRIG '${jobDef.jobType}_totalrenovering' för ENSKILDA moment!**\n`;
    instructions += `Den standarden är ENDAST för att validera total-tid, inte för att beräkna delmoment.\n\n`;
  }
  
  // ============ 5. ROT/RUT INFORMATION ============
  if (jobDef.applicableDeduction !== 'none') {
    instructions += `**💰 ${jobDef.applicableDeduction.toUpperCase()}-BERÄTTIGAT:**\n`;
    instructions += `${jobDef.deductionPercentage}% avdrag på arbetskostnad\n`;
    
    // Speciella varningar
    if (jobDef.applicableDeduction === 'rut' && jobDef.jobType === 'trädgård') {
      instructions += `**⚠️ VIKTIGT: Trädfällning är EJ RUT-berättigat!**\n`;
    }
    
    instructions += `\n`;
  }
  
  // ============ 6. PRISSPANN ============
  instructions += `**💵 PRISSPANN:**\n`;
  instructions += `- Per ${jobDef.unitType}: ${jobDef.priceBounds.minPerUnit}-${jobDef.priceBounds.maxPerUnit} kr\n`;
  instructions += `- Total min: ${jobDef.priceBounds.totalMin.toLocaleString('sv-SE')} kr\n`;
  instructions += `- Total max: ${jobDef.priceBounds.totalMax.toLocaleString('sv-SE')} kr\n\n`;
  
  // ============ 7. MINIMUM-KOSTNAD (FÖR MÅLNING) ============
  if (jobDef.jobType === 'målning' && measurements?.area) {
    const minCost = 150; // minimumCostPerSqm
    const recCost = 300; // recommendedCostPerSqm
    instructions += `**MINIMUM KOSTNAD:**\n`;
    instructions += `- Minst ${(measurements.area * minCost).toLocaleString('sv-SE')} kr (${measurements.area} kvm × ${minCost} kr/kvm)\n`;
    instructions += `- Rekommenderat: ${(measurements.area * recCost).toLocaleString('sv-SE')} kr (${measurements.area} kvm × ${recCost} kr/kvm)\n\n`;
    
    instructions += `**VIKTIGA FAKTORER:**\n`;
    instructions += `- 🎨 Mörka färger (svart, mörk blå, etc.) → +1 slutstrykning\n`;
    instructions += `- 🔝 Takmålning → +20% timpris (svårare arbete)\n`;
    instructions += `- 🏠 Många rum → mer maskering och förberedelser\n\n`;
  }
  
  return instructions;
}

/**
 * Beräknar timspann baserat på typical hours
 * ±30% från typical
 */
function calculateHourRange(
  typical: number, 
  area: number, 
  unitType: string
): { min: number; max: number } {
  return {
    min: Math.round(typical * 0.7 * 10) / 10,
    max: Math.round(typical * 1.3 * 10) / 10
  };
}
