// ============================================================================
// FORMULA ENGINE - FAS 0: SEPARATION AV KVANTIFIERING
// ============================================================================

import { JobDefinition } from './jobRegistry.ts';

export interface ProjectParams {
  jobType: string;
  unitQty: number;           // t.ex. 50 kvm
  complexity: 'simple' | 'normal' | 'complex';
  accessibility: 'easy' | 'normal' | 'hard';
  qualityLevel: 'budget' | 'standard' | 'premium';
  userHourlyRate?: number;   // Prioritet om finns
  userWeighting: number;     // 0-100% vikt för user rate
}

export interface CalculatedWorkItem {
  name: string;
  description: string;
  hours: number;
  hourlyRate: number;
  subtotal: number;
  reasoning: string;
  appliedMultipliers: string[];
  sourceOfTruth: 'web_market' | 'industry_benchmark' | 'user_rate_weighted';
  confidence: number;
}

/**
 * KRITISK: All kvantifiering sker här, INTE i AI:n
 * FAS 0: Hybridmodell - Web → Bransch → User (viktad)
 */
export function calculateWorkItem(
  params: ProjectParams,
  jobDef: JobDefinition
): CalculatedWorkItem {
  
  console.log('🧮 FORMULA ENGINE: Calculating work item...', {
    jobType: params.jobType,
    unitQty: params.unitQty,
    complexity: params.complexity,
    userWeighting: params.userWeighting
  });
  
  // 1. Basberäkning
  const baseTimePerUnit = jobDef.timePerUnit[params.complexity];
  const baseHours = params.unitQty * baseTimePerUnit;
  
  // 2. Applicera multiplikatorer
  let totalMultiplier = 1.0;
  const appliedMultipliers: string[] = [];
  
  const accessMult = jobDef.multipliers.accessibility[params.accessibility];
  totalMultiplier *= accessMult;
  if (accessMult !== 1.0) {
    appliedMultipliers.push(`Tillgänglighet: ${accessMult}x`);
  }
  
  const qualityMult = jobDef.multipliers.quality[params.qualityLevel];
  totalMultiplier *= qualityMult;
  if (qualityMult !== 1.0) {
    appliedMultipliers.push(`Kvalitet: ${qualityMult}x`);
  }
  
  const finalHours = Math.round(baseHours * totalMultiplier * 10) / 10; // Max 1 decimal
  
  // 3. HYBRIDMODELL: Timpris med viktad prioritering
  // PRIORITET: Web → Bransch → User (viktad efter erfarenhet)
  let hourlyRate: number;
  let sourceOfTruth: 'web_market' | 'industry_benchmark' | 'user_rate_weighted';
  let confidence: number;
  
  if (params.userHourlyRate && params.userWeighting > 0) {
    // Weighted average: (user_rate * user_weight) + (market_rate * (1 - user_weight))
    const userWeight = params.userWeighting / 100;
    hourlyRate = Math.round(
      (params.userHourlyRate * userWeight) + 
      (jobDef.hourlyRateRange.typical * (1 - userWeight))
    );
    sourceOfTruth = params.userWeighting >= 50 ? 'user_rate_weighted' : 'web_market';
    confidence = 0.7 + (params.userWeighting / 100) * 0.3; // 0.7-1.0
    
    console.log('💰 Using weighted rate:', {
      userRate: params.userHourlyRate,
      marketRate: jobDef.hourlyRateRange.typical,
      userWeight: params.userWeighting,
      finalRate: hourlyRate
    });
  } else {
    // Ny användare: använd marknadspris
    hourlyRate = jobDef.hourlyRateRange.typical;
    sourceOfTruth = 'web_market';
    confidence = 0.85;
    
    console.log('🌐 Using market rate:', hourlyRate);
  }
  
  // 4. Subtotal
  const subtotal = Math.round(finalHours * hourlyRate);
  
  // 5. Reasoning
  const reasoning = `
📐 Bas: ${params.unitQty} ${jobDef.unitType} × ${baseTimePerUnit}h = ${baseHours.toFixed(1)}h
${appliedMultipliers.length > 0 ? `⚙️ Multiplikatorer: ${appliedMultipliers.join(', ')}` : ''}
⏱️ Total tid: ${finalHours}h
💰 Timpris: ${hourlyRate} kr/h ${params.userWeighting > 0 ? `(${Math.round(params.userWeighting)}% dina priser, ${100 - Math.round(params.userWeighting)}% marknad)` : '(marknadspris)'}
💵 Subtotal: ${subtotal.toLocaleString('sv-SE')} kr
  `.trim();
  
  console.log('✅ FORMULA ENGINE: Work item calculated', {
    hours: finalHours,
    hourlyRate,
    subtotal,
    sourceOfTruth,
    confidence
  });
  
  return {
    name: jobDef.standardWorkItems[0]?.name || `${jobDef.jobType} (standardmoment)`,
    description: `Beräknat enligt ${sourceOfTruth === 'user_rate_weighted' ? 'dina priser och marknadsdata' : 'marknadspriser'}`,
    hours: finalHours,
    hourlyRate,
    subtotal,
    reasoning,
    appliedMultipliers,
    sourceOfTruth,
    confidence
  };
}

