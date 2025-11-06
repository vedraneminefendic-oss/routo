/**
 * MATH GUARD - Final Math Validation & Auto-Correction
 * 
 * KRITISKT: Denna modul säkerställer att:
 * 1. Varje workItem: subtotal = hours × hourlyRate (avrundad till heltal)
 * 2. Alla totals (workCost, materialCost, equipmentCost, VAT, ROT/RUT) räknas om korrekt
 * 3. Alla avvikelser >10% loggas och korrigeras
 * 
 * Ska ALLTID köras innan offert returneras eller sparas.
 */

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

interface Summary {
  workCost: number;
  materialCost: number;
  equipmentCost: number;
  totalBeforeVAT: number;
  vatAmount: number;
  totalWithVAT: number;
  deductionAmount?: number;
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
 * Huvudfunktion: Korrigerar alla subtotals och totals
 */
export function enforceWorkItemMath(quote: Quote): MathGuardResult {
  console.log('\n🛡️ ===== MATH GUARD: Starting validation =====');
  
  const corrections: MathGuardResult['corrections'] = [];
  let maxDiffPercent = 0;

  // ============================================
  // STEG 1: Korrigera varje workItem
  // ============================================
  
  const correctedWorkItems = (quote.workItems || []).map((item, index) => {
    const hours = Number(item.hours) || 0;
    const rate = Number(item.hourlyRate) || 0;
    const correctSubtotal = Math.round(hours * rate);
    const existingSubtotal = Number(item.subtotal) || 0;
    
    const diff = Math.abs(correctSubtotal - existingSubtotal);
    const diffPercent = existingSubtotal > 0 ? (diff / existingSubtotal) * 100 : 0;
    
    maxDiffPercent = Math.max(maxDiffPercent, diffPercent);
    
    if (diffPercent > 10) {
      console.warn(`⚠️ MATH CORRECTION #${index + 1}: "${item.name}"`);
      console.warn(`   Hours: ${hours}h × Rate: ${rate} kr/h = ${correctSubtotal} kr`);
      console.warn(`   Existing: ${existingSubtotal} kr`);
      console.warn(`   Diff: ${diff.toFixed(2)} kr (${diffPercent.toFixed(1)}%)`);
      
      corrections.push({
        itemName: item.name,
        type: 'workItem',
        field: 'subtotal',
        oldValue: existingSubtotal,
        newValue: correctSubtotal,
        diffPercent: diffPercent
      });
      
      return {
        ...item,
        subtotal: correctSubtotal,
        reasoning: item.reasoning
          ? `${item.reasoning} [Math-korrigerad från ${existingSubtotal} kr]`
          : `Beräknat: ${hours}h × ${rate} kr/h = ${correctSubtotal} kr`
      };
    }
    
    return item;
  });

  // ============================================
  // STEG 2: Räkna om alla totals
  // ============================================
  
  const workCost = correctedWorkItems.reduce((sum, w) => sum + (w.subtotal || 0), 0);
  const materialCost = (quote.materials || []).reduce((sum, m) => sum + (m.subtotal || 0), 0);
  const equipmentCost = (quote.equipment || []).reduce((sum, e) => sum + (e.subtotal || 0), 0);
  
  const totalBeforeVAT = workCost + materialCost + equipmentCost;
  const vatAmount = Math.round(totalBeforeVAT * 0.25);
  const totalWithVAT = totalBeforeVAT + vatAmount;
  
  // ============================================
  // STEG 3: Räkna om ROT/RUT avdrag
  // ============================================
  
  let deductionAmount = 0;
  
  if (quote.deductionType === 'rot') {
    // ROT: 30% av arbetskostnaden, max 50 000 kr per person
    deductionAmount = Math.min(Math.round(workCost * 0.30), 50000);
  } else if (quote.deductionType === 'rut') {
    // RUT: 50% av arbetskostnaden, max 75 000 kr per person
    deductionAmount = Math.min(Math.round(workCost * 0.50), 75000);
  }
  
  const customerPays = totalWithVAT - deductionAmount;
  
  // ============================================
  // STEG 4: Jämför gamla vs nya totals
  // ============================================
  
  const oldWorkCost = quote.summary?.workCost || 0;
  const oldTotalWithVAT = quote.summary?.totalWithVAT || 0;
  const oldCustomerPays = quote.summary?.customerPays || 0;
  
  let totalsCorrected = false;
  
  if (Math.abs(workCost - oldWorkCost) > 100) {
    console.warn(`⚠️ TOTAL CORRECTION: workCost ${oldWorkCost} → ${workCost} kr`);
    corrections.push({
      itemName: 'Summary',
      type: 'total',
      field: 'workCost',
      oldValue: oldWorkCost,
      newValue: workCost,
      diffPercent: oldWorkCost > 0 ? ((Math.abs(workCost - oldWorkCost) / oldWorkCost) * 100) : 0
    });
    totalsCorrected = true;
  }
  
  if (Math.abs(totalWithVAT - oldTotalWithVAT) > 100) {
    console.warn(`⚠️ TOTAL CORRECTION: totalWithVAT ${oldTotalWithVAT} → ${totalWithVAT} kr`);
    corrections.push({
      itemName: 'Summary',
      type: 'total',
      field: 'totalWithVAT',
      oldValue: oldTotalWithVAT,
      newValue: totalWithVAT,
      diffPercent: oldTotalWithVAT > 0 ? ((Math.abs(totalWithVAT - oldTotalWithVAT) / oldTotalWithVAT) * 100) : 0
    });
    totalsCorrected = true;
  }
  
  if (Math.abs(customerPays - oldCustomerPays) > 100) {
    console.warn(`⚠️ TOTAL CORRECTION: customerPays ${oldCustomerPays} → ${customerPays} kr`);
    corrections.push({
      itemName: 'Summary',
      type: 'total',
      field: 'customerPays',
      oldValue: oldCustomerPays,
      newValue: customerPays,
      diffPercent: oldCustomerPays > 0 ? ((Math.abs(customerPays - oldCustomerPays) / oldCustomerPays) * 100) : 0
    });
    totalsCorrected = true;
  }

  // ============================================
  // STEG 5: Bygg korrigerad offert
  // ============================================
  
  const correctedQuote: Quote = {
    ...quote,
    workItems: correctedWorkItems,
    summary: {
      workCost,
      materialCost,
      equipmentCost,
      totalBeforeVAT,
      vatAmount,
      totalWithVAT,
      deductionAmount,
      rotRutDeduction: deductionAmount > 0 ? deductionAmount : undefined,
      customerPays
    }
  };

  // ============================================
  // STEG 6: Sammanfattning
  // ============================================
  
  const workItemsCorrected = corrections.filter(c => c.type === 'workItem').length;
  
  console.log(`\n🛡️ MATH GUARD: Complete`);
  console.log(`   Work items corrected: ${workItemsCorrected}/${correctedWorkItems.length}`);
  console.log(`   Totals corrected: ${totalsCorrected ? 'Yes' : 'No'}`);
  console.log(`   Max diff: ${maxDiffPercent.toFixed(1)}%`);
  console.log(`   Total corrections: ${corrections.length}`);
  console.log('======================================\n');

  return {
    correctedQuote,
    totalCorrections: corrections.length,
    corrections,
    summary: {
      workItemsCorrected,
      totalsCorrected,
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
