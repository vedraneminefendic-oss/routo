// ==========================================
// DELTA ENGINE - Inkrementella offertändringar
// ==========================================

export interface DeltaChange {
  type: 'add' | 'remove' | 'modify';
  category: 'workItem' | 'material' | 'equipment';
  itemName: string;
  oldValue?: any;
  newValue?: any;
  reason: string;
}

export interface DeltaValidation {
  valid: boolean;
  warnings: string[];
  priceChange: number;
  priceChangePercent: number;
}

/**
 * Detekterar vad användaren vill ändra i offerten
 */
export function detectDeltaChanges(
  userMessage: string,
  previousQuote: any
): DeltaChange[] {
  const changes: DeltaChange[] = [];
  const lowerMessage = userMessage.toLowerCase();
  
  // FAS 2: Expanded keywords for better detection
  const addKeywords = ['lägg till', 'även', 'också', 'plus', 'och', 'inkludera', 'lägg in', 'ta med'];
  const removeKeywords = ['ta bort', 'utan', 'bara', 'endast', 'skippa', 'exkludera', 'ta inte med', 'behövs inte', 'ej', 'inte'];
  const modifyKeywords = ['ändra', 'byt', 'istället', 'premium', 'standard', 'budget', 'bättre', 'billigare'];
  
  const isAdding = addKeywords.some(kw => lowerMessage.includes(kw));
  const isRemoving = removeKeywords.some(kw => lowerMessage.includes(kw));
  const isModifying = modifyKeywords.some(kw => lowerMessage.includes(kw));
  
  console.log(`🔍 FAS 2: Detecting changes in: "${userMessage}"`);
  console.log(`   isAdding: ${isAdding}, isRemoving: ${isRemoving}, isModifying: ${isModifying}`);
  
  // FAS 2: Extract which items are mentioned with better matching
  const mentionedItems = extractMentionedItems(lowerMessage, previousQuote);
  console.log(`   Mentioned items (${mentionedItems.length}):`, mentionedItems.map(i => i.name));
  
  // Detektera typ av ändring
  if (isRemoving && !isAdding) {
    // Ta bort specifika items
    mentionedItems.forEach(item => {
      changes.push({
        type: 'remove',
        category: item.category as 'workItem' | 'material' | 'equipment',
        itemName: item.name,
        oldValue: item.subtotal,
        reason: `Kunden bad ta bort: "${userMessage}"`
      });
      console.log(`   ❌ REMOVE: ${item.name} (${item.category})`);
    });
  } else if (isAdding && !isRemoving) {
    // Lägg till nya items (AI måste beräkna dessa)
    const newItemName = extractNewItemName(userMessage);
    changes.push({
      type: 'add',
      category: 'workItem',
      itemName: newItemName,
      reason: `Kunden bad lägga till: "${userMessage}"`
    });
    console.log(`   ➕ ADD: ${newItemName}`);
  } else if (isModifying) {
    // Ändra befintliga items
    mentionedItems.forEach(item => {
      changes.push({
        type: 'modify',
        category: item.category as 'workItem' | 'material' | 'equipment',
        itemName: item.name,
        oldValue: item.subtotal,
        reason: `Kunden bad ändra: "${userMessage}"`
      });
      console.log(`   🔄 MODIFY: ${item.name} (${item.category})`);
    });
  }
  
  return changes;
}

/**
 * Applicerar ändringar deterministiskt på offerten
 */
