/**
 * REGRESSION TESTS - FAS 4: Verifiering av alla faser
 * Testar att Fas 1-3 fungerar korrekt tillsammans
 */

import { findJobDefinition } from './jobRegistry.ts';
import { generateMaterialsFromJobDefinition } from './materialsFromJobDef.ts';
import { validateQuoteDomain } from './domainValidator.ts';
import { enforceWorkItemMath } from './mathGuard.ts';

export interface TestResult {
  testName: string;
  passed: boolean;
  errors: string[];
  warnings: string[];
  details: any;
}

export interface RegressionTestSuite {
  suiteName: string;
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
  };
}

/**
 * Test 1: Städning 100 kvm - Verifierar perUnit flag och material calculations
 */
async function testCleaningPerUnit(): Promise<TestResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const details: any = {};
  
  try {
    // Hitta jobbdefinition
    const jobDef = findJobDefinition('flyttstadning');
    if (!jobDef) {
      errors.push('Kunde inte hitta jobDefinition för flyttstadning');
      return { testName: 'Städning 100 kvm', passed: false, errors, warnings, details };
    }
    details.jobDef = { jobType: jobDef.jobType, unitType: jobDef.unitType };
    
    // Verifiera perUnit flag på standardWorkItems
    const hasPerUnit = jobDef.standardWorkItems?.some(item => item.perUnit === true);
    if (!hasPerUnit) {
      warnings.push('Ingen standardWorkItem har perUnit=true');
    }
    details.perUnitItems = jobDef.standardWorkItems?.filter(i => i.perUnit).map(i => i.name);
    
    // Testa material-generering
    const unitQty = 100;
    const generatedMaterials = generateMaterialsFromJobDefinition(
      { unitQty, qualityLevel: 'standard' },
      jobDef
    );
    details.generatedMaterials = generatedMaterials;
    
    if (generatedMaterials.length === 0) {
      warnings.push('Inga material genererades');
    } else {
      details.materialCount = generatedMaterials.length;
      // Verifiera att materialkostnad är rimlig
      const totalMaterialCost = generatedMaterials.reduce((sum, m) => sum + m.estimatedCost, 0);
      if (totalMaterialCost < 100 || totalMaterialCost > 2000) {
        warnings.push(`Material kostnad verkar ovanlig: ${totalMaterialCost} kr`);
      }
      details.totalMaterialCost = totalMaterialCost;
    }
    
    // Skapa en mock-offert för validering
    const workCost = Math.round((unitQty * 0.15 + unitQty * 0.06) * 450);
    const materialCost = generatedMaterials.reduce((sum, m) => sum + m.estimatedCost, 0);
    const totalBeforeVAT = workCost + materialCost;
    const vatAmount = Math.round(totalBeforeVAT * 0.25);
    const totalWithVAT = totalBeforeVAT + vatAmount;
    
    const mockQuote = {
      workItems: [
        {
          name: 'Grundstädning',
          hours: unitQty * 0.15,
          estimatedHours: unitQty * 0.15,
          hourlyRate: 450,
          subtotal: Math.round(unitQty * 0.15 * 450)
        },
        {
          name: 'Sanitetsutrymmen',
          hours: unitQty * 0.06,
          estimatedHours: unitQty * 0.06,
          hourlyRate: 450,
          subtotal: Math.round(unitQty * 0.06 * 450)
        }
      ],
      materials: generatedMaterials.map(m => ({ name: m.name, subtotal: m.estimatedCost })),
      equipment: [],
      summary: {
        workCost,
        materialCost,
        equipmentCost: 0,
        totalBeforeVAT,
        vatAmount,
        totalWithVAT,
        customerPays: totalWithVAT
      },
      measurements: { unitQty, area: unitQty },
      hourlyRate: 450,
      context: { complexity: 'normal' }
    };
    
    // Test domain validation
    const validation = await validateQuoteDomain(mockQuote, jobDef, { autoFix: false });
    details.validation = {
      passed: validation.passed,
      errors: validation.errors,
      warnings: validation.warnings
    };
    
    if (!validation.passed) {
      errors.push(...validation.errors);
    }
    warnings.push(...validation.warnings);
    
    // Test math guard
    const mathResult = enforceWorkItemMath(mockQuote);
    details.mathCorrections = mathResult.corrections.length;
    
    if (mathResult.corrections.length > 0) {
      warnings.push(`Math guard gjorde ${mathResult.corrections.length} korrigeringar`);
    }
    
  } catch (error) {
    errors.push(`Test exception: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return {
    testName: 'Städning 100 kvm - perUnit & materials',
    passed: errors.length === 0,
    errors,
    warnings,
    details
  };
}

/**
 * Test 2: Målning 50 kvm - Verifierar material formulas och validering
 */
async function testPaintingMaterials(): Promise<TestResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const details: any = {};
  
  try {
    const jobDef = findJobDefinition('målning');
    if (!jobDef) {
      errors.push('Kunde inte hitta jobDefinition för målning');
      return { testName: 'Målning 50 kvm', passed: false, errors, warnings, details };
    }
    
    const unitQty = 50;
    
    // Verifiera att materialCalculations finns
    if (!jobDef.materialCalculations || jobDef.materialCalculations.length === 0) {
      errors.push('Målning saknar materialCalculations');
      return { testName: 'Målning 50 kvm', passed: false, errors, warnings, details };
    }
    details.materialCalculationsCount = jobDef.materialCalculations.length;
    
    // Generera material
    const materials = generateMaterialsFromJobDefinition(
      { unitQty, qualityLevel: 'standard' },
      jobDef
    );
    details.materials = materials.map(m => ({ 
      name: m.name, 
      quantity: m.quantity, 
      estimatedCost: m.estimatedCost 
    }));
    
    // Verifiera täckfärg-beräkning (unitQty / 6.5 liter)
    const tackfarg = materials.find(m => m.name.toLowerCase().includes('täckfärg'));
    if (tackfarg) {
      const expectedQty = Math.ceil(unitQty / 6.5);
      details.tackfargExpected = expectedQty;
      details.tackfargActual = tackfarg.quantity;
      
      if (Math.abs(tackfarg.quantity - expectedQty) > 0.1) {
        errors.push(`Täckfärg kvantitet fel: förväntad ${expectedQty}, fick ${tackfarg.quantity}`);
      }
    } else {
      warnings.push('Hittade inte täckfärg i genererade material');
    }
    
    // Skapa mock-offert
    const mockQuote = {
      workItems: [
        { name: 'Spackling och slipning', hours: 10, estimatedHours: 10, hourlyRate: 650, subtotal: 6500 },
        { name: 'Grundmålning', hours: 6, estimatedHours: 6, hourlyRate: 650, subtotal: 3900 },
        { name: 'Första strykn. täckfärg', hours: 8, estimatedHours: 8, hourlyRate: 650, subtotal: 5200 },
        { name: 'Andra strykn. täckfärg', hours: 5, estimatedHours: 5, hourlyRate: 650, subtotal: 3250 }
      ],
      materials,
      measurements: { unitQty, area: unitQty },
      hourlyRate: 650,
      context: { complexity: 'normal' }
    };
    
    // Validera
    const validation = await validateQuoteDomain(mockQuote, jobDef);
    details.validation = { passed: validation.passed, errors: validation.errors, warnings: validation.warnings };
    
    if (!validation.passed) {
      errors.push(...validation.errors);
    }
    warnings.push(...validation.warnings);
    
  } catch (error) {
    errors.push(`Test exception: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return {
    testName: 'Målning 50 kvm - material formulas',
    passed: errors.length === 0,
    errors,
    warnings,
    details
  };
}

/**
 * Test 3: Badrum - Verifierar mandatory items och validering
 */
async function testBathroomValidation(): Promise<TestResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const details: any = {};
  
  try {
    const jobDef = findJobDefinition('badrum');
    if (!jobDef) {
      errors.push('Kunde inte hitta jobDefinition för badrum');
      return { testName: 'Badrum validation', passed: false, errors, warnings, details };
    }
    
    // Test 1: Saknade obligatoriska moment
    const incompleteQuote = {
      workItems: [
        { name: 'Rivning', hours: 8, estimatedHours: 8, hourlyRate: 650, subtotal: 5200 }
      ],
      materials: [],
      measurements: { unitQty: 6, area: 6 },
      hourlyRate: 650
    };
    
    const validationIncomplete = await validateQuoteDomain(incompleteQuote, jobDef, { autoFix: false });
    details.incompleteValidation = {
      passed: validationIncomplete.passed,
      missingItems: validationIncomplete.missingItems,
      errors: validationIncomplete.errors
    };
    
    if (validationIncomplete.passed) {
      warnings.push('Validering godkände offert med saknade moment');
    }
    
    if (validationIncomplete.missingItems.length === 0) {
      warnings.push('Inga saknade moment detekterades');
    }
    
    // Test 2: Auto-fix
    const validationAutoFix = await validateQuoteDomain(incompleteQuote, jobDef, { autoFix: true });
    details.autoFixResult = {
      attempted: validationAutoFix.autoFixAttempted,
      success: validationAutoFix.autoFixSuccess,
      workItemsAfter: incompleteQuote.workItems.length
    };
    
    if (!validationAutoFix.autoFixAttempted) {
      warnings.push('Auto-fix kördes inte');
    }
    
    // Test 3: Komplett offert
    const materials = generateMaterialsFromJobDefinition(
      { unitQty: 6, qualityLevel: 'standard' },
      jobDef
    );
    
    const completeWorkCost = (10 + 16 + 8 + 20 + 6 + 5) * 650;
    const completeMaterialCost = materials.reduce((sum, m) => sum + m.estimatedCost, 0);
    const completeTotalBeforeVAT = completeWorkCost + completeMaterialCost;
    const completeVatAmount = Math.round(completeTotalBeforeVAT * 0.25);
    
    const completeQuote = {
      workItems: [
        { name: 'Rivning', hours: 10, estimatedHours: 10, hourlyRate: 650, subtotal: 6500 },
        { name: 'VVS-arbete', hours: 16, estimatedHours: 16, hourlyRate: 650, subtotal: 10400 },
        { name: 'Golvläggning', hours: 8, estimatedHours: 8, hourlyRate: 650, subtotal: 5200 },
        { name: 'Kakelsättning', hours: 20, estimatedHours: 20, hourlyRate: 650, subtotal: 13000 },
        { name: 'El-installation', hours: 6, estimatedHours: 6, hourlyRate: 650, subtotal: 3900 },
        { name: 'Målning', hours: 5, estimatedHours: 5, hourlyRate: 650, subtotal: 3250 }
      ],
      materials: materials.map(m => ({ name: m.name, subtotal: m.estimatedCost })),
      equipment: [],
      summary: {
        workCost: completeWorkCost,
        materialCost: completeMaterialCost,
        equipmentCost: 0,
        totalBeforeVAT: completeTotalBeforeVAT,
        vatAmount: completeVatAmount,
        totalWithVAT: completeTotalBeforeVAT + completeVatAmount,
        customerPays: completeTotalBeforeVAT + completeVatAmount
      },
      measurements: { unitQty: 6, area: 6 },
      hourlyRate: 650,
      context: { complexity: 'normal' }
    };
    
    const validationComplete = await validateQuoteDomain(completeQuote, jobDef);
    details.completeValidation = {
      passed: validationComplete.passed,
      errors: validationComplete.errors,
      warnings: validationComplete.warnings
    };
    
    if (!validationComplete.passed) {
      errors.push('Komplett offert godkändes inte');
      errors.push(...validationComplete.errors);
    }
    
  } catch (error) {
    errors.push(`Test exception: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return {
    testName: 'Badrum - mandatory items & validation',
    passed: errors.length === 0,
    errors,
    warnings,
    details
  };
}

/**
 * Test 4: Kök - Verifierar proportionRules
 */
async function testKitchenProportions(): Promise<TestResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const details: any = {};
  
  try {
    const jobDef = findJobDefinition('kök');
    if (!jobDef) {
      errors.push('Kunde inte hitta jobDefinition för kök');
      return { testName: 'Kök proportions', passed: false, errors, warnings, details };
    }
    
    // Verifiera proportionRules finns
    if (!jobDef.proportionRules) {
      warnings.push('Kök saknar proportionRules');
    } else {
      details.proportionRules = jobDef.proportionRules;
    }
    
    // Test med oproportionerlig rivning
    const badProportions = {
      workItems: [
        { name: 'Rivning', hours: 80, estimatedHours: 80, hourlyRate: 650, subtotal: 52000 }, // 80% av tiden
        { name: 'VVS', hours: 10, estimatedHours: 10, hourlyRate: 650, subtotal: 6500 },
        { name: 'Montering', hours: 10, estimatedHours: 10, hourlyRate: 650, subtotal: 6500 }
      ],
      materials: [],
      measurements: { unitQty: 12, area: 12 },
      hourlyRate: 650,
      context: { complexity: 'normal' }
    };
    
    const validation = await validateQuoteDomain(badProportions, jobDef);
    details.validation = {
      passed: validation.passed,
      warnings: validation.warnings
    };
    
    if (validation.warnings.length === 0) {
      warnings.push('Proportion-regler triggade inte varningar för oproportionerlig rivning');
    }
    
    warnings.push(...validation.warnings);
    
  } catch (error) {
    errors.push(`Test exception: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return {
    testName: 'Kök - proportion rules',
    passed: errors.length === 0,
    errors,
    warnings,
    details
  };
}

/**
 * Kör alla regression-tester
 */
export async function runRegressionTests(): Promise<RegressionTestSuite> {
  const startTime = Date.now();
  const results: TestResult[] = [];
  
  console.log('🧪 Starting Regression Tests - Fas 1-3 Verification');
  console.log('═══════════════════════════════════════════════════');
  
  // Kör alla tester
  results.push(await testCleaningPerUnit());
  results.push(await testPaintingMaterials());
  results.push(await testBathroomValidation());
  results.push(await testKitchenProportions());
  
  const duration = Date.now() - startTime;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  // Logga resultat
  console.log('\n📊 Regression Test Results:');
  console.log('═══════════════════════════════════════════════════');
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.testName}`);
    if (result.errors.length > 0) {
      result.errors.forEach(err => console.log(`   ❌ ${err}`));
    }
    if (result.warnings.length > 0) {
      result.warnings.forEach(warn => console.log(`   ⚠️  ${warn}`));
    }
  });
  
  console.log('\n📈 Summary:');
  console.log(`   Total: ${results.length}`);
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Duration: ${duration}ms`);
  console.log('═══════════════════════════════════════════════════\n');
  
  return {
    suiteName: 'Fas 1-3 Regression Tests',
    results,
    summary: {
      total: results.length,
      passed,
      failed,
      duration
    }
  };
}
