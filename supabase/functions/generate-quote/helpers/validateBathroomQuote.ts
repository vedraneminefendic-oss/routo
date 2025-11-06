// ==========================================
// BATHROOM QUOTE VALIDATION
// ==========================================

import { BATHROOM_REQUIREMENTS } from './bathroomRequirements.ts';
import { findStandard, calculateTimeFromStandard } from './industryStandards.ts';

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

// AUTO-FIX: Add missing bathroom components
export async function autoFixBathroomQuote(
  quote: any,
  missing: string[],
  area: number,
  projectType?: string
): Promise<any> {
  
  // Helper to check if work item already exists
  const hasExistingItem = (standardJobType: string): boolean => {
    if (!quote.workItems || !Array.isArray(quote.workItems)) return false;
    
    return quote.workItems.some((item: any) => {
      const itemName = (item.workItemName || item.name || '').toLowerCase();
      const standard = findStandard(itemName, { jobType: projectType || 'badrum' });
      return standard?.jobType === standardJobType;
    });
  };
  
  const fixes: Record<string, any> = {
    'VVS-installation': {
      name: 'VVS-installation',
      description: 'Byte av rör, kopplingar, ventiler, golvbrunn, installera dusch/toalett/tvättställ',
      standardJobType: 'vvs_badrum',
      hours: 14,  // Fallback if standard not found
      hourlyRate: 950,
      subtotal: 13300
    },
    'El-installation': {
      name: 'El-installation våtrum',
      description: 'Jordfelsbrytare, IP44-armaturer, golvvärmekabel, fläktinstallation',
      standardJobType: 'el_badrum',
      hours: 12,  // Fallback
      hourlyRate: 950,
      subtotal: 11400
    },
    'El-installation våtrum': {
      name: 'El-installation våtrum',
      description: 'Jordfelsbrytare, IP44-armaturer, golvvärmekabel, fläktinstallation',
      standardJobType: 'el_badrum',
      hours: 12,
      hourlyRate: 950,
      subtotal: 11400
    },
    'Golvvärmemontage': {
      name: 'Golvvärmemontage',
      description: 'Läggning av golvvärmematta och installation av termostat',
      standardJobType: 'golvvarme',
      hours: 6,
      hourlyRate: 850,
      subtotal: 5100
    },
    'Ventilationsinstallation': {
      name: 'Ventilationsinstallation',
      description: 'Montering av badrumsfläkt med timer och fuktavkännare',
      standardJobType: 'ventilation',
      hours: 3,
      hourlyRate: 850,
      subtotal: 2550
    },
    'Tätskiktsarbete': {
      name: 'Tätskiktsarbete',
      description: 'Applicering av tätskikt på golv och väggar enligt branschregler',
      standardJobType: 'tatskikt',
      hours: 8,
      hourlyRate: 850,
      subtotal: 6800
    }
  };
  
  const materialFixes: Record<string, any> = {
    'Golvbrunn': {
      name: 'Golvbrunn',
      quantity: 1,
      unitPrice: 800,
      subtotal: 800
    },
    'Golvvärme': {
      name: 'Golvvärmematta',
      quantity: area,
      unitPrice: 350,
      subtotal: area * 350
    },
    'Badrumsfläkt': {
      name: 'Badrumsfläkt med timer',
      quantity: 1,
      unitPrice: 1200,
      subtotal: 1200
    },
    'Jordfelsbrytare': {
      name: 'Jordfelsbrytare',
      quantity: 1,
      unitPrice: 600,
      subtotal: 600
    }
  };
  
  const fixedQuote = { ...quote };
  
  // Add missing workItems with better keyword matching and dynamic hour calculation
  missing.forEach(missingItem => {
    // Try exact match first
    if (fixes[missingItem]) {
      const fix = fixes[missingItem];
      
      // Check if item already exists
      if (hasExistingItem(fix.standardJobType)) {
        console.log(`  ⏭️ Skipping ${missingItem} - already exists (matched by standard ${fix.standardJobType})`);
        return;
      }
      
      // Calculate hours dynamically from standard
      const standard = findStandard(fix.name, { jobType: projectType || 'badrum' });
      let calculatedHours = fix.hours; // Fallback
      
      if (standard) {
        calculatedHours = calculateTimeFromStandard(standard, { area });
        console.log(`  📊 Calculated hours from standard ${standard.jobType}: ${calculatedHours.toFixed(1)}h (area: ${area} kvm)`);
      }
      
      // Use existing hourly rate if one exists in quote, otherwise use standard or fallback
      const existingRate = fixedQuote.workItems?.find((w: any) => 
        w.name?.toLowerCase().includes(fix.name.split(' ')[0].toLowerCase())
      )?.hourlyRate;
      
      const hourlyRate = existingRate || (standard?.hourlyRate?.standard) || fix.hourlyRate;
      const subtotal = Math.round(calculatedHours * hourlyRate);
      
      const itemToAdd = {
        ...fix,
        hours: calculatedHours,
        estimatedHours: calculatedHours,
        hourlyRate,
        subtotal
      };
      
      fixedQuote.workItems = fixedQuote.workItems || [];
      fixedQuote.workItems.push(itemToAdd);
      console.log(`  ✅ Auto-added (dynamic): ${fix.name} (${calculatedHours.toFixed(1)}h × ${hourlyRate} kr = ${subtotal} kr)`);
    } else {
      // Try keyword matching
      const itemLower = missingItem.toLowerCase();
      const matchedFix = Object.entries(fixes).find(([key, _]) => 
        itemLower.includes(key.toLowerCase().split(' ')[0]) ||
        itemLower.includes(key.toLowerCase().split('-')[0])
      );
      
      if (matchedFix) {
        const [_, fix] = matchedFix;
        
        // Check if item already exists
        if (hasExistingItem(fix.standardJobType)) {
          console.log(`  ⏭️ Skipping ${missingItem} (keyword match) - already exists`);
          return;
        }
        
        // Calculate hours dynamically
        const standard = findStandard(fix.name, { jobType: projectType || 'badrum' });
        let calculatedHours = fix.hours;
        
        if (standard) {
          calculatedHours = calculateTimeFromStandard(standard, { area });
        }
        
        const existingRate = fixedQuote.workItems?.find((w: any) => 
          w.name?.toLowerCase().includes(fix.name.split(' ')[0].toLowerCase())
        )?.hourlyRate;
        
        const hourlyRate = existingRate || (standard?.hourlyRate?.standard) || fix.hourlyRate;
        const subtotal = Math.round(calculatedHours * hourlyRate);
        
        const itemToAdd = {
          ...fix,
          hours: calculatedHours,
          estimatedHours: calculatedHours,
          hourlyRate,
          subtotal
        };
        
        fixedQuote.workItems = fixedQuote.workItems || [];
        fixedQuote.workItems.push(itemToAdd);
        console.log(`  ✅ Auto-added (keyword + dynamic): ${fix.name} (${calculatedHours.toFixed(1)}h × ${hourlyRate} kr = ${subtotal} kr)`);
      }
    }
    
    // Add materials
    if (materialFixes[missingItem]) {
      fixedQuote.materials = fixedQuote.materials || [];
      fixedQuote.materials.push(materialFixes[missingItem]);
      console.log(`  ✅ Auto-added material: ${missingItem}`);
    }
  });
  
  // Recalculate summary
  const newWorkCost = fixedQuote.workItems.reduce((sum: number, w: any) => sum + w.subtotal, 0);
  const newMaterialCost = fixedQuote.materials.reduce((sum: number, m: any) => sum + m.subtotal, 0);
  const newTotalBeforeVAT = newWorkCost + newMaterialCost;
  
  fixedQuote.summary = {
    ...fixedQuote.summary,
    workCost: newWorkCost,
    materialCost: newMaterialCost,
    totalBeforeVAT: newTotalBeforeVAT,
    vat: Math.round(newTotalBeforeVAT * 0.25),
    totalWithVAT: Math.round(newTotalBeforeVAT * 1.25),
    customerPays: Math.round(newTotalBeforeVAT * 1.25)
  };
  
  return fixedQuote;
}
