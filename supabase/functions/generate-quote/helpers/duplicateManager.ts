import { findStandard } from './industryStandards.ts';
import { validateTimeEstimate } from './validateTimeEstimate.ts';

function normalizeName(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/våtrum/g, 'badrum')
    .replace(/el[-\s]*install(ation)?/g, 'el installation')
    .trim();
}

// FIX-HOURS-V4: Detektera item-typ för att förhindra fel-gruppering
function detectItemType(name: string): string {
  const n = name.toLowerCase();
  
  // El - ENDAST om "el" nämns utan kakel/klinker
  if (n.includes('el') && !n.includes('kakel') && !n.includes('klinker')) {
    return 'el';
  }
  
  // Kakel - om "kakel" nämns (oavsett om klinker också nämns - splitCombinedItems ska hantera detta)
  if (n.includes('kakel')) {
    return 'kakel';
  }
  
  // Klinker - ENDAST om "klinker" nämns utan kakel
  if (n.includes('klinker') && !n.includes('kakel')) {
    return 'klinker';
  }
  
  return 'other';
}

export function normalizeAndMergeDuplicates(
  quote: any,
  measurements: { area?: number; rooms?: number; quantity?: number; length?: number },
  projectType?: string
): any {
  const items = Array.isArray(quote?.workItems) ? quote.workItems : [];
  if (items.length === 0) return quote;

  const groups = new Map<string, Array<any>>();

  for (const original of items) {
    const name = original.workItemName || original.name || '';
    const hours = Number(original.hours ?? original.estimatedHours ?? 0) || 0;
    let standard = findStandard(name, { jobType: projectType });
    
    // FORCE STANDARD KEY för badrum-kontext när standard saknas
    let key = standard?.jobType || normalizeName(name);
    if (!standard && projectType?.toLowerCase().includes('badrum')) {
      const nameLower = name.toLowerCase();
      let forcedKey = '';
      if (nameLower.includes('el') && !nameLower.includes('kakel') && !nameLower.includes('klinker')) {
        forcedKey = 'el_badrum';
      } else if (nameLower.includes('kakel')) {
        forcedKey = 'kakel_vagg';
      } else if (nameLower.includes('klinker') && !nameLower.includes('kakel')) {
        forcedKey = 'klinker_golv';
      }
      if (forcedKey) {
        key = forcedKey;
        console.log(`🔑 Forcing standard key via context: ${forcedKey} for "${name}"`);
      }
    }
    
    // FIX-HOURS-V4: Extra säkerhet - lägg till item-typ till nyckeln för att förhindra el/kakel/klinker merge
    const itemType = detectItemType(name);
    key = `${key}_${itemType}`;

    const entry = { original, name, hours, standard };
    if (!groups.has(key)) groups.set(key, [entry]);
    else groups.get(key)!.push(entry);
  }

  const friendlyNameMap: Record<string, string> = {
    el_badrum: 'El-installation våtrum',
    kakel_vagg: 'Kakel vägg',
    klinker_golv: 'Klinker golv',
  };

  const merged: any[] = [];

  for (const [key, group] of groups.entries()) {
    const representative = group[0];
    const standard = representative?.standard || null;

    if (group.length === 1) {
      const g = group[0];
      const item = { ...g.original };
      const hrs = Number(item.hours ?? item.estimatedHours ?? 0) || 0;
      item.name = item.name || item.workItemName || g.name;
      item.hours = hrs;
      item.estimatedHours = hrs;

      // Per-item logg
      if (standard) {
        const unit = standard.timePerUnit.unit;
        const amount =
          unit === 'kvm' ? (measurements.area ?? 1) :
          unit === 'rum' ? (measurements.rooms ?? 1) :
          unit === 'meter' ? (measurements.length ?? 1) :
          unit === 'styck' ? (measurements.quantity ?? 1) :
          1;
        const minH = standard.timePerUnit.min * amount;
        const typH = standard.timePerUnit.typical * amount;
        const maxH = standard.timePerUnit.max * amount;
        console.log(`📄 Item: ${item.name} | std=${standard.jobType} | unit=${unit} amount=${amount} | range=[${minH.toFixed(1)}..${maxH.toFixed(1)}] typ=${typH.toFixed(1)} | hours=${hrs.toFixed(1)}`);
      } else {
        console.log(`📄 Item: ${item.name} | std=— | hours=${hrs.toFixed(1)}`);
      }

      merged.push(item);
      continue;
    }

    // Dubblettgrupp
    const sumBefore = group.reduce((s, g) => s + (g.hours || 0), 0);
    const repName =
      (standard && friendlyNameMap[standard.jobType]) ||
      (standard && standard.jobType) ||
      group.map((g) => g.name).sort((a, b) => b.length - a.length)[0] ||
      key;

    const validation = validateTimeEstimate(
      repName,
      sumBefore,
      measurements,
      standard || undefined,
      { jobType: projectType }
    );

    const mergedHours = validation.isRealistic
      ? sumBefore
      : validation.correctedHours ?? sumBefore;

    const descriptions = Array.from(
      new Set(
        group
          .map((g) => (g.original.description || '').trim())
          .filter(Boolean)
      )
    );
    const reasonings = Array.from(
      new Set(
        group
          .map((g) => (g.original.reasoning || '').trim())
          .filter(Boolean)
      )
    );

    const item = {
      ...representative.original,
      name: repName,
      hours: mergedHours,
      estimatedHours: mergedHours,
      description: descriptions.join(' | ') || representative.original.description,
      reasoning:
        `[SAMMANSLAGNING] ${group.length} dubbletter → 1. ` +
        `Original: ${group
          .map((g) => `${g.name}=${(g.hours || 0).toFixed(1)}h`)
          .join(' + ')} = ${sumBefore.toFixed(1)}h. ` +
        (!validation.isRealistic && validation.suggestedRange
          ? `Korrigerad till ${mergedHours.toFixed(1)}h baserat på standard [${validation.suggestedRange.min.toFixed(1)}..${validation.suggestedRange.max.toFixed(1)}]. `
          : '') +
        (reasonings.length ? `| ${reasonings.join(' | ')}` : ''),
    };

    // Per-grupp logg
    if (standard) {
      const unit = standard.timePerUnit.unit;
      const amount =
        unit === 'kvm' ? (measurements.area ?? 1) :
        unit === 'rum' ? (measurements.rooms ?? 1) :
        unit === 'meter' ? (measurements.length ?? 1) :
        unit === 'styck' ? (measurements.quantity ?? 1) :
        1;
      const minH = standard.timePerUnit.min * amount;
      const typH = standard.timePerUnit.typical * amount;
      const maxH = standard.timePerUnit.max * amount;
      console.log(
        `🔁 Merge: key=${key} → "${repName}" | std=${standard.jobType} | unit=${unit} amount=${amount}`
      );
      console.log(
        `   originals: ${group
          .map((g) => `${g.name}(${(g.hours || 0).toFixed(1)}h)`)
          .join(', ')}`
      );
      console.log(
        `   hours: before=${sumBefore.toFixed(1)}, range=[${minH.toFixed(1)}..${maxH.toFixed(1)}], typ=${typH.toFixed(1)}, after=${mergedHours.toFixed(1)}`
      );
    } else {
      console.log(`🔁 Merge: key=${key} → "${repName}" | std=—`);
      console.log(
        `   originals: ${group
          .map((g) => `${g.name}(${(g.hours || 0).toFixed(1)}h)`)
          .join(', ')}`
      );
      console.log(
        `   hours: before=${sumBefore.toFixed(1)}, after=${mergedHours.toFixed(1)}`
      );
    }

    merged.push(item);
  }

  return {
    ...quote,
    workItems: merged,
  };
}
