import { findStandard, calculateTimeFromStandard } from './industryStandards.ts';
import { classifyWorkItem, hasWord } from './classifier.ts';

/**
 * FIX-HOURS-V5: Classifier-driven splitting of combined work items
 * Splits items that mention multiple domains (e.g., "kakel och klinker", "el + ventilation")
 */
export function splitCombinedItems(
  quote: any,
  measurements: { area?: number; rooms?: number; quantity?: number; length?: number },
  projectType?: string
): any {
  const items = Array.isArray(quote?.workItems) ? quote.workItems : [];
  if (items.length === 0) return quote;

  const expanded: any[] = [];

  for (const item of items) {
    const name = (item.name || item.workItemName || '').toLowerCase();
    const desc = (item.description || '').toLowerCase();
    const text = `${name} ${desc}`;

    // Check for "kakel och klinker" combination
    const hasKakel = hasWord(text, 'kakel');
    const hasKlinker = hasWord(text, 'klinker');
    const hasBothTiles = hasKakel && hasKlinker;

    if (hasBothTiles) {
      console.log(`✂️ Splitting combined tiles item: "${item.name || item.workItemName}"`);

      // Split into Kakel vägg and Klinker golv
      const kakelStd = findStandard('Kakel vägg', { jobType: projectType });
      const klinkerStd = findStandard('Klinker golv', { jobType: projectType });

      const kakelHours = kakelStd 
        ? calculateTimeFromStandard(kakelStd, measurements)
        : 8.8;
      const klinkerHours = klinkerStd
        ? calculateTimeFromStandard(klinkerStd, measurements)
        : 11.2;

      expanded.push({
        ...item,
        name: 'Kakel vägg',
        workItemName: 'Kakel vägg',
        hours: kakelHours,
        estimatedHours: kakelHours,
        description: 'Kakelsättning av väggar',
        reasoning: `[UPPDELAD från "${item.name || item.workItemName}"] Baserat på ${measurements.area || 4} kvm. ${item.reasoning || ''}`.trim()
      });

      expanded.push({
        ...item,
        name: 'Klinker golv',
        workItemName: 'Klinker golv',
        hours: klinkerHours,
        estimatedHours: klinkerHours,
        description: 'Klinkersättning av golv',
        reasoning: `[UPPDELAD från "${item.name || item.workItemName}"] Baserat på ${measurements.area || 4} kvm. ${item.reasoning || ''}`.trim()
      });

      continue;
    }

    // Future: Add more combination checks here (e.g., "el + ventilation")
    // For now, only handle kakel+klinker

    expanded.push(item);
  }

  console.log(`✂️ Split result: ${items.length} items → ${expanded.length} items (${expanded.length - items.length} splits)`);

  return {
    ...quote,
    workItems: expanded
  };
}
