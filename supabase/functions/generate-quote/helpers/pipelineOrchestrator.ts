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
  // STEG 4-8: MERGE & FORMULA ENGINE
  // ============================================
  
  // TODO: I Fas 2 ska vi flytta all merge- och formula-logik hit
  // För nu returnerar vi input direkt för att inte bryta befintlig funktionalitet
  
  console.log('⚠️ STEG 4-8: Skipped (kommer implementeras i Fas 2)');
  
  // ============================================
  // STEG 9: Filtrera kund-material
  // ============================================
  
  let materials = params.materials || [];
  
  if (flags.customerProvidesMaterial && flags.customerProvidesDetails) {
    materials = filterCustomerProvidedMaterials(
      materials,
      flags.customerProvidesDetails.materials
    );
  }
  
  // ============================================
  // STEG 10: Bygg quote (temporärt, ska flyttas till Formula Engine)
  // ============================================
  
  const quote: any = {
    ...params,
    workItems: params.workItems || [],
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
      ...appliedFallbacks.map(f => ({ text: f, confidence: 80 }))
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
  // STEG 11: Validera proportioner
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
  // STEG 12: FINAL MATH GUARD (OBLIGATORISKT)
  // ============================================
  
  const mathGuardResult = enforceWorkItemMath(quote);
  
  // ============================================
  // STEG 13: Log report
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
