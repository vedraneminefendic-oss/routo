/**
 * MATERIAL GENERATION FROM JOB DEFINITION
 * Generates materials based on jobDef.materialCalculations
 */

import type { JobDefinition } from './jobRegistry.ts';

export interface MaterialCalculationParams {
  unitQty: number;
  qualityLevel: 'budget' | 'standard' | 'premium';
}

export interface CalculatedMaterial {
  name: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  estimatedCost: number;
  reasoning: string;
}

/**
 * Generate materials from job definition material calculations
 */
export function generateMaterialsFromJobDefinition(
  params: MaterialCalculationParams,
  jobDef: JobDefinition
): CalculatedMaterial[] {
  if (!jobDef.materialCalculations || jobDef.materialCalculations.length === 0) {
    console.log('ℹ️ No materialCalculations in jobDef, skipping material generation');
    return [];
  }

  console.log(`🧮 Generating ${jobDef.materialCalculations.length} materials from jobDef`);
  
  const materials: CalculatedMaterial[] = [];
  
  for (const matCalc of jobDef.materialCalculations) {
    try {
      // Evaluate formula safely using Function constructor instead of eval
      let calculatedQty = 0;
      
      // Create safe evaluation context
      const context = {
        unitQty: params.unitQty,
        quantity: params.unitQty,
        area: params.unitQty,
        Math: Math
      };
      
      // Replace common variables in formula
      let formula = matCalc.formula
        .replace(/\bunitQty\b/g, context.unitQty.toString())
        .replace(/\bquantity\b/g, context.quantity.toString())
        .replace(/\barea\b/g, context.area.toString());
      
      // Evaluate formula using Function (safer than eval)
      try {
        calculatedQty = new Function('Math', `return ${formula}`)(Math);
      } catch (e) {
        console.error(`❌ Failed to evaluate formula "${matCalc.formula}":`, e);
        continue;
      }
      
      // Round if needed
      const finalQty = matCalc.roundUp ? Math.ceil(calculatedQty) : Math.round(calculatedQty * 100) / 100;
      
      // Get price for quality level
      const pricePerUnit = matCalc.pricePerUnit[params.qualityLevel];
      const estimatedCost = Math.round(finalQty * pricePerUnit);
      
      materials.push({
        name: matCalc.name,
        quantity: finalQty,
        unit: matCalc.unit,
        pricePerUnit,
        estimatedCost,
        reasoning: `Formula: ${matCalc.formula} = ${calculatedQty.toFixed(2)} → ${finalQty} ${matCalc.unit} × ${pricePerUnit} kr (${params.qualityLevel})`
      });
      
      console.log(`✅ Generated material: ${matCalc.name} = ${finalQty} ${matCalc.unit} × ${pricePerUnit} kr = ${estimatedCost} kr`);
      
    } catch (error) {
      console.error(`❌ Failed to calculate material "${matCalc.name}":`, error);
      // Skip this material if calculation fails
      continue;
    }
  }
  
  console.log(`✅ Generated ${materials.length} materials from jobDef`);
  
  return materials;
}
