import { findStandard } from './industryStandards.ts';
import { validateTimeEstimate } from './validateTimeEstimate.ts';
import { classifyWorkItem, buildCanonicalKey, hasWord, type WorkItemClassification } from './classifier.ts';

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

// FIX-HOURS-V5: Token-baserad item-typ detektion
function detectItemType(name: string): string {
  const n = name.toLowerCase();
  
  // El - ENDAST om "el" som ord nämns utan kakel/klinker
  if (hasWord(n, 'el') && !hasWord(n, 'kakel') && !hasWord(n, 'klinker')) {
    return 'el';
  }
  
  // Kakel - om "kakel" som ord nämns
  if (hasWord(n, 'kakel')) {
    return 'kakel';
  }
  
  // Klinker - ENDAST om "klinker" som ord nämns utan kakel
  if (hasWord(n, 'klinker') && !hasWord(n, 'kakel')) {
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

  const classificationMap = new Map<any, WorkItemClassification>();
  
  for (const original of items) {
    const name = original.workItemName || original.name || '';
    const description = original.description || '';
    const hours = Number(original.hours ?? original.estimatedHours ?? 0) || 0;
    let standard = findStandard(name, { jobType: projectType });
    
    // FIX-HOURS-V5: Klassificera item
    const cls = classifyWorkItem(name, description, projectType);
    classificationMap.set(original, cls);
    
    // FIX-HOURS-V6: Domain-first grouping key
    const domainPart = cls.domain || 'other';
    const stdPart = standard?.jobType || 'none';
    const componentPart = cls.component || 'general';
    const surfacePart = cls.surface || '-';
    // Domain FIRST → prevents el/tiles merge at source
    let key = `${domainPart}:${stdPart}:${componentPart}:${surfacePart}`;
    
    console.log(`🧭 Classifier key: ${key} for "${name}"`);
    
    // Warn if standard domain doesn't match classified domain
    if (standard && cls.domain !== 'other') {
      const stdDomain = standard.jobType.split('_')[0];
      if (stdDomain !== cls.domain && !['el', 'tiles'].includes(cls.domain)) {
        console.warn(`⚠️ Domain mismatch: standard=${stdDomain} vs classified=${cls.domain} for "${name}"`);
      }
    }

    const entry = { original, name, hours, standard, cls };
    if (!groups.has(key)) groups.set(key, [entry]);
    else groups.get(key)!.push(entry);
  }
  
  // FIX-HOURS-V5: Hard separation guard - split groups with mixed domains
  const guardedGroups = new Map<string, Array<any>>();
  for (const [key, group] of groups.entries()) {
    if (group.length === 1) {
      guardedGroups.set(key, group);
      continue;
    }
    
    // Check if all items share the same domain
    const domains = new Set(group.map(g => g.cls.domain));
    if (domains.size === 1) {
      guardedGroups.set(key, group);
    } else {
      // Split by domain
      console.warn(`🚨 Hard-guard split: key=${key} has mixed domains:`, Array.from(domains));
      for (const g of group) {
        const splitKey = `${key}_SPLIT_${g.cls.domain}`;
        if (!guardedGroups.has(splitKey)) guardedGroups.set(splitKey, [g]);
        else guardedGroups.get(splitKey)!.push(g);
      }
    }
  }
  
  // Replace groups with guarded groups
  groups.clear();
  for (const [key, group] of guardedGroups.entries()) {
    groups.set(key, group);
  }

  const friendlyNameMap: Record<string, string> = {
    el_badrum: 'El-installation våtrum',
    kakel_vagg: 'Kakel vägg',
    klinker_golv: 'Klinker golv',
  };

  // FIX-HOURS-V6: Helper to re-map standard by group domain
  function remapStandardForGroup(group: any[], projectType?: string) {
    const text = group.map(g => `${g.name} ${g.original.description||''}`).join(' ').toLowerCase();
    const groupDomain = group[0].cls.domain;
    
    if (groupDomain === 'tiles') {
      const wantKlinker = hasWord(text, 'klinker') && !hasWord(text, 'kakel');
      const target = wantKlinker ? 'Klinker golv' : 'Kakel vägg';
      return findStandard(target, { jobType: projectType || 'badrum' });
    }
    if (groupDomain === 'el') {
      return findStandard('El-installation våtrum', { jobType: projectType || 'badrum' });
    }
    return null;
  }

  const merged: any[] = [];

  for (const [key, group] of groups.entries()) {
    const representative = group[0];
    let standard = representative?.standard || null;
    const groupDomain = representative.cls?.domain || 'other';
    
    // FIX-HOURS-V6: Re-map standard if domain mismatch
    if (standard) {
      const stdDomain = standard.jobType.split('_')[0];
      if (stdDomain !== groupDomain) {
        console.warn(`⚠️ Standard/domain mismatch in group: std=${standard.jobType} vs domain=${groupDomain} → re-map`);
        const remapped = remapStandardForGroup(group, projectType);
        if (remapped) {
          console.log(`↪️ Remapped standard: ${standard.jobType} → ${remapped.jobType}`);
          standard = remapped;
        } else {
          console.warn(`⚠️ Could not re-map standard, dropping it`);
          standard = null;
        }
      }
    }

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
    
    // FIX-HOURS-V6: Domain-safe naming
    let repName =
      (standard && friendlyNameMap[standard.jobType]) ||
      (standard && standard.jobType) ||
      key;
    
    // Domain-based fallback if no standard
    if (!standard || repName === key) {
      const text = group.map(g => `${g.name} ${g.original.description||''}`).join(' ').toLowerCase();
      if (groupDomain === 'tiles') {
        repName = (hasWord(text, 'klinker') && !hasWord(text, 'kakel')) ? 'Klinker golv' : 'Kakel vägg';
      } else if (groupDomain === 'el') {
        repName = 'El-installation våtrum';
      } else {
        repName = group.map((g) => g.name).sort((a, b) => b.length - a.length)[0] || key;
      }
    }
    
    // Extra safety: if tiles domain but name contains "el-installation", override
    if (groupDomain === 'tiles' && repName.toLowerCase().includes('el-installation')) {
      const text = group.map(g => `${g.name} ${g.original.description||''}`).join(' ').toLowerCase();
      repName = (hasWord(text, 'klinker') && !hasWord(text, 'kakel')) ? 'Klinker golv' : 'Kakel vägg';
      console.warn(`🛡️ Safety override: tiles domain got el-installation name → corrected to ${repName}`);
    }

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
