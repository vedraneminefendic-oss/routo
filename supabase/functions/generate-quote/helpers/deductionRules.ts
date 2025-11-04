// ============================================
// DEDUCTION RULES - CENTRALISERAD ROT/RUT-KÄLLA (FAS 4)
// ============================================

export interface DeductionRule {
  percentage: number;
  maxPerPerson: number;
  applicableTo: 'workCost' | 'totalCost';
  description: string;
}

export interface DeductionRules {
  rot: DeductionRule;
  rut: DeductionRule;
}

/**
 * Hämtar aktuella ROT/RUT-regler från databasen baserat på datum
 * 
 * KÄLLA FÖR SANNING för alla ROT/RUT-beräkningar i systemet
 */
export async function getDeductionRules(
  supabase: any,
  date: Date = new Date()
): Promise<DeductionRules> {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Hämta ROT-regel som är giltig för datumet
  const { data: rotData, error: rotError } = await supabase
    .from('deduction_limits')
    .select('*')
    .eq('deduction_type', 'rot')
    .lte('valid_from', dateStr)
    .or(`valid_to.is.null,valid_to.gte.${dateStr}`)
    .order('valid_from', { ascending: false })
    .limit(1)
    .single();

  // Hämta RUT-regel som är giltig för datumet
  const { data: rutData, error: rutError } = await supabase
    .from('deduction_limits')
    .select('*')
    .eq('deduction_type', 'rut')
    .lte('valid_from', dateStr)
    .or(`valid_to.is.null,valid_to.gte.${dateStr}`)
    .order('valid_from', { ascending: false })
    .limit(1)
    .single();

  if (rotError || rutError || !rotData || !rutData) {
    console.error('❌ Failed to fetch deduction rules from DB, using fallback:', { rotError, rutError });
    
    // FALLBACK till hårdkodade regler om databas-hämtning misslyckas
    const year = date.getFullYear();
    const rotPercentage = year >= 2025 && date < new Date('2026-01-01') ? 50 : 30;
    
    return {
      rot: {
        percentage: rotPercentage,
        maxPerPerson: 50000,
        applicableTo: 'workCost',
        description: `ROT-avdrag ${rotPercentage}% på arbetskostnad. Max 50 000 kr per person och år.`
      },
      rut: {
        percentage: 50,
        maxPerPerson: 75000,
        applicableTo: 'workCost',
        description: 'RUT-avdrag 50% på arbetskostnad. Max 75 000 kr per person och år.'
      }
    };
  }

  return {
    rot: {
      percentage: Number(rotData.deduction_percentage),
      maxPerPerson: rotData.max_amount_per_year,
      applicableTo: 'workCost',
      description: rotData.description || `ROT-avdrag ${rotData.deduction_percentage}% på arbetskostnad`
    },
    rut: {
      percentage: Number(rutData.deduction_percentage),
      maxPerPerson: rutData.max_amount_per_year,
      applicableTo: 'workCost',
      description: rutData.description || `RUT-avdrag ${rutData.deduction_percentage}% på arbetskostnad`
    }
  };
}

/**
 * Beräknar faktiskt avdragsbelopp baserat på regler
 */
export async function calculateDeduction(
  supabase: any,
  deductionType: 'rot' | 'rut',
  workCost: number,
  date: Date = new Date()
): Promise<{
  amount: number;
  percentage: number;
  rule: DeductionRule;
  description: string;
}> {
  const rules = await getDeductionRules(supabase, date);
  const rule = rules[deductionType];
  
  const calculatedAmount = workCost * (rule.percentage / 100);
  const amount = Math.min(calculatedAmount, rule.maxPerPerson);
  
  let description = rule.description;
  if (calculatedAmount > rule.maxPerPerson) {
    description += ` (Begränsat till maxbelopp)`;
  }
  
  return {
    amount: Math.round(amount),
    percentage: rule.percentage,
    rule,
    description
  };
}

/**
 * Validerar att ett avdrag följer aktuella regler
 */
export async function validateDeduction(
  supabase: any,
  deductionType: 'rot' | 'rut',
  claimedPercentage: number,
  claimedAmount: number,
  workCost: number,
  date: Date = new Date()
): Promise<{
  isValid: boolean;
  errors: string[];
  correctedAmount?: number;
  correctedPercentage?: number;
}> {
  const errors: string[] = [];
  const rules = await getDeductionRules(supabase, date);
  const rule = rules[deductionType];
  
  // Validera procentsats
  if (claimedPercentage !== rule.percentage) {
    errors.push(
      `Fel procentsats: ${claimedPercentage}% används, men ${rule.percentage}% är korrekt för ${deductionType.toUpperCase()} ${date.getFullYear()}`
    );
  }
  
  // Validera belopp
  const expectedAmount = Math.min(
    workCost * (rule.percentage / 100),
    rule.maxPerPerson
  );
  
  if (Math.abs(claimedAmount - expectedAmount) > 10) { // 10 kr tolerans för avrundning
    errors.push(
      `Fel avdragsbelopp: ${claimedAmount} kr angivet, men ${Math.round(expectedAmount)} kr är korrekt (${rule.percentage}% av ${workCost} kr arbetskostnad)`
    );
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    correctedAmount: errors.length > 0 ? Math.round(expectedAmount) : undefined,
    correctedPercentage: errors.length > 0 ? rule.percentage : undefined
  };
}
