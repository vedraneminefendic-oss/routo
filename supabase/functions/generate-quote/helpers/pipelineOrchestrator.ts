/**
 * PIPELINE ORCHESTRATOR - Central koordinator för offertgenerering
 * 
 * Denna modul orkestrerar hela quote-genererings-pipelinen i rätt ordning:
 * 1. Hämta JobDefinition från registry
 * 2. Applicera fallbacks (area, complexity)
 * 3. Detektera flags (customerProvidesMaterial, noComplexity)
 * 4. Merge pass 1 (normalisera dubbletter)
 * 5. Formula Engine pass 1 (räkna timmar och priser)
 * 6. Domain validation (jobbtyps-specifika regler)
 * 7. Merge pass 2 (efter korrigeringar)
 * 8. Formula Engine pass 2 (omräkning)
 * 9. Filtrera kund-material
 * 10. FINAL MATH GUARD (obligatoriskt)
 * 11. Log report
 * 
 * VIKTIGT: Denna pipeline ska användas för ALLA jobbtyper - ingen hårdkodad logik.
 */

import { enforceWorkItemMath, logQuoteReport } from './mathGuard.ts';
import { detectFlags, filterCustomerProvidedMaterials } from './flagDetector.ts';
import { findJobDefinition, type JobDefinition } from './jobRegistry.ts';
import { mergeWorkItems, logMergeReport, type MergeResult } from './mergeEngine.ts';
import { validateQuoteDomain, type DomainValidationResult } from './domainValidator.ts';

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
 * Validera proportioner och minsta krav
 */
function validateProportions(
  workItems: any[],
  jobDef: JobDefinition
): { passed: boolean; warnings: string[] } {
  
  const warnings: string[] = [];
  const rules = jobDef.proportionRules;
  
  if (!rules) {
    return { passed: true, warnings: [] };
  }

  const totalHours = workItems.reduce((sum, w) => sum + (w.hours || 0), 0);

  // Kontrollera att inget enskilt moment är >50% av total tid
  workItems.forEach(item => {
    const share = totalHours > 0 ? (item.hours / totalHours) : 0;
    if (share > rules.maxSingleItemShare) {
      warnings.push(
        `"${item.name}" utgör ${(share * 100).toFixed(0)}% av total arbetstid (max ${(rules.maxSingleItemShare * 100).toFixed(0)}%)`
      );
    }
  });

  // Kontrollera att rivning inte är >30% av total tid
  const demolitionItem = workItems.find(w => 
    w.name.toLowerCase().includes('rivning') || 
    w.name.toLowerCase().includes('demontering')
  );
  
  if (demolitionItem && rules.demolitionMaxShare) {
    const demolitionShare = totalHours > 0 ? (demolitionItem.hours / totalHours) : 0;
    if (demolitionShare > rules.demolitionMaxShare) {
      warnings.push(
        `Rivning utgör ${(demolitionShare * 100).toFixed(0)}% av total arbetstid (max ${(rules.demolitionMaxShare * 100).toFixed(0)}%)`
      );
    }
  }

  // Kontrollera minsta antal workItems
  if (rules.minWorkItems && workItems.length < rules.minWorkItems) {
    warnings.push(
      `Offerten innehåller endast ${workItems.length} arbetsmoment (minimum: ${rules.minWorkItems})`
    );
  }

  return {
    passed: warnings.length === 0,
    warnings
  };
}

/**
 * HUVUDFUNKTION: Kör hela pipelinen
 * 
 * OBS: Denna funktion är en "skeleton" som ska integreras med befintlig generate-quote.
 * I Fas 2 ska vi flytta all logik hit och ta bort hårdkodning i generate-quote/index.ts.
 */
