// ==========================================
// VALIDATION: Quote Consistency Check
// ==========================================
export function validateQuoteConsistency(
  previousQuote: any,
  newQuote: any,
  latestUserMessage: string
): { isConsistent: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  const prevTotal = parseFloat(previousQuote?.summary?.customerPays || '0');
  const newTotal = parseFloat(newQuote?.summary?.customerPays || '0');
  
  // Detect if user is ADDING work
  const additionKeywords = [
    'lägg till', 'även', 'också', 'plus', 'och',
    'add', 'also', 'additionally', 'plus', 'include'
  ];
  const isAddingWork = additionKeywords.some(kw => 
    latestUserMessage.toLowerCase().includes(kw)
  );
  
  // Detect if user is REMOVING work
  const removalKeywords = [
    'ta bort', 'utan', 'bara', 'endast', 'skippa',
    'remove', 'without', 'only', 'skip', 'exclude'
  ];
  const isRemovingWork = removalKeywords.some(kw => 
    latestUserMessage.toLowerCase().includes(kw)
  );
  
  // CRITICAL: If adding work, price MUST increase
  if (isAddingWork && newTotal < prevTotal) {
    warnings.push(
      `⚠️ KONSISTENSFEL: Priset sjönk från ${prevTotal} SEK till ${newTotal} SEK trots att arbete lades till. ` +
      `Detta är INTE logiskt och skapar misstro hos kunden.`
    );
  }
  
  // If removing work, price should decrease
  if (isRemovingWork && newTotal > prevTotal) {
    warnings.push(
      `⚠️ KONSISTENSFEL: Priset ökade från ${prevTotal} SEK till ${newTotal} SEK trots att arbete togs bort.`
    );
  }
  
  // Check for unrealistic price jumps (>50% change without clear reason)
  const priceDelta = Math.abs(newTotal - prevTotal);
  const percentChange = (priceDelta / prevTotal) * 100;
  
  if (!isAddingWork && !isRemovingWork && percentChange > 50) {
    warnings.push(
      `⚠️ STOR PRISFÖRÄNDRING: Priset ändrades med ${percentChange.toFixed(0)}% utan tydlig anledning ` +
      `(från ${prevTotal} SEK till ${newTotal} SEK).`
    );
  }
  
  // Check if work items decreased when adding work
  const prevWorkItems = previousQuote?.workItems?.length || 0;
  const newWorkItems = newQuote?.workItems?.length || 0;
  
  if (isAddingWork && newWorkItems < prevWorkItems) {
    warnings.push(
      `⚠️ KONSISTENSFEL: Antal arbetsmoment minskade från ${prevWorkItems} till ${newWorkItems} ` +
      `trots att arbete skulle läggas till.`
    );
  }
  
  return {
    isConsistent: warnings.length === 0,
    warnings
  };
}
