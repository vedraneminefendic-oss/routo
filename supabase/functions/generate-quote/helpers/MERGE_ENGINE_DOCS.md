# Merge Engine - Fas 4 Dokumentation

## Översikt

Merge Engine ansvarar för att normalisera och slå samman dubbletter av workItems **innan** Formula Engine körs. Detta säkerställer att vi har ren, deduplicated data att arbeta med.

## Problem som Merge Engine löser

### Problem 1: Dubbletter från AI
AI:n kan ibland generera samma arbetsmoment flera gånger med små variationer:
```json
{
  "workItems": [
    { "name": "Målning väggar", "estimatedHours": 8, "hourlyRate": 650 },
    { "name": "Måla väggar", "estimatedHours": 5, "hourlyRate": 650 },
    { "name": "Väggmålning", "estimatedHours": 3, "hourlyRate": 650 }
  ]
}
```

### Problem 2: Icke-standardiserade namn
AI:n använder olika namn för samma sak:
```json
{
  "workItems": [
    { "name": "Rivning", "estimatedHours": 10, "hourlyRate": 750 },
    { "name": "Demontering", "estimatedHours": 8, "hourlyRate": 750 }
  ]
}
```

### Problem 3: Felaktig viktning
När man slår samman items måste timpriser viktas korrekt:
```
❌ FEL: (650 + 700) / 2 = 675 kr/h
✅ RÄTT: (650×8h + 700×4h) / (8h+4h) = 667 kr/h
```

## Lösning: Merge Engine

Merge Engine kör i 3 steg:

### Steg 1: Normalisering
Matchar AI:ns namn mot JobDefinition.standardWorkItems:

```typescript
// Input
{ name: "Måla väggar" }

// Normaliserar mot Job Registry
{ name: "Målning väggar" } // Standard från badrum-definition
```

**Algoritm:**
1. Exakt match först (case-insensitive)
2. Partiell match baserat på ord-likhet
3. Returnerar bara om confidence >50%

### Steg 2: Dublett-detektion
Identifierar items med >70% namn-likhet:

```typescript
calculateSimilarity("Målning väggar", "Måla väggar") 
// → 0.85 (85% likhet)

calculateSimilarity("Rivning", "Demontering")
// → 0.4 (40% likhet, slås EJ samman)
```

**Algoritm:**
- Jaccard similarity på ord-nivå
- Bonus för substring-match
- Threshold: 0.7 (70%)

### Steg 3: Sammanslagning
Slår samman dubbletter med viktade priser:

```typescript
// Input dubbletter
[
  { name: "Målning väggar", estimatedHours: 8, hourlyRate: 650 },
  { name: "Måla väggar", estimatedHours: 4, hourlyRate: 700 }
]

// Output merged
{
  name: "Målning väggar",  // Längsta namnet
  estimatedHours: 12,       // 8 + 4
  hourlyRate: 667,          // (650×8 + 700×4) / 12 = viktad
  description: "Tidigare: 'Måla väggar'"
}
```

## API

### mergeWorkItems()

**Huvudfunktion** för all merge-logik.

```typescript
import { mergeWorkItems } from './mergeEngine.ts';
import { getJobDefinition } from './jobRegistry.ts';

const jobDef = getJobDefinition('målning');

const result = mergeWorkItems(
  [
    { name: "Målning väggar", estimatedHours: 8, hourlyRate: 650 },
    { name: "Måla väggar", estimatedHours: 4, hourlyRate: 700 },
    { name: "Spackling", estimatedHours: 5, hourlyRate: 600 }
  ],
  jobDef
);

console.log(result.mergedWorkItems);
// [
//   { name: "Målning väggar", estimatedHours: 12, hourlyRate: 667 },
//   { name: "Spackling", estimatedHours: 5, hourlyRate: 600 }
// ]

console.log(result.duplicatesRemoved); // 1
console.log(result.itemsNormalized);   // 0
```

**Input:**
- `workItems: WorkItem[]` - Lista med workItems att merga
- `jobDef?: JobDefinition` - JobDefinition för normalisering (optional)

**Output:**
```typescript
{
  mergedWorkItems: WorkItem[],     // Mergade items
  mergeOperations: Array<{         // Detaljerade merge-operationer
    originalItems: string[],
    mergedInto: string,
    totalHours: number,
    weightedRate: number,
    reason: string
  }>,
  duplicatesRemoved: number,       // Antal borttagna dubbletter
  itemsNormalized: number          // Antal normaliserade namn
}
```

### quickMergeWorkItems()

**Snabb version** utan JobDefinition (bara likhet).

```typescript
import { quickMergeWorkItems } from './mergeEngine.ts';

const result = quickMergeWorkItems(workItems);
// Normaliserar INTE, bara slår samman dubbletter
```

### logMergeReport()

**Logging-helper** för detaljerad rapport.

```typescript
import { logMergeReport } from './mergeEngine.ts';

const result = mergeWorkItems(workItems, jobDef);
logMergeReport(result);
```