export function applyDeltaChanges(
  previousQuote: any,
  changes: DeltaChange[],
  aiGeneratedQuote?: any
): any {
  // Skapa en djup kopia av previousQuote
  const updatedQuote = JSON.parse(JSON.stringify(previousQuote));
  
  for (const change of changes) {
    if (change.type === 'remove') {
      // Ta bort item
      if (change.category === 'workItem') {
        updatedQuote.workItems = updatedQuote.workItems.filter(
          (item: any) => !itemNameMatches(item.name, change.itemName)
        );
      } else if (change.category === 'material') {
        updatedQuote.materials = updatedQuote.materials.filter(
          (item: any) => !itemNameMatches(item.name, change.itemName)
        );
      } else if (change.category === 'equipment') {
        updatedQuote.equipment = updatedQuote.equipment?.filter(
          (item: any) => !itemNameMatches(item.name, change.itemName)
        );
      }
    } else if (change.type === 'add') {
      // Lägg till item från AI-genererad quote
      if (aiGeneratedQuote) {
        const newItems = findNewItems(aiGeneratedQuote, previousQuote, change.category);
        if (change.category === 'workItem') {
          updatedQuote.workItems = [...(updatedQuote.workItems || []), ...newItems];
        } else if (change.category === 'material') {
          updatedQuote.materials = [...(updatedQuote.materials || []), ...newItems];
        } else if (change.category === 'equipment') {
          updatedQuote.equipment = [...(updatedQuote.equipment || []), ...newItems];
        }
      }
    } else if (change.type === 'modify') {
      // Ändra befintlig item
      if (change.category === 'workItem') {
        updatedQuote.workItems = updatedQuote.workItems.map((item: any) => {
          if (itemNameMatches(item.name, change.itemName) && aiGeneratedQuote) {
            const modifiedItem = aiGeneratedQuote.workItems?.find(
              (newItem: any) => itemNameMatches(newItem.name, change.itemName)
            );
            return modifiedItem || item;
          }
          return item;
        });
      } else if (change.category === 'material') {
        updatedQuote.materials = updatedQuote.materials.map((item: any) => {
          if (itemNameMatches(item.name, change.itemName) && aiGeneratedQuote) {
            const modifiedItem = aiGeneratedQuote.materials?.find(
              (newItem: any) => itemNameMatches(newItem.name, change.itemName)
            );
            return modifiedItem || item;
          }
          return item;
        });
      }
    }
  }
  
  return updatedQuote;
}

/**
 * Validerar att prisdelta är rimlig
 */
export function validatePriceDelta(
  previousQuote: any,
  newQuote: any,
  changes: DeltaChange[],
  userMessage: string
): DeltaValidation {
  const warnings: string[] = [];
  
  const prevTotal = extractTotal(previousQuote);
  const newTotal = extractTotal(newQuote);
  const priceChange = newTotal - prevTotal;
  const priceChangePercent = (Math.abs(priceChange) / prevTotal) * 100;
  
  // Detektera intent
  const lowerMessage = userMessage.toLowerCase();
  const isAddingWork = ['lägg till', 'även', 'också', 'plus', 'och'].some(kw => lowerMessage.includes(kw));
  const isRemovingWork = ['ta bort', 'utan', 'bara', 'endast', 'skippa'].some(kw => lowerMessage.includes(kw));
  
  // KRITISK validering: Om lägger till arbete, priset MÅSTE öka
  if (isAddingWork && priceChange < 0) {
    warnings.push(
      `🚨 KRITISKT FEL: Priset sjönk från ${prevTotal.toLocaleString()} kr till ${newTotal.toLocaleString()} kr ` +
      `trots att arbete skulle läggas till. Detta är INTE logiskt!`
    );
  }
  
  // Om tar bort arbete, priset SKA minska
  if (isRemovingWork && priceChange > 0) {
    warnings.push(
      `⚠️ VARNING: Priset ökade från ${prevTotal.toLocaleString()} kr till ${newTotal.toLocaleString()} kr ` +
      `trots att arbete skulle tas bort.`
    );
  }
  
  // Orealistiska prishopp utan tydlig anledning
  if (!isAddingWork && !isRemovingWork && priceChangePercent > 50) {
    warnings.push(
      `⚠️ STOR PRISFÖRÄNDRING: Priset ändrades med ${priceChangePercent.toFixed(0)}% ` +
      `(från ${prevTotal.toLocaleString()} kr till ${newTotal.toLocaleString()} kr) utan tydlig anledning.`
    );
  }
  
  // Beräkna förväntad prisförändring baserat på changes
  let expectedChange = 0;
  for (const change of changes) {
    if (change.type === 'remove' && change.oldValue) {
      expectedChange -= change.oldValue;
    }
  }
  
  // Om faktisk ändring är mer än 2x förväntad ändring
  if (expectedChange !== 0 && Math.abs(priceChange - expectedChange) > Math.abs(expectedChange) * 2) {
    warnings.push(
      `⚠️ Förväntad prisändring: ${expectedChange.toLocaleString()} kr, ` +
      `faktisk: ${priceChange.toLocaleString()} kr. Skillnaden är stor.`
    );
  }
  
  return {
    valid: warnings.length === 0,
    warnings,
    priceChange,
    priceChangePercent
  };
}

