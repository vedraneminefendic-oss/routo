/**
 * PIPELINE ORCHESTRATOR - FAS 5: Full Integration
 * Denna modul orkestrerar hela quote-genererings-pipelinen.
 */

import { enforceWorkItemMath, logQuoteReport } from './mathGuard.ts';
import { detectFlags, filterCustomerProvidedMaterials } from './flagDetector.ts';
import { findJobDefinition, type JobDefinition } from './jobRegistry.ts';
import { mergeWorkItems, logMergeReport, type MergeResult } from './mergeEngine.ts';
import { validateQuoteDomain, type DomainValidationResult } from './domainValidator.ts';
import { generateWorkItemsFromJobDefinition, calculateQuoteTotals, type ProjectParams, type QuoteStructure } from './formulaEngine.ts';
import { generateMaterialsFromJobDefinition } from './materialsFromJobDef.ts';

interface ParsedInput {
  description: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  jobType?: string;
  area?: number;
  complexity?: 'simple' | 'normal' | 'complex';
  workItems?: any[];
  materials?: any[];
  equipment?: any[];
  [key: string]: any;
}

interface QuoteContext {
  userId: string;
  supabase: any;
  sessionId?: string;
  customerId?: string;
  [key: string]: any;
}

interface PipelineResult {
  quote: any;
  flags: {
    customerProvidesMaterial: boolean;
    noComplexity: boolean;
  };
  corrections: {
    totalCorrections: number;
    workItemsCorrected: number;
    totalsCorrected: boolean;
  };
  mergeResult: MergeResult;
  domainValidation: DomainValidationResult;
  jobDefinition: JobDefinition;
  appliedFallbacks: string[];
  summary: any;
  traceLog: string[];
}

/**
 * Applicera fallbacks för saknade värden
 */
function applyFallbacks(
  input: ParsedInput,
  jobDef: JobDefinition
): { params: ParsedInput; appliedFallbacks: string[] } {
  
  const appliedFallbacks: string[] = [];
  const params = { ...input };

  // Fallback för area/quantity
  if (!params.area && jobDef.fallbackBehavior?.defaultUnitQty) {
    params.area = jobDef.fallbackBehavior.defaultUnitQty;
    appliedFallbacks.push(
      jobDef.fallbackBehavior.assumptionText ||
      `Area saknas – använde ${params.area} ${jobDef.unitType} baserat på ${jobDef.jobType}`
    );
    console.log(`📐 FALLBACK: area = ${params.area} ${jobDef.unitType}`);
  }

  // Fallback för complexity
  if (!params.complexity) {
    params.complexity = 'normal';
    appliedFallbacks.push('Komplexitet ej specificerad – använde "normal"');
    console.log(`📐 FALLBACK: complexity = normal`);
  }

  return { params, appliedFallbacks };
}

/**
 * HUVUDFUNKTION: Kör hela pipelinen - FAS 5: FULL INTEGRATION
 */
