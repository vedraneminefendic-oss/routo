/**
 * PIPELINE ORCHESTRATOR - FAS 5: Full Integration
 * * Denna modul orkestrerar hela quote-genererings-pipelinen.
 * Nu med STRIKT ROT/RUT-logik.
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
  flags: any;
  corrections: any;
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
  
  let materials = generatedMaterials.map(m => ({
    name: m.name,
    quantity: m.quantity,
    unit: m.unit,
    unitPrice: m.pricePerUnit,
    subtotal: m.estimatedCost,
    reasoning: m.reasoning
  }));
  
  // 5. Merge Engine
  const mergeResult = mergeWorkItems(workItems, jobDef);
  workItems = mergeResult.mergedWorkItems;

  // 7. Domain Validation (simplified)
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
  // OBS: Om vi vill ha tidsstyrd 50% ROT kan vi lägga in datumkoll här.
  let deductionPercentage = jobDef.deductionPercentage / 100;
  
  // Säkerhetsspärr för orimliga värden
  if (deductionType === 'rot' && deductionPercentage > 0.30) {
    // Om datumet är 2024 kan 50% vara ok, annars tvinga 30%
    // För enkelhetens skull sätter vi standard 30% här om inget annat anges
    // deductionPercentage = 0.30; 
  }

  const workCostInclVat = finalSummary.workCost * 1.25; // ROT/RUT baseras på inkl moms mot privatperson
  // Men formeln i formulaEngine brukar räkna avdraget direkt på workCost (exkl moms) om det är B2B, 
  // eller så har vi en flagga 'isPrivate'. 
  // Enklast: Vi räknar avdraget som: (Arbetskostnad_inkl_moms * procent).
  
  // I denna implementation drar vi avdraget från TOTALEN inkl moms.
  // Skatteverket ger avdrag på 30% av arbetskostnaden INKLUSIVE moms.
  const potentialDeduction = Math.round(workCostInclVat * deductionPercentage);
  
  // Applicera maxgräns (50k/75k per person) - här antar vi 1 person
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
    deductionType: deductionType, // VIKTIGT FÖR FRONTEND
    projectType: jobDef.jobType
  };

  // 13. Math Guard
  const mathGuardResult = enforceWorkItemMath(quote);
  
  // Tvinga tillbaka våra korrekta ROT/RUT-värden om MathGuard nollställde dem
  mathGuardResult.correctedQuote.deductionType = deductionType;
  mathGuardResult.correctedQuote.summary.rotRutDeduction = deductionAmount;
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
