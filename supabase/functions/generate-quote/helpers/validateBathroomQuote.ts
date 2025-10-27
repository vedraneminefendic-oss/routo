// ==========================================
// BATHROOM QUOTE VALIDATION
// ==========================================

import { BATHROOM_REQUIREMENTS } from './bathroomRequirements.ts';

export interface ValidationIssue {
  severity: 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  suggestedFix?: string;
  autoFixable?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  missing: string[];
  recommendations: string[];
  pricePerSqm?: number;
  expectedMinPrice?: number;
  expectedMaxPrice?: number;
}

export function validateBathroomQuote(
  quote: any,
  area: number,
  benchmarkMinPrice: number = 18000,
  benchmarkMaxPrice: number = 30000
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const missing: string[] = [];
  const recommendations: string[] = [];

  // 1. PRICE VALIDATION
  const totalCost = parseFloat(quote?.summary?.totalBeforeVAT || '0');
  const pricePerSqm = totalCost / area;
  const expectedMinTotal = area * benchmarkMinPrice;
  const expectedMaxTotal = area * benchmarkMaxPrice;

  if (pricePerSqm < benchmarkMinPrice * 0.85) {
    issues.push({
      severity: 'CRITICAL',
      message: `Priset ${Math.round(pricePerSqm)} kr/kvm är ${Math.round((benchmarkMinPrice - pricePerSqm) / benchmarkMinPrice * 100)}% under marknadspriset (${Math.round(benchmarkMinPrice)} kr/kvm)`,
      suggestedFix: `Öka till minst ${Math.round(expectedMinTotal)} SEK totalt (${benchmarkMinPrice} kr/kvm × ${area} kvm)`,
      autoFixable: false
    });
  }

  if (pricePerSqm > benchmarkMaxPrice * 1.2) {
    issues.push({
      severity: 'WARNING',
      message: `Priset ${Math.round(pricePerSqm)} kr/kvm är mycket högt jämfört med marknadspriset (max ${Math.round(benchmarkMaxPrice)} kr/kvm)`,
      suggestedFix: `Kontrollera om det finns onödigt dyra material eller för många timmar`,
      autoFixable: false
    });
  }

  // 2. REQUIRED WORK ITEMS VALIDATION
  const requiredWorkKeywords = [
    { keyword: 'vvs', name: 'VVS-installation' },
    { keyword: 'el', name: 'El-installation' },
    { keyword: 'golvvärme', name: 'Golvvärmemontage' },
    { keyword: 'tätskikt', name: 'Tätskiktsarbete' },
    { keyword: 'ventilation', name: 'Ventilationsinstallation' },
    { keyword: 'kakel', name: 'Kakel- och klinkerläggning' },
    { keyword: 'klinker', name: 'Klinkergolv', optional: true }
  ];

  for (const { keyword, name, optional } of requiredWorkKeywords) {
    const hasItem = quote?.workItems?.some((item: any) =>
      item.name?.toLowerCase().includes(keyword)
    );

    if (!hasItem && !optional) {
      missing.push(name);
      issues.push({
        severity: 'ERROR',
        message: `Obligatoriskt arbetsmoment saknas: ${name}`,
        suggestedFix: `Lägg till "${name}" i offerten`,
        autoFixable: true
      });
    }
  }

  // 3. MATERIAL VALIDATION
  const requiredMaterialKeywords = [
    { keyword: 'golvbrunn', name: 'Golvbrunn' },
    { keyword: 'dusch', name: 'Duschblandare/Duschset' },
    { keyword: 'wc', name: 'WC-stol', alt: 'toalett' },
    { keyword: 'tvättställ', name: 'Tvättställ', alt: 'handfat' },
    { keyword: 'golvvärme', name: 'Golvvärmematta' },
    { keyword: 'fläkt', name: 'Badrumsfläkt' },
    { keyword: 'jordfelsbrytare', name: 'Jordfelsbrytare' },
    { keyword: 'tätskikt', name: 'Tätskiktsmaterial' }
  ];

  for (const { keyword, name, alt } of requiredMaterialKeywords) {
    const hasMaterial = quote?.materials?.some((m: any) => {
      const materialName = m.name?.toLowerCase() || '';
      return materialName.includes(keyword) || (alt && materialName.includes(alt));
    });

    if (!hasMaterial) {
      missing.push(name);
      issues.push({
        severity: 'WARNING',
        message: `Material saknas: ${name}`,
        suggestedFix: `Lägg till "${name}" i materiallistan`,
        autoFixable: true
      });
    }
  }

  // 4. TOTAL HOURS VALIDATION
  const totalHours = quote?.workItems?.reduce((sum: number, item: any) => 
    sum + (parseFloat(item.hours) || 0), 0
  ) || 0;
  
  const minHoursForBathroom = 50;

  if (totalHours < minHoursForBathroom) {
    issues.push({
      severity: 'ERROR',
      message: `Endast ${totalHours} timmar totalt. En komplett badrumsrenovering tar normalt minst ${minHoursForBathroom}h`,
      suggestedFix: `Granska alla arbetsmoment och se till att timantalen är realistiska`,
      autoFixable: false
    });
  }

  // 5. SAFETY WARNINGS CHECK
  const hasWarnings = quote?.assumptions?.some((a: string) =>
    a.includes('⚠️') || a.includes('obligatorisk') || a.includes('certifikat')
  );

  if (!hasWarnings) {
    issues.push({
      severity: 'INFO',
      message: 'Säkerhetsvarningar saknas i offerten',
      suggestedFix: 'Lägg till säkerhetsvarningar från BATHROOM_REQUIREMENTS.warnings',
      autoFixable: true
    });
  }

  // 6. GENERATE RECOMMENDATIONS
  if (issues.length === 0) {
    recommendations.push('✅ Offerten uppfyller alla kvalitetskrav för badrumsrenovering');
  } else {
    const criticalCount = issues.filter(i => i.severity === 'CRITICAL').length;
    const errorCount = issues.filter(i => i.severity === 'ERROR').length;
    
    if (criticalCount > 0) {
      recommendations.push('🚨 Offerten har kritiska brister och bör INTE skickas till kund');
    } else if (errorCount > 0) {
      recommendations.push('⚠️ Offerten har allvarliga brister - gör en manuell översyn');
    } else {
      recommendations.push('💡 Offerten är acceptabel men kan förbättras');
    }

    if (missing.length > 0) {
      recommendations.push(`Lägg till: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ` (+${missing.length - 3} fler)` : ''}`);
    }
  }

  return {
    isValid: issues.filter(i => i.severity === 'CRITICAL' || i.severity === 'ERROR').length === 0,
    issues,
    missing,
    recommendations,
    pricePerSqm: Math.round(pricePerSqm),
    expectedMinPrice: Math.round(expectedMinTotal),
    expectedMaxPrice: Math.round(expectedMaxTotal)
  };
}

