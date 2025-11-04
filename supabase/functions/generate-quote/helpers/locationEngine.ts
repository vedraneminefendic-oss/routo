/**
 * LOCATION ENGINE - Härled ort och region från olika källor
 * Prioritetsordning:
 * 1. Jobbplats (från offertformulär/chat)
 * 2. Kundens adress (från customers-tabell)
 * 3. Företagets basadress (från company_settings)
 * 4. Fallback: landsbygd
 */

interface LocationResult {
  location: string;
  region: string;
  source: 'job_location' | 'customer_address' | 'company_address' | 'fallback';
  confidence: number;
}

// Mappning av städer/kommuner till regioner
const REGION_MAPPING: Record<string, string[]> = {
  stockholm: ['stockholm', 'solna', 'täby', 'huddinge', 'södertälje', 'nacka', 'sundbyberg', 'lidingö', 'upplands väsby', 'järfälla', 'bromma'],
  goteborg: ['göteborg', 'mölndal', 'partille', 'kungälv', 'ale', 'lerum', 'härryda'],
  malmo: ['malmö', 'lund', 'helsingborg', 'landskrona', 'trelleborg', 'ystad', 'eslöv'],
  uppsala: ['uppsala', 'enköping', 'tierp', 'älvkarleby'],
  norrland: ['umeå', 'luleå', 'sundsvall', 'östersund', 'skellefteå', 'piteå', 'boden', 'kiruna', 'gävle', 'härnösand'],
  smaland: ['jönköping', 'växjö', 'kalmar', 'västervik', 'nässjö', 'vetlanda'],
  landsbygd: []
};

export async function deriveLocation(
  jobLocation: string | null,
  customerId: string | null,
  userId: string,
  supabase: any
): Promise<LocationResult> {
  
  console.log('📍 Härledning av ort och region...');
  
  // PRIO 1: Jobbplats från offertformulär eller chat
  if (jobLocation && jobLocation.trim().length > 0) {
    const region = matchRegion(jobLocation);
    console.log(`✅ PRIO 1: Jobbplats "${jobLocation}" → region: ${region}`);
    return {
      location: jobLocation,
      region,
      source: 'job_location',
      confidence: 0.95
    };
  }
  
  // PRIO 2: Kundens adress från customer-tabell
  if (customerId) {
    const { data: customer } = await supabase
      .from('customers')
      .select('address')
      .eq('id', customerId)
      .single();
    
    if (customer?.address) {
      const region = matchRegion(customer.address);
      console.log(`✅ PRIO 2: Kundadress "${customer.address}" → region: ${region}`);
      return {
        location: customer.address,
        region,
        source: 'customer_address',
        confidence: 0.85
      };
    }
  }
  
  // PRIO 3: Företagets basadress från company_settings
  const { data: company } = await supabase
    .from('company_settings')
    .select('address')
    .eq('user_id', userId)
    .single();
  
  if (company?.address) {
    const region = matchRegion(company.address);
    console.log(`✅ PRIO 3: Företagsadress "${company.address}" → region: ${region}`);
    return {
      location: company.address,
      region,
      source: 'company_address',
      confidence: 0.70
    };
  }
  
  // FALLBACK: Landsbygd (neutral multiplier)
  console.log('⚠️ FALLBACK: Ingen adress hittades → använder "landsbygd"');
  return {
    location: 'Okänd ort',
    region: 'landsbygd',
    source: 'fallback',
    confidence: 0.50
  };
}

function matchRegion(address: string): string {
  const normalized = address.toLowerCase();
  
  for (const [region, cities] of Object.entries(REGION_MAPPING)) {
    if (cities.some(city => normalized.includes(city))) {
      return region;
    }
  }
  
  return 'landsbygd';
}

export async function getRegionalMultiplier(
  region: string,
  jobCategory: string,
  supabase: any
): Promise<{ multiplier: number; reason: string }> {
  
  // Försök hitta specifik kategori först
  let { data } = await supabase
    .from('regional_multipliers')
    .select('*')
    .eq('region', region)
    .eq('job_category', jobCategory)
    .single();
  
  // Fallback till 'alla' om inte hittad
  if (!data) {
    const result = await supabase
      .from('regional_multipliers')
      .select('*')
      .eq('region', region)
      .eq('job_category', 'alla')
      .single();
    data = result.data;
  }
  
  if (!data) {
    console.warn(`⚠️ No regional multiplier found for ${region}`);
    return { multiplier: 1.0, reason: 'Ingen regional data tillgänglig' };
  }
  
  console.log(`🌍 Regional multiplier: ${region} → ${data.multiplier}x (${data.reason})`);
  return { multiplier: data.multiplier, reason: data.reason };
}

export async function getSeasonalMultiplier(
  jobType: string,
  month: number,
  supabase: any
): Promise<{ multiplier: number; reason: string }> {
  
  const { data } = await supabase
    .from('seasonal_multipliers')
    .select('*')
    .eq('job_type', jobType)
    .eq('month', month)
    .single();
  
  if (!data) {
    console.log(`📅 No seasonal multiplier found for ${jobType} in month ${month}`);
    return { multiplier: 1.0, reason: 'Ingen säsongsdata tillgänglig' };
  }
  
  console.log(`📅 Seasonal multiplier: ${jobType} month ${month} → ${data.multiplier}x (${data.reason})`);
  return { multiplier: data.multiplier, reason: data.reason };
}

export function getMonthName(month: number): string {
  const months = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 
                  'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
  return months[month - 1] || 'Okänd månad';
}
