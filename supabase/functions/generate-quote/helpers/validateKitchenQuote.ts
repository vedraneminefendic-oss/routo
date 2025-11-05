import { KITCHEN_REQUIREMENTS } from './kitchenRequirements.ts';

export interface KitchenValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  missingItems: string[];
  underHouredItems: Array<{ name: string; actual: number; minimum: number }>;
  totalIssue?: { actual: number; minimum: number };
}

/**
 * Validerar att en köksoffert uppfyller minimikrav
 */
export function validateKitchenQuote(
  quote: any,
  area: number
): KitchenValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingItems: string[] = [];
  const underHouredItems: Array<{ name: string; actual: number; minimum: number }> = [];

  console.log('🔍 Validerar köksoffert för area:', area, 'kvm');

  // 1. Kontrollera obligatoriska arbetsmoment
  for (const required of KITCHEN_REQUIREMENTS.minimumWorkItems) {
    const found = quote.workItems?.find((item: any) =>
      item.name.toLowerCase().includes(required.name.toLowerCase().split(' ')[0]) ||
      item.name.toLowerCase().includes(required.name.toLowerCase())
    );

    if (!found) {
      errors.push(`Saknar obligatoriskt arbetsmoment: ${required.name}`);
      missingItems.push(required.name);
    } else if (found.hours < required.minHours) {
      errors.push(
        `${required.name}: ${found.hours}h är för lågt (minimum ${required.minHours}h)`
      );
      underHouredItems.push({
        name: required.name,
        actual: found.hours,
        minimum: required.minHours,
      });
    }
  }

  // 2. Kontrollera total kostnad mot minimum per kvm
  const totalCost = quote.summary?.totalWithVAT || quote.summary?.customerPays || 0;
  const minTotal = area * KITCHEN_REQUIREMENTS.minimumCostPerSqm;
  const recommendedTotal = area * KITCHEN_REQUIREMENTS.recommendedCostPerSqm;

  if (totalCost < minTotal) {
    errors.push(
      `Total kostnad ${totalCost.toLocaleString('sv-SE')} kr är för låg (minimum ${minTotal.toLocaleString('sv-SE')} kr för ${area} kvm)`
    );
  } else if (totalCost < recommendedTotal) {
    warnings.push(
      `Total kostnad ${totalCost.toLocaleString('sv-SE')} kr är under rekommenderat (${recommendedTotal.toLocaleString('sv-SE')} kr för ${area} kvm)`
    );
  }

  // 3. Kontrollera material (om kunden inte står för köket)
  const customerProvidesKitchen = quote.exclusions?.some(
    (e: any) =>
      e.item?.toLowerCase().includes('köksskåp') ||
      e.item?.toLowerCase().includes('kök') ||
      e.reason?.toLowerCase().includes('kunden står för kök') ||
      e.reason?.toLowerCase().includes('ikea kök')
  );

  if (!customerProvidesKitchen) {
    for (const material of KITCHEN_REQUIREMENTS.minimumMaterials) {
      const found = quote.materials?.find((m: any) =>
        m.name.toLowerCase().includes(material.name.toLowerCase())
      );
      if (!found) {
        warnings.push(`Material kan saknas: ${material.name}`);
      }
    }
  } else {
    console.log('✅ Kunden står för köket - hoppar över materialkontroll');
  }

  const totalIssue =
    totalCost < minTotal
      ? { actual: totalCost, minimum: minTotal }
      : undefined;

  const result: KitchenValidationResult = {
    passed: errors.length === 0,
    errors,
    warnings,
    missingItems,
    underHouredItems,
    totalIssue,
  };

  if (!result.passed) {
    console.error('❌ Köksvalidering MISSLYCKADES:', result.errors);
  } else if (result.warnings.length > 0) {
    console.warn('⚠️ Köksvalidering OK men med varningar:', result.warnings);
  } else {
    console.log('✅ Köksvalidering OK');
  }

  return result;
}

/**
 * Genererar en användarvänlig sammanfattning av valideringsfel
 */
export function generateKitchenValidationSummary(
  validation: KitchenValidationResult
): string {
  if (validation.passed) {
    return 'Offerten uppfyller alla krav för köksrenovering.';
  }

  const parts: string[] = ['Köksofferten uppfyller inte minimikrav:'];

  if (validation.missingItems.length > 0) {
    parts.push(
      `\n\n**Saknade arbetsmoment:**\n${validation.missingItems.map(item => `- ${item}`).join('\n')}`
    );
  }

  if (validation.underHouredItems.length > 0) {
    parts.push(
      `\n\n**Arbetsmoment med för få timmar:**\n${validation.underHouredItems
        .map(
          item =>
            `- ${item.name}: ${item.actual}h (minimum ${item.minimum}h)`
        )
        .join('\n')}`
    );
  }

  if (validation.totalIssue) {
    parts.push(
      `\n\n**Total kostnad för låg:**\n- Aktuell: ${validation.totalIssue.actual.toLocaleString('sv-SE')} kr\n- Minimum: ${validation.totalIssue.minimum.toLocaleString('sv-SE')} kr`
    );
  }

  if (validation.warnings.length > 0) {
    parts.push(
      `\n\n**Varningar:**\n${validation.warnings.map(w => `- ${w}`).join('\n')}`
    );
  }

  return parts.join('\n');
}
