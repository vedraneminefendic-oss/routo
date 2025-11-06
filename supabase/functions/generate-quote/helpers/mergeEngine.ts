// ============================================================================
// MERGE ENGINE - FAS 4: NORMALISERING OCH DUBLETTHANTERING
// ============================================================================

/**
 * MERGE ENGINE ansvarar för att:
 * 1. Normalisera workItem-namn till standardiserade former
 * 2. Identifiera och slå samman dubbletter
 * 3. Kombinera workItems som är samma sak men med olika namn
 * 4. Vikta timpriser korrekt vid sammanslagning
 * 
 * Körs INNAN Formula Engine för att säkerställa clean data.
 */

import { JobDefinition } from './jobRegistry.ts';

export interface WorkItem {
  name: string;
  description?: string;
  estimatedHours: number;
  hourlyRate: number;
  subtotal?: number;
}

export interface MergeResult {
  mergedWorkItems: WorkItem[];
  mergeOperations: Array<{
    originalItems: string[];
    mergedInto: string;
    totalHours: number;
    weightedRate: number;
    reason: string;
  }>;
  duplicatesRemoved: number;
  itemsNormalized: number;
}

/**
 * Normalisera ett workItem-namn till standardform
 * Baserat på JobDefinition.standardWorkItems
 */
function normalizeWorkItemName(
  name: string, 
  jobDef: JobDefinition
): { normalizedName: string; confidence: number } {
  
  const normalized = name.toLowerCase().trim();
  
  // Exakt match mot standardWorkItems
  const exactMatch = jobDef.standardWorkItems?.find(
    std => std.name.toLowerCase() === normalized
  );
  
  if (exactMatch) {
    return { normalizedName: exactMatch.name, confidence: 1.0 };
  }
  
  // Partiell match - hitta bästa kandidat
  let bestMatch = { name, score: 0 };
  
  jobDef.standardWorkItems?.forEach(std => {
    const stdLower = std.name.toLowerCase();
    let score = 0;
    
    // Dela upp i ord och räkna matchningar
    const nameWords = normalized.split(/\s+/);
    const stdWords = stdLower.split(/\s+/);
    
    nameWords.forEach(word => {
      if (stdWords.some(stdWord => stdWord.includes(word) || word.includes(stdWord))) {
        score += 1;
      }
    });
    
    // Bonus för att hela namnet ingår
    if (stdLower.includes(normalized) || normalized.includes(stdLower)) {
      score += 2;
    }
    
    if (score > bestMatch.score) {
      bestMatch = { name: std.name, score };
    }
  });
  
  // Returnera bara om vi har minst 50% confidence
  if (bestMatch.score >= 2) {
    const confidence = Math.min(0.9, bestMatch.score / 4);
    return { normalizedName: bestMatch.name, confidence };
  }
  
  // Ingen bra match - behåll original
  return { normalizedName: name, confidence: 0 };
}

/**
 * Beräkna likhet mellan två workItem-namn
 * Returnerar 0-1 där 1 = identiska
 */
function calculateSimilarity(name1: string, name2: string): number {
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();
  
  // Exakt match
  if (n1 === n2) return 1.0;
  
  // Split into words
  const words1 = n1.split(/\s+/);
  const words2 = n2.split(/\s+/);
  
  // Count matching words
  let matches = 0;
  words1.forEach(w1 => {
    if (words2.some(w2 => w2.includes(w1) || w1.includes(w2))) {
      matches++;
    }
  });
  
  // Beräkna Jaccard similarity
  const union = new Set([...words1, ...words2]).size;
  const similarity = union > 0 ? matches / union : 0;
  
  // Bonus för substring-match
  if (n1.includes(n2) || n2.includes(n1)) {
    return Math.min(1.0, similarity + 0.3);
  }
  
  return similarity;
}

/**
 * Identifiera dubbletter baserat på namn-likhet
 * Returnerar grupper av workItems som ska slås samman
 */
