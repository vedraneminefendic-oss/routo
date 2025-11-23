/**
 * PIPELINE ORCHESTRATOR - FAS 5: Full Integration
 * Denna modul orkestrerar hela quote-genererings-pipelinen.
 * FIX: Korrigerad material-mappning och ROT-logik.
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

function applyFallbacks(input: ParsedInput, jobDef: JobDefinition) {
  const appliedFallbacks: string[] = [];
  const params = { ...input };

  if (!params.area && jobDef.fallbackBehavior?.defaultUnitQty) {
    params.area = jobDef.fallbackBehavior.defaultUnitQty;
    appliedFallbacks.push(`Area saknas – använde ${params.area} ${jobDef.unitType}`);
  }

  if (!params.complexity) {
    params.complexity = 'normal';
    appliedFallbacks.push('Komplexitet ej specificerad – använde "normal"');
  }
  return { params, appliedFallbacks };
}

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
  
  // 1. Job Definition
  const jobDef = findJobDefinition(userInput.jobType || '', context.supabase);
  if (!jobDef) throw new Error(`No job definition found for: ${userInput.jobType}`);
  log(`✅ Job definition: ${jobDef.jobType} (${jobDef.category.toUpperCase()})`);
  
  // 2. Fallbacks
  const { params, appliedFallbacks } = applyFallbacks(userInput, jobDef);
  
  // 3. Flags
  const flags = detectFlags(params.conversationHistory || [], params.description);
  
  // 4. Formula Engine
  const projectParams: ProjectParams = {
    jobType: jobDef.jobType,
    unitQty: params.area || 1,
    complexity: params.complexity || 'normal',
    accessibility: params.accessibility || 'normal',
    qualityLevel: params.qualityLevel || 'standard',
    userHourlyRate: params.hourlyRate,
    userWeighting: params.userWeighting || 0
  };
  
  const workItemsResult = generateWorkItemsFromJobDefinition(projectParams, jobDef);
  let workItems = workItemsResult.workItems.map(wi => ({
    name: wi.name,
    hours: wi.hours,
    hourlyRate: wi.hourlyRate,
    subtotal: wi.subtotal,
    estimatedHours: wi.hours,
    reasoning: wi.reasoning
  }));
  
  const generatedMaterials = generateMaterialsFromJobDefinition({
      unitQty: projectParams.unitQty,
      qualityLevel: projectParams.qualityLevel
    }, jobDef);
  
  // FIX 1: Mappa materialpriser korrekt för både frontend och backend
  let materials = generatedMaterials.map(m => ({
    name: m.name,
    quantity: m.quantity,
    unit: m.unit,
    unitPrice: m.pricePerUnit,     // Används av vissa system
    pricePerUnit: m.pricePerUnit,  // Används av frontend (fixar 0 kr felet)
    subtotal: m.estimatedCost,
    estimatedCost: m.estimatedCost,
    reasoning: m.reasoning
  }));
  
  // 5. Merge Engine
  const mergeResult = mergeWorkItems(workItems, jobDef);
  workItems = mergeResult.mergedWorkItems;

  // 7. Domain Validation
  const domainValidation = await validateQuoteDomain({ workItems }, jobDef, { autoFix: false });
  
  // 11. Calculate Totals
  const quoteStructure: QuoteStructure = {
    workItems: workItems.map(wi => ({ ...wi, estimatedHours: wi.hours })),
    materials: materials.map(m => ({ ...m, estimatedCost: m.subtotal })),
    equipment: []
  };
  
  const totalsResult = calculateQuoteTotals(quoteStructure);
  const finalSummary = totalsResult.quote.summary || { workCost: 0, materialCost: 0, totalWithVAT: 0, customerPays: 0 };
  
  // 12. SKATTEREDUKTIONER (ROT/RUT) - KORRIGERAD LOGIK
  // Vi litar STENHÅRT på vad jobRegistry säger. Säger den ROT, är det ROT.
  const deductionType = jobDef.applicableDeduction; 
  
  // Hämta procent. Default 30% för ROT, 50% för RUT.
  let deductionPercentage = jobDef.deductionPercentage / 100;
  
  // Säkerhetsspärr: Om registry säger ROT men procent är 50%, tvinga ner till 30%
  // (Om vi inte är i 2024-perioden för höjt ROT)
  const today = new Date();
  const tempRotPeriod = today <= new Date('2024-12-31');
  
  if (deductionType === 'rot') {
    if (tempRotPeriod && deductionPercentage === 0.5) {
        log('💰 SPECIAL: Tillfälligt förhöjt ROT (50%) aktivt');
    } else {
        deductionPercentage = 0.30; // Standard ROT
        log('💰 STANDARD: ROT justerat till 30%');
    }
  } else if (deductionType === 'rut') {
      deductionPercentage = 0.50; // Standard RUT
  }

  // Beräkna avdrag
  const workCostInclVat = finalSummary.workCost * 1.25; 
  const potentialDeduction = Math.round(workCostInclVat * deductionPercentage);
  
  const maxDeduction = deductionType === 'rot' ? 50000 : 75000;
  const deductionAmount = Math.min(potentialDeduction, maxDeduction);
  
  const rotDeduction = deductionType === 'rot' ? deductionAmount : 0;
  const rutDeduction = deductionType === 'rut' ? deductionAmount : 0;
  
  const totalBeforeDeduction = finalSummary.totalWithVAT;
  const customerPays = Math.max(0, totalBeforeDeduction - deductionAmount);
  
  log(`💰 Deduction: ${deductionType.toUpperCase()} (${deductionPercentage*100}%) = -${deductionAmount} kr`);

  const quote: any = {
    ...params,
    workItems,
    materials,
    equipment: [],
    summary: {
      ...finalSummary,
      deductionAmount,
      rotDeduction,
      rutDeduction,
      rotRutDeduction: deductionAmount,
      customerPays
    },
    deductionType: deductionType, 
    projectType: jobDef.jobType
  };

  // 13. Math Guard
  const mathGuardResult = enforceWorkItemMath(quote);
  
  // Återställ ROT/RUT-värden efter Math Guard
  mathGuardResult.correctedQuote.deductionType = deductionType;
  mathGuardResult.correctedQuote.summary.rotRutDeduction = deductionAmount;
  mathGuardResult.correctedQuote.summary.rotDeduction = rotDeduction;
  mathGuardResult.correctedQuote.summary.rutDeduction = rutDeduction;
  mathGuardResult.correctedQuote.summary.customerPays = customerPays;

  return {
    quote: mathGuardResult.correctedQuote,
    flags: { customerProvidesMaterial: flags.customerProvidesMaterial, noComplexity: false },
    corrections: { totalCorrections: 0, workItemsCorrected: 0, totalsCorrected: false },
    mergeResult,
    domainValidation,
    jobDefinition: jobDef,
    appliedFallbacks,
    summary: mathGuardResult.correctedQuote.summary,
    traceLog
  };
}

export function applyMathGuard(quote: any): any {
  const result = enforceWorkItemMath(quote);
  return result.correctedQuote;
}
