/**
 * DOMAIN VALIDATOR - FAS 3: Konsoliderad validering via jobRegistry
 * Alla jobbtyper valideras nu med samma funktion baserat på jobRegistry-regler
 */

import type { JobDefinition } from './jobRegistry.ts';

export interface DomainValidationResult {
  jobType: string;
  passed: boolean;
  errors: string[];
  warnings: string[];
  missingItems: string[];
  underHouredItems: Array<{ name: string; actual: number; minimum: number }>;
  totalIssue?: { actual: number; minimum: number };
  summary: string;
  validatorUsed: string;
  autoFixAttempted: boolean;
  autoFixSuccess?: boolean;
}

export interface ValidationOptions {
  autoFix?: boolean;
  strictMode?: boolean;
}

/**
 * FAS 3: Unified domain validation using jobRegistry
 * Validates quotes against JobDefinition rules for all job types
 */
export async function validateQuoteDomain(
  quote: any,
  jobDef: JobDefinition,
  options: ValidationOptions = {}
): Promise<DomainValidationResult> {
  
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingItems: string[] = [];
  const underHouredItems: Array<{ name: string; actual: number; minimum: number }> = [];
  let autoFixAttempted = false;
  let autoFixSuccess = false;
  
  console.log(`🔍 Validating quote for job type: ${jobDef.jobType}`);
  
  const workItems = quote.workItems || [];
  const totalHours = workItems.reduce((sum: number, item: any) => sum + (item.hours || 0), 0);
  const unitQty = quote.measurements?.unitQty || quote.measurements?.area || 0;
  
  // 1. Check mandatory work items from standardWorkItems
  if (jobDef.standardWorkItems) {
    const mandatoryItems = jobDef.standardWorkItems.filter(item => item.mandatory);
    
    for (const mandatory of mandatoryItems) {
      const found = workItems.find((item: any) => 
        item.name.toLowerCase().includes(mandatory.name.toLowerCase()) ||
        mandatory.name.toLowerCase().includes(item.name.toLowerCase())
      );
      
      if (!found) {
        missingItems.push(mandatory.name);
        errors.push(`Saknar obligatoriskt arbetsmoment: ${mandatory.name}`);
        
        // Auto-fix: Add missing mandatory item
        if (options.autoFix) {
          autoFixAttempted = true;
          const calculatedHours = mandatory.perUnit && unitQty > 0
            ? mandatory.typicalHours * unitQty
            : mandatory.typicalHours;
          
          workItems.push({
            name: mandatory.name,
            description: `Auto-tillagt obligatoriskt moment: ${mandatory.name}`,
            hours: calculatedHours,
            estimatedHours: calculatedHours,
            hourlyRate: quote.hourlyRate || jobDef.hourlyRateRange.typical,
            subtotal: calculatedHours * (quote.hourlyRate || jobDef.hourlyRateRange.typical),
            reasoning: 'Auto-tillagt: Obligatoriskt arbetsmoment'
          });
          autoFixSuccess = true;
          console.log(`✅ Auto-fix: Added missing mandatory item ${mandatory.name}`);
        }
      } else {
        // Check if hours are reasonable for mandatory items
        const expectedHours = mandatory.perUnit && unitQty > 0
          ? mandatory.typicalHours * unitQty
          : mandatory.typicalHours;
        
        const minHours = expectedHours * 0.5; // Allow 50% deviation
        
        if (found.hours < minHours) {
          underHouredItems.push({
            name: found.name,
            actual: found.hours,
            minimum: minHours
          });
          warnings.push(`${found.name} har få timmar: ${found.hours}h (förväntat ~${expectedHours.toFixed(1)}h)`);
        }
      }
    }
  }
  
  // 2. Check proportion rules
  if (jobDef.proportionRules && totalHours > 0) {
    const rules = jobDef.proportionRules;
    
    // Check max single item share
    if (rules.maxSingleItemShare) {
      for (const item of workItems) {
        const share = item.hours / totalHours;
        if (share > rules.maxSingleItemShare) {
          warnings.push(
            `${item.name} utgör ${(share * 100).toFixed(0)}% av total tid ` +
            `(max ${(rules.maxSingleItemShare * 100).toFixed(0)}%)`
          );
        }
      }
    }
    
    // Check demolition share
    if (rules.demolitionMaxShare) {
      const demolitionItems = workItems.filter((item: any) => 
        item.name.toLowerCase().includes('rivning') ||
        item.name.toLowerCase().includes('demonter')
      );
      const demolitionHours = demolitionItems.reduce((sum: number, item: any) => sum + item.hours, 0);
      const demolitionShare = demolitionHours / totalHours;
      
      if (demolitionShare > rules.demolitionMaxShare) {
        warnings.push(
          `Rivningstid är ${(demolitionShare * 100).toFixed(0)}% ` +
          `(max ${(rules.demolitionMaxShare * 100).toFixed(0)}%)`
        );
      }
    }
    
    // Check minimum work items count
    if (rules.minWorkItems && workItems.length < rules.minWorkItems) {
      warnings.push(`För få arbetsmoment: ${workItems.length} (minimum ${rules.minWorkItems})`);
    }
  }
  
  // 3. Validate against time bounds (calculated from timePerUnit)
  if (unitQty > 0 && jobDef.timePerUnit) {
    const complexity = quote.context?.complexity || 'normal';
    const expectedTime = jobDef.timePerUnit[complexity as keyof typeof jobDef.timePerUnit] * unitQty;
    const minTime = expectedTime * 0.5;  // Allow 50% below
    const maxTime = expectedTime * 2.0;  // Allow 100% above
    
    if (totalHours < minTime) {
      warnings.push(
        `Total tid verkar låg: ${totalHours}h för ${unitQty} ${jobDef.unitType} ` +
        `(förväntat ~${expectedTime.toFixed(1)}h)`
      );
    } else if (totalHours > maxTime) {
      warnings.push(
        `Total tid verkar hög: ${totalHours}h för ${unitQty} ${jobDef.unitType} ` +
        `(förväntat ~${expectedTime.toFixed(1)}h)`
      );
    }
  }
  
  // Determine if validation passed (only errors fail validation, not warnings)
  const passed = errors.length === 0;
  
  // Generate summary
  let summary = '';
  if (passed) {
    summary = warnings.length > 0 
      ? `Validering godkänd med ${warnings.length} varningar`
      : 'Validering godkänd';
  } else {
    summary = `Validering misslyckades: ${errors.length} fel, ${warnings.length} varningar`;
  }
  
  if (autoFixAttempted) {
    summary += autoFixSuccess ? ' (auto-korrigerad)' : ' (auto-korrigering misslyckades)';
  }
  
  console.log(`📊 Validation result: ${summary}`);
  
  return {
    jobType: jobDef.jobType,
    passed,
    errors,
    warnings,
    missingItems,
    underHouredItems,
    summary,
    validatorUsed: 'jobRegistry',
    autoFixAttempted,
    autoFixSuccess: autoFixAttempted ? autoFixSuccess : undefined
  };
}
