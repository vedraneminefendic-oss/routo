# Formula Engine - Fas 3 Dokumentation

## Översikt

Formula Engine är den **enda källan till sanning** för alla matematiska beräkningar i offertsystemet. Ingen annan kod ska räkna subtotals eller totals.

## Principer

1. **Single Source of Truth**: All matematik sker i `formulaEngine.ts`
2. **Deterministisk**: Samma input ger alltid samma output
3. **Transparent**: Alla beräkningar loggas och kan spåras
4. **Självkorrigerande**: Upptäcker och korrigerar fel automatiskt

## Arkitektur

```
┌─────────────────────────────────────────────────────────────┐
│                    QUOTE GENERATION FLOW                     │
└─────────────────────────────────────────────────────────────┘

1. AI genererar strukturerad data
   ↓
   {
     workItems: [{ name, hours, hourlyRate }],
     materials: [{ name, estimatedCost }],
     equipment: [{ name, estimatedCost }]
   }

2. Formula Engine beräknar ALLT
   ↓
   calculateQuoteTotals(quote, deductionType)
   
   Beräknar:
   - workItem.subtotal = hours × hourlyRate
   - workCost = sum(workItems.subtotal)
   - materialCost = sum(materials.estimatedCost)
   - equipmentCost = sum(equipment.estimatedCost)
   - totalBeforeVAT = workCost + materialCost + equipmentCost
   - vat = totalBeforeVAT × 0.25
   - totalWithVAT = totalBeforeVAT + vat
   - rotDeduction / rutDeduction (baserat på workCost)
   - customerPays = totalWithVAT - deduction

3. Math Guard validerar
   ↓
   enforceWorkItemMath(quote)
   
   - Använder Formula Engine internt
   - Upptäcker och loggar avvikelser >10%
   - Returnerar korrigerad quote

4. Pipeline Orchestrator
   ↓
   runQuotePipeline(input, context)
   
   - Koordinerar alla steg
   - Applicerar fallbacks
   - Detekterar flags
   - Kör Math Guard som sista steg
```

## API

### calculateQuoteTotals()

**Primär funktion** för alla beräkningar.

```typescript
import { calculateQuoteTotals } from './formulaEngine.ts';

const { quote, report } = calculateQuoteTotals(
  {
    workItems: [
      { 
        name: 'Målning väggar',
        estimatedHours: 10,
        hourlyRate: 650
      }
    ],
    materials: [
      { name: 'Färg', quantity: 5, unit: 'l', estimatedCost: 500 }
    ],
    equipment: [],
    deductionType: 'rut'
  },
  'rut'
);

console.log(quote.summary.customerPays); // Final betalning
console.log(report.workItemsRecalculated); // Antal korrigeringar
```

**Input:**
- `quote: QuoteStructure` - Quote med workItems, materials, equipment
- `deductionType: string` - 'rot' | 'rut' | 'none'

**Output:**
```typescript
{
  quote: QuoteStructure,      // Uppdaterad quote med alla beräknade värden
  report: CalculationReport    // Detaljerad rapport om korrigeringar
}
```

### recalculateQuoteTotals()

**Snabb version** utan rapport (för prestanda).

```typescript
import { recalculateQuoteTotals } from './formulaEngine.ts';

const updatedQuote = recalculateQuoteTotals(quote, 'rot');
```

### validateQuoteMath()

**Validering** utan att ändra quote.

```typescript
import { validateQuoteMath } from './formulaEngine.ts';

if (!validateQuoteMath(quote, 'rot')) {
  console.log('Quote har felaktiga beräkningar!');
}
```

## Användning i befintlig kod

### I generate-quote/index.ts

**FÖRE (Fas 2):**
```typescript
// ❌ Manuell beräkning (gamla systemet)
const workCost = workItems.reduce((sum, w) => sum + w.subtotal, 0);
const totalBeforeVAT = workCost + materialCost;
// ... mer manuell matematik
```

**EFTER (Fas 3):**
```typescript
// ✅ Använd Formula Engine via Math Guard
import { enforceWorkItemMath } from './helpers/mathGuard.ts';

// Efter att AI har genererat quote-strukturen:
const mathGuardResult = enforceWorkItemMath(rawQuote);
const finalQuote = mathGuardResult.correctedQuote;

// All matematik är nu korrekt och validerad
```

### I Math Guard

Math Guard använder nu Formula Engine internt:

```typescript
export function enforceWorkItemMath(quote: Quote): MathGuardResult {
  // Konvertera till QuoteStructure
  const quoteStructure = convertToQuoteStructure(quote);
  
  // Använd Formula Engine
  const { quote: correctedQuote, report } = calculateQuoteTotals(
    quoteStructure, 
    quote.deductionType || 'none'
  );
  
  // Returnera resultat med rapport
  return {
    correctedQuote,
    totalCorrections: report.totalCorrections,
    // ...
  };
}
```

