/**
 * MATH GUARD - Final Math Validation & Auto-Correction
 * * FAS 3: Använder Formula Engine för alla beräkningar
 * * KRITISKT: Denna modul säkerställer att:
 * 1. Varje workItem: subtotal = hours × hourlyRate (avrundad till heltal)
 * 2. Alla totals (workCost, materialCost, equipmentCost, VAT, ROT/RUT) räknas om korrekt
 * 3. Alla avvikelser >10% loggas och korrigeras
 * * Ska ALLTID köras innan offert returneras eller sparas.
 */

import { calculateQuoteTotals, QuoteStructure, CalculationReport } from './formulaEngine.ts';

interface WorkItem {
  name: string;
  hours: number;
  hourlyRate: number;
  subtotal: number;
  reasoning?: string;
}

interface Material {
  name: string;
  subtotal: number;
}

interface Equipment {
  name: string;
  subtotal: number;
}

// FIX: Lade till rotDeduction och rutDeduction för att matcha Pipeline Orchestrator
interface Summary {
  workCost: number;
  materialCost: number;
  equipmentCost: number;
  totalBeforeVAT: number;
  vatAmount: number;
  totalWithVAT: number;
  deductionAmount?: number;
  rotDeduction?: number; // NY: Måste finnas för att matcha pipeline
  rutDeduction?: number; // NY: Måste finnas för att matcha pipeline
  rotRutDeduction?: number;
  customerPays: number;
}

interface Quote {
  workItems: WorkItem[];
  materials?: Material[];
  equipment?: Equipment[];
  summary: Summary;
  deductionType?: 'rot' | 'rut' | 'none';
  [key: string]: any;
}

interface MathGuardResult {
  correctedQuote: Quote;
  totalCorrections: number;
  corrections: Array<{
    itemName: string;
    type: 'workItem' | 'total';
    field: string;
    oldValue: number;
    newValue: number;
    diffPercent: number;
  }>;
  summary: {
    workItemsCorrected: number;
    totalsCorrected: boolean;
    maxDiffPercent: number;
  };
}

/**
 * FAS 3: Huvudfunktion - Använder Formula Engine för alla beräkningar
 * * Korrigerar alla subtotals och totals genom att använda den centrala Formula Engine
 */
export function enforceWorkItemMath(quote: Quote): MathGuardResult {
  console.log('\n🛡️ ===== MATH GUARD: Starting validation (using Formula Engine) =====');
  
  // Konvertera quote till QuoteStructure för Formula Engine
  const quoteStructure: QuoteStructure = {
    workItems: (quote.workItems || []).map(item => ({
      name: item.name,
      description: item.reasoning,
      estimatedHours: item.hours,
      hourlyRate: item.hourlyRate,
      subtotal: item.subtotal
    })),
    materials: (quote.materials || []).map(mat => ({
      name: mat.name,
      quantity: 1,
      unit: 'st',
      estimatedCost: mat.subtotal
    })),
    equipment: (quote.equipment || []).map(eq => ({
      name: eq.name,
      quantity: 1,
      unit: 'st',
      estimatedCost: eq.subtotal
    })),
    summary: quote.summary,
    deductionType: quote.deductionType || 'none'
  };
  
  // Använd Formula Engine för att beräkna allt
  const { quote: correctedStructure, report } = calculateQuoteTotals(
    quoteStructure, 
    quote.deductionType || 'none'
  );
  
  // Konvertera tillbaka till Quote-format
  const corrections: MathGuardResult['corrections'] = [];
  let maxDiffPercent = 0;
  
  // Samla korrigeringar från Formula Engine-rapporten
  report.details.forEach(detail => {
    const match = detail.match(/WorkItem "([^"]+)": (\d+) kr → (\d+) kr/);
    if (match) {
      const oldValue = parseInt(match[2]);
      const newValue = parseInt(match[3]);
      const diffPercent = oldValue > 0 ? Math.abs((newValue - oldValue) / oldValue) * 100 : 0;
      maxDiffPercent = Math.max(maxDiffPercent, diffPercent);
      
      corrections.push({
        itemName: match[1],
        type: 'workItem',
        field: 'subtotal',
        oldValue,
        newValue,
        diffPercent
      });
    }
    
    const totalMatch = detail.match(/Total corrected: (\d+) kr → (\d+) kr/);
    if (totalMatch) {
      const oldValue = parseInt(totalMatch[1]);
      const newValue = parseInt(totalMatch[2]);
      const diffPercent = oldValue > 0 ? Math.abs((newValue - oldValue) / oldValue) * 100 : 0;
      
      corrections.push({
        itemName: 'Summary',
        type: 'total',
        field: 'customerPays',
        oldValue,
        newValue,
        diffPercent
      });
    }
  });
  
  // Bygg korrigerad quote med uppdaterad data från Formula Engine
  const correctedWorkItems = correctedStructure.workItems.map((item, index) => ({
    name: item.name,
    hours: item.estimatedHours,
    hourlyRate: item.hourlyRate,
    subtotal: item.subtotal!,
    reasoning: item.description || quote.workItems[index]?.reasoning
  }));
  
  const correctedQuote: Quote = {
    ...quote,
    workItems: correctedWorkItems,
    summary: {
      workCost: correctedStructure.summary!.workCost!,
      materialCost: correctedStructure.summary!.materialCost!,
      equipmentCost: correctedStructure.summary!.equipmentCost!,
      totalBeforeVAT: correctedStructure.summary!.totalBeforeVAT!,
      vatAmount: correctedStructure.summary!.vat!,
      totalWithVAT: correctedStructure.summary!.totalWithVAT!,
      deductionAmount: (correctedStructure.summary!.rotDeduction || 0) + (correctedStructure.summary!.rutDeduction || 0),
      // FIX: Se till att dessa fält följer med och matchar interfacet
      rotDeduction: correctedStructure.summary!.rotDeduction || 0,
      rutDeduction: correctedStructure.summary!.rutDeduction || 0,
      rotRutDeduction: (correctedStructure.summary!.rotDeduction || 0) + (correctedStructure.summary!.rutDeduction || 0),
      customerPays: correctedStructure.summary!.customerPays!
    }
  };
  
  console.log(`\n🛡️ MATH GUARD: Complete (Formula Engine)`);
  console.log(`   Work items recalculated: ${report.workItemsRecalculated}`);
  console.log(`   Total corrections: ${report.totalCorrections}`);
  console.log(`   Max diff: ${maxDiffPercent.toFixed(1)}%`);
  console.log('======================================\n');
  
  return {
    correctedQuote,
    totalCorrections: corrections.length,
    corrections,
    summary: {
      workItemsCorrected: report.workItemsRecalculated,
      totalsCorrected: report.totalCorrections > 0,
      maxDiffPercent
    }
  };
}

