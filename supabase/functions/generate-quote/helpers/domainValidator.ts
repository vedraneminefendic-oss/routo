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
  
  // Skip validation if no requirements defined
  if (!jobDef.minimalRequirements) {
    return {
      jobType: jobDef.jobType,
      passed: true,
      errors: [],
      warnings: [],
      missingItems: [],
      underHouredItems: [],
      summary: 'No requirements defined for this job type',
      validatorUsed: 'jobRegistry',
      autoFixAttempted: false
    };
  }
  
  const workItems = quote.workItems || [];
  const totalHours = workItems.reduce((sum: number, item: any) => sum + (item.hours || 0), 0);
  
  // 1. Check required items
  if (jobDef.minimalRequirements.requiredItems) {
    for (const required of jobDef.minimalRequirements.requiredItems) {
      const found = workItems.find((item: any) => 
        item.name.toLowerCase().includes(required.name.toLowerCase()) ||
        required.name.toLowerCase().includes(item.name.toLowerCase())
      );
      
      if (!found) {
        missingItems.push(required.name);
        errors.push(`Saknar obligatorisk arbetspost: ${required.name}`);
        
        // Auto-fix: Add missing item
        if (options.autoFix) {
          autoFixAttempted = true;
          const standardItem = jobDef.standardWorkItems?.find(std => 
            std.name.toLowerCase().includes(required.name.toLowerCase())
          );
          
          if (standardItem) {
            workItems.push({
              name: standardItem.name,
              description: standardItem.reasoning || `Lägg till ${standardItem.name}`,
              hours: Math.max(required.minHours || 0, standardItem.hours || 0),
              estimatedHours: Math.max(required.minHours || 0, standardItem.hours || 0),
              hourlyRate: quote.hourlyRate || 650,
              subtotal: (Math.max(required.minHours || 0, standardItem.hours || 0)) * (quote.hourlyRate || 650),
              reasoning: `Auto-tillagd: ${standardItem.reasoning || 'Obligatorisk arbetspost'}`
            });
            autoFixSuccess = true;
            console.log(`✅ Auto-fix: Added missing item ${standardItem.name}`);
          }
        }
      } else if (required.minHours && found.hours < required.minHours) {
        underHouredItems.push({
          name: found.name,
          actual: found.hours,
          minimum: required.minHours
        });
        warnings.push(`${found.name} har för få timmar: ${found.hours}h (minimum ${required.minHours}h)`);
        
        // Auto-fix: Increase hours
        if (options.autoFix) {
          autoFixAttempted = true;
          found.hours = required.minHours;
          found.estimatedHours = required.minHours;
          found.subtotal = required.minHours * (found.hourlyRate || quote.hourlyRate || 650);
          found.reasoning = (found.reasoning || '') + ` [Auto-justerad till minimum ${required.minHours}h]`;
          autoFixSuccess = true;
          console.log(`✅ Auto-fix: Increased ${found.name} to ${required.minHours}h`);
        }
      }
    }
  }
  
  // 2. Check minimum total hours
  if (jobDef.minimalRequirements.minTotalHours && totalHours < jobDef.minimalRequirements.minTotalHours) {
    errors.push(`Total tid för låg: ${totalHours}h (minimum ${jobDef.minimalRequirements.minTotalHours}h)`);
    
    // Auto-fix: Distribute extra hours proportionally
    if (options.autoFix && workItems.length > 0) {
      autoFixAttempted = true;
      const deficit = jobDef.minimalRequirements.minTotalHours - totalHours;
      const hoursPerItem = deficit / workItems.length;
      
      workItems.forEach((item: any) => {
        item.hours += hoursPerItem;
        item.estimatedHours = item.hours;
        item.subtotal = item.hours * (item.hourlyRate || quote.hourlyRate || 650);
        item.reasoning = (item.reasoning || '') + ` [Auto-justerad +${hoursPerItem.toFixed(1)}h]`;
      });
      autoFixSuccess = true;
      console.log(`✅ Auto-fix: Distributed ${deficit}h across ${workItems.length} items`);
    }
  }
  
  // 3. Check max single item share
  if (jobDef.minimalRequirements.maxSingleItemShare && totalHours > 0) {
    const maxShare = jobDef.minimalRequirements.maxSingleItemShare;
    
    for (const item of workItems) {
      const share = item.hours / totalHours;
      if (share > maxShare) {
        warnings.push(`${item.name} utgör ${(share * 100).toFixed(0)}% av total tid (max ${(maxShare * 100).toFixed(0)}%)`);
      }
    }
  }
  
  // 4. Check proportion rules if defined
  if (jobDef.proportionRules && totalHours > 0) {
    const rules = jobDef.proportionRules;
    
    if (rules.demolitionTimeMax) {
      const demolitionItems = workItems.filter((item: any) => 
        item.name.toLowerCase().includes('rivning') ||
        item.name.toLowerCase().includes('demontera')
      );
      const demolitionHours = demolitionItems.reduce((sum: number, item: any) => sum + item.hours, 0);
      const demolitionShare = demolitionHours / totalHours;
      
      if (demolitionShare > rules.demolitionTimeMax) {
        warnings.push(`Rivningstid är ${(demolitionShare * 100).toFixed(0)}% (max ${(rules.demolitionTimeMax * 100).toFixed(0)}%)`);
      }
    }
    
    if (rules.minWorkItems && workItems.length < rules.minWorkItems) {
      warnings.push(`För få arbetsmoment: ${workItems.length} (minimum ${rules.minWorkItems})`);
    }
  }
  
  // Determine if validation passed
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
    totalIssue: jobDef.minimalRequirements.minTotalHours && totalHours < jobDef.minimalRequirements.minTotalHours
      ? { actual: totalHours, minimum: jobDef.minimalRequirements.minTotalHours }
      : undefined,
    summary,
    validatorUsed: 'jobRegistry',
    autoFixAttempted,
    autoFixSuccess: autoFixAttempted ? autoFixSuccess : undefined
  };
}