Output:
```
📊 ===== MERGE REPORT =====

Duplicates Removed: 1
Items Normalized: 0
Merge Operations: 1

Merge Operations:

  1. Merged: Målning väggar + Måla väggar
     Into: "Målning väggar"
     Hours: 12h
     Weighted Rate: 667 kr/h
     Reason: Duplicate items merged

Final Work Items:
  1. Målning väggar
     12h × 667 kr/h
  2. Spackling
     5h × 600 kr/h
===========================
```

## Integration i Pipeline

Merge Engine körs **före** Formula Engine i Pipeline Orchestrator:

```typescript
// pipelineOrchestrator.ts

export async function runQuotePipeline(input, context) {
  
  // STEG 1-3: Hämta JobDef, fallbacks, flags
  // ...
  
  // STEG 4: MERGE ENGINE
  const mergeResult = mergeWorkItems(
    input.workItems,
    jobDef
  );
  
  // Använd mergade items från och med nu
  const workItems = mergeResult.mergedWorkItems;
  
  // STEG 5: FORMULA ENGINE
  // Beräknar subtotals och totals för mergade items
  const { quote } = calculateQuoteTotals({ workItems, ... });
  
  // STEG 6: MATH GUARD
  const finalQuote = enforceWorkItemMath(quote);
  
  return {
    quote: finalQuote,
    mergeResult,  // Inkluderar merge-rapport
    // ...
  };
}
```

## Exempel

### Exempel 1: Enkel merge av dubbletter

**Input:**
```typescript
const workItems = [
  { name: "Målning rum", estimatedHours: 8, hourlyRate: 650 },
  { name: "Måla rum", estimatedHours: 4, hourlyRate: 700 }
];
```

**Process:**
```
🔀 MERGE ENGINE: Starting
   Input: 2 work items

🔍 Found 1 duplicate groups

🔗 MERGE: [Målning rum, Måla rum]
   → "Målning rum": 12h × 667 kr/h

✅ MERGE ENGINE: Complete
   Input: 2 items
   Output: 1 items
   Duplicates removed: 1
   Items normalized: 0
   Merge operations: 1
```

**Output:**
```typescript
{
  mergedWorkItems: [
    { name: "Målning rum", estimatedHours: 12, hourlyRate: 667 }
  ],
  duplicatesRemoved: 1,
  mergeOperations: [
    {
      originalItems: ["Målning rum", "Måla rum"],
      mergedInto: "Målning rum",
      totalHours: 12,
      weightedRate: 667,
      reason: "Duplicate items merged"
    }
  ]
}
```

### Exempel 2: Normalisering mot Job Registry

**Input:**
```typescript
const workItems = [
  { name: "Väggmålning", estimatedHours: 10, hourlyRate: 650 },
  { name: "Spackling vägg", estimatedHours: 5, hourlyRate: 600 }
];

const jobDef = getJobDefinition('målning');
// standardWorkItems: [
//   { name: "Målning väggar", mandatory: true },
//   { name: "Spackling och slipning", mandatory: true }
// ]
```

**Process:**
```
🔀 MERGE ENGINE: Starting
   Input: 2 work items

📝 NORMALIZE: "Väggmålning" → "Målning väggar" (75% confidence)
📝 NORMALIZE: "Spackling vägg" → "Spackling och slipning" (80% confidence)

🔍 Found 0 duplicate groups

✅ MERGE ENGINE: Complete
   Items normalized: 2
```

**Output:**
```typescript
{
  mergedWorkItems: [
    { 
      name: "Målning väggar", 
      estimatedHours: 10, 
      hourlyRate: 650,
      description: "Tidigare: 'Väggmålning'"
    },
    { 
      name: "Spackling och slipning", 
      estimatedHours: 5, 
      hourlyRate: 600,
      description: "Tidigare: 'Spackling vägg'"
    }
  ],
  itemsNormalized: 2,
  duplicatesRemoved: 0
}
```

### Exempel 3: Komplett pipeline med merge

```typescript
import { runQuotePipeline } from './pipelineOrchestrator.ts';

const result = await runQuotePipeline(
  {
    description: "Måla om 3 rum",
    workItems: [
      { name: "Målning rum 1", estimatedHours: 8, hourlyRate: 650 },
      { name: "Måla rum 1", estimatedHours: 2, hourlyRate: 650 },
      { name: "Målning rum 2", estimatedHours: 6, hourlyRate: 650 },
      { name: "Målning rum 3", estimatedHours: 7, hourlyRate: 650 }
    ]
  },
  { userId: 'user-123', supabase }
);

console.log(result.mergeResult.duplicatesRemoved); // 1
console.log(result.quote.workItems.length);        // 3 (inte 4)
```

## Viktad timprisberäkning

**Varför viktning är viktigt:**

```typescript
// Scenario: Slå samman två workItems

Item 1: 10h × 600 kr/h = 6000 kr
Item 2: 2h × 900 kr/h = 1800 kr
Total: 12h, 7800 kr

// ❌ FEL: Enkelt genomsnitt
(600 + 900) / 2 = 750 kr/h
12h × 750 kr/h = 9000 kr  // 1200 kr FEL!

// ✅ RÄTT: Viktad efter timmar
(600×10 + 900×2) / 12 = 650 kr/h
12h × 650 kr/h = 7800 kr  // KORREKT!
```

