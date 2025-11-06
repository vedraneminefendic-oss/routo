// ============================================
// RELATIONS - Parent-child work item relations
// ============================================

export interface RelationAdjustment {
  unit: 'kvm' | 'styck' | 'fixed';
  perUnitHours?: number;
  fixedHours?: number;
  min: number;
  max: number;
  note?: string;
}

export const PARENT_CHILD_RELATIONS: Record<string, {
  subtractIfPresent: Record<string, RelationAdjustment>
}> = {
  'el:installation': {
    subtractIfPresent: {
      'el:golvvarme': {
        unit: 'kvm',
        perUnitHours: 0.5,
        min: 1.5,
        max: 6,
        note: 'El-installation exkl. golvvärme (se separat rad)'
      }
    }
  },
  'el_badrum:installation': {
    subtractIfPresent: {
      'el:golvvarme': {
        unit: 'kvm',
        perUnitHours: 0.5,
        min: 1.5,
        max: 6,
        note: 'El-installation våtrum exkl. golvvärme (se separat rad)'
      }
    }
  }
};

export function applyOverlapAdjustments(
  quote: any,
  measurements: { area?: number; rooms?: number; quantity?: number; length?: number },
  projectType?: string
): any {
  const items = Array.isArray(quote?.workItems) ? quote.workItems : [];
  if (items.length === 0) return quote;
  
  console.log('🔗 Checking for overlap adjustments...');
  
  // Build classification map
  const itemsByKey = new Map<string, any>();
  for (const item of items) {
    const name = item.workItemName || item.name || '';
    const nameLower = name.toLowerCase();
    
    // Build simple key
    let key = 'other';
    if (nameLower.includes('el-installation') || nameLower.includes('elinstallation')) {
      if (nameLower.includes('våtrum') || nameLower.includes('badrum')) {
        key = 'el_badrum:installation';
      } else {
        key = 'el:installation';
      }
    } else if (nameLower.includes('golvvärme') || nameLower.includes('golvvarme')) {
      key = 'el:golvvarme';
    }
    
    itemsByKey.set(key, item);
  }
  
  // Check for relations
  const adjustedItems: any[] = [];
  const processedKeys = new Set<string>();
  
  for (const item of items) {
    const name = item.workItemName || item.name || '';
    const nameLower = name.toLowerCase();
    
    let itemKey = 'other';
    if (nameLower.includes('el-installation') || nameLower.includes('elinstallation')) {
      if (nameLower.includes('våtrum') || nameLower.includes('badrum')) {
        itemKey = 'el_badrum:installation';
      } else {
        itemKey = 'el:installation';
      }
    } else if (nameLower.includes('golvvärme') || nameLower.includes('golvvarme')) {
      itemKey = 'el:golvvarme';
    }
    
    // Check if this item has relations
    const relation = PARENT_CHILD_RELATIONS[itemKey];
    if (relation && !processedKeys.has(itemKey)) {
      processedKeys.add(itemKey);
      
      // Check if any child items exist
      for (const [childKey, adjustment] of Object.entries(relation.subtractIfPresent)) {
        if (itemsByKey.has(childKey)) {
          const childItem = itemsByKey.get(childKey);
          
          // Calculate adjustment hours
          let adjustHours = 0;
          if (adjustment.unit === 'kvm' && adjustment.perUnitHours) {
            const area = measurements.area || (projectType?.toLowerCase().includes('badrum') ? 4 : 10);
            adjustHours = adjustment.perUnitHours * area;
          } else if (adjustment.fixedHours) {
            adjustHours = adjustment.fixedHours;
          }
          
          // Clamp to min/max
          adjustHours = Math.max(adjustment.min, Math.min(adjustment.max, adjustHours));
          
          // Apply adjustment
          const originalHours = Number(item.hours ?? item.estimatedHours ?? 0);
          const newHours = Math.max(1, originalHours - adjustHours);
          
          console.log(`🔗 Overlap adjustment: ${itemKey} -${adjustHours.toFixed(1)}h due to ${childKey} (${originalHours.toFixed(1)}h → ${newHours.toFixed(1)}h)`);
          
          // Update parent item
          item.hours = newHours;
          item.estimatedHours = newHours;
          item.reasoning = `${item.reasoning || ''} | [OVERLAP] ${adjustment.note || 'Justerad för överlapp'}`.trim();
          
          // Update child item reasoning
          childItem.reasoning = `${childItem.reasoning || ''} | [RELATION] Ingår normalt i el-installation men specificerad separat här`.trim();
          
          break; // Only one adjustment per parent
        }
      }
    }
    
    adjustedItems.push(item);
  }
  
  return {
    ...quote,
    workItems: adjustedItems
  };
}
