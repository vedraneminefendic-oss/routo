/**
 * TOTAL GUARD - Validera totalpris mot branschmedian (±25%)
 * Förhindrar extrema priser genom att jämföra mot industry_benchmarks
 */

interface TotalGuardResult {
  passed: boolean;
  deviation: number;
  pricePerUnit: number;
  medianPricePerUnit: number;
  warning?: {
    type: 'price_too_high' | 'price_too_low';
    message: string;
    suggestedAction: string;
  };
}

export async function validateTotalPrice(
  totalPrice: number,
  unitQty: number,
  unitType: string,
  jobType: string,
  supabase: any
): Promise<TotalGuardResult> {
  
  console.log('🛡️ TOTAL-GUARD: Validerar totalpris...');
  
  const pricePerUnit = totalPrice / unitQty;
  
  // Hämta median från industry_benchmarks
  const { data: benchmark } = await supabase
    .from('industry_benchmarks')
    .select('*')
    .eq('work_category', jobType.toLowerCase())
    .eq('metric_type', 'price_per_unit')
    .single();
  
  if (!benchmark) {
    console.log('⚠️ No benchmark data for total-guard, skipping validation');
    return {
      passed: true,
      deviation: 0,
      pricePerUnit,
      medianPricePerUnit: 0
    };
  }
  
  const medianPricePerUnit = benchmark.median_value;
  const minAllowed = medianPricePerUnit * 0.75; // -25%
  const maxAllowed = medianPricePerUnit * 1.25; // +25%
  
  const deviation = ((pricePerUnit - medianPricePerUnit) / medianPricePerUnit) * 100;
  
  if (pricePerUnit < minAllowed) {
    console.warn(`⚠️ TOTAL-GUARD: Price ${deviation.toFixed(0)}% BELOW median`);
    return {
      passed: false,
      deviation,
      pricePerUnit,
      medianPricePerUnit,
      warning: {
        type: 'price_too_low',
        message: `Priset ligger ${Math.abs(deviation).toFixed(0)}% under branschmedian (${Math.round(medianPricePerUnit)} kr/${unitType}). Detta kan påverka lönsamheten.`,
        suggestedAction: 'Överväg att justera timpriser, material eller multiplikatorer uppåt.'
      }
    };
  }
  
  if (pricePerUnit > maxAllowed) {
    console.warn(`⚠️ TOTAL-GUARD: Price ${deviation.toFixed(0)}% ABOVE median`);
    return {
      passed: false,
      deviation,
      pricePerUnit,
      medianPricePerUnit,
      warning: {
        type: 'price_too_high',
        message: `Priset ligger ${deviation.toFixed(0)}% över branschmedian (${Math.round(medianPricePerUnit)} kr/${unitType}). Detta kan minska chansen att offerten accepteras.`,
        suggestedAction: 'Kontrollera timpriser, materialpåslag och multiplikatorer. Överväg att sänka något.'
      }
    };
  }
  
  console.log('✅ TOTAL-GUARD: Price within acceptable range');
  return {
    passed: true,
    deviation,
    pricePerUnit,
    medianPricePerUnit
  };
}