**Implementation:**
```typescript
const weightedRate = items.reduce(
  (sum, item) => sum + (item.hourlyRate * item.estimatedHours),
  0
) / totalHours;
```

## Likhet-algoritm

```typescript
function calculateSimilarity(name1: string, name2: string): number {
  // 1. Lowercase och trim
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();
  
  // 2. Exakt match → 1.0
  if (n1 === n2) return 1.0;
  
  // 3. Dela upp i ord
  const words1 = n1.split(/\s+/);
  const words2 = n2.split(/\s+/);
  
  // 4. Räkna matchande ord (fuzzy)
  let matches = 0;
  words1.forEach(w1 => {
    if (words2.some(w2 => w2.includes(w1) || w1.includes(w2))) {
      matches++;
    }
  });
  
  // 5. Jaccard similarity
  const union = new Set([...words1, ...words2]).size;
  const similarity = union > 0 ? matches / union : 0;
  
  // 6. Bonus för substring-match
  if (n1.includes(n2) || n2.includes(n1)) {
    return Math.min(1.0, similarity + 0.3);
  }
  
  return similarity;
}
```

**Exempel:**
```typescript
calculateSimilarity("Målning väggar", "Måla väggar")
// → 0.85 (85% likhet) ✅ Slås samman

calculateSimilarity("Målning", "Spackling")
// → 0.0 (0% likhet) ❌ Slås EJ samman

calculateSimilarity("Rivning och demontering", "Demontering")
// → 0.8 (80% med substring-bonus) ✅ Slås samman
```

## Best Practices

### ✅ DO

```typescript
// Kör Merge Engine innan Formula Engine
const mergeResult = mergeWorkItems(workItems, jobDef);
const { quote } = calculateQuoteTotals({ 
  workItems: mergeResult.mergedWorkItems 
});

// Logga merge-operationer för debugging
if (mergeResult.duplicatesRemoved > 0) {
  logMergeReport(mergeResult);
}

// Inkludera merge-info i assumptions
quote.assumptions.push({
  text: `Slog samman ${mergeResult.duplicatesRemoved} dubbletter`,
  confidence: 95
});
```

### ❌ DON'T

```typescript
// Slå INTE samman efter Formula Engine
const { quote } = calculateQuoteTotals({ workItems });
const mergeResult = mergeWorkItems(quote.workItems); // ❌

// Glöm INTE att använda JobDefinition
const result = mergeWorkItems(workItems); // ⚠️ Normaliserar inte

// Kör INTE merge manuellt - använd Pipeline Orchestrator
// (Pipeline kör Merge Engine automatiskt)
```

## Testning

### Enhetstest

```typescript
import { mergeWorkItems, calculateSimilarity } from './mergeEngine.ts';

// Test 1: Likhet-algoritm
expect(calculateSimilarity("Målning", "Måla")).toBeGreaterThan(0.7);
expect(calculateSimilarity("Målning", "Spackling")).toBeLessThan(0.3);

// Test 2: Merge dubbletter
const result = mergeWorkItems([
  { name: "Målning", estimatedHours: 8, hourlyRate: 650 },
  { name: "Måla", estimatedHours: 4, hourlyRate: 700 }
]);

expect(result.mergedWorkItems.length).toBe(1);
expect(result.mergedWorkItems[0].estimatedHours).toBe(12);
expect(result.mergedWorkItems[0].hourlyRate).toBe(667); // Viktad

// Test 3: Normalisering
const jobDef = { standardWorkItems: [{ name: "Målning väggar" }] };
const result2 = mergeWorkItems(
  [{ name: "Väggmålning", estimatedHours: 10, hourlyRate: 650 }],
  jobDef
);

expect(result2.mergedWorkItems[0].name).toBe("Målning väggar");
```

## Prestandaoptimering

Merge Engine är O(n²) för likhet-jämförelser, men optimerad för vanliga fall:

- **Best case**: Inga dubbletter → O(n)
- **Worst case**: Alla items är dubbletter → O(n²)
- **Typical case**: 1-3 dubbletter bland 5-10 items → O(n)

För >100 workItems bör man överväga batch-processing.

## Framtida förbättringar

### Fas 5: ML-baserad normalisering
Träna en modell på historiska quotes för bättre normalisering:
```typescript
// Framtida API
const result = await mlMergeWorkItems(workItems, {
  model: 'quote-normalizer-v2',
  threshold: 0.8
});
```

### Fas 6: Smart suggestions
Föreslå merge till användaren istället för automatisk:
```typescript
// Framtida API
const suggestions = suggestMerges(workItems);
// → UI visar: "Vill du slå samman 'Målning' och 'Måla'?"
```

## Support

För frågor eller buggrapporter, se:
- `mergeEngine.ts` - Källkod
- `pipelineOrchestrator.ts` - Integration
- `formulaEngine.ts` - Nästa steg efter merge