// === HELPER FUNCTIONS ===

function extractMentionedItems(message: string, quote: any): Array<{ name: string; category: string; subtotal: number }> {
  const items: Array<{ name: string; category: string; subtotal: number }> = [];
  const lowerMessage = message.toLowerCase();
  
  // FAS 2: Better fuzzy matching for Swedish work items
  const normalizeSwedish = (text: string) => {
    return text
      .toLowerCase()
      .replace(/å/g, 'a')
      .replace(/ä/g, 'a')
      .replace(/ö/g, 'o')
      .replace(/[^a-z0-9]/g, '');
  };
  
  const normalizedMessage = normalizeSwedish(lowerMessage);
  
  // Sök i workItems med fuzzy matching
  quote.workItems?.forEach((item: any) => {
    const normalizedItemName = normalizeSwedish(item.name);
    const itemWords = normalizedItemName.split(' ').filter((w: string) => w.length > 3);
    
    // Check if ANY significant word from item name appears in message
    const hasMatch = itemWords.some((word: string) => 
      normalizedMessage.includes(word) || word.includes(normalizedMessage.split(' ')[0])
    );
    
    if (hasMatch) {
      items.push({
        name: item.name,
        category: 'workItem',
        subtotal: item.subtotal || 0
      });
    }
  });
  
  // Sök i materials med fuzzy matching
  quote.materials?.forEach((item: any) => {
    const normalizedItemName = normalizeSwedish(item.name);
    const itemWords = normalizedItemName.split(' ').filter((w: string) => w.length > 3);
    
    const hasMatch = itemWords.some((word: string) => 
      normalizedMessage.includes(word) || word.includes(normalizedMessage.split(' ')[0])
    );
    
    if (hasMatch) {
      items.push({
        name: item.name,
        category: 'material',
        subtotal: item.subtotal || 0
      });
    }
  });
  
  return items;
}

function extractNewItemName(message: string): string {
  // Försök extrahera vad som ska läggas till
  const match = message.match(/lägg till\s+([^.!?]+)/i) ||
                message.match(/även\s+([^.!?]+)/i) ||
                message.match(/också\s+([^.!?]+)/i);
  
  return match ? match[1].trim() : 'Okänt arbete';
}

function itemNameMatches(name1: string, name2: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-zåäö0-9]/g, '');
  const n1 = normalize(name1);
  const n2 = normalize(name2);
  
  // Exakt match
  if (n1 === n2) return true;
  
  // Partiell match (minst 70% av orden matchar)
  const words1 = n1.split(/\s+/).filter(w => w.length > 3);
  const words2 = n2.split(/\s+/).filter(w => w.length > 3);
  
  if (words1.length === 0 || words2.length === 0) return false;
  
  const matches = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));
  return matches.length / Math.max(words1.length, words2.length) >= 0.7;
}

function findNewItems(newQuote: any, oldQuote: any, category: string): any[] {
  const newItems: any[] = [];
  
  const newList = category === 'workItem' ? newQuote.workItems :
                  category === 'material' ? newQuote.materials :
                  newQuote.equipment;
  
  const oldList = category === 'workItem' ? oldQuote.workItems :
                  category === 'material' ? oldQuote.materials :
                  oldQuote.equipment;
  
  if (!newList || !oldList) return [];
  
  for (const newItem of newList) {
    const existsInOld = oldList.some((oldItem: any) => 
      itemNameMatches(oldItem.name, newItem.name)
    );
    
    if (!existsInOld) {
      newItems.push(newItem);
    }
  }
  
  return newItems;
}

function extractTotal(quote: any): number {
  // Försök olika fält för total
  return quote?.summary?.customerPays ??
         quote?.summary?.totalWithVAT ??
         quote?.summary?.total ??
         quote?.summary?.totalBeforeVAT ??
         0;
}
