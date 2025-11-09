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
  
  // NYA FÖR PUNKT 1: Region & Säsong
  regionMultiplier?: number;  // 1.1 = +10%, 0.9 = -10%
  regionReason?: string;
  seasonMultiplier?: number;  // 1.15 = +15%, 0.85 = -15%
  seasonReason?: string;
  location?: string;          // 'Stockholm', 'Göteborg'
  locationSource?: string;    // 'job_location', 'customer_address', etc.
  startMonth?: number;        // 1-12 för säsong
  
  // NYA FÖR PUNKT 3: Kategori-viktning
  jobCategory?: string;       // 'målning', 'vvs', 'el'
  categoryWeighting?: number; // 0-100% för denna kategori
  categoryAvgRate?: number;   // Användarens genomsnittliga timpris i kategorin
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

export interface WorkItemGenerationResult {
  workItems: CalculatedWorkItem[];
  totalHours: number;
  baseHours: number;
  hourlyRate: number;
  reasoning: string;
}

/**
 * Compute multipliers and hourly rate for work items
 * Extracted to be reusable by both single and multi-item generation
 */
function computeMultipliers(
  params: ProjectParams,
  jobDef: JobDefinition
): {
  totalMultiplier: number;
  appliedMultipliers: string[];
  hourlyRate: number;
  sourceOfTruth: 'web_market' | 'industry_benchmark' | 'user_rate_weighted';
  confidence: number;
} {
  let totalMultiplier = 1.0;
  const appliedMultipliers: string[] = [];
  
  // Accessibility multiplier
  const accessMult = jobDef.multipliers.accessibility[params.accessibility];
  totalMultiplier *= accessMult;
  if (accessMult !== 1.0) {
    appliedMultipliers.push(`Tillgänglighet: ${accessMult}x`);
  }
  
  // Quality multiplier
  const qualityMult = jobDef.multipliers.quality[params.qualityLevel];
  totalMultiplier *= qualityMult;
  if (qualityMult !== 1.0) {
    appliedMultipliers.push(`Kvalitet: ${qualityMult}x`);
  }
  
  // Region multiplier
  if (params.regionMultiplier && params.regionMultiplier !== 1.0 && jobDef.regionSensitive !== false) {
    totalMultiplier *= params.regionMultiplier;
    appliedMultipliers.push(`Region: ${params.regionMultiplier.toFixed(2)}x`);
  }
  
  // Season multiplier
  if (params.seasonMultiplier && params.seasonMultiplier !== 1.0 && jobDef.seasonSensitive !== false) {
    totalMultiplier *= params.seasonMultiplier;
    appliedMultipliers.push(`Säsong: ${params.seasonMultiplier.toFixed(2)}x`);
  }
  
  // Calculate hourly rate using hybrid model
  let hourlyRate: number;
  let sourceOfTruth: 'web_market' | 'industry_benchmark' | 'user_rate_weighted';
  let confidence: number;
  
  if (params.categoryWeighting && params.categoryWeighting > 0 && (params.categoryAvgRate || params.userHourlyRate)) {
    const userRate = params.categoryAvgRate || params.userHourlyRate!;
    const categoryWeight = params.categoryWeighting / 100;
    const marketWeight = 1 - categoryWeight;
    
    hourlyRate = Math.round(
      (userRate * categoryWeight) + 
      (jobDef.hourlyRateRange.typical * marketWeight)
    );
    
    sourceOfTruth = params.categoryWeighting >= 50 ? 'user_rate_weighted' : 'web_market';
    confidence = 0.7 + (params.categoryWeighting / 100) * 0.3;
  } else if (params.userHourlyRate && params.userWeighting > 0) {
    const userWeight = params.userWeighting / 100;
    hourlyRate = Math.round(
      (params.userHourlyRate * userWeight) + 
      (jobDef.hourlyRateRange.typical * (1 - userWeight))
    );
    sourceOfTruth = params.userWeighting >= 50 ? 'user_rate_weighted' : 'web_market';
    confidence = 0.7 + (params.userWeighting / 100) * 0.3;
  } else {
    hourlyRate = jobDef.hourlyRateRange.typical;
    sourceOfTruth = 'web_market';
    confidence = 0.85;
  }
  
  return { totalMultiplier, appliedMultipliers, hourlyRate, sourceOfTruth, confidence };
}

