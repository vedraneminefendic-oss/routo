/**
 * DOMAIN VALIDATOR - FAS 1: Konsoliderad validering via jobRegistry
 * Alla requirements är nu i jobRegistry.ts, inga separata validators behövs
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
 * FAS 1: Validering sker nu via globalValidator + jobRegistry
 * Denna funktion är en stub för bakåtkompatibilitet
 */
export async function validateQuoteDomain(
  quote: any,
  jobDef: JobDefinition,
  options: ValidationOptions = {}
): Promise<DomainValidationResult> {
  
  console.log(`✅ Domain validation skipped (FAS 1: all validation now in globalValidator + jobRegistry)`);
  
  return {
    jobType: jobDef.type[0] || 'unknown',
    passed: true,
    errors: [],
    warnings: [],
    missingItems: [],
    underHouredItems: [],
    summary: 'Validation now handled by globalValidator + jobRegistry',
    validatorUsed: 'jobRegistry',
    autoFixAttempted: false
  };
}