function identifyDuplicates(
  workItems: WorkItem[],
  similarityThreshold: number = 0.7
): Array<number[]> {
  
  // KRITISK FIX: Aldrig slå ihop dessa specifika kombinationer
  const neverMerge = [
    ['förberedelse', 'städning'],
    ['förberedelse', 'efterarbete'],
    ['skydd', 'städning'],
    ['preparation', 'cleanup'],
    ['rivning', 'städning']
  ];
  
  const groups: Array<number[]> = [];
  const processed = new Set<number>();
  
  workItems.forEach((item, i) => {
    if (processed.has(i)) return;
    
    const group = [i];
    processed.add(i);
    
    // Hitta alla items som är lika med denna
    workItems.forEach((other, j) => {
      if (i === j || processed.has(j)) return;
      
      const similarity = calculateSimilarity(item.name, other.name);
      
      if (similarity >= similarityThreshold) {
        // Kontrollera om detta är en förbjuden kombination
        const name1Lower = item.name.toLowerCase();
        const name2Lower = other.name.toLowerCase();
        
        const isForbidden = neverMerge.some(([keyword1, keyword2]) => 
          (name1Lower.includes(keyword1) && name2Lower.includes(keyword2)) ||
          (name1Lower.includes(keyword2) && name2Lower.includes(keyword1))
        );
        
        if (!isForbidden) {
          group.push(j);
          processed.add(j);
        } else {
          console.log(`   ⚠️ BLOCKED MERGE: "${item.name}" + "${other.name}" (forbidden combination)`);
        }
      }
    });
    
    // Bara lägg till grupper med >1 item (dvs dubbletter)
    if (group.length > 1) {
      groups.push(group);
    }
  });
  
  return groups;
}

/**
 * Slå samman en grupp av workItems till ett enda item
 * Viktar timpriser baserat på timmar
 */
function mergeWorkItemGroup(
  workItems: WorkItem[],
  indices: number[]
): { merged: WorkItem; originalNames: string[] } {
  
  const items = indices.map(i => workItems[i]);
  
  // Beräkna totala timmar
  const totalHours = items.reduce((sum, item) => sum + item.estimatedHours, 0);
  
  // Vikta timpriser baserat på timmar (viktigt för korrekt genomsnitt!)
  const weightedRate = items.reduce(
    (sum, item) => sum + (item.hourlyRate * item.estimatedHours),
    0
  ) / totalHours;
  
  // Använd det längsta/mest beskrivande namnet
  const longestName = items.reduce(
    (longest, item) => item.name.length > longest.length ? item.name : longest,
    items[0].name
  );
  
  // Kombinera descriptions
  const descriptions = items
    .map(item => item.description)
    .filter(Boolean);
  
  const combinedDescription = descriptions.length > 0
    ? descriptions.join(' + ')
    : undefined;
  
  return {
    merged: {
      name: longestName,
      description: combinedDescription,
      estimatedHours: totalHours,
      hourlyRate: Math.round(weightedRate)
    },
    originalNames: items.map(item => item.name)
  };
}

/**
 * FAS 4: HUVUDFUNKTION - Kör hela merge-processen
 * 
 * Steg:
 * 1. Normalisera workItem-namn mot JobDefinition
 * 2. Identifiera dubbletter (likhet >70%)
 * 3. Slå samman dubbletter med viktade timpriser
 * 4. Returnera mergade items + detaljerad rapport
 */
