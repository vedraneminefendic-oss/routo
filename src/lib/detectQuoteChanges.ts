interface WorkItem {
  name: string;
  subtotal: number;
  hours?: number;
  hourlyRate?: number;
}

interface Material {
  name: string;
  subtotal: number;
  quantity?: number;
  unit?: string;
}

interface QuoteChange {
  type: 'added' | 'removed' | 'modified';
  category: 'workItem' | 'material';
  item: WorkItem | Material;
  oldValue?: number;
  newValue?: number;
}

export interface QuoteChanges {
  added: (WorkItem | Material)[];
  removed: (WorkItem | Material)[];
  modified: Array<{ item: WorkItem | Material; oldValue: number; newValue: number }>;
  priceChange: {
    previous: number;
    new: number;
    difference: number;
    percentageChange: number;
  };
}

export const detectQuoteChanges = (previousQuote: any, newQuote: any): QuoteChanges => {
  const changes: QuoteChanges = {
    added: [],
    removed: [],
    modified: [],
    priceChange: {
      previous: previousQuote?.summary?.customerPays || 0,
      new: newQuote?.summary?.customerPays || 0,
      difference: 0,
      percentageChange: 0
    }
  };

  // Calculate price change
  changes.priceChange.difference = changes.priceChange.new - changes.priceChange.previous;
  if (changes.priceChange.previous > 0) {
    changes.priceChange.percentageChange = 
      (changes.priceChange.difference / changes.priceChange.previous) * 100;
  }

  // Normalize item name for comparison
  const normalizeName = (name: string) => 
    name.trim().toLowerCase().replace(/[.,:;!?]/g, '');

  // Detect work item changes
  const previousWorkItems = previousQuote?.workItems || [];
  const newWorkItems = newQuote?.workItems || [];

  const previousWorkItemMap = new Map(
    previousWorkItems.map((item: WorkItem) => [normalizeName(item.name), item])
  );
  const newWorkItemMap = new Map(
    newWorkItems.map((item: WorkItem) => [normalizeName(item.name), item])
  );

  // Find added work items
  newWorkItems.forEach((item: WorkItem) => {
    if (!previousWorkItemMap.has(normalizeName(item.name))) {
      changes.added.push(item);
    }
  });

  // Find removed work items
  previousWorkItems.forEach((item: WorkItem) => {
    if (!newWorkItemMap.has(normalizeName(item.name))) {
      changes.removed.push(item);
    }
  });

  // Find modified work items (price change)
  newWorkItems.forEach((newItem: WorkItem) => {
    const normalizedName = normalizeName(newItem.name);
    const oldItem = previousWorkItemMap.get(normalizedName) as WorkItem | undefined;
    if (oldItem && oldItem.subtotal !== newItem.subtotal) {
      changes.modified.push({
        item: newItem,
        oldValue: oldItem.subtotal,
        newValue: newItem.subtotal
      });
    }
  });

  // Detect material changes
  const previousMaterials = previousQuote?.materials || [];
  const newMaterials = newQuote?.materials || [];

  const previousMaterialMap = new Map(
    previousMaterials.map((item: Material) => [normalizeName(item.name), item])
  );
  const newMaterialMap = new Map(
    newMaterials.map((item: Material) => [normalizeName(item.name), item])
  );

  // Find added materials
  newMaterials.forEach((item: Material) => {
    if (!previousMaterialMap.has(normalizeName(item.name))) {
      changes.added.push(item);
    }
  });

  // Find removed materials
  previousMaterials.forEach((item: Material) => {
    if (!newMaterialMap.has(normalizeName(item.name))) {
      changes.removed.push(item);
    }
  });

  // Find modified materials
  newMaterials.forEach((newItem: Material) => {
    const normalizedName = normalizeName(newItem.name);
    const oldItem = previousMaterialMap.get(normalizedName) as Material | undefined;
    if (oldItem && oldItem.subtotal !== newItem.subtotal) {
      changes.modified.push({
        item: newItem,
        oldValue: oldItem.subtotal,
        newValue: newItem.subtotal
      });
    }
  });

  return changes;
};