export function generateValidationSummary(validation: ValidationResult): string {
  const { issues, missing, recommendations } = validation;
  
  let summary = '\n🔍 KVALITETSKONTROLL - BADRUMSRENOVERING\n\n';
  
  if (validation.pricePerSqm) {
    summary += `📊 Pris: ${validation.pricePerSqm} kr/kvm\n`;
    summary += `   Förväntat: ${Math.round((validation.expectedMinPrice! + validation.expectedMaxPrice!) / 2 / ((validation.expectedMinPrice! + validation.expectedMaxPrice!) / 2 / validation.pricePerSqm))} kr/kvm\n\n`;
  }
  
  if (issues.length > 0) {
    summary += '⚠️ PROBLEM FUNNA:\n';
    issues.forEach(issue => {
      const icon = issue.severity === 'CRITICAL' ? '🚨' : issue.severity === 'ERROR' ? '❌' : issue.severity === 'WARNING' ? '⚠️' : 'ℹ️';
      summary += `${icon} ${issue.message}\n`;
      if (issue.suggestedFix) {
        summary += `   💡 ${issue.suggestedFix}\n`;
      }
    });
    summary += '\n';
  }
  
  if (recommendations.length > 0) {
    summary += '📋 REKOMMENDATIONER:\n';
    recommendations.forEach(rec => {
      summary += `${rec}\n`;
    });
  }
  
  return summary;
}
