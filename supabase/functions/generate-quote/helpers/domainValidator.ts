/**
 * DOMAIN VALIDATOR - Unified orchestrator for job-specific validations
 * 
 * This module coordinates all domain-specific validation rules:
 * - Bathroom: validateBathroomQuote
 * - Kitchen: validateKitchenQuote
 * - Painting: validatePaintingQuote
 * - Cleaning: validateCleaningQuote
 * - Gardening/Tree felling: validateGardeningQuote
 * - Electrical: validateElectricalQuote
 * 
 * Used in Pipeline Step 6 (after Merge, before final Formula Engine)
 */

import { validateBathroomQuote, generateValidationSummary as generateBathroomSummary, autoFixBathroomQuote } from './validateBathroomQuote.ts';
import { validateKitchenQuote, generateKitchenValidationSummary } from './validateKitchenQuote.ts';
import { validatePaintingQuote, generatePaintingValidationSummary } from './validatePaintingQuote.ts';
import { validateCleaningQuote, generateCleaningValidationSummary } from './validateCleaningQuote.ts';
import { validateGardeningQuote, generateGardeningValidationSummary } from './validateGardeningQuote.ts';
import { validateElectricalQuote, generateElectricalValidationSummary } from './validateElectricalQuote.ts';
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
 * Main entry point: Validates quote based on job type
 */
export async function validateQuoteDomain(
  quote: any,
  jobDef: JobDefinition,
  options: ValidationOptions = {}
): Promise<DomainValidationResult> {
  
  console.log(`\n🔍 ===== DOMAIN VALIDATION: ${jobDef.jobType} =====`);
  
  const jobType = jobDef.jobType.toLowerCase();
  
  // Extract parameters needed for validation
  const area = quote.measurements?.area || quote.area || 0;
  const quantity = quote.measurements?.quantity || quote.quantity || area;
  
  // Route to appropriate validator
  let result: DomainValidationResult;
  
  if (jobType.includes('badrum')) {
    result = await validateBathroom(quote, area, jobDef, options);
  } else if (jobType.includes('kök')) {
    result = validateKitchen(quote, area, jobDef);
  } else if (jobType.includes('målning') || jobType.includes('mala')) {
    result = validatePainting(quote, area, jobDef);
  } else if (jobType.includes('städ')) {
    result = validateCleaning(quote, area, jobDef);
  } else if (jobType.includes('trädgård') || jobType.includes('fäll')) {
    result = validateGardening(quote, quantity, jobDef);
  } else if (jobType.includes('el') || jobType.includes('elektr')) {
    result = validateElectrical(quote, jobDef);
  } else {
    result = validateGeneric(quote, jobDef);
  }
  
  console.log(`\n🔍 DOMAIN VALIDATION RESULT:`);
  console.log(`   Passed: ${result.passed}`);
  console.log(`   Errors: ${result.errors.length}`);
  console.log(`   Warnings: ${result.warnings.length}`);
  
  if (!result.passed) {
    console.error(`❌ Validation failed for ${jobType}:`, result.errors);
  } else if (result.warnings.length > 0) {
    console.warn(`⚠️ Validation passed with warnings:`, result.warnings);
  } else {
    console.log(`✅ Domain validation passed`);
  }
  
  return result;
}

/**
 * Bathroom validation with auto-fix support
 */
async function validateBathroom(
  quote: any,
  area: number,
  jobDef: JobDefinition,
  options: ValidationOptions
): Promise<DomainValidationResult> {
  
  const validation = validateBathroomQuote(quote, area);
  
  let autoFixAttempted = false;
  let autoFixSuccess = false;
  let finalQuote = quote;
  
  // Extract missing items from validation issues
  const missingItems = validation.missing || [];
  
  // Attempt auto-fix if enabled and validation failed
  if (options.autoFix && !validation.isValid && missingItems.length > 0) {
    console.log('🔧 Attempting auto-fix for bathroom quote...');
    autoFixAttempted = true;
    
    try {
      finalQuote = await autoFixBathroomQuote(
        quote, 
        missingItems, 
        area,
        jobDef.jobType
      );
      
      // Re-validate after fix
      const revalidation = validateBathroomQuote(finalQuote, area);
      autoFixSuccess = revalidation.isValid;
      
      if (autoFixSuccess) {
        console.log('✅ Auto-fix successful');
        // Update the original quote object
        Object.assign(quote, finalQuote);
      } else {
        console.warn('⚠️ Auto-fix applied but validation still fails');
      }
    } catch (error) {
      console.error('❌ Auto-fix failed:', error);
    }
  }
  
  return {
    jobType: jobDef.jobType,
    passed: validation.isValid,
    errors: validation.issues.filter(i => i.severity === 'ERROR' || i.severity === 'CRITICAL').map(i => i.message),
    warnings: validation.issues.filter(i => i.severity === 'WARNING' || i.severity === 'INFO').map(i => i.message),
    missingItems: missingItems,
    underHouredItems: [], // Bathroom validator doesn't track this separately
    totalIssue: validation.expectedMinPrice ? {
      actual: quote.summary?.totalBeforeVAT || 0,
      minimum: validation.expectedMinPrice
    } : undefined,
    summary: generateBathroomSummary(validation),
    validatorUsed: 'validateBathroomQuote',
    autoFixAttempted,
    autoFixSuccess
  };
}

/**
 * Kitchen validation
 */
function validateKitchen(
  quote: any,
  area: number,
  jobDef: JobDefinition
): DomainValidationResult {
  
  const validation = validateKitchenQuote(quote, area);
  
  return {
    jobType: jobDef.jobType,
    passed: validation.passed,
    errors: validation.errors,
    warnings: validation.warnings,
    missingItems: validation.missingItems,
    underHouredItems: validation.underHouredItems,
    totalIssue: validation.totalIssue,
    summary: generateKitchenValidationSummary(validation),
    validatorUsed: 'validateKitchenQuote',
    autoFixAttempted: false
  };
}