export async function runQuotePipeline(
  userInput: ParsedInput,
  context: QuoteContext
): Promise<PipelineResult> {
  
  const traceLog: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    traceLog.push(msg);
  };

  log('\n🏗️ ===== PIPELINE ORCHESTRATOR FAS 5: Starting =====');
  
  // ============================================
  // STEG 1: Hämta JobDefinition
  // ============================================
  
  const jobDef = findJobDefinition(userInput.jobType || '', context.supabase);
  
  if (!jobDef) {
    throw new Error(`No job definition found for job type: ${userInput.jobType}`);
  }
  
  log(`✅ Job definition found: ${jobDef.jobType} (Category: ${jobDef.category})`);
  
  // ============================================
  // STEG 2: Applicera fallbacks
  // ============================================
  
  const { params, appliedFallbacks } = applyFallbacks(userInput, jobDef);
  log(`📐 Applied ${appliedFallbacks.length} fallbacks`);
  
  // ============================================
  // STEG 3: Detektera flags
  // ============================================
  
  const flags = detectFlags(
    params.conversationHistory || [],
    params.description
  );
  
  log(`🚩 Flags detected: CustomerMaterial=${flags.customerProvidesMaterial}`);
  
  // ============================================
  // STEG 4: FORMULA ENGINE - Generate WorkItems & Materials
  // ============================================
  
  log('🧮 STEG 4: Formula Engine - Generating work items and materials...');
  
  // Build ProjectParams for Formula Engine
  const projectParams: ProjectParams = {
    jobType: jobDef.jobType,
    unitQty: params.area || jobDef.fallbackBehavior?.defaultUnitQty || 1,
    complexity: params.complexity || 'normal',
    accessibility: params.accessibility || 'normal',
    qualityLevel: params.qualityLevel || 'standard',
    userHourlyRate: params.hourlyRate,
    userWeighting: params.userWeighting || 0,
    regionMultiplier: params.regionMultiplier,
    regionReason: params.regionReason,
    seasonMultiplier: params.seasonMultiplier,
    seasonReason: params.seasonReason,
    location: params.location,
    locationSource: params.locationSource,
    startMonth: params.startMonth,
    jobCategory: params.jobCategory,
    categoryWeighting: params.categoryWeighting,
    categoryAvgRate: params.categoryAvgRate
  };
  
  // Generate work items from job definition
  const workItemsResult = generateWorkItemsFromJobDefinition(projectParams, jobDef);
  let workItems = workItemsResult.workItems.map(wi => ({
    name: wi.name,
    hours: wi.hours,
    hourlyRate: wi.hourlyRate,
    subtotal: wi.subtotal,
    estimatedHours: wi.hours,
    reasoning: wi.reasoning
  }));
  
  // Generate materials from job definition
  const generatedMaterials = generateMaterialsFromJobDefinition(
    {
      unitQty: projectParams.unitQty,
      qualityLevel: projectParams.qualityLevel
    },
    jobDef
  );
  
  let materials = generatedMaterials.map(m => ({
    name: m.name,
    quantity: m.quantity,
    unit: m.unit,
    unitPrice: m.pricePerUnit,
    subtotal: m.estimatedCost,
    reasoning: m.reasoning
  }));
  
  log(`✅ Generated ${workItems.length} work items and ${materials.length} materials`);
  
  // ============================================
  // STEG 5: MERGE ENGINE - Pass 1
  // ============================================
  
  log('🔀 STEG 5: Merge Engine - Pass 1...');
  
  const mergeResult = mergeWorkItems(workItems, jobDef);
  
  if (mergeResult.duplicatesRemoved > 0 || mergeResult.itemsNormalized > 0) {
    log(`🔀 MERGE: Removed ${mergeResult.duplicatesRemoved} duplicates, normalized ${mergeResult.itemsNormalized} items`);
    logMergeReport(mergeResult);
  }
  
  // Map merged work items to correct structure
  workItems = mergeResult.mergedWorkItems.map((item: any) => ({
    name: item.name || '',
    hours: item.hours || item.estimatedHours || 0,
    hourlyRate: item.hourlyRate || 0,
    subtotal: item.subtotal || 0,
    estimatedHours: item.hours || item.estimatedHours || 0,
    reasoning: item.reasoning || item.description || ''
  }));
  
  // ============================================
  // STEG 7: DOMAIN VALIDATION (with auto-fix)
  // ============================================
  
  log('🔍 STEG 7: Domain Validation...');
  
  // Build temporary quote for validation
  const tempQuote: any = {
    workItems,
    materials,
    equipment: params.equipment || [],
    measurements: { 
      unitQty: projectParams.unitQty, 
      area: projectParams.unitQty 
    },
    hourlyRate: workItemsResult.hourlyRate,
    context: { complexity: projectParams.complexity }
  };
  
  // Run domain validation with auto-fix
  const domainValidation = await validateQuoteDomain(
    tempQuote,
    jobDef,
    { autoFix: true, strictMode: false }
  );
  
  // If auto-fix was applied, update work items
  if (domainValidation.autoFixAttempted && domainValidation.autoFixSuccess) {
    log('✅ Auto-fix applied, updating work items');
    workItems = tempQuote.workItems;
  }
  
  // ============================================
  // STEG 8: MERGE ENGINE - Pass 2 (after auto-fix)
  // ============================================
  
  if (domainValidation.autoFixAttempted) {
    const mergeResult2 = mergeWorkItems(workItems, jobDef);
    if (mergeResult2.duplicatesRemoved > 0) {
      workItems = mergeResult2.mergedWorkItems.map((item: any) => ({
        name: item.name || '',
        hours: item.hours || item.estimatedHours || 0,
        hourlyRate: item.hourlyRate || 0,
        subtotal: item.subtotal || 0,
        estimatedHours: item.hours || item.estimatedHours || 0,
        reasoning: item.reasoning || item.description || ''
      }));
    }
  }
  
  // ============================================
  // STEG 9: FORMULA ENGINE - Final recalculation
  // ============================================
  
  // Recalculate all subtotals to ensure consistency
  workItems = workItems.map(item => ({
    ...item,
    subtotal: Math.round(item.hours * item.hourlyRate)
  }));
  
  // ============================================
  // STEG 10: Filter customer-provided materials
  // ============================================
  
  if (flags.customerProvidesMaterial && flags.customerProvidesDetails) {
    log('🚩 STEG 10: Filtering customer-provided materials...');
    materials = filterCustomerProvidedMaterials(
      materials,
      flags.customerProvidesDetails.materials
    );
  }
  
  // ============================================
  // STEG 11: Calculate totals
  // ============================================
  
  log('💰 STEG 11: Calculating totals...');
  
  const quoteStructure: QuoteStructure = {
    workItems: workItems.map(wi => ({
      name: wi.name,
      description: wi.reasoning || '',
      estimatedHours: wi.hours,
      hourlyRate: wi.hourlyRate,
      subtotal: wi.subtotal
    })),
    materials: materials.map(m => ({
      name: m.name,
      quantity: m.quantity,
      unit: m.unit,
      estimatedCost: m.subtotal
    })),
    equipment: (params.equipment || []).map((eq: any) => ({
      name: eq.name,
      quantity: eq.days || 1,
      unit: 'dag',
      estimatedCost: eq.subtotal || 0
    }))
  };
  
  const totalsResult = calculateQuoteTotals(quoteStructure);
  const finalSummary = totalsResult.quote.summary || {
    workCost: 0,
    materialCost: 0,
    equipmentCost: 0,
    totalBeforeVAT: 0,
    vat: 0,
    totalWithVAT: 0,
    rotDeduction: 0,
    rutDeduction: 0,
    customerPays: 0
  };
  
  // ============================================
  // STEG 12: Build complete quote & DEDUCTIONS
  // ============================================
  
  // ✅ SÄKERHETSFIX: Hämta procentsats strikt från definitionen
  const deductionType = jobDef.applicableDeduction || params.deductionType || 'none';
  
  // Grundinställning från registry
  let deductionPercentage = jobDef.deductionPercentage 
    ? jobDef.deductionPercentage / 100 
    : (deductionType === 'rot' ? 0.30 : (deductionType === 'rut' ? 0.50 : 0));

  // 🕒 TIDSSTYRD LOGIK: ROT 50% till årsskiftet 2024/2025
  if (deductionType === 'rot') {
    const today = new Date();
    const endOfTemporaryIncrease = new Date('2024-12-31');
    
    if (today <= endOfTemporaryIncrease) {
      deductionPercentage = 0.50; // Tillfälligt 50%
      log(`💰 SPECIAL RULE: ROT increased to 50% until ${endOfTemporaryIncrease.toISOString().split('T')[0]}`);
    } else {
      deductionPercentage = 0.30; // Återgår till 30% efter datumet
      log('💰 STANDARD RULE: ROT is 30%');
    }
  }

  const workCost = finalSummary.workCost || 0;
  
  // Beräkna exakt avdrag
  const deductionAmount = Math.round(workCost * deductionPercentage);
  
  // Separera för rapportering
  const rotDeduction = deductionType === 'rot' ? deductionAmount : 0;
  const rutDeduction = deductionType === 'rut' ? deductionAmount : 0;
  
  const customerPays = finalSummary.customerPays || 0;
  const totalBeforeDeduction = (finalSummary.totalWithVAT || 0);
  const customerPaysAfterDeduction = totalBeforeDeduction - deductionAmount;
  
  log(`💰 Deduction Logic: Type=${deductionType}, Percent=${deductionPercentage*100}%, Amount=${deductionAmount}`);

  const quote: any = {
    ...params,
    workItems,
    materials,
    equipment: params.equipment || [],
    summary: {
      workCost: finalSummary.workCost,
      materialCost: finalSummary.materialCost,
      equipmentCost: finalSummary.equipmentCost,
      totalBeforeVAT: finalSummary.totalBeforeVAT,
      vatAmount: finalSummary.vat,
      totalWithVAT: finalSummary.totalWithVAT,
      deductionAmount: deductionAmount,
      rotDeduction: rotDeduction,
      rutDeduction: rutDeduction,
      rotRutDeduction: deductionAmount,
      customerPays: customerPaysAfterDeduction > 0 ? customerPaysAfterDeduction : 0
    },
    assumptions: [
      ...(params.assumptions || []),
      ...appliedFallbacks.map(f => ({ text: f, confidence: 80 })),
      ...mergeResult.mergeOperations.map(op => ({
        text: `Slog samman "${op.originalItems.join(', ')}" till "${op.mergedInto}"`,
        confidence: 95
      })),
      // Lägg till antagande om skattesatsen om den är förhöjd
      ...(deductionType === 'rot' && deductionPercentage === 0.50 ? [{
        text: 'Beräknat med tillfälligt förhöjt ROT-avdrag (50%) som gäller under 2024.',
        confidence: 100
      }] : [])
    ],
    customerResponsibilities: params.customerResponsibilities || [],
    validationWarnings: [
      ...(params.validationWarnings || []),
      ...domainValidation.warnings
    ],
    measurements: {
      unitQty: projectParams.unitQty,
      area: projectParams.unitQty
    },
    hourlyRate: workItemsResult.hourlyRate,
    deductionType: deductionType, 
    projectType: jobDef.jobType
  };
  
  // Add customer material responsibilities
  if (flags.customerProvidesMaterial && flags.customerProvidesDetails) {
    quote.customerResponsibilities = [
      ...quote.customerResponsibilities,
      `Kund tillhandahåller ${flags.customerProvidesDetails.materials.join(', ')}`
    ];
  }
  
  // ============================================
  // STEG 13: FINAL MATH GUARD (OBLIGATORISKT)
  // ============================================
  
  log('🛡️ STEG 13: Final Math Guard...');
  
  const mathGuardResult = enforceWorkItemMath(quote);
  
  // Säkerställ att deductionType är korrekt även efter Math Guard
  mathGuardResult.correctedQuote.deductionType = deductionType;
  mathGuardResult.correctedQuote.summary.rotRutDeduction = deductionAmount;
  
  // Fixa specifika fält om Math Guard nollställde dem
  if (deductionType === 'rot') {
    mathGuardResult.correctedQuote.summary.rotDeduction = deductionAmount;
    mathGuardResult.correctedQuote.summary.rutDeduction = 0;
  } else if (deductionType === 'rut') {
    mathGuardResult.correctedQuote.summary.rutDeduction = deductionAmount;
    mathGuardResult.correctedQuote.summary.rotDeduction = 0;
  }
  
  // Recalculate final pay to be safe
  mathGuardResult.correctedQuote.summary.customerPays = 
    mathGuardResult.correctedQuote.summary.totalWithVAT - deductionAmount;
  
  log(`✅ Math Guard complete. Final price: ${mathGuardResult.correctedQuote.summary.customerPays}`);
  
  // ============================================
  // STEG 14: Log report
  // ============================================
  
  logQuoteReport(mathGuardResult.correctedQuote);
  
  log('🏗️ PIPELINE ORCHESTRATOR FAS 5: Complete ✅\n');
  
  return {
    quote: mathGuardResult.correctedQuote,
    flags: {
      customerProvidesMaterial: flags.customerProvidesMaterial,
      noComplexity: flags.noComplexity
    },
    corrections: {
      totalCorrections: mathGuardResult.totalCorrections,
      ...mathGuardResult.summary
    },
    mergeResult,
    domainValidation,
    jobDefinition: jobDef,
    appliedFallbacks,
    summary: mathGuardResult.correctedQuote.summary,
    traceLog
  };
}

/**
 * Enkel wrapper för att bara köra Math Guard (för befintlig kod)
 */
export function applyMathGuard(quote: any): any {
  const result = enforceWorkItemMath(quote);
  return result.correctedQuote;
}