export async function runQuotePipeline(
  userInput: ParsedInput,
  context: QuoteContext
): Promise<PipelineResult> {
  
  console.log('\n🏗️ ===== PIPELINE ORCHESTRATOR: Starting =====');
  
  // ============================================
  // STEG 1: Hämta JobDefinition
  // ============================================
  
  const jobDef = findJobDefinition(userInput.jobType || '', context.supabase);
  
  if (!jobDef) {
    console.warn('⚠️ No job definition found - using generic fallback');
  } else {
    console.log(`✅ Job definition found: ${jobDef.jobType}`);
  }
  
  // ============================================
  // STEG 2: Applicera fallbacks
  // ============================================
  
  const { params, appliedFallbacks } = applyFallbacks(userInput, jobDef!);
  console.log(`📐 Applied ${appliedFallbacks.length} fallbacks`);
  
  // ============================================
  // STEG 3: Detektera flags
  // ============================================
  
  const flags = detectFlags(
    params.conversationHistory || [],
    params.description
  );
  
  // ============================================
  // STEG 4: MERGE ENGINE - Normalisera och slå samman dubbletter
  // ============================================
  
  let workItems = params.workItems || [];
  
  const mergeResult = mergeWorkItems(workItems, jobDef || undefined);
  
  if (mergeResult.duplicatesRemoved > 0 || mergeResult.itemsNormalized > 0) {
    console.log(`🔀 MERGE: Removed ${mergeResult.duplicatesRemoved} duplicates, normalized ${mergeResult.itemsNormalized} items`);
    logMergeReport(mergeResult);
  }
  
  // Använd de mergade workItems från och med nu
  workItems = mergeResult.mergedWorkItems;
  
  // ============================================
  // STEG 5-8: FORMULA ENGINE
  // ============================================
  
  // TODO: I nästa fas ska Formula Engine integreras här för att beräkna allt
  console.log('⚠️ STEG 5-8: Formula Engine - Will be integrated in next phase');
  
  // ============================================
  // STEG 6: DOMAIN VALIDATION
  // ============================================
  
  // Bygg temporär quote för validering (innan final totals)
  const tempQuote: any = {
    ...params,
    workItems,
    materials: params.materials || [],
    equipment: params.equipment || [],
    summary: params.summary || {
      workCost: 0,
      materialCost: 0,
      equipmentCost: 0,
      totalBeforeVAT: 0,
      vatAmount: 0,
      totalWithVAT: 0,
      customerPays: 0
    }
  };
  
  // Kör domain-specifik validering
  const domainValidation = await validateQuoteDomain(
    tempQuote,
    jobDef!,
    { autoFix: true, strictMode: false }
  );
  
  // Om auto-fix kördes, uppdatera workItems
  if (domainValidation.autoFixAttempted && domainValidation.autoFixSuccess) {
    console.log('✅ Auto-fix applied, updating work items');
    workItems = tempQuote.workItems;
  }
  
  // ============================================
  // STEG 7: Filtrera kund-material
  // ============================================
  
  let materials = params.materials || [];
  
  if (flags.customerProvidesMaterial && flags.customerProvidesDetails) {
    materials = filterCustomerProvidedMaterials(
      materials,
      flags.customerProvidesDetails.materials
    );
  }
  
  // ============================================
  // STEG 8: Bygg quote (temporärt, ska flyttas till Formula Engine)
  // ============================================
  
  const quote: any = {
    ...params,
    workItems,  // Använd mergade workItems
    materials,
    equipment: params.equipment || [],
    summary: params.summary || {
      workCost: 0,
      materialCost: 0,
      equipmentCost: 0,
      totalBeforeVAT: 0,
      vatAmount: 0,
      totalWithVAT: 0,
      customerPays: 0
    },
    assumptions: [
      ...(params.assumptions || []),
      ...appliedFallbacks.map(f => ({ text: f, confidence: 80 })),
      // Lägg till merge-info som assumptions
      ...mergeResult.mergeOperations.map(op => ({
        text: `Slog samman "${op.originalItems.join(', ')}" till "${op.mergedInto}"`,
        confidence: 95
      }))
    ],
    customerResponsibilities: params.customerResponsibilities || [],
    validationWarnings: params.validationWarnings || []
  };
  
  // Lägg till flags till quote
  if (flags.customerProvidesMaterial) {
    quote.customerResponsibilities = [
      ...quote.customerResponsibilities,
      `Kund tillhandahåller ${flags.customerProvidesDetails?.materials.join(', ')}`
    ];
  }
  
  // ============================================
  // STEG 9: Domain validation now consolidated in globalValidator
  // ============================================
  
  // FAS 1: Validation warnings now handled by globalValidator
  
  // ============================================
  // STEG 10: Validera proportioner
  // ============================================
  
  if (jobDef?.proportionRules) {
    const proportionValidation = validateProportions(quote.workItems, jobDef);
    
    if (!proportionValidation.passed) {
      console.warn('⚠️ PROPORTION WARNINGS:');
      proportionValidation.warnings.forEach(w => console.warn(`   - ${w}`));
      
      quote.validationWarnings = [
        ...quote.validationWarnings,
        ...proportionValidation.warnings
      ];
    }
  }
  
  // ============================================
  // STEG 11: FINAL MATH GUARD (OBLIGATORISKT)
  // ============================================
  
  const mathGuardResult = enforceWorkItemMath(quote);
  
  // ============================================
  // STEG 12: Log report
  // ============================================
  
  logQuoteReport(mathGuardResult.correctedQuote);
  
  console.log('🏗️ PIPELINE ORCHESTRATOR: Complete\n');
  
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
    jobDefinition: jobDef!,
    appliedFallbacks
  };
}

/**
 * Enkel wrapper för att bara köra Math Guard (för befintlig kod)
 */
export function applyMathGuard(quote: any): any {
  const result = enforceWorkItemMath(quote);
  return result.correctedQuote;
}