/**
 * Painting validation
 */
function validatePainting(
  quote: any,
  area: number,
  jobDef: JobDefinition
): DomainValidationResult {
  
  const validation = validatePaintingQuote(quote, area);
  
  return {
    jobType: jobDef.jobType,
    passed: validation.passed,
    errors: validation.errors,
    warnings: validation.warnings,
    missingItems: validation.missingItems,
    underHouredItems: validation.underHouredItems,
    totalIssue: validation.totalIssue,
    summary: generatePaintingValidationSummary(validation),
    validatorUsed: 'validatePaintingQuote',
    autoFixAttempted: false
  };
}

/**
 * Cleaning validation
 */
function validateCleaning(
  quote: any,
  area: number,
  jobDef: JobDefinition
): DomainValidationResult {
  
  const validation = validateCleaningQuote(quote, area);
  
  return {
    jobType: jobDef.jobType,
    passed: validation.passed,
    errors: validation.errors,
    warnings: validation.warnings,
    missingItems: validation.missingItems,
    underHouredItems: validation.underHouredItems,
    totalIssue: validation.totalIssue,
    summary: generateCleaningValidationSummary(validation),
    validatorUsed: 'validateCleaningQuote',
    autoFixAttempted: false
  };
}

/**
 * Gardening/Tree felling validation
 */
function validateGardening(
  quote: any,
  quantity: number,
  jobDef: JobDefinition
): DomainValidationResult {
  
  const validation = validateGardeningQuote(quote, quantity);
  
  return {
    jobType: jobDef.jobType,
    passed: validation.passed,
    errors: validation.errors,
    warnings: validation.warnings,
    missingItems: validation.missingItems,
    underHouredItems: validation.underHouredItems,
    totalIssue: undefined, // Gardening validator doesn't provide this
    summary: generateGardeningValidationSummary(validation),
    validatorUsed: 'validateGardeningQuote',
    autoFixAttempted: false
  };
}

/**
 * Electrical validation
 */
function validateElectrical(
  quote: any,
  jobDef: JobDefinition
): DomainValidationResult {
  
  const validation = validateElectricalQuote(quote);
  
  return {
    jobType: jobDef.jobType,
    passed: validation.passed,
    errors: validation.errors,
    warnings: validation.warnings,
    missingItems: validation.missingItems,
    underHouredItems: validation.underHouredItems,
    totalIssue: undefined, // Electrical validator doesn't provide this
    summary: generateElectricalValidationSummary(validation),
    validatorUsed: 'validateElectricalQuote',
    autoFixAttempted: false
  };
}

/**
 * Generic validation for job types without specific validators
 */
function validateGeneric(
  quote: any,
  jobDef: JobDefinition
): DomainValidationResult {
  
  console.log(`⚠️ No specific validator for job type: ${jobDef.jobType}, using generic checks`);
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Basic checks
  if (!quote.workItems || quote.workItems.length === 0) {
    errors.push('Offerten saknar arbetsmoment');
  }
  
  if (quote.summary?.totalBeforeVAT <= 0) {
    errors.push('Total kostnad är 0 kr eller negativ');
  }
  
  // Check against proportion rules if available
  if (jobDef.proportionRules) {
    const totalHours = quote.workItems?.reduce((sum: number, w: any) => sum + (w.hours || 0), 0) || 0;
    
    if (jobDef.proportionRules.minWorkItems && quote.workItems.length < jobDef.proportionRules.minWorkItems) {
      warnings.push(
        `Offerten innehåller endast ${quote.workItems.length} arbetsmoment (rekommenderat minimum: ${jobDef.proportionRules.minWorkItems})`
      );
    }
    
    if (totalHours > 0) {
      quote.workItems?.forEach((item: any) => {
        const share = item.hours / totalHours;
        if (share > jobDef.proportionRules!.maxSingleItemShare) {
          warnings.push(
            `"${item.name}" utgör ${(share * 100).toFixed(0)}% av total arbetstid (max ${(jobDef.proportionRules!.maxSingleItemShare * 100).toFixed(0)}%)`
          );
        }
      });
    }
  }
  
  return {
    jobType: jobDef.jobType,
    passed: errors.length === 0,
    errors,
    warnings,
    missingItems: [],
    underHouredItems: [],
    summary: errors.length === 0 
      ? 'Generic validation passed'
      : `Generic validation failed: ${errors.join(', ')}`,
    validatorUsed: 'validateGeneric',
    autoFixAttempted: false
  };
}

/**
 * Helper: Add validation warnings to quote object
 */
export function attachValidationWarnings(
  quote: any,
  validationResult: DomainValidationResult
): void {
  
  if (!quote.validationWarnings) {
    quote.validationWarnings = [];
  }
  
  // Add errors as high-priority warnings
  validationResult.errors.forEach(error => {
    quote.validationWarnings.push(`❌ ${error}`);
  });
  
  // Add warnings
  validationResult.warnings.forEach(warning => {
    quote.validationWarnings.push(`⚠️ ${warning}`);
  });
  
  // Add missing items
  if (validationResult.missingItems.length > 0) {
    quote.validationWarnings.push(
      `📋 Saknade arbetsmoment: ${validationResult.missingItems.join(', ')}`
    );
  }
  
  // Add under-houred items
  if (validationResult.underHouredItems.length > 0) {
    validationResult.underHouredItems.forEach(item => {
      quote.validationWarnings.push(
        `⏱️ ${item.name}: ${item.actual}h (minimum ${item.minimum}h)`
      );
    });
  }
}
