import { PAINTING_REQUIREMENTS } from './paintingRequirements.ts';

export interface PaintingValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  missingItems: string[];
  underHouredItems: Array<{ name: string; actual: number; minimum: number }>;
  totalIssue?: { actual: number; minimum: number };
}

export function validatePaintingQuote(quote: any, area: number): PaintingValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingItems: string[] = [];
  const underHouredItems: Array<{ name: string; actual: number; minimum: number }> = [];
  let totalIssue: { actual: number; minimum: number } | undefined;

  // 1. Kontrollera obligatoriska arbetsmoment
  for (const requiredItem of PAINTING_REQUIREMENTS.minimumWorkItems) {
    const foundItem = quote.workItems?.find((item: any) => {
      const itemName = item.name?.toLowerCase() || '';
      const requiredName = requiredItem.name.toLowerCase();
      
      // Flexibel matchning för arbetsmoment
      if (requiredName.includes('förberedelser')) {
        return itemName.includes('förbered') || itemName.includes('skydd') || itemName.includes('masker');
      }
      if (requiredName.includes('spackling')) {
        return itemName.includes('spackl') || itemName.includes('slipr') || itemName.includes('slipn');
      }
      if (requiredName.includes('grundmålning')) {
        return itemName.includes('grund') && (itemName.includes('mål') || itemName.includes('färg'));
      }
      if (requiredName.includes('slutstrykningar')) {
        return itemName.includes('slutstryk') || itemName.includes('toppstryk') || itemName.includes('finish');
      }
      if (requiredName.includes('städning')) {
        return itemName.includes('städ') || itemName.includes('efter') || itemName.includes('clean');
      }
      
      return itemName.includes(requiredName.substring(0, 5));
    });

    const minHoursForArea = requiredItem.hoursPerSqm * area;

    if (!foundItem) {
      missingItems.push(`${requiredItem.name} (${requiredItem.description})`);
      errors.push(`Saknar obligatoriskt arbetsmoment: ${requiredItem.name}`);
    } else if (foundItem.hours < minHoursForArea * 0.7) { // 30% tolerans
      underHouredItems.push({
        name: requiredItem.name,
        actual: foundItem.hours,
        minimum: minHoursForArea,
      });
      errors.push(
        `${requiredItem.name}: ${foundItem.hours}h är för lågt (minimum ${Math.round(minHoursForArea * 10) / 10}h för ${area}kvm)`
      );
    }
  }

  // 2. Kontrollera total kostnad
  const totalCost = quote.summary?.totalBeforeVAT || 0;
  const minimumTotal = area * PAINTING_REQUIREMENTS.minimumCostPerSqm;
  const recommendedTotal = area * PAINTING_REQUIREMENTS.recommendedCostPerSqm;

  if (totalCost < minimumTotal) {
    totalIssue = { actual: totalCost, minimum: minimumTotal };
    errors.push(
      `Total kostnad ${totalCost} kr är för låg för ${area} kvm (minimum ${minimumTotal} kr, ${PAINTING_REQUIREMENTS.minimumCostPerSqm} kr/kvm)`
    );
  } else if (totalCost < recommendedTotal) {
    warnings.push(
      `Total kostnad ${totalCost} kr är under rekommenderat värde ${recommendedTotal} kr (${PAINTING_REQUIREMENTS.recommendedCostPerSqm} kr/kvm för ${area} kvm väggyta)`
    );
  }

  // 3. Kontrollera material
  const materialItems = quote.materials || [];
  
  for (const requiredMaterial of PAINTING_REQUIREMENTS.minimumMaterials) {
    const foundMaterial = materialItems.find((item: any) => {
      const itemName = item.name?.toLowerCase() || '';
      const requiredName = requiredMaterial.name.toLowerCase();
      
      if (requiredName.includes('färg') && !requiredName.includes('grund')) {
        return itemName.includes('färg') && !itemName.includes('grund');
      }
      if (requiredName.includes('spackel')) {
        return itemName.includes('spackl');
      }
      if (requiredName.includes('maskering')) {
        return itemName.includes('masker') || itemName.includes('skydd');
      }
      if (requiredName.includes('grundfärg')) {
        return itemName.includes('grund') && itemName.includes('färg');
      }
      
      return itemName.includes(requiredName.substring(0, 4));
    });

    if (!foundMaterial && requiredMaterial.minQuantity !== 'perArea') {
      warnings.push(`Saknar material: ${requiredMaterial.name}`);
    } else if (foundMaterial && requiredMaterial.minQuantity === 'perArea') {
      const expectedQuantity = area * requiredMaterial.multiplier!;
      if (foundMaterial.quantity < expectedQuantity * 0.8) {
        warnings.push(
          `${requiredMaterial.name}: ${foundMaterial.quantity} ${foundMaterial.unit} kan vara för lite för ${area} kvm (förväntat ca ${Math.ceil(expectedQuantity)} ${foundMaterial.unit})`
        );
      }
    }
  }

  // 4. Lägg till specifika varningar från requirements
  const description = quote.description?.toLowerCase() || '';
  
  if (description.includes('mörk') || description.includes('svart') || description.includes('blå')) {
    warnings.push('OBS: Mörka färger kräver ofta extra slutstrykningar');
  }
  
  if (description.includes('tak')) {
    warnings.push('OBS: Takmålning kostar mer än väggmålning (högre timpris)');
  }

  const totalStrokes = quote.workItems?.filter((item: any) => 
    item.name?.toLowerCase().includes('stryk')
  ).length || 0;
  
  if (totalStrokes < 2) {
    warnings.push('OBS: Målning kräver normalt minst 2-3 strykningar (grund + slutstrykningar)');
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    missingItems,
    underHouredItems,
    totalIssue,
  };
}

export function generatePaintingValidationSummary(validation: PaintingValidationResult): string {
  let summary = '❌ MÅLNINGSVALIDERING MISSLYCKADES\n\n';

  if (validation.missingItems.length > 0) {
    summary += '🚫 Saknade arbetsmoment:\n';
    validation.missingItems.forEach(item => {
      summary += `   • ${item}\n`;
    });
    summary += '\n';
  }

  if (validation.underHouredItems.length > 0) {
    summary += '⏱️ För få timmar:\n';
    validation.underHouredItems.forEach(item => {
      summary += `   • ${item.name}: ${item.actual}h (minimum ${item.minimum}h)\n`;
    });
    summary += '\n';
  }

  if (validation.totalIssue) {
    summary += `💰 Total kostnad för låg:\n`;
    summary += `   • Aktuell: ${validation.totalIssue.actual} kr\n`;
    summary += `   • Minimum: ${validation.totalIssue.minimum} kr\n`;
    summary += `   • Skillnad: ${validation.totalIssue.minimum - validation.totalIssue.actual} kr för lågt\n\n`;
  }

  if (validation.errors.length > 0) {
    summary += '🔴 Alla fel:\n';
    validation.errors.forEach(error => {
      summary += `   • ${error}\n`;
    });
  }

  summary += '\n💡 Målningsofferter måste inkludera förberedelser, spackling, grund- och slutstrykningar.';

  return summary;
}