/**
 * Detaljerad loggrapport för debugging
 */
export function logQuoteReport(quote: Quote): void {
  console.log('\n📊 ===== QUOTE MATH REPORT =====');
  console.log('\nWork Items:');
  
  (quote.workItems || []).forEach((item, i) => {
    const computed = Math.round(item.hours * item.hourlyRate);
    const diff = item.subtotal - computed;
    const diffPct = computed > 0 ? Math.abs(diff / computed) * 100 : 0;
    
    console.log(`  ${i + 1}. ${item.name}`);
    console.log(`     ${item.hours}h × ${item.hourlyRate} kr/h = ${computed} kr`);
    console.log(`     Actual: ${item.subtotal} kr (diff: ${diffPct.toFixed(1)}%)`);
  });
  
  console.log('\nMaterials:');
  (quote.materials || []).forEach((m, i) => {
    console.log(`  ${i + 1}. ${m.name}: ${m.subtotal} kr`);
  });
  
  console.log('\nEquipment:');
  (quote.equipment || []).forEach((e, i) => {
    console.log(`  ${i + 1}. ${e.name}: ${e.subtotal} kr`);
  });
  
  console.log('\nTotals:');
  console.log(`  Work cost: ${quote.summary.workCost.toLocaleString()} kr`);
  console.log(`  Material cost: ${quote.summary.materialCost.toLocaleString()} kr`);
  console.log(`  Equipment cost: ${quote.summary.equipmentCost.toLocaleString()} kr`);
  console.log(`  Total before VAT: ${quote.summary.totalBeforeVAT.toLocaleString()} kr`);
  console.log(`  VAT (25%): ${quote.summary.vatAmount.toLocaleString()} kr`);
  console.log(`  Total with VAT: ${quote.summary.totalWithVAT.toLocaleString()} kr`);
  
  if (quote.summary.deductionAmount && quote.summary.deductionAmount > 0) {
    console.log(`  ROT/RUT deduction: ${quote.summary.deductionAmount.toLocaleString()} kr`);
  }
  
  console.log(`  Customer pays: ${quote.summary.customerPays.toLocaleString()} kr`);
  console.log('================================\n');
}

/**
 * Enkel validering som returnerar true/false
 */
export function validateQuoteMath(quote: Quote): boolean {
  const result = enforceWorkItemMath(quote);
  return result.totalCorrections === 0;
}