/**
 * Beräkna servicebil automatiskt vid >4h
 */
export function calculateServiceVehicle(
  totalHours: number,
  jobDef: JobDefinition,
  userEquipmentRate?: number
): CalculatedWorkItem | null {
  
  if (!jobDef.serviceVehicle || !jobDef.serviceVehicle.autoInclude) {
    return null;
  }
  
  if (totalHours < jobDef.serviceVehicle.threshold) {
    console.log(`⏭️ Service vehicle not needed (${totalHours}h < ${jobDef.serviceVehicle.threshold}h threshold)`);
    return null;
  }
  
  // Använd användarens pris om finns, annars standard
  const dailyRate = userEquipmentRate || 800; // Fallback: 800 kr/dag
  const days = jobDef.serviceVehicle.unit === 'dag' ? 1 : 0.5;
  const subtotal = Math.round(dailyRate * days);
  
  console.log('🚐 Service vehicle added automatically:', {
    totalHours,
    threshold: jobDef.serviceVehicle.threshold,
    dailyRate,
    days,
    subtotal
  });
  
  return {
    name: 'Servicebil',
    description: `Läggs till automatiskt vid arbeten >${jobDef.serviceVehicle.threshold}h`,
    hours: 0,
    hourlyRate: 0,
    subtotal,
    reasoning: `Servicebil läggs till automatiskt vid arbeten >${jobDef.serviceVehicle.threshold}h (${totalHours.toFixed(1)}h). Pris: ${dailyRate} kr/${jobDef.serviceVehicle.unit}.`,
    appliedMultipliers: [],
    sourceOfTruth: userEquipmentRate ? 'user_rate_weighted' : 'web_market',
    confidence: userEquipmentRate ? 0.9 : 0.75
  };
}

/**
 * Beräkna material med buckets (budget/standard/premium)
 */
export function calculateMaterial(
  materialName: string,
  quantity: number,
  unit: string,
  qualityLevel: 'budget' | 'standard' | 'premium',
  jobDef: JobDefinition,
  basePricePerUnit: number,
  userMarkup: number = 0
): {
  name: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  subtotal: number;
  reasoning: string;
  sourceOfTruth: string;
  confidence: number;
} {
  
  // Applicera bucket-multiplikator
  const bucket = jobDef.materialBuckets[qualityLevel];
  const adjustedPricePerUnit = Math.round(basePricePerUnit * bucket.priceMultiplier);
  
  // Applicera användarens påslag
  const finalPricePerUnit = Math.round(adjustedPricePerUnit * (1 + userMarkup / 100));
  const subtotal = Math.round(finalPricePerUnit * quantity);
  
  const reasoning = `
📦 Material: ${materialName} (${qualityLevel})
💰 Baspris: ${basePricePerUnit} kr/${unit}
⚙️ Kvalitetsmultiplikator: ${bucket.priceMultiplier}x (${qualityLevel})
${userMarkup > 0 ? `📊 Påslag: +${userMarkup}%` : ''}
💵 Slutpris: ${finalPricePerUnit} kr/${unit} × ${quantity} ${unit} = ${subtotal.toLocaleString('sv-SE')} kr
  `.trim();
  
  return {
    name: materialName,
    quantity,
    unit,
    pricePerUnit: finalPricePerUnit,
    subtotal,
    reasoning,
    sourceOfTruth: userMarkup > 0 ? 'user_rate_weighted' : 'web_market',
    confidence: 0.8
  };
}