/**
 * FAS 1: Generate ALL work items from Job Definition
 * This is the NEW function that replaces single-item calculation
 * 
 * @param params - Project parameters (unitQty, complexity, etc.)
 * @param jobDef - Job definition with standardWorkItems
 * @returns All calculated work items with totals
 */
export function generateWorkItemsFromJobDefinition(
  params: ProjectParams,
  jobDef: JobDefinition
): WorkItemGenerationResult {
  
  console.log('🧮 FORMULA ENGINE: Generating all work items from job definition...', {
    jobType: params.jobType,
    unitQty: params.unitQty,
    standardWorkItems: jobDef.standardWorkItems.length
  });
  
  // Compute shared multipliers and hourly rate
  const { totalMultiplier, appliedMultipliers, hourlyRate, sourceOfTruth, confidence } = 
    computeMultipliers(params, jobDef);
  
  // Generate work items from standardWorkItems
  const workItems: CalculatedWorkItem[] = [];
  let totalHours = 0;
  let baseHours = 0;
  
  for (const standardItem of jobDef.standardWorkItems) {
    // Calculate hours: typicalHours (per unit) × unitQty × multipliers
    const itemBaseHours = standardItem.typicalHours * params.unitQty;
    const itemFinalHours = Math.round(itemBaseHours * totalMultiplier * 10) / 10; // Max 1 decimal
    const itemSubtotal = Math.round(itemFinalHours * hourlyRate);
    
    baseHours += itemBaseHours;
    totalHours += itemFinalHours;
    
    const itemReasoning = `
📐 Bas: ${params.unitQty} ${jobDef.unitType} × ${standardItem.typicalHours}h/enhet = ${itemBaseHours.toFixed(1)}h
${appliedMultipliers.length > 0 ? `⚙️ Multiplikatorer: ${appliedMultipliers.join(', ')}\n` : ''}⏱️ Final tid: ${itemFinalHours}h
💰 Timpris: ${hourlyRate} kr/h
💵 Subtotal: ${itemSubtotal.toLocaleString('sv-SE')} kr
    `.trim();
    
    workItems.push({
      name: standardItem.name,
      description: `Beräknat enligt ${sourceOfTruth === 'user_rate_weighted' ? 'dina priser och marknadsdata' : 'marknadspriser'}`,
      hours: itemFinalHours,
      hourlyRate,
      subtotal: itemSubtotal,
      reasoning: itemReasoning,
      appliedMultipliers,
      sourceOfTruth,
      confidence
    });
  }
  
  // Build summary reasoning
  const getMonthName = (month: number): string => {
    const months = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 
                    'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
    return months[month - 1] || '';
  };
  
  const reasoningParts: string[] = [
    `📐 Projekt: ${params.unitQty} ${jobDef.unitType} ${jobDef.jobType}`,
    `⏱️ Total bastid: ${baseHours.toFixed(1)}h`,
  ];
  
  if (params.regionMultiplier && params.regionMultiplier !== 1.0) {
    reasoningParts.push(
      `📍 Region: ${params.location} (${(params.regionMultiplier - 1) * 100 > 0 ? '+' : ''}${((params.regionMultiplier - 1) * 100).toFixed(0)}%) - ${params.regionReason}`
    );
  }
  
  if (params.seasonMultiplier && params.seasonMultiplier !== 1.0 && params.startMonth) {
    reasoningParts.push(
      `📅 Säsong: ${getMonthName(params.startMonth)} (${(params.seasonMultiplier - 1) * 100 > 0 ? '+' : ''}${((params.seasonMultiplier - 1) * 100).toFixed(0)}%) - ${params.seasonReason}`
    );
  }
  
  if (appliedMultipliers.length > 0) {
    reasoningParts.push(`⚙️ Multiplikatorer: ${appliedMultipliers.join(', ')}`);
  }
  
  reasoningParts.push(
    `⏱️ Total justerad tid: ${totalHours.toFixed(1)}h`,
    `💰 Timpris: ${hourlyRate} kr/h ${params.categoryWeighting ? `(${Math.round(params.categoryWeighting)}% dina ${params.jobCategory}-priser)` : params.userWeighting > 0 ? `(${Math.round(params.userWeighting)}% dina priser)` : '(marknadspris)'}`,
    `\n🔍 Delmoment:\n${workItems.map(w => `  • ${w.name}: ${w.hours}h × ${hourlyRate} kr/h = ${w.subtotal.toLocaleString('sv-SE')} kr`).join('\n')}`
  );
  
  const reasoning = reasoningParts.join('\n');
  
  console.log('✅ FORMULA ENGINE: Generated all work items', {
    count: workItems.length,
    totalHours,
    hourlyRate,
    totalCost: workItems.reduce((sum, w) => sum + w.subtotal, 0)
  });
  
  return {
    workItems,
    totalHours,
    baseHours,
    hourlyRate,
    reasoning
  };
}

