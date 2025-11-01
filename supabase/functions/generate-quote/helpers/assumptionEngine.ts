import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface Assumption {
  text: string;
  confidence: number;
  sourceOfTruth: string;
  canConfirm: boolean;
  field: string;
}

interface HistoricalPattern {
  avgTimeline: number;
  avgCostPerSqm: number;
  commonMaterials: string[];
  commonWorkItems: string[];
  sampleSize: number;
}

/**
 * Hämtar historiska mönster från liknande projekt
 */
export async function getHistoricalPatterns(
  supabase: any,
  userId: string,
  projectType: string,
  area: number
): Promise<HistoricalPattern | null> {
  try {
    // Hämta liknande accepterade offerter (±20% av arean)
    const minArea = area * 0.8;
    const maxArea = area * 1.2;
    
    const { data: similarQuotes, error } = await supabase
      .from('quotes')
      .select('generated_quote, edited_quote, description, created_at')
      .eq('user_id', userId)
      .in('status', ['accepted', 'completed'])
      .ilike('description', `%${projectType}%`);

    if (error || !similarQuotes || similarQuotes.length === 0) {
      console.log('⚠️ No historical patterns found');
      return null;
    }

    // Filtrera på area i quote data
    const relevantQuotes = similarQuotes.filter((q: any) => {
      const quote = q.edited_quote || q.generated_quote;
      const quoteArea = quote?.measurements?.area || 0;
      return quoteArea >= minArea && quoteArea <= maxArea;
    });

    if (relevantQuotes.length === 0) {
      return null;
    }

    // Beräkna medelvärden
    let totalTimeline = 0;
    let totalCost = 0;
    const allMaterials = new Set<string>();
    const allWorkItems = new Set<string>();

    relevantQuotes.forEach((q: any) => {
      const quote = q.edited_quote || q.generated_quote;
      
      // Timeline (anta 5 arbetsdagar/vecka)
      if (quote.timeline?.totalDuration) {
        const weeks = parseInt(quote.timeline.totalDuration);
        totalTimeline += weeks * 5;
      }

      // Kostnad per kvm
      const quoteArea = quote.measurements?.area || area;
      const cost = quote.summary?.totalBeforeVAT || 0;
      totalCost += cost / quoteArea;

      // Material och arbetsmoment
      quote.materials?.forEach((m: any) => allMaterials.add(m.name));
      quote.workItems?.forEach((w: any) => allWorkItems.add(w.name));
    });

    const sampleSize = relevantQuotes.length;

    return {
      avgTimeline: Math.round(totalTimeline / sampleSize),
      avgCostPerSqm: Math.round(totalCost / sampleSize),
      commonMaterials: Array.from(allMaterials).slice(0, 10),
      commonWorkItems: Array.from(allWorkItems).slice(0, 10),
      sampleSize,
    };
  } catch (error) {
    console.error('Error fetching historical patterns:', error);
    return null;
  }
}

/**
 * Genererar antaganden baserat på historik och input
 */
export function generateAssumptions(
  conversationSummary: any,
  historicalPattern: HistoricalPattern | null,
  projectType: string
): Assumption[] {
  const assumptions: Assumption[] = [];

  // 1. Tidslinje-antagande
  if (!conversationSummary.timeline || conversationSummary.timeline === 'så snart som möjligt') {
    if (historicalPattern && historicalPattern.sampleSize > 0) {
      const weeks = Math.ceil(historicalPattern.avgTimeline / 5);
      assumptions.push({
        text: `Projekttid: ${weeks}-${weeks + 1} veckor`,
        confidence: historicalPattern.sampleSize >= 5 ? 75 : 60,
        sourceOfTruth: `Historiska offertdata (${historicalPattern.sampleSize} liknande projekt)`,
        canConfirm: true,
        field: 'timeline',
      });
    } else {
      // Fallback baserat på projekttyp
      const defaultWeeks = projectType.includes('badrum') ? 3 : projectType.includes('kök') ? 4 : 2;
      assumptions.push({
        text: `Projekttid: ${defaultWeeks}-${defaultWeeks + 1} veckor`,
        confidence: 40,
        sourceOfTruth: 'Branschstandard för liknande projekt',
        canConfirm: true,
        field: 'timeline',
      });
    }
  }

  // 2. Golvvärme-antagande (för badrum i källare)
  if (projectType.toLowerCase().includes('badrum') && 
      conversationSummary.scope?.toLowerCase().includes('källare')) {
    if (!conversationSummary.answeredTopics?.includes('golvvärme')) {
      assumptions.push({
        text: 'Golvvärme: Inkluderat (rekommenderas starkt i källare)',
        confidence: 80,
        sourceOfTruth: 'Branschrekommendation - 80% av källarbadrum har golvvärme',
        canConfirm: true,
        field: 'heating',
      });
    }
  }

  // 3. Material-antagande
  if (!conversationSummary.materials?.quality) {
    assumptions.push({
      text: 'Materialkvalitet: Standard (mellanpris)',
      confidence: 70,
      sourceOfTruth: 'De flesta kunder väljer standardmaterial',
      canConfirm: true,
      field: 'materials',
    });
  }

  // 4. Kostnadsuppskattning
  if (historicalPattern && historicalPattern.sampleSize >= 3) {
    const estimatedCost = Math.round(historicalPattern.avgCostPerSqm * (conversationSummary.measurements?.area || 1));
    const min = Math.round(estimatedCost * 0.85);
    const max = Math.round(estimatedCost * 1.15);
    
    assumptions.push({
      text: `Kostnadsram: ${min.toLocaleString('sv-SE')} - ${max.toLocaleString('sv-SE')} kr (exkl. moms)`,
      confidence: historicalPattern.sampleSize >= 5 ? 85 : 70,
      sourceOfTruth: `Baserat på ${historicalPattern.sampleSize} liknande projekt du gjort`,
      canConfirm: false,
      field: 'cost',
    });
  }

  // 5. Specifika arbetsmoment (om historik finns)
  if (historicalPattern && historicalPattern.commonWorkItems.length > 0) {
    assumptions.push({
      text: `Vanliga arbetsmoment: ${historicalPattern.commonWorkItems.slice(0, 3).join(', ')}`,
      confidence: 80,
      sourceOfTruth: `Dina tidigare ${projectType}-projekt`,
      canConfirm: false,
      field: 'workItems',
    });
  }

  return assumptions;
}

/**
 * Beräknar hur komplett konversationen är
 */
export function calculateCompleteness(conversationSummary: any): {
  completeness: number;
  missingCritical: string[];
  missingOptional: string[];
} {
  const requiredFields = [
    { key: 'projectType', label: 'Typ av projekt' },
    { key: 'measurements.area', label: 'Storlek/Area' },
    { key: 'scope', label: 'Omfattning' },
    { key: 'timeline', label: 'Tidplan' },
  ];

  const optionalFields = [
    { key: 'materials.quality', label: 'Materialkvalitet' },
    { key: 'budget', label: 'Budget' },
    { key: 'specialRequirements', label: 'Speciella krav' },
    { key: 'exclusions', label: 'Undantag' },
  ];

  const getValue = (obj: any, path: string) => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  const missingCritical = requiredFields
    .filter(f => !getValue(conversationSummary, f.key))
    .map(f => f.label);

  const missingOptional = optionalFields
    .filter(f => !getValue(conversationSummary, f.key))
    .map(f => f.label);

  const filled = requiredFields.length - missingCritical.length;
  const completeness = Math.round((filled / requiredFields.length) * 100);

  return {
    completeness,
    missingCritical,
    missingOptional,
  };
}
