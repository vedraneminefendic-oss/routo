// ============================================
// DEDUCTION RULES - CENTRALISERAD ROT/RUT-KÄLLA
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
 * Hämtar aktuella ROT/RUT-regler baserat på datum
 * 
 * KÄLLA FÖR SANNING för alla ROT/RUT-beräkningar i systemet
 */
export function getDeductionRules(date: Date = new Date()): DeductionRules {
  const year = date.getFullYear();
  
  // ROT-avdrag: 50% under 2025, därefter 30%
  const rotPercentage = year >= 2025 && date < new Date('2026-01-01') ? 50 : 30;
  
  return {
    rot: {
      percentage: rotPercentage,
      maxPerPerson: 50000,
      applicableTo: 'workCost',
      description: `ROT-avdrag ${rotPercentage}% på arbetskostnad. Max ${50000} kr per person och år.`
    },
    rut: {
      percentage: 50,
      maxPerPerson: 75000,
      applicableTo: 'workCost',
      description: 'RUT-avdrag 50% på arbetskostnad. Max 75 000 kr per person och år.'
    }
  };
}

/**
 * Beräknar faktiskt avdragsbelopp baserat på regler
 */
export function calculateDeduction(
  deductionType: 'rot' | 'rut',
  workCost: number,
  date: Date = new Date()
): {
  amount: number;
  percentage: number;
  rule: DeductionRule;
  description: string;
} {
  const rules = getDeductionRules(date);
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
export function validateDeduction(
  deductionType: 'rot' | 'rut',
  claimedPercentage: number,
  claimedAmount: number,
  workCost: number,
  date: Date = new Date()
): {
  isValid: boolean;
  errors: string[];
  correctedAmount?: number;
  correctedPercentage?: number;
} {
  const errors: string[] = [];
  const rules = getDeductionRules(date);
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