/**
 * WRAPPER: Single work item calculation (uses generateWorkItemsFromJobDefinition internally)
 * Kept for backwards compatibility but now generates all items and returns summary
 */
export function calculateWorkItem(
  params: ProjectParams,
  jobDef: JobDefinition
): CalculatedWorkItem {
  
  console.log('🧮 FORMULA ENGINE: Calculating work item (wrapper)...', {
    jobType: params.jobType,
    unitQty: params.unitQty
  });
  
  // Use the new multi-item generator
  const result = generateWorkItemsFromJobDefinition(params, jobDef);
  
  // Return summary item with total hours and reasoning
  const totalSubtotal = result.workItems.reduce((sum, w) => sum + w.subtotal, 0);
  
  const reasoningParts: string[] = [result.reasoning];
  
  return {
    name: jobDef.jobType,
    description: `Beräknat enligt ${result.workItems[0]?.sourceOfTruth === 'user_rate_weighted' ? 'dina priser och marknadsdata' : 'marknadspriser'}`,
    hours: result.totalHours,
    hourlyRate: result.hourlyRate,
    subtotal: totalSubtotal,
    reasoning: result.reasoning,
    appliedMultipliers: result.workItems[0]?.appliedMultipliers || [],
    sourceOfTruth: result.workItems[0]?.sourceOfTruth || 'web_market',
    confidence: result.workItems[0]?.confidence || 0.85
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

// ============================================================================
// FAS 3: TOTAL CALCULATION ENGINE - Beräknar alla totaler automatiskt
// ============================================================================

export interface QuoteStructure {
  workItems: Array<{
    name: string;
    description?: string;
    estimatedHours: number;
    hourlyRate: number;
    subtotal?: number;
  }>;
  materials?: Array<{
    name: string;
    quantity: number;
    unit: string;
    estimatedCost: number;
  }>;
  equipment?: Array<{
    name: string;
    quantity?: number;
    unit?: string;
    estimatedCost: number;
  }>;
  summary?: {
    workCost?: number;
    materialCost?: number;
    equipmentCost?: number;
    totalBeforeVAT?: number;
    vat?: number;
    totalWithVAT?: number;
    rotDeduction?: number;
    rutDeduction?: number;
    customerPays?: number;
  };
  deductionType?: string;
  measurements?: {
    area?: number;
    [key: string]: any;
  };
}

export interface CalculationReport {
  workItemsRecalculated: number;
  totalCorrections: number;
  originalTotal?: number;
  correctedTotal?: number;
  details: string[];
}

/**
 * FAS 3: CORE FORMULA ENGINE - Beräknar alla subtotals och totals
 * 
 * KRITISK REGEL: All matematik sker här, INTE i AI:n eller manuellt
 * 
 * @param quote - Quote-struktur med workItems, materials, equipment
 * @param deductionType - 'rot' | 'rut' | 'none' 
 * @returns Uppdaterad quote med alla beräknade värden + rapport
 */
export function calculateQuoteTotals(
  quote: QuoteStructure,
  deductionType: string = 'none'
): { quote: QuoteStructure; report: CalculationReport } {
  
  console.log('🧮 FORMULA ENGINE: Starting total calculation...');
  
  const report: CalculationReport = {
    workItemsRecalculated: 0,
    totalCorrections: 0,
    details: []
  };
  
  // ============ 1. BERÄKNA WORKITEM SUBTOTALS ============
  quote.workItems.forEach((item, index) => {
    const calculatedSubtotal = Math.round(item.estimatedHours * item.hourlyRate);
    const originalSubtotal = item.subtotal;
    
    if (originalSubtotal && Math.abs(calculatedSubtotal - originalSubtotal) > 0.01) {
      report.workItemsRecalculated++;
      report.details.push(
        `WorkItem "${item.name}": ${originalSubtotal} kr → ${calculatedSubtotal} kr ` +
        `(${item.estimatedHours}h × ${item.hourlyRate} kr/h)`
      );
    }
    
    item.subtotal = calculatedSubtotal;
  });
  
  // ============ 2. SUMMERA ARBETSKOSTNAD ============
  const workCost = quote.workItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  
  // ============ 3. SUMMERA MATERIALKOSTNAD ============
  const materialCost = quote.materials?.reduce(
    (sum, mat) => sum + (mat.estimatedCost || 0), 
    0
  ) || 0;
  
  // ============ 4. SUMMERA UTRUSTNINGSKOSTNAD ============
  const equipmentCost = quote.equipment?.reduce(
    (sum, eq) => sum + (eq.estimatedCost || 0), 
    0
  ) || 0;
  
  // ============ 5. TOTAL FÖRE MOMS ============
  const totalBeforeVAT = workCost + materialCost + equipmentCost;
  
  // ============ 6. MOMS (25%) ============
  const vat = Math.round(totalBeforeVAT * 0.25);
  
  // ============ 7. TOTAL MED MOMS ============
  const totalWithVAT = totalBeforeVAT + vat;
  
  // ============ 8. ROT/RUT AVDRAG ============
  let rotDeduction = 0;
  let rutDeduction = 0;
  
  if (deductionType === 'rot') {
    // ROT: 30% på arbetskostnad (exklusive material)
    rotDeduction = Math.round(workCost * 0.30);
  } else if (deductionType === 'rut') {
    // RUT: 50% på arbetskostnad (exklusive material)
    rutDeduction = Math.round(workCost * 0.50);
  }
  
  // ============ 9. KUND BETALAR ============
  const customerPays = totalWithVAT - rotDeduction - rutDeduction;
  
  // ============ 10. SKAPA/UPPDATERA SUMMARY ============
  const originalSummary = quote.summary;
  
  quote.summary = {
    workCost,
    materialCost,
    equipmentCost,
    totalBeforeVAT,
    vat,
    totalWithVAT,
    rotDeduction,
    rutDeduction,
    customerPays
  };
  
  // ============ 11. KONTROLLERA MOT ORIGINAL ============
  if (originalSummary?.customerPays) {
    const diff = Math.abs(customerPays - originalSummary.customerPays);
    const diffPercent = (diff / originalSummary.customerPays) * 100;
    
    if (diff > 1) { // Mer än 1 kr skillnad
      report.totalCorrections++;
      report.originalTotal = originalSummary.customerPays;
      report.correctedTotal = customerPays;
      report.details.push(
        `Total corrected: ${originalSummary.customerPays} kr → ${customerPays} kr ` +
        `(${diffPercent.toFixed(1)}% skillnad)`
      );
    }
  }
  
  // ============ 12. LOGG RESULTAT ============
  console.log('✅ FORMULA ENGINE: Calculation complete', {
    workCost,
    materialCost,
    equipmentCost,
    totalBeforeVAT,
    vat,
    totalWithVAT,
    deduction: deductionType === 'rot' ? rotDeduction : deductionType === 'rut' ? rutDeduction : 0,
    customerPays,
    workItemsRecalculated: report.workItemsRecalculated,
    totalCorrections: report.totalCorrections
  });
  
  return { quote, report };
}

/**
 * FAS 3: QUICK RECALCULATION - Snabb omkörning av totaler utan rapport
 * Används när man bara behöver uppdatera totaler snabbt
 */
export function recalculateQuoteTotals(
  quote: QuoteStructure,
  deductionType: string = 'none'
): QuoteStructure {
  const { quote: updatedQuote } = calculateQuoteTotals(quote, deductionType);
  return updatedQuote;
}

/**
 * FAS 3: VALIDATE QUOTE MATH - Kontrollerar om en quote har korrekta beräkningar
 * Returnerar true om allt stämmer, false om något är fel
 */
export function validateQuoteMath(quote: QuoteStructure, deductionType: string = 'none'): boolean {
  const { report } = calculateQuoteTotals(quote, deductionType);
  return report.workItemsRecalculated === 0 && report.totalCorrections === 0;
}