export function mergeWorkItems(
  workItems: WorkItem[],
  jobDef?: JobDefinition
): MergeResult {
  
  console.log('\n🔀 ===== MERGE ENGINE: Starting =====');
  console.log(`   Input: ${workItems.length} work items`);
  
  const mergeOperations: MergeResult['mergeOperations'] = [];
  let itemsNormalized = 0;
  
  // ============================================
  // STEG 1: Normalisera namn
  // ============================================
  
  let normalizedItems = [...workItems];
  
  if (jobDef && jobDef.standardWorkItems && jobDef.standardWorkItems.length > 0) {
    normalizedItems = workItems.map(item => {
      const { normalizedName, confidence } = normalizeWorkItemName(item.name, jobDef);
      
      if (normalizedName !== item.name && confidence > 0.5) {
        console.log(`📝 NORMALIZE: "${item.name}" → "${normalizedName}" (${(confidence * 100).toFixed(0)}% confidence)`);
        itemsNormalized++;
        
        return {
          ...item,
          name: normalizedName,
          description: item.description 
            ? `${item.description} [Tidigare: "${item.name}"]`
            : `Tidigare: "${item.name}"`
        };
      }
      
      return item;
    });
  }
  
  // ============================================
  // STEG 2: Identifiera dubbletter
  // ============================================
  
  const duplicateGroups = identifyDuplicates(normalizedItems);
  
  console.log(`🔍 Found ${duplicateGroups.length} duplicate groups`);
  
  if (duplicateGroups.length === 0) {
    console.log('✅ MERGE ENGINE: No duplicates found, returning original items\n');
    return {
      mergedWorkItems: normalizedItems,
      mergeOperations: [],
      duplicatesRemoved: 0,
      itemsNormalized
    };
  }
  
  // ============================================
  // STEG 3: Slå samman dubbletter
  // ============================================
  
  const mergedItems: WorkItem[] = [];
  const processedIndices = new Set<number>();
  
  duplicateGroups.forEach(group => {
    const { merged, originalNames } = mergeWorkItemGroup(normalizedItems, group);
    
    console.log(`🔗 MERGE: [${originalNames.join(', ')}]`);
    console.log(`   → "${merged.name}": ${merged.estimatedHours}h × ${merged.hourlyRate} kr/h`);
    
    mergeOperations.push({
      originalItems: originalNames,
      mergedInto: merged.name,
      totalHours: merged.estimatedHours,
      weightedRate: merged.hourlyRate,
      reason: 'Duplicate items merged'
    });
    
    mergedItems.push(merged);
    group.forEach(idx => processedIndices.add(idx));
  });
  
  // Lägg till alla items som INTE var dubbletter
  normalizedItems.forEach((item, idx) => {
    if (!processedIndices.has(idx)) {
      mergedItems.push(item);
    }
  });
  
  const duplicatesRemoved = workItems.length - mergedItems.length;
  
  console.log(`✅ MERGE ENGINE: Complete`);
  console.log(`   Input: ${workItems.length} items`);
  console.log(`   Output: ${mergedItems.length} items`);
  console.log(`   Duplicates removed: ${duplicatesRemoved}`);
  console.log(`   Items normalized: ${itemsNormalized}`);
  console.log(`   Merge operations: ${mergeOperations.length}\n`);
  
  return {
    mergedWorkItems: mergedItems,
    mergeOperations,
    duplicatesRemoved,
    itemsNormalized
  };
}

/**
 * VARIANT: Quick merge utan JobDefinition (använder bara likhet)
 */
export function quickMergeWorkItems(workItems: WorkItem[]): MergeResult {
  return mergeWorkItems(workItems, undefined);
}

/**
 * HELPER: Logga detaljerad merge-rapport
 */
export function logMergeReport(result: MergeResult): void {
  console.log('\n📊 ===== MERGE REPORT =====');
  console.log(`\nDuplicates Removed: ${result.duplicatesRemoved}`);
  console.log(`Items Normalized: ${result.itemsNormalized}`);
  console.log(`Merge Operations: ${result.mergeOperations.length}`);
  
  if (result.mergeOperations.length > 0) {
    console.log('\nMerge Operations:');
    result.mergeOperations.forEach((op, i) => {
      console.log(`\n  ${i + 1}. Merged: ${op.originalItems.join(' + ')}`);
      console.log(`     Into: "${op.mergedInto}"`);
      console.log(`     Hours: ${op.totalHours}h`);
      console.log(`     Weighted Rate: ${op.weightedRate} kr/h`);
      console.log(`     Reason: ${op.reason}`);
    });
  }
  
  console.log('\nFinal Work Items:');
  result.mergedWorkItems.forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.name}`);
    console.log(`     ${item.estimatedHours}h × ${item.hourlyRate} kr/h`);
    if (item.description) {
      console.log(`     Note: ${item.description}`);
    }
  });
  
  console.log('===========================\n');
}