## Beräkningsregler

### 1. WorkItem Subtotals
```
subtotal = Math.round(estimatedHours × hourlyRate)
```

### 2. Arbetskostnad
```
workCost = Σ(workItem.subtotal)
```

### 3. Materialkostnad
```
materialCost = Σ(material.estimatedCost)
```

### 4. Utrustningskostnad
```
equipmentCost = Σ(equipment.estimatedCost)
```

### 5. Total före moms
```
totalBeforeVAT = workCost + materialCost + equipmentCost
```

### 6. Moms (25%)
```
vat = Math.round(totalBeforeVAT × 0.25)
```

### 7. Total med moms
```
totalWithVAT = totalBeforeVAT + vat
```

### 8. ROT-avdrag (30% på arbete)
```
rotDeduction = Math.round(workCost × 0.30)
```

### 9. RUT-avdrag (50% på arbete)
```
rutDeduction = Math.round(workCost × 0.50)
```

### 10. Kund betalar
```
customerPays = totalWithVAT - (rotDeduction || rutDeduction || 0)
```

## Självkorrigering

Formula Engine upptäcker automatiskt felaktiga beräkningar och korrigerar dem:

```typescript
const { quote, report } = calculateQuoteTotals(badQuote, 'rot');

if (report.totalCorrections > 0) {
  console.log(`Korrigerade ${report.totalCorrections} fel`);
  report.details.forEach(detail => console.log(detail));
}
```

**Exempel på korrigeringar:**
```
WorkItem "Målning": 6400 kr → 6500 kr (10h × 650 kr/h)
Total corrected: 8320 kr → 8450 kr (1.6% skillnad)
```

## Integration med Math Guard

Math Guard är nu en **wrapper** runt Formula Engine som:

1. Konverterar mellan olika quote-format
2. Samlar korrigeringsrapporter
3. Loggar alla ändringar för debugging

```typescript
// Math Guard använder Formula Engine internt
const result = enforceWorkItemMath(quote);

console.log(`Korrigerade ${result.totalCorrections} fel`);
console.log(`Max avvikelse: ${result.summary.maxDiffPercent}%`);
```

## Best Practices

### ✅ DO

```typescript
// Använd Formula Engine för alla beräkningar
const { quote } = calculateQuoteTotals(rawQuote, 'rot');

// Validera innan du sparar
if (!validateQuoteMath(quote, 'rot')) {
  throw new Error('Quote math is invalid');
}

// Använd Math Guard som sista steg i pipeline
const finalQuote = enforceWorkItemMath(quote).correctedQuote;
```

### ❌ DON'T

```typescript
// Räkna ALDRIG manuellt
const total = item1.subtotal + item2.subtotal; // ❌

// Modifiera ALDRIG summary direkt
quote.summary.customerPays = 10000; // ❌

// Räkna ALDRIG subtotals i AI-prompten
"Calculate subtotal = hours × rate" // ❌
```

## Testning

### Enhetstester

```typescript
import { calculateQuoteTotals } from './formulaEngine.ts';

// Test 1: Grundläggande beräkning
const input = {
  workItems: [{ name: 'Test', estimatedHours: 10, hourlyRate: 500 }],
  materials: [],
  equipment: []
};

const { quote } = calculateQuoteTotals(input, 'none');
expect(quote.workItems[0].subtotal).toBe(5000);
expect(quote.summary.totalBeforeVAT).toBe(5000);

// Test 2: ROT-avdrag
const { quote: rotQuote } = calculateQuoteTotals(input, 'rot');
expect(rotQuote.summary.rotDeduction).toBe(1500); // 30% av 5000
expect(rotQuote.summary.customerPays).toBe(4750); // 5000 + 1250 VAT - 1500 ROT
```

### Regressionstester

Formula Engine ska klara alla befintliga regressionstester utan ändringar.

```bash
# Kör regressionstester
supabase functions invoke run-regression-tests
```

## Logging

Formula Engine loggar alla beräkningar för debugging:

```
🧮 FORMULA ENGINE: Starting total calculation...
✅ FORMULA ENGINE: Calculation complete {
  workCost: 6500,
  materialCost: 500,
  equipmentCost: 0,
  totalBeforeVAT: 7000,
  vat: 1750,
  totalWithVAT: 8750,
  deduction: 3250,
  customerPays: 5500,
  workItemsRecalculated: 1,
  totalCorrections: 1
}
```

## Framtida utveckling

### Fas 4: Merge Engine Integration
Formula Engine kommer att integreras med Merge Engine för att hantera dubbletter innan beräkning.

### Fas 5: Domain Validation
Formula Engine kommer att validera mot jobbtyps-specifika regler från Job Registry.

## Support

För frågor eller buggrapporter, se:
- `formulaEngine.ts` - Källkod
- `mathGuard.ts` - Integration
- `pipelineOrchestrator.ts` - Pipeline-användning
