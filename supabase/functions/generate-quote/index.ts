import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// FAS 7: Industry-specific material to work cost ratios (FAS 3.6: REALISTISKA VÄRDEN)
const MATERIAL_RATIOS: Record<string, number> = {
  'Snickare': 0.45,           // Virke, beslag, skruv
  'Elektriker': 0.40,         // Kablar, dosor, uttag - mer material än tidigare
  'VVS': 0.50,                // Rör, kopplingar, kranar - betydande materialkostnad
  'Målare': 0.20,             // Färg, spackel, förberedelse - mest arbete
  'Murare': 0.50,             // Tegel, murbruk, isolering
  'Plattsättare': 0.65,       // ⬆️ Kakel, klinker, fog - MYCKET högt materialpris (badrum!)
  'Städare': 0.05,            // ⬇️ Städmaterial - nästan bara arbete
  'Trädgårdsskötare': 0.30,   // Växter, jord, gödsel
  'Arborist': 0.10,           // ⬇️ Mest arbete + transport
  'Fönsterputsare': 0.05,     // ⬇️ Minimal material
  'Takläggare': 0.60,         // Takpannor, underlag - dyrt material
  'Hantverkare': 0.35,        // Generic fallback
  // FAS 3.6: Projektbaserade ratios (används när flera arbetstyper kombineras)
  'badrum': 0.65,             // ⬆️ Kakel + VVS + klinker
  'kok': 0.70,                // ⬆️ Vitvaror, skåp, bänkskivor
  'altan': 0.50,              // Virke, beslag
  'malning': 0.20,            // Färg är billigt
  'golv': 0.55,               // Golv-material kostar mycket
  'fönster': 0.75             // Fönstren själva är dyrast
};

// FAS 4: Smart industry defaults to reduce unnecessary questions
const SMART_DEFAULTS: Record<string, {
  defaultArea?: string;
  defaultQuantity?: string;
  assumedFactors: string[];
  typicalMeasurements: string;
}> = {
  'badrum_renovering': {
    defaultArea: '5 kvm',
    assumedFactors: ['Standardhöjd 2.4m väggar', 'Inkluderar golv och väggar'],
    typicalMeasurements: 'Standardbadrum är typiskt 4-6 kvm'
  },
  'kok_renovering': {
    defaultArea: '12 kvm',
    assumedFactors: ['Standardkök med L-form', 'Inkluderar vitvaror'],
    typicalMeasurements: 'Standardkök är typiskt 10-15 kvm'
  },
  'altan': {
    defaultArea: '20 kvm',
    assumedFactors: ['Höjd 0.5m över mark', 'Inkluderar räcke'],
    typicalMeasurements: 'Standardaltan är typiskt 15-25 kvm'
  },
  'malning': {
    defaultArea: '40 kvm',
    assumedFactors: ['Standardhöjd 2.5m tak', '2 färglager'],
    typicalMeasurements: 'Ett rum är typiskt 15-20 kvm golv = 40-50 kvm väggar'
  },
  'fonsterputs': {
    defaultQuantity: '10 fönster',
    assumedFactors: ['Standardfönster 1.2m x 1.5m', 'Ut- och insida'],
    typicalMeasurements: 'Villa har typiskt 10-15 fönster'
  },
  'tradfallning': {
    defaultQuantity: '1 träd',
    assumedFactors: ['Höjd 12m', 'Diameter 40cm', 'Bortforsling ingår'],
    typicalMeasurements: 'Standardträd är 10-15m högt'
  },
  'stadning': {
    defaultArea: '100 kvm',
    assumedFactors: ['Standardstädning inkl. badrum och kök'],
    typicalMeasurements: 'Villa är typiskt 100-150 kvm'
  }
};

// Industry benchmarks for realistic pricing validation
const INDUSTRY_BENCHMARKS: Record<string, {
  avgMaterialPerSqm: number;
  avgWorkHoursPerSqm: number;
  minMaterial: number;
  workTypes: string[];
  avgTotalPerSqm: number;
  minPricePerSqm: number;
  maxPricePerSqm: number;
}> = {
  'badrum_renovering': {
    avgMaterialPerSqm: 3500,
    avgWorkHoursPerSqm: 12,
    minMaterial: 15000,
    workTypes: ['Plattsättare', 'VVS', 'Elektriker', 'Snickare'],
    avgTotalPerSqm: 20000,
    minPricePerSqm: 15000,
    maxPricePerSqm: 30000
  },
  'kok_renovering': {
    avgMaterialPerSqm: 4000,
    avgWorkHoursPerSqm: 10,
    minMaterial: 30000,
    workTypes: ['Snickare', 'Elektriker', 'VVS'],
    avgTotalPerSqm: 25000,
    minPricePerSqm: 20000,
    maxPricePerSqm: 40000
  },
  'altan': {
    avgMaterialPerSqm: 1500,
    avgWorkHoursPerSqm: 6,
    minMaterial: 8000,
    workTypes: ['Snickare'],
    avgTotalPerSqm: 3500,
    minPricePerSqm: 2500,
    maxPricePerSqm: 5000
  },
  'malning': {
    avgMaterialPerSqm: 50,
    avgWorkHoursPerSqm: 0.5,
    minMaterial: 3000,
    workTypes: ['Målare'],
    avgTotalPerSqm: 400,
    minPricePerSqm: 300,
    maxPricePerSqm: 600
  },
  'golvlaggning': {
    avgMaterialPerSqm: 400,
    avgWorkHoursPerSqm: 2,
    minMaterial: 8000,
    workTypes: ['Snickare'],
    avgTotalPerSqm: 1800,
    minPricePerSqm: 1200,
    maxPricePerSqm: 2500
  }
};

// FAS 5: Fetch learned preferences and industry benchmarks from database
async function fetchLearningContext(supabaseClient: any, userId: string, sessionId?: string) {
  const context: {
    learnedPreferences?: any;
    industryData?: any[];
    userPatterns?: any;
  } = {};
  
  // 1. Get learned preferences from current session
  if (sessionId) {
    try {
      const { data: session } = await supabaseClient
        .from('conversation_sessions')
        .select('learned_preferences')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single();
      
      if (session?.learned_preferences) {
        context.learnedPreferences = session.learned_preferences;
        console.log('📚 FAS 5: Loaded learned preferences from session');
      }
    } catch (error) {
      console.error('Error fetching learned preferences:', error);
    }
  }
  
  // 2. Get industry benchmarks from database
  try {
    const { data: benchmarks } = await supabaseClient
      .from('industry_benchmarks')
      .select('*')
      .order('sample_size', { ascending: false });
    
    if (benchmarks && benchmarks.length > 0) {
      context.industryData = benchmarks;
      console.log(`📊 FAS 5: Loaded ${benchmarks.length} industry benchmarks`);
    }
  } catch (error) {
    console.error('Error fetching industry benchmarks:', error);
  }
  
  // 3. Get user quote patterns
  try {
    const { data: patterns } = await supabaseClient
      .from('user_quote_patterns')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (patterns) {
      context.userPatterns = patterns;
      console.log('👤 FAS 5: Loaded user patterns');
    }
  } catch (error) {
    console.error('Error fetching user patterns:', error);
  }
  
  return context;
}

// FAS 5: Enhanced PROACTIVE REALITY CHECK with learning
async function performProactiveRealityCheck(params: {
  projectType: string;
  description: string;
  area?: number;
  conversationHistory?: any[];
  learningContext?: {
    learnedPreferences?: any;
    industryData?: any[];
    userPatterns?: any;
  };
}): Promise<{ 
  shouldProceed: boolean; 
  suggestedMaterialRatio?: number; 
  reasoning: string;
  estimatedMinCost?: number;
  estimatedMaxCost?: number;
  newLearnings?: any;
}> {
  const { projectType, description, area, conversationHistory, learningContext } = params;
  
  // Map project type to benchmark key
  const projectLower = projectType.toLowerCase();
  let benchmarkKey: string | null = null;
  
  if (projectLower.includes('badrum') || projectLower.includes('våtrum')) {
    benchmarkKey = 'badrum_renovering';
  } else if (projectLower.includes('kök')) {
    benchmarkKey = 'kok_renovering';
  } else if (projectLower.includes('altan') || projectLower.includes('däck')) {
    benchmarkKey = 'altan';
  } else if (projectLower.includes('mål') || projectLower.includes('färg')) {
    benchmarkKey = 'malning';
  } else if (projectLower.includes('golv')) {
    benchmarkKey = 'golvlaggning';
  }
  
  // If no area or benchmark, can't validate proactively
  if (!benchmarkKey || !area) {
    return { 
      shouldProceed: true, 
      reasoning: 'Ingen benchmark eller area - kan ej validera proaktivt' 
    };
  }
  
  // FAS 5: Try to get benchmark from database first, fallback to hardcoded
  let benchmark = INDUSTRY_BENCHMARKS[benchmarkKey];
  let usedDatabaseBenchmark = false;
  
  if (learningContext?.industryData) {
    const dbBenchmark = learningContext.industryData.find(
      (b: any) => b.work_category === benchmarkKey && b.metric_type === 'price_per_sqm'
    );
    
    if (dbBenchmark && dbBenchmark.sample_size >= 3) {
      // Use database benchmark if we have at least 3 samples
      benchmark = {
        ...benchmark,
        minPricePerSqm: dbBenchmark.min_value,
        maxPricePerSqm: dbBenchmark.max_value,
        avgTotalPerSqm: dbBenchmark.median_value
      };
      usedDatabaseBenchmark = true;
      console.log(`📊 FAS 5: Using database benchmark for ${benchmarkKey} (${dbBenchmark.sample_size} samples)`);
    }
  }
  
  if (!benchmark) {
    return { 
      shouldProceed: true, 
      reasoning: 'Benchmark saknas för denna projekttyp' 
    };
  }
  
  const estimatedMinCost = area * benchmark.minPricePerSqm;
  const estimatedMaxCost = area * benchmark.maxPricePerSqm;
  
  console.log(`🔍 FAS 3.6 Proaktiv check: ${projectType} ${area} kvm`);
  console.log(`   → Förväntat pris: ${Math.round(estimatedMinCost)}-${Math.round(estimatedMaxCost)} kr (${benchmark.minPricePerSqm}-${benchmark.maxPricePerSqm} kr/kvm)`);
  
  // Extract material level from conversation
  const fullText = conversationHistory 
    ? conversationHistory.map(m => m.content).join(' ').toLowerCase()
    : description.toLowerCase();
  
  const isBudget = /budget|billig|enkel|grundläggande/i.test(fullText);
  const isPremium = /premium|exklusiv|lyx|högkvalitet|kvalitet|dyr|bäst/i.test(fullText);
  
  // FAS 5: Smart material ratio calculation with multiple sources
  let suggestedMaterialRatio = MATERIAL_RATIOS[benchmarkKey] || 0.35;
  let ratioSource = 'hardcoded';
  
  // Priority 1: Learned preferences from this session
  if (learningContext?.learnedPreferences?.preferredMaterialRatio) {
    suggestedMaterialRatio = learningContext.learnedPreferences.preferredMaterialRatio;
    ratioSource = 'session';
    console.log(`💡 FAS 5: Using session material ratio: ${(suggestedMaterialRatio * 100).toFixed(0)}%`);
  }
  // Priority 2: Database industry benchmark
  else if (learningContext?.industryData) {
    const dbMaterialRatio = learningContext.industryData.find(
      (b: any) => b.work_category === benchmarkKey && b.metric_type === 'material_to_work_ratio'
    );
    
    if (dbMaterialRatio && dbMaterialRatio.sample_size >= 3) {
      suggestedMaterialRatio = dbMaterialRatio.median_value;
      ratioSource = 'database';
      console.log(`📊 FAS 5: Using database material ratio: ${(suggestedMaterialRatio * 100).toFixed(0)}% (${dbMaterialRatio.sample_size} samples)`);
    }
  }
  // Priority 3: User patterns (historical)
  else if (learningContext?.userPatterns?.avg_material_to_work_ratio) {
    suggestedMaterialRatio = learningContext.userPatterns.avg_material_to_work_ratio;
    ratioSource = 'user_patterns';
    console.log(`👤 FAS 5: Using user pattern material ratio: ${(suggestedMaterialRatio * 100).toFixed(0)}%`);
  }
  
  // Adjust for quality level
  const originalRatio = suggestedMaterialRatio;
  if (isBudget) {
    suggestedMaterialRatio *= 0.85; // 15% lägre material för budget
  } else if (isPremium) {
    suggestedMaterialRatio *= 1.25; // 25% högre material för premium
  }
  
  const qualityLevel = isBudget ? 'budget' : isPremium ? 'premium' : 'mellan';
  console.log(`   → Final materialratio: ${(suggestedMaterialRatio * 100).toFixed(0)}% (${ratioSource}, ${qualityLevel})`);
  
  // FAS 5: Track new learnings for this session
  const newLearnings = {
    projectType: benchmarkKey,
    qualityPreference: qualityLevel,
    adjustedMaterialRatio: suggestedMaterialRatio,
    estimatedPriceRange: { min: estimatedMinCost, max: estimatedMaxCost },
    usedDatabaseBenchmark
  };
  
  return {
    shouldProceed: true,
    suggestedMaterialRatio,
    reasoning: `${projectType} ${area} kvm bör kosta ${Math.round(estimatedMinCost)}-${Math.round(estimatedMaxCost)} kr (${benchmark.minPricePerSqm}-${benchmark.maxPricePerSqm} kr/kvm) [${ratioSource}]`,
    estimatedMinCost,
    estimatedMaxCost,
    newLearnings
  };
}

// FAS 3 STEG 1: PRE-GENERATION VALIDATION
// Validates BEFORE quote generation to catch issues early
function validateBeforeGeneration(
  measurements: any,
  criticalFactors: string[],
  conversationHistory: any[] | undefined,
  description: string
): { valid: boolean; missingInfo?: string[] } {
  const missingInfo: string[] = [];
  
  // Build full conversation text for analysis
  const fullConversationText = conversationHistory
    ? conversationHistory.map(m => m.content).join(' ').toLowerCase()
    : description.toLowerCase();
  
  // Check 1: Critical measurements present?
  const needsMeasurements = fullConversationText.match(/(renovera|bygga|fälla|måla|lägga)/);
  if (needsMeasurements) {
    if (!measurements.area && !measurements.height && !measurements.quantity) {
      missingInfo.push('Saknar kritiska mått (area, höjd eller antal)');
    }
  }
  
  // Check 2: Are critical factors answered?
  if (criticalFactors.length > 0) {
    const unansweredFactors = criticalFactors.filter(factor => {
      const factorKeywords = factor.toLowerCase().match(/\w+/g) || [];
      return !factorKeywords.some(kw => fullConversationText.includes(kw));
    });
    
    if (unansweredFactors.length > 0 && conversationHistory && conversationHistory.length < 4) {
      // Only flag if conversation is short and factors truly unanswered
      missingInfo.push(`Obesvarade faktorer: ${unansweredFactors.slice(0, 2).join(', ')}`);
    }
  }
  
  // Check 3: Minimum description quality
  if (description.length < 15) {
    missingInfo.push('Beskrivningen är för kort för att generera en tillförlitlig offert');
  }
  
  return {
    valid: missingInfo.length === 0,
    missingInfo: missingInfo.length > 0 ? missingInfo : undefined
  };
}

// FAS 3 STEG 2: POST-GENERATION REALITY CHECK (FAS 3.6: KASTAR ERROR VID FEL)
// Enhanced reality check with detailed warnings - NOW THROWS ERROR ON CRITICAL FAILURES
function performRealityCheck(
  quote: any,
  projectType: string,
  area?: number
): { valid: boolean; reason?: string; warnings?: string[] } {
  const totalValue = quote.summary.totalBeforeVAT;
  const warnings: string[] = [];
  
  // Map project description keywords to benchmark keys
  const projectLower = projectType.toLowerCase();
  let benchmarkKey: string | null = null;
  
  if (projectLower.includes('badrum') || projectLower.includes('våtrum')) {
    benchmarkKey = 'badrum_renovering';
  } else if (projectLower.includes('kök')) {
    benchmarkKey = 'kok_renovering';
  } else if (projectLower.includes('altan') || projectLower.includes('däck')) {
    benchmarkKey = 'altan';
  } else if (projectLower.includes('mål') || projectLower.includes('färg')) {
    benchmarkKey = 'malning';
  } else if (projectLower.includes('golv')) {
    benchmarkKey = 'golvlaggning';
  }
  
  if (!benchmarkKey || !area) {
    return { valid: true, warnings }; // Can't validate without benchmark or area
  }
  
  const benchmark = INDUSTRY_BENCHMARKS[benchmarkKey];
  const pricePerSqm = totalValue / area;
  
  // FIX 3: Kolla om kunden står för dyra material (kakel, klinker, köksskåp, etc)
  const customerProvidesExpensiveMaterials = 
    /kund.*står.*för.*(material|kakel|klinker|köksskåp|vitvaror|bänkskiv)/i.test(projectType);
  
  let adjustedMinPrice = benchmark.minPricePerSqm;
  let adjustedMaxPrice = benchmark.maxPricePerSqm;
  
  if (customerProvidesExpensiveMaterials) {
    // Justera benchmark nedåt med 40-60% för saknade material (material utgör ~50-70% av kostnad)
    adjustedMinPrice = benchmark.minPricePerSqm * 0.4;  
    adjustedMaxPrice = benchmark.maxPricePerSqm * 0.6;
    console.log(`📦 Customer provides materials - adjusted price range: ${Math.round(adjustedMinPrice)}-${Math.round(adjustedMaxPrice)} kr/m² (original: ${benchmark.minPricePerSqm}-${benchmark.maxPricePerSqm} kr/m²)`);
  }
  
  // FAS 3.6: Critical errors now THROW instead of just warning
  if (pricePerSqm < adjustedMinPrice * 0.7) {  // 30% tolerans
    const errorMsg = customerProvidesExpensiveMaterials
      ? `Priset ${Math.round(pricePerSqm)} kr/m² är orealistiskt lågt även när kunden står för material. Förväntat: ${Math.round(adjustedMinPrice)}-${Math.round(adjustedMaxPrice)} kr/m². Kontrollera arbetstid.`
      : `Priset ${Math.round(pricePerSqm)} kr/m² är orealistiskt lågt för ${projectType}. Branschnorm: ${benchmark.minPricePerSqm}-${benchmark.maxPricePerSqm} kr/m². Kontrollera material och arbetstid.`;
    console.error(`❌ Reality check failed: ${errorMsg}`);
    throw new Error(`VALIDATION_FAILED: ${errorMsg}`);
  }
  
  if (pricePerSqm > adjustedMaxPrice * 1.5) {
    const errorMsg = `Priset ${Math.round(pricePerSqm)} kr/m² är orealistiskt högt för ${projectType}. Branschnorm: ${Math.round(adjustedMinPrice)}-${Math.round(adjustedMaxPrice)} kr/m². Kontrollera om något dubbelräknats.`;
    console.error(`❌ Reality check failed: ${errorMsg}`);
    throw new Error(`VALIDATION_FAILED: ${errorMsg}`);
  }
  
  // Soft warnings (quote is valid but may need attention)
  if (pricePerSqm < benchmark.minPricePerSqm * 1.2) {
    warnings.push(`⚠️ Priset ligger i underkant (${Math.round(pricePerSqm)} kr/m²). Branschsnitt: ${benchmark.avgTotalPerSqm} kr/m²`);
  }
  
  if (pricePerSqm > benchmark.maxPricePerSqm) {
    warnings.push(`⚠️ Priset ligger över branschstandard (${Math.round(pricePerSqm)} kr/m² vs ${benchmark.maxPricePerSqm} kr/m²). Detta kan vara motiverat beroende på projektet.`);
  }
  
  // Check material/work ratio
  const materialRatio = quote.summary.materialCost / quote.summary.workCost;
  if (materialRatio < 0.3 && benchmarkKey.includes('renovering')) {
    warnings.push('⚠️ Material/arbete-ratio är låg. Kontrollera att alla materialkostnader är med.');
  }
  
  if (materialRatio > 2) {
    warnings.push('⚠️ Material/arbete-ratio är hög. Kontrollera att arbetskostnaden är korrekt.');
  }
  
  return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
}

// Validation function to ensure AI output matches base totals
function validateQuoteOutput(quote: any, baseTotals: any, hourlyRatesByType?: { [workType: string]: number } | null, detailLevel?: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // 1. Validate work hours by type
  const workHoursByType = new Map<string, number>();
  quote.workItems.forEach((item: any) => {
    const type = item.name.split(' - ')[0]; // "Snickare - Rivning" → "Snickare"
    workHoursByType.set(type, (workHoursByType.get(type) || 0) + item.hours);
  });
  
  Object.entries(baseTotals.workHours).forEach(([type, hours]) => {
    const actualHours = workHoursByType.get(type) || 0;
    const tolerance = 0.5;
    if (Math.abs(actualHours - (hours as number)) > tolerance) {
      errors.push(`${type}: Förväntade ${hours}h men fick ${actualHours}h`);
    }
  });
  
  // 2. Validate material cost
  const totalMaterialCost = quote.materials.reduce((sum: number, m: any) => sum + m.subtotal, 0);
  const expectedMaterialCost = baseTotals.materialCost + baseTotals.equipmentCost;
  const costTolerance = 100;
  if (Math.abs(totalMaterialCost - expectedMaterialCost) > costTolerance) {
    errors.push(`Material: Förväntade ${expectedMaterialCost} kr men fick ${totalMaterialCost} kr`);
  }
  
  // 2b. Validate that NO materials have pricePerUnit = 0
  const materialsWithZeroPrice = quote.materials.filter((m: any) => m.pricePerUnit === 0 || m.subtotal === 0);
  if (materialsWithZeroPrice.length > 0) {
    errors.push(`Material med pris 0 kr: ${materialsWithZeroPrice.map((m: any) => m.name).join(', ')} - ALLA material MÅSTE ha realistiska priser!`);
  }
  
  // 3. Validate summary calculations
  const actualWorkCost = quote.workItems.reduce((sum: number, w: any) => sum + w.subtotal, 0);
  if (Math.abs(quote.summary.workCost - actualWorkCost) > 1) {
    errors.push('summary.workCost matchar inte summan av workItems');
  }
  
  if (Math.abs(quote.summary.materialCost - totalMaterialCost) > 1) {
    errors.push('summary.materialCost matchar inte summan av materials');
  }
  
  // 4. Validate hourly rates match user's custom rates
  if (hourlyRatesByType && Object.keys(hourlyRatesByType).length > 0) {
    quote.workItems.forEach((item: any) => {
      const workTypeName = item.name.split(' - ')[0]; // "Snickare - Rivning" → "Snickare"
      const expectedRate = hourlyRatesByType[workTypeName];
      
      if (expectedRate) {
        const tolerance = 1; // Allow 1 kr difference
        if (Math.abs(item.hourlyRate - expectedRate) > tolerance) {
          errors.push(`${workTypeName}: Förväntade timpris ${expectedRate} kr/h men fick ${item.hourlyRate} kr/h`);
        }
      }
    });
  }
  
  // 5. Validate detail level requirements
  if (detailLevel) {
    const workItemCount = quote.workItems.length;
    const materialCount = quote.materials.length;
    const notesLength = quote.notes?.length || 0;
    
    switch (detailLevel) {
      case 'quick':
        if (workItemCount < 2 || workItemCount > 3) {
          errors.push(`Quick: Ska ha 2-3 arbetsposter, har ${workItemCount}`);
        }
        if (materialCount < 3 || materialCount > 5) {
          errors.push(`Quick: Ska ha 3-5 materialposter, har ${materialCount}`);
        }
        if (notesLength > 100) {
          errors.push(`Quick: Notes ska vara max 100 tecken, är ${notesLength}`);
        }
        break;
        
      case 'standard':
        if (workItemCount < 4 || workItemCount > 6) {
          errors.push(`Standard: Ska ha 4-6 arbetsposter, har ${workItemCount}`);
        }
        if (materialCount < 5 || materialCount > 10) {
          errors.push(`Standard: Ska ha 5-10 materialposter, har ${materialCount}`);
        }
        if (notesLength < 200 || notesLength > 300) {
          errors.push(`Standard: Notes ska vara 200-300 tecken, är ${notesLength}`);
        }
        break;
        
      case 'detailed':
        if (workItemCount < 6 || workItemCount > 10) {
          errors.push(`Detailed: Ska ha 6-10 arbetsposter, har ${workItemCount}`);
        }
        if (materialCount < 10 || materialCount > 15) {
          errors.push(`Detailed: Ska ha 10-15 materialposter, har ${materialCount}`);
        }
        if (notesLength < 500 || notesLength > 800) {
          errors.push(`Detailed: Notes ska vara 500-800 tecken, är ${notesLength}`);
        }
        if (!quote.notes?.includes('Fas ')) {
          errors.push('Detailed: Notes ska innehålla fasindelning (Fas 1, Fas 2...)');
        }
        break;
        
      case 'construction':
        if (workItemCount < 10 || workItemCount > 15) {
          errors.push(`Construction: Ska ha 10-15 arbetsposter, har ${workItemCount}`);
        }
        if (materialCount < 15 || materialCount > 25) {
          errors.push(`Construction: Ska ha 15-25 materialposter, har ${materialCount}`);
        }
        if (notesLength < 1200 || notesLength > 2000) {
          errors.push(`Construction: Notes ska vara 1200-2000 tecken, är ${notesLength}`);
        }
        const requiredTerms = ['projektledning', 'tidsplan', 'garanti', 'besiktning'];
        const missingTerms = requiredTerms.filter(term => 
          !quote.notes?.toLowerCase().includes(term)
        );
        if (missingTerms.length > 0) {
          errors.push(`Construction: Notes saknar: ${missingTerms.join(', ')}`);
        }
        break;
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// Auto-correct function to force mathematical consistency
function autoCorrectQuote(quote: any, baseTotals: any): any {
  const correctedQuote = JSON.parse(JSON.stringify(quote)); // Deep clone
  
  // Force correct work hours distribution
  Object.entries(baseTotals.workHours).forEach(([type, expectedHours]) => {
    const typeItems = correctedQuote.workItems.filter((item: any) => 
      item.name.startsWith(type + ' -') || item.name === type
    );
    
    if (typeItems.length > 0) {
      const totalActualHours = typeItems.reduce((sum: number, item: any) => sum + item.hours, 0);
      const ratio = (expectedHours as number) / totalActualHours;
      
      typeItems.forEach((item: any) => {
        item.hours = Math.round(item.hours * ratio * 10) / 10;
        item.subtotal = item.hours * item.hourlyRate;
      });
    }
  });
  
  // Force correct material cost
  const expectedMaterialCost = baseTotals.materialCost + baseTotals.equipmentCost;
  const actualMaterialCost = correctedQuote.materials.reduce((sum: number, m: any) => sum + m.subtotal, 0);
  
  if (actualMaterialCost > 0) {
    const materialRatio = expectedMaterialCost / actualMaterialCost;
    correctedQuote.materials.forEach((item: any) => {
      item.subtotal = Math.round(item.subtotal * materialRatio);
      item.pricePerUnit = Math.round(item.subtotal / item.quantity);
    });
  }
  
  // Recalculate summary
  correctedQuote.summary.workCost = correctedQuote.workItems.reduce((sum: number, w: any) => sum + w.subtotal, 0);
  correctedQuote.summary.materialCost = correctedQuote.materials.reduce((sum: number, m: any) => sum + m.subtotal, 0);
  correctedQuote.summary.totalBeforeVAT = correctedQuote.summary.workCost + correctedQuote.summary.materialCost;
  correctedQuote.summary.vat = Math.round(correctedQuote.summary.totalBeforeVAT * 0.25);
  correctedQuote.summary.totalWithVAT = correctedQuote.summary.totalBeforeVAT + correctedQuote.summary.vat;
  
  return correctedQuote;
}

// Helper function to build intelligent conversation summary
function buildConversationSummary(history: any[], fallbackDescription?: string): string {
  if (!history || history.length === 0) {
    return fallbackDescription || '';
  }
  
  const userMessages = history
    .filter(m => m.role === 'user')
    .map(m => m.content);
  
  if (userMessages.length === 0) {
    return fallbackDescription || '';
  }
  
  if (userMessages.length === 1) {
    return userMessages[0];
  }
  
  // Första meddelandet = huvudförfrågan
  const mainRequest = userMessages[0];
  
  // Övriga = förtydliganden
  const clarifications = userMessages.slice(1)
    .filter(c => c.length > 5)
    .join('. ');
  
  return clarifications 
    ? `${mainRequest}. ${clarifications}`
    : mainRequest;
}

// Normalization helper for text comparison with synonym mapping
function normalizeText(text: string): string {
  // Synonym mapping for common Swedish construction terms
  const synonyms: Record<string, string> = {
    'fällning': 'falla',
    'fälla': 'falla',
    'såga': 'falla',
    'ta ner': 'falla',
    'kakel': 'plattor',
    'klinker': 'plattor',
    'flisa': 'plattor',
    'rivning': 'riva',
    'demontera': 'riva',
    'plocka ner': 'riva',
    'målning': 'mala',
    'spackling': 'mala',
    'tapetsering': 'mala',
    'stubbe': 'stubb',
    'rot': 'stubb',
    'stam': 'stubb'
  };
  
  let normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  
  // Replace synonyms
  for (const [key, value] of Object.entries(synonyms)) {
    const keyNorm = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    normalized = normalized.replace(new RegExp(keyNorm, 'gi'), value);
  }
  
  // Handle compound words (split hyphenated)
  normalized = normalized.replace(/-/g, ' ');
  
  return normalized;
}

// Domain-specific critical factors per work type  
function getDomainKnowledge(description: string): {
  projectType?: string;
  criticalFactors: string[];
  advice?: string;
  workType: string;
} {
  const descNorm = normalizeText(description);
  
  const domainMap: Record<string, { keywords: string[]; factors: string[]; projectType?: string }> = {
    'trädfällning': {
      keywords: ['falla', 'trad', 'ek', 'tall', 'gran', 'bjork', 'arborist'],
      projectType: 'tradfallning',
      factors: [
        '🌳 Trädhöjd påverkar tid och utrustning kraftigt (10m = 2h, 20m = 4-5h)',
        '📏 Diameter avgör svårighetsgrad (>60cm = professionell utrustning)',
        '🏠 Närhet till byggnader/ledningar = +50-100% kostnad pga precision',
        '🪵 Stubbfräsning är separat post (ca 2000-4000 kr beroende på storlek)',
        '🚚 Bortforsling av virke/grenar kan kosta 3000-8000 kr beroende på volym'
      ]
    },
    'badrumsrenovering': {
      keywords: ['badrum', 'wc', 'dusch', 'kakel', 'plattor', 'handfat', 'toalett'],
      projectType: 'badrum_renovering',
      factors: [
        '🚿 Rivning av gammalt material: 3-6 timmar beroende på storlek',
        '💧 VVS-arbete är kritiskt och tidskrävande (1-2 dagar för komplett byte)',
        '🔌 El-arbete för uttag och belysning (0.5-1 dag)',
        '🧱 Plattläggning: Räkna 15-25 timmar för 5 kvm badrum',
        '🎨 Material varierar enormt: Budget 500-2000 kr/kvm för plattor'
      ]
    },
    'målning': {
      keywords: ['mala', 'spackel', 'tapetsera', 'farg'],
      projectType: 'malning',
      factors: [
        '🎨 Area och takhöjd är kritiska faktorer',
        '🧰 Förberedelse (spackling, slipning) = 40% av tiden',
        '🖌️ Antal strykningar påverkar tid: 2 strykningar standard',
        '🪜 Takhöjd >3m kräver ställning = +30% tid',
        '🏠 Fönster/dörrar/lister ökar komplexitet betydligt'
      ]
    },
    'städning': {
      keywords: ['stada', 'stad', 'torka', 'dammsuga', 'fonsterputs'],
      factors: [
        '🏠 Kvm är primär kostnadsfaktor',
        '🧹 Typ av städning: Storstädning vs underhåll (2-3x skillnad)',
        '🪟 Fönsterputs räknas separat (150-300 kr per fönster)',
        '⏰ Frekvens påverkar pris: Engångsjobb dyrare än återkommande',
        '🧴 Material ingår oftast, men specialrengöring tillkommer'
      ]
    }
  };
  
  // Detect work type
  for (const [workType, config] of Object.entries(domainMap)) {
    if (config.keywords.some(kw => descNorm.includes(kw))) {
      return { workType, criticalFactors: config.factors };
    }
  }
  
  return { workType: 'general', criticalFactors: [] };
}

// Extract measurements with structured data
async function extractMeasurements(
  description: string,
  apiKey: string
): Promise<{
  quantity?: number;
  height?: string;
  diameter?: string;
  area?: string;
  appliesTo?: string;
  ambiguous: boolean;
  clarificationNeeded?: string;
}> {
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: `Extrahera mått och kvantiteter från denna beskrivning: "${description}"

VIKTIGT REGLER:
1. Sätter ENDAST ambiguous=true om mått verkligen saknas eller är otydliga
2. Om tydliga mått finns → ambiguous=false
3. Om flera objekt nämns med samma mått, anta att det gäller för alla

FÖR TRÄD/TRÄDFÄLLNING:
- Om höjd finns men ej diameter → fråga: "Vilken diameter/tjocklek har stammen vid brösthöjd?"
- Om diameter finns men ej höjd → fråga: "Hur höga är träden?"
- Om varken höjd eller diameter finns → fråga: "Vilken höjd och diameter har träden?"

EXEMPEL PÅ TYDLIGA MÅTT (ambiguous=false):
✅ "renovera badrum 8 kvm" → { area: "8 kvm", ambiguous: false }
✅ "två ekar 15 meter höga, 50cm diameter" → { quantity: 2, height: "15 meter", diameter: "50cm", ambiguous: false }
✅ "fälla tre träd, 12m, 15m och 8m höga" → { quantity: 3, height: "12m, 15m, 8m", ambiguous: false }
✅ "installera nytt kök 12 kvm" → { area: "12 kvm", ambiguous: false }

EXEMPEL PÅ TVETYDIGA MÅTT (ambiguous=true):
❌ "renovera badrum" (ingen yta angiven)
❌ "måla vardagsrum" (ingen yta angiven)
❌ "fälla träd" (ingen höjd eller antal angivet)`
        }],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_measurements',
            description: 'Extrahera kvantitet och mått från beskrivning',
            parameters: {
              type: 'object',
              properties: {
                quantity: { 
                  type: 'number', 
                  description: 'Antal objekt (träd, rum, etc)' 
                },
                height: { 
                  type: 'string', 
                  description: 'Höjd med enhet, t.ex. "15 meter". Om flera olika höjder, lista dem.' 
                },
                diameter: { 
                  type: 'string', 
                  description: 'Diameter/bredd med enhet, t.ex. "5 meter"' 
                },
                area: { 
                  type: 'string', 
                  description: 'Area med enhet, t.ex. "25 kvm"' 
                },
                appliesTo: {
                  type: 'string',
                  enum: ['all', 'individual'],
                  description: 'Om samma mått gäller alla objekt (all) eller individuellt (individual)'
                },
                ambiguous: {
                  type: 'boolean',
                  description: 'true om mått kan tolkas på flera sätt eller är otydliga'
                },
                clarificationNeeded: {
                  type: 'string',
                  description: 'Fråga för att klargöra tvetydighet om ambiguous=true'
                }
              },
              required: ['ambiguous']
            }
          }
        }],
        tool_choice: { 
          type: 'function', 
          function: { name: 'extract_measurements' } 
        }
      })
    });

    if (!response.ok) {
      console.warn('Measurement extraction failed, continuing without structured data');
      return { ambiguous: false };
    }

    const data = await response.json();
    const toolCall = data.choices[0].message.tool_calls?.[0];
    
    if (toolCall) {
      const parsed = JSON.parse(toolCall.function.arguments);
      
      // REGEX FALLBACK: Om AI säger "ambiguous" men vi hittar tydliga mått i texten
      if (parsed.ambiguous) {
        const regexFindings: any = {};
        
        // Extrahera antal (ord eller siffror) - utökad lista
        const quantityMatch = description.match(/\b(två|tre|fyra|fem|sex|sju|åtta|nio|tio|elva|tolv|\d+)\s+(tr[aä]d|ek(ar)?|rum|badrum(men)?|k[oö]k|f[öo]nster|d[öo]rr(ar)?|v[aä]gg(ar)?|tak|radiator(er)?|uttag|sk[aå]p|plattor|lister|stolpar)/i);
        if (quantityMatch) {
          const quantityWord = quantityMatch[1].toLowerCase();
          const quantityMap: Record<string, number> = { 
            'två': 2, 'tre': 3, 'fyra': 4, 'fem': 5, 'sex': 6, 
            'sju': 7, 'åtta': 8, 'nio': 9, 'tio': 10, 'elva': 11, 'tolv': 12
          };
          regexFindings.quantity = quantityMap[quantityWord] || parseInt(quantityWord);
        }
        
        // Extrahera area med sifferord-stöd (t.ex. "åtta kvm")
        const wordToNumber: Record<string, number> = {
          'en': 1, 'ett': 1, 'två': 2, 'tre': 3, 'fyra': 4, 'fem': 5,
          'sex': 6, 'sju': 7, 'åtta': 8, 'nio': 9, 'tio': 10,
          'elva': 11, 'tolv': 12, 'femton': 15, 'tjugo': 20
        };
        
        // Försök digit-baserad area först
        let areaMatch = description.match(/(\d+(?:[.,]\d+)?)\s*(kvm|kvadratmeter|m²|m2)/i);
        if (areaMatch) {
          regexFindings.area = `${areaMatch[1]} ${areaMatch[2]}`;
        } else {
          // Försök sifferord-baserad area
          const wordAreaMatch = description.match(/\b(en|ett|två|tre|fyra|fem|sex|sju|åtta|nio|tio|elva|tolv|femton|tjugo)\s*(kvm|kvadrat|m²|m2)\b/i);
          if (wordAreaMatch) {
            const num = wordToNumber[wordAreaMatch[1].toLowerCase()];
            if (num) {
              regexFindings.area = `${num} kvm`;
            }
          }
        }
        
        // Extrahera höjd (meter, m)
        const heightMatch = description.match(/(\d+(?:[.,]\d+)?)\s*(meter|m)\s+(hög|höga|höjd)?/i);
        if (heightMatch) {
          regexFindings.height = `${heightMatch[1]} ${heightMatch[2]}`;
        }
        
        // Extrahera diameter
        const diameterMatch = description.match(/(\d+(?:[.,]\d+)?)\s*(meter|m|cm)\s+(diameter|bred)/i);
        if (diameterMatch) {
          regexFindings.diameter = `${diameterMatch[1]} ${diameterMatch[2]}`;
        }
        
        // Om regex hittade något som AI missade
        const foundAnyMeasurement = Object.keys(regexFindings).length > 0;
        
        // Kolla om beskrivningen innehåller action-verb (indikerar konkret arbete)
        const hasActionVerb = /\b(renovera|installera|fälla|måla|byta|reparera|städa|bygga|lägga)\b/i.test(description);
        
        if (foundAnyMeasurement && hasActionVerb) {
          console.log('🔧 Regex fallback override: Found measurements AI missed', regexFindings);
          parsed.ambiguous = false;
          // Merge regex findings into parsed (om AI inte redan har dem)
          if (!parsed.quantity && regexFindings.quantity) parsed.quantity = regexFindings.quantity;
          if (!parsed.area && regexFindings.area) parsed.area = regexFindings.area;
          if (!parsed.height && regexFindings.height) parsed.height = regexFindings.height;
          if (!parsed.diameter && regexFindings.diameter) parsed.diameter = regexFindings.diameter;
          if (!parsed.appliesTo && regexFindings.quantity) parsed.appliesTo = 'all';
          delete parsed.clarificationNeeded; // Ta bort onödig fråga
        }
      }
      
      // INTELLIGENT FALLBACK: Om träd har höjd men saknar diameter
      if (parsed.height && !parsed.diameter && /träd|gran|tall|ek|björk|lönn|ask|alm|arborist|fäll/i.test(description)) {
        const estimatedDiameter = estimateDiameterFromHeight(parsed.height);
        if (estimatedDiameter) {
          console.log(`🌲 Auto-estimating diameter from height ${parsed.height}: ${estimatedDiameter}`);
          parsed.diameter = estimatedDiameter;
          parsed.ambiguous = false; // Vi har nu tillräcklig info
          delete parsed.clarificationNeeded; // Ta bort frågan
          
          // Markera att detta är en uppskattning (hanteras i huvudfunktionen)
          (parsed as any).diameterEstimated = true;
        }
      }
      
      console.log('📏 Extracted measurements:', parsed);
      return parsed;
    }
    
    return { ambiguous: false };
  } catch (error) {
    console.warn('Measurement extraction error:', error);
    return { ambiguous: false };
  }
}

// Intelligent fallback för träddiameter baserat på höjd
function estimateDiameterFromHeight(heightStr: string): string | null {
  const heightMatch = heightStr.match(/(\d+(?:[.,]\d+)?)/);
  if (!heightMatch) return null;
  
  const heightMeters = parseFloat(heightMatch[1].replace(',', '.'));
  
  // Tumregel för nordiska barrträd (gran, tall):
  // - 10m träd ≈ 30cm diameter
  // - 15m träd ≈ 40-50cm diameter
  // - 20m träd ≈ 50-70cm diameter
  // - 25m+ träd ≈ 70-100cm diameter
  
  let estimatedDiameter: number;
  
  if (heightMeters < 12) {
    estimatedDiameter = 30; // Mindre träd
  } else if (heightMeters < 18) {
    estimatedDiameter = 45; // Medelstora träd
  } else if (heightMeters < 25) {
    estimatedDiameter = 60; // Stora träd
  } else {
    estimatedDiameter = 80; // Mycket stora träd
  }
  
  return `${estimatedDiameter}cm`;
}

// FAS 17: Simplified handleConversation - drastiskt förenklad
async function handleConversation(
  description: string,
  conversationHistory: any[] | undefined,
  apiKey: string
): Promise<{ action: 'ask' | 'generate'; questions?: string[]; reasoning?: string }> {
  
  // Bygg full kontext
  const fullDescription = conversationHistory && conversationHistory.length > 0
    ? buildConversationSummary(conversationHistory, description)
    : description;
  
  // Kolla om användaren redan gett grundläggande info
  const hasBasicInfo = fullDescription.length > 30 || 
    /\d+\s*(kvm|m2|meter|cm|st|stycken)/i.test(fullDescription);
  
  if (hasBasicInfo) {
    console.log('✅ Basic info present → generate');
    return {
      action: 'generate',
      reasoning: 'Användaren har angett tillräcklig grundinformation'
    };
  }
  
  // Endast om EXTREMT lite info → fråga
  console.log('⚠️ Very little info → asking for more');
  return {
    action: 'ask',
    questions: ['Kan du beskriva projektet mer detaljerat? (storlek, material, särskilda önskemål)'],
    reasoning: 'För lite information för att börja kalkylera'
  };
}

// Context Reconciliation: Infer yes/no answers from Swedish phrases
// FAS 17: Old functions removed (reconcileMissingCriticalWithLatestAnswers, performPreflightCheck, generateFollowUpQuestions)



async function calculateBaseTotals(
  description: string,
  apiKey: string,
  hourlyRates: any[] | null,
  equipmentRates: any[] | null,
  suggestedMaterialRatio?: number // FAS 3.6: Optional override från proaktiv check
): Promise<{
  workHours: any;
  materialCost: number;
  equipmentCost: number;
  hourlyRatesByType: { [workType: string]: number };
  diameterEstimated?: string; // För trädfällning med uppskattat diameter
}> {
  
  // Extract structured measurements for better calculation accuracy
  console.log('📊 Calculating base totals with description:', description);
  const measurements = await extractMeasurements(description, apiKey);
  console.log('📐 Structured measurements for calculation:', {
    quantity: measurements.quantity || 'not specified',
    height: measurements.height || 'not specified',
    diameter: measurements.diameter || 'not specified',
    area: measurements.area || 'not specified',
    appliesTo: measurements.appliesTo || 'not specified'
  });
  const ratesContext = hourlyRates && hourlyRates.length > 0
    ? `Timpriserna är: ${hourlyRates.map(r => `${r.work_type}: ${r.rate} kr/h`).join(', ')}`
    : 'Standardpris: 650 kr/h';

  const equipmentContext = equipmentRates && equipmentRates.length > 0
    ? `\n\nTillgänglig utrustning: ${equipmentRates.map(e => `${e.name} (${e.price_per_day || e.price_per_hour} kr/${e.price_per_day ? 'dag' : 'tim'})`).join(', ')}`
    : '';

  const equipmentKnowledge = `

BRANSCH-STANDARD VERKTYG/MASKINER (lägg alltid till dessa om relevant):

Arborist/Trädfällning:
- Motorsåg: 200-300 kr/tim (ägd) eller 800-1200 kr/dag (hyrd)
- Flishugg: 1500-2500 kr/dag (hyrd)
- Säkerhetsutrustning: 500 kr (engångskostnad)

Grävarbete/Markarbete:
- Minigrävare (1-3 ton): 800-1200 kr/dag
- Grävmaskin (5+ ton): 1500-2500 kr/dag

Kakel/Plattsättning:
- Kakelskärare: 150 kr/dag (hyrd)
- Blandare/mixxer: 100 kr/dag (hyrd)

Målning/Fasadarbete:
- Ställning: 200-400 kr/dag per sektion
- Sprututrustning: 300-500 kr/dag (hyrd)

Om användaren INTE har lagt in dessa verktyg i sina inställningar,
lägg ändå till dem i equipmentCost med branschstandardpriser.
`;

  // FAS 7: Calculate industry-specific material ratio
  const workTypesInDescription = description.toLowerCase();
  let materialRatio = MATERIAL_RATIOS['Hantverkare']; // Default
  
  for (const [workType, ratio] of Object.entries(MATERIAL_RATIOS)) {
    if (workTypesInDescription.includes(workType.toLowerCase())) {
      materialRatio = ratio;
      console.log(`📊 Using material ratio ${ratio} for work type: ${workType}`);
      break;
    }
  }

  const materialPriceKnowledge = `

**═══════════════════════════════════════════════════════════════**
**KRITISKT - MATERIAL MÅSTE ALLTID HA REALISTISKA PRISER!**
**═══════════════════════════════════════════════════════════════**

**VIKTIGA REGLER:**
1. materialCost FÅR ALDRIG vara 0 för renoveringsprojekt!
2. Använd chain-of-thought: "Vad behövs? → Räkna ut kvantitet → Uppskattar pris per enhet → Summera"
3. Branschspecifikt materialförhållande: ${(materialRatio * 100).toFixed(0)}% av arbetskostnaden
4. Om du är osäker, använd materialförhållandet som estimat

**CHAIN-OF-THOUGHT EXEMPEL:**
Projekt: "Renovera badrum 5 kvm, mellan-nivå"
→ Tänk: "Vad behöver ett badrum?"
→ Kakel på väggar: 5 kvm vägg × 375 kr/kvm = 1875 kr
→ Klinker på golv: 5 kvm golv × 425 kr/kvm = 2125 kr
→ VVS: rör + kopplingar + kranar = 6000 kr
→ El: kablar + dosor = 3000 kr
→ Tätskikt: 1500 kr
→ Golvvärme: 4250 kr
→ Fästmassor och fog: 1500 kr
→ TOTAL: 20 250 kr ✅

Projekt: "Bygga altandäck 25 kvm, budget"
→ Tänk: "Vad behövs för ett däck?"
→ Virke konstruktion: 25 kvm × 300 kr/kvm = 7500 kr
→ Däckbräder: 25 kvm × 200 kr/kvm = 5000 kr
→ Räcke: 15 löpmeter × 650 kr/m = 9750 kr
→ Trappa: 4000 kr
→ Skruv och beslag: 2500 kr
→ TOTAL: 28 750 kr ✅

**DETALJERADE PRISGUIDER PER PROJEKTTYP:**

BADRUMSRENOVERING (per kvm):
═══════════════════════════════════════════════════════════════
Budget-nivå (ex: 5 kvm):
• Kakel vägg: 150-250 kr/kvm → 5 kvm = 1000 kr
• Klinker golv: 200-300 kr/kvm → 5 kvm = 1250 kr
• Tätskikt: 800-1200 kr totalt
• VVS-material (rör, kopplingar): 3000-5000 kr
• El-material (kablar, dosor): 1500-2500 kr
• Golvvärmesystem: 2000-3500 kr
• Fästmassor och fog: 800-1200 kr
→ TOTAL: 10 000-15 000 kr

Mellan-nivå (ex: 5 kvm):
• Kakel vägg: 300-450 kr/kvm → 5 kvm = 1875 kr
• Klinker golv: 350-500 kr/kvm → 5 kvm = 2125 kr
• Tätskikt: 1200-1800 kr totalt
• VVS-material: 5000-7000 kr
• El-material: 2500-3500 kr
• Golvvärmesystem: 3500-5000 kr
• Fästmassor och fog: 1200-1800 kr
→ TOTAL: 18 000-25 000 kr

Premium (ex: 5 kvm):
• Kakel vägg: 500-800 kr/kvm → 5 kvm = 3250 kr
• Klinker golv: 600-900 kr/kvm → 5 kvm = 3750 kr
• Tätskikt: 1800-2500 kr totalt
• VVS-material premium: 7000-10000 kr
• El-material premium: 3500-5000 kr
• Golvvärmesystem premium: 5000-7000 kr
• Fästmassor och fog premium: 1800-2500 kr
→ TOTAL: 28 000-38 000 kr

ALTANBYGGE (per kvm):
═══════════════════════════════════════════════════════════════
Budget tryckimpregnerat (ex: 25 kvm):
• Virke konstruktion (reglar, bärbalkar): 250-350 kr/kvm → 25 kvm = 7500 kr
• Altangolv (däckbräder): 150-250 kr/kvm → 25 kvm = 5000 kr
• Räcke (stolpar, spjälor): 500-800 kr/löpmeter → 15m = 10500 kr
• Trappa: 3000-5000 kr
• Fästmaterial (skruv, beslag): 2000-3000 kr
→ TOTAL: 28 000-36 000 kr

Mellan-nivå (ex: 25 kvm):
• Virke konstruktion: 350-450 kr/kvm → 25 kvm = 10000 kr
• Altangolv premium: 250-350 kr/kvm → 25 kvm = 7500 kr
• Räcke premium: 800-1200 kr/löpmeter → 15m = 15000 kr
• Trappa: 5000-7000 kr
• Fästmaterial: 3000-4000 kr
→ TOTAL: 40 500-53 500 kr

MÅLNING (rum):
═══════════════════════════════════════════════════════════════
Budget färg (ex: 120 kvm yta):
• Vägfärg: 80-120 kr/liter → 30 liter = 3000 kr
• Spackel: 500-800 kr
• Grundfärg: 1000-1500 kr
• Målartejp, presenning: 500-800 kr
→ TOTAL: 5 000-6 500 kr

Mellan-nivå (ex: 120 kvm yta):
• Vägfärg premium: 150-200 kr/liter → 30 liter = 5250 kr
• Spackel premium: 800-1200 kr
• Grundfärg: 1500-2000 kr
• Målartillbehör: 800-1200 kr
→ TOTAL: 8 500-10 500 kr

GOLVLÄGGNING:
═══════════════════════════════════════════════════════════════
Laminat budget (ex: 40 kvm):
• Laminatgolv: 150-250 kr/kvm → 40 kvm = 8000 kr
• Underlag: 50-80 kr/kvm → 40 kvm = 2600 kr
• Sockel: 30-50 kr/löpmeter → 30m = 1200 kr
→ TOTAL: 11 800 kr

Trägolv mellan (ex: 40 kvm):
• Trägolv: 400-600 kr/kvm → 40 kvm = 20000 kr
• Underlag: 80-120 kr/kvm → 40 kvm = 4000 kr
• Sockel: 60-80 kr/löpmeter → 30m = 2100 kr
→ TOTAL: 26 100 kr

**FALLBACK-REGEL:**
Om du inte hittar exakt projekttyp i guiderna ovan:
→ Använd denna formel: materialCost = arbetskostnad × 0.35 (35%)
→ Förklaring: Material är typiskt 30-40% av arbetskostnaden i de flesta renoveringsprojekt
`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: `Du beräknar ENDAST total arbetstid och materialkostnad för projekt. 

${equipmentKnowledge}

${materialPriceKnowledge}

VIKTIGT: Identifiera vilka FAKTISKA arbetstyper som krävs för detta uppdrag.

Exempel:
- Städning → "Städare"
- Fönsterputsning → "Fönsterputsare"
- Trädfällning → "Arborist" eller "Trädvård"
- Badrumsrenovering → "Snickare", "VVS", "Elektriker", "Plattsättare"
- Målning → "Målare"
- Gräsklippning → "Trädgårdsskötare"
- Altanbygge → "Snickare"

${ratesContext}${equipmentContext}

Returnera ENDAST JSON i detta format:
{
  "workHours": { "Städare": 8, "Fönsterputsare": 2 },
  "materialCost": 5000,
  "equipmentCost": 0
}

**═══════════════════════════════════════════════════════════════**
**KRITISKA REGLER - FÖLJ DESSA EXAKT:**
**═══════════════════════════════════════════════════════════════**

1. **workHours:** Total arbetstid per FAKTISK arbetstyp som projektet kräver (svenska yrkestitlar)

2. **materialCost:** MÅSTE VARA REALISTISKT! FÅR ALDRIG vara 0 för renovering/byggprojekt!
   → Använd chain-of-thought (se exempel ovan)
   → Om osäker: materialCost = arbetskostnad × 0.35

3. **equipmentCost:** Kostnad för maskiner/utrustning (0 om inget behövs)

4. **Var specifik med arbetstyper** - använd INTE "Snickare" för städning!

**KORREKTA EXEMPEL:**
─────────────────────────────────────────────────────────────────
Input: "Renovera badrum 5 kvm, mellan-nivå"
→ workHours: {"Plattsättare": 12, "VVS": 8, "Elektriker": 4}
→ materialCost: 21500 (följ chain-of-thought ovan)
→ equipmentCost: 0
✅ KORREKT!

Input: "Bygga altandäck 25 kvm, tryckimpregnerat"
→ workHours: {"Snickare": 40}
→ materialCost: 32000 (följ prisguiden)
→ equipmentCost: 0
✅ KORREKT!

Input: "Måla 3 rum (ca 120 kvm yta), budget"
→ workHours: {"Målare": 16}
→ materialCost: 5500 (följ prisguiden)
→ equipmentCost: 0
✅ KORREKT!

**FELAKTIGA EXEMPEL (GÖR ALDRIG SÅHÄR):**
─────────────────────────────────────────────────────────────────
Input: "Renovera badrum 5 kvm"
→ materialCost: 0
❌ FEL! Badrumsrenovering MÅSTE ha material!

Input: "Bygga altan"
→ materialCost: 0
❌ FEL! Altanbygge MÅSTE ha virke och material!`
        },
        {
          role: 'user',
          content: `Beräkna totaler för: "${description}"`
        }
      ],
      response_format: { type: "json_object" }
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('⚠️ AI Gateway error in calculateBaseTotals:', response.status, errorBody);
    console.log('⚠️ Using degraded mode for base totals calculation');
    
    // Degraded mode: heuristic-based calculation
    const descLower = description.toLowerCase();
    let workHours: { [key: string]: number } = {};
    let materialCost = 0;
    let equipmentCost = 0;
    
    // Detect project type and estimate
    if (descLower.includes('träd') || descLower.includes('fäll') || descLower.includes('arborist')) {
      // Tree work: Arborist
      const isLarge = descLower.includes('stor') || descLower.includes('hög');
      const nearHouse = descLower.includes('hus') || descLower.includes('byggnad') || descLower.includes('nära');
      const baseHours = isLarge ? 14 : 10;
      const complexityAdd = nearHouse ? 2 : 0;
      workHours['Arborist'] = baseHours + complexityAdd;
      
      equipmentCost = 200; // Motorsåg
      if (descLower.includes('forsla') || descLower.includes('borttransport')) {
        equipmentCost += 2000; // Flishugg
      }
      materialCost = 0;
    } else if (descLower.includes('måla') || descLower.includes('målning')) {
      // Painting
      const areaMatch = description.match(/(\d+)\s*kvm/);
      const area = areaMatch ? parseInt(areaMatch[1]) : 120;
      workHours['Målare'] = Math.round(area / 7.5);
      materialCost = area < 100 ? 5500 : 8500;
      equipmentCost = 0;
    } else if (descLower.includes('badrum')) {
      // Bathroom renovation
      workHours = { 'Plattsättare': 12, 'VVS': 8, 'Elektriker': 4 };
      materialCost = 20000;
      equipmentCost = 0;
    } else if (descLower.includes('altan') || descLower.includes('däck')) {
      // Deck construction
      workHours['Snickare'] = 40;
      materialCost = 32000;
      equipmentCost = 0;
    } else if (descLower.includes('golv')) {
      // Flooring
      workHours['Snickare'] = 20;
      materialCost = 15000;
      equipmentCost = 0;
    } else {
      // Unknown: generic carpentry
      workHours['Snickare'] = 8;
      materialCost = 0;
      equipmentCost = 0;
    }
    
    // Calculate work cost for material fallback
    let workCost = 0;
    const hourlyRatesByType: { [key: string]: number } = {};
    if (hourlyRates && hourlyRates.length > 0) {
      hourlyRates.forEach(r => {
        hourlyRatesByType[r.work_type] = r.rate;
      });
      
      Object.entries(workHours).forEach(([type, hours]) => {
        const rate = hourlyRatesByType[type] || 650;
        workCost += hours * rate;
      });
    } else {
      Object.values(workHours).forEach(hours => {
        workCost += hours * 650;
      });
    }
    
    // If material is still 0, use fallback rule (35% of work cost)
    if (materialCost === 0 && workCost > 0) {
      materialCost = Math.round(workCost * 0.35);
    }
    
    console.log('⚠️ Degraded mode result:', { workHours, materialCost, equipmentCost, workCost });
    
    return { 
      workHours, 
      materialCost, 
      equipmentCost,
      hourlyRatesByType
    };
  }

  let result;
  try {
    const data = await response.json();
    result = JSON.parse(data.choices[0].message.content);
  } catch (parseError) {
    console.error('⚠️ JSON parse error in calculateBaseTotals:', parseError);
    console.log('⚠️ Using degraded mode for base totals calculation');
    
    // Same degraded mode as above
    const descLower = description.toLowerCase();
    let workHours: { [key: string]: number } = {};
    let materialCost = 0;
    let equipmentCost = 0;
    
    if (descLower.includes('träd') || descLower.includes('fäll') || descLower.includes('arborist')) {
      const isLarge = descLower.includes('stor') || descLower.includes('hög');
      const nearHouse = descLower.includes('hus') || descLower.includes('byggnad') || descLower.includes('nära');
      workHours['Arborist'] = (isLarge ? 14 : 10) + (nearHouse ? 2 : 0);
      equipmentCost = descLower.includes('forsla') || descLower.includes('borttransport') ? 2200 : 200;
      materialCost = 0;
    } else if (descLower.includes('måla') || descLower.includes('målning')) {
      const areaMatch = description.match(/(\d+)\s*kvm/);
      const area = areaMatch ? parseInt(areaMatch[1]) : 120;
      workHours['Målare'] = Math.round(area / 7.5);
      materialCost = area < 100 ? 5500 : 8500;
      equipmentCost = 0;
    } else if (descLower.includes('badrum')) {
      workHours = { 'Plattsättare': 12, 'VVS': 8, 'Elektriker': 4 };
      materialCost = 20000;
      equipmentCost = 0;
    } else if (descLower.includes('altan') || descLower.includes('däck')) {
      workHours['Snickare'] = 40;
      materialCost = 32000;
      equipmentCost = 0;
    } else if (descLower.includes('golv')) {
      workHours['Snickare'] = 20;
      materialCost = 15000;
      equipmentCost = 0;
    } else {
      workHours['Snickare'] = 8;
      materialCost = 0;
      equipmentCost = 0;
    }
    
    let workCost = 0;
    const hourlyRatesByType: { [key: string]: number } = {};
    if (hourlyRates && hourlyRates.length > 0) {
      hourlyRates.forEach(r => {
        hourlyRatesByType[r.work_type] = r.rate;
      });
      Object.entries(workHours).forEach(([type, hours]) => {
        const rate = hourlyRatesByType[type] || 650;
        workCost += hours * rate;
      });
    } else {
      Object.values(workHours).forEach(hours => {
        workCost += hours * 650;
      });
    }
    
    if (materialCost === 0 && workCost > 0) {
      materialCost = Math.round(workCost * 0.35);
    }
    
    console.log('⚠️ Degraded mode result:', { workHours, materialCost, equipmentCost, workCost });
    
    return { 
      workHours, 
      materialCost, 
      equipmentCost,
      hourlyRatesByType,
      diameterEstimated: undefined // Degraded mode har ingen diameter-uppskattning
    };
  }
  
  // Map hourly rates to dictionary for easier validation
  const hourlyRatesByType: { [key: string]: number } = {};
  if (hourlyRates && hourlyRates.length > 0) {
    hourlyRates.forEach(r => {
      hourlyRatesByType[r.work_type] = r.rate;
    });
  }

  // Beräkna totaler
  let workCost = 0;
  Object.entries(result.workHours || {}).forEach(([type, hours]) => {
    const rate = hourlyRatesByType[type] || 650;
    workCost += (hours as number) * rate;
  });
  
  const totalHours = Object.values(result.workHours || {}).reduce((sum: number, h: any) => sum + h, 0);
  const totalCost = workCost + result.materialCost + result.equipmentCost;

  console.log('✅ Base totals calculated:', { 
    workHours: result.workHours, 
    materialCost: result.materialCost, 
    equipmentCost: result.equipmentCost,
    workCost,
    totalHours,
    totalCost,
    hourlyRatesByType
  });

  return { 
    workHours: result.workHours, 
    materialCost: result.materialCost, 
    equipmentCost: result.equipmentCost,
    workCost,
    totalHours,
    totalCost,
    deductionAmount: 0, // Beräknas senare baserat på deduction type
    hourlyRatesByType,
    diameterEstimated: (measurements as any).diameterEstimated ? measurements.diameter : undefined
  } as any; // Använd any för att undvika TypeScript-fel
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Input validation schema
    const requestSchema = z.object({
      description: z.string().trim().min(1, "Description too short").max(5000, "Description too long"),
      customer_id: z.string().uuid().optional(),
      detailLevel: z.enum(['quick', 'standard', 'detailed', 'construction']).default('standard'),
      deductionType: z.enum(['rot', 'rut', 'none', 'auto']).default('auto'),
      referenceQuoteId: z.string().optional(),
      numberOfRecipients: z.number().int().min(1).max(10).default(1),
      conversation_history: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string()
      })).optional(),
      sessionId: z.string().uuid().optional() // FAS 5: Session context
    });

    // Parse and validate request body
    const body = await req.json();
    const validatedData = requestSchema.parse(body);

    // Extract user_id from JWT token instead of trusting client
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Create admin client to verify JWT and get user
    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user_id = user.id;
    const { description, customer_id, detailLevel, deductionType, referenceQuoteId, numberOfRecipients, conversation_history } = validatedData;

    console.log('Generating quote for user:', user_id);
    console.log('Description:', description);
    console.log('Deduction type requested:', deductionType);
    console.log('Conversation history length:', conversation_history?.length || 0);

    // Bestäm avdragssats baserat på datum (Fas 9B)
    const currentDate = new Date();
    const is2025HigherRate = currentDate >= new Date('2025-05-12') && currentDate <= new Date('2025-12-31');
    const deductionRate = is2025HigherRate ? 0.50 : 0.30;
    const deductionPeriodText = is2025HigherRate 
      ? 'T.o.m. 31 december 2025: 50% avdrag på arbetskostnad inkl. moms'
      : 'Fr.o.m. 1 januari 2026: 30% avdrag på arbetskostnad inkl. moms';
    
    console.log(`📅 Datum: ${currentDate.toISOString().split('T')[0]} → Avdragssats: ${deductionRate * 100}%`);

    // Beräkna max ROT/RUT baserat på antal mottagare (Fas 9A)
    const maxRotPerPerson = 50000;
    const maxRutPerPerson = 75000;
    const totalMaxRot = maxRotPerPerson * numberOfRecipients;
    const totalMaxRut = maxRutPerPerson * numberOfRecipients;

    console.log(`📊 ROT/RUT-gränser: ${numberOfRecipients} mottagare → Max ROT: ${totalMaxRot} kr, Max RUT: ${totalMaxRut} kr`);

    // Skapa Supabase-klient för att hämta timpriser
    const supabaseClient = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!
    );

    // FAS 5: Fetch learning context (learned preferences, industry benchmarks, user patterns)
    console.log('📚 FAS 5: Fetching learning context...');
    const learningContext = await fetchLearningContext(
      supabaseClient, 
      user_id, 
      validatedData.sessionId
    );

    // Detect deduction type if set to auto
    let finalDeductionType = deductionType;
    if (deductionType === 'auto') {
      console.log('Auto-detecting deduction type...');
      
      // NYTT: Använd FÖRSTA meddelandet från conversation_history för avdragsdetektion
      // eftersom det innehåller huvudbeskrivningen av projektet
      const firstUserMessage = conversation_history && conversation_history.length > 0
        ? conversation_history.find(m => m.role === 'user')?.content || description
        : description;
      
      console.log(`Description for deduction detection: ${firstUserMessage}`);
      
      finalDeductionType = await detectDeductionType(firstUserMessage, LOVABLE_API_KEY);
      console.log('Detected deduction type:', finalDeductionType);
    }

    // Hämta referensofferter om användaren valt det
    let referenceQuotes: any[] = [];
    if (referenceQuoteId) {
      if (referenceQuoteId === 'auto') {
        console.log('Auto-selecting similar quotes...');
        const { data: similar, error: similarError } = await supabaseClient
          .rpc('find_similar_quotes', {
            user_id_param: user_id,
            description_param: description,
            limit_param: 3
          });
        
        if (similarError) {
          console.error('Error finding similar quotes:', similarError);
        } else if (similar && similar.length > 0) {
          referenceQuotes = similar.map((q: any) => ({
            id: q.quote_id,
            title: q.title,
            description: q.description,
            quote_data: q.quote_data
          }));
          console.log(`Found ${referenceQuotes.length} similar quotes`);
        }
      } else {
        console.log('Using specific reference quote:', referenceQuoteId);
        const { data: specific, error: specificError } = await supabaseClient
          .from('quotes')
          .select('id, title, description, generated_quote, edited_quote')
          .eq('id', referenceQuoteId)
          .eq('user_id', user_id)
          .single();
        
        if (specificError) {
          console.error('Error fetching specific quote:', specificError);
        } else if (specific) {
          referenceQuotes = [{
            id: specific.id,
            title: specific.title,
            description: specific.description,
            quote_data: specific.edited_quote || specific.generated_quote
          }];
          console.log('Using reference quote:', specific.title);
        }
      }
    }

    // Hämta användarens timpriser
    const { data: hourlyRates, error: ratesError} = await supabaseClient
      .from('hourly_rates')
      .select('work_type, rate')
      .eq('user_id', user_id);

    if (ratesError) {
      console.error('Error fetching hourly rates:', ratesError);
    }

    // Hämta användarens maskiner och utrustning
    const { data: equipmentRates, error: equipmentError } = await supabaseClient
      .from('equipment_rates')
      .select('name, equipment_type, price_per_day, price_per_hour, is_rented, default_quantity')
      .eq('user_id', user_id);

    if (equipmentError) {
      console.error('Error fetching equipment rates:', equipmentError);
    }

    // Hämta kundspecifik historik (om customer_id finns)
    let customerHistoryText = '';
    if (customer_id) {
      const { data: customerQuotes } = await supabaseClient
        .from('quotes')
        .select('title, generated_quote, edited_quote, status, created_at')
        .eq('user_id', user_id)
        .eq('customer_id', customer_id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (customerQuotes && customerQuotes.length > 0) {
        customerHistoryText = '\n\nTidigare offerter för denna kund:\n' +
          customerQuotes.map(q => {
            const quote = q.edited_quote || q.generated_quote;
            const totalCost = quote?.summary?.totalWithVAT || 0;
            return `- ${q.title}: ${totalCost} kr (Status: ${q.status}, ${new Date(q.created_at).toLocaleDateString('sv-SE')})`;
          }).join('\n') +
          '\n\nAnvänd denna historik för att matcha priser och nivå om liknande arbete.';
      }
    }

    // Hämta prishistorik från alla användarens offerter
    const { data: recentQuotes } = await supabaseClient
      .from('quotes')
      .select('generated_quote, edited_quote')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(20);

    let pricingHistoryText = '';
    if (recentQuotes && recentQuotes.length > 0) {
      const allWorkItems: any[] = [];
      recentQuotes.forEach(q => {
        const quote = q.edited_quote || q.generated_quote;
        if (quote?.workItems) {
          allWorkItems.push(...quote.workItems);
        }
      });
      
      const workTypeAverages = new Map();
      allWorkItems.forEach(item => {
        const name = item.name.toLowerCase();
        if (!workTypeAverages.has(name)) {
          workTypeAverages.set(name, []);
        }
        workTypeAverages.get(name).push(item.hourlyRate);
      });
      
      if (workTypeAverages.size > 0) {
        pricingHistoryText = '\n\nDina genomsnittliga priser från tidigare offerter:\n';
        workTypeAverages.forEach((rates, workType) => {
          const avg = rates.reduce((a: number, b: number) => a + b, 0) / rates.length;
          pricingHistoryText += `- ${workType}: ~${Math.round(avg)} kr/h (baserat på ${rates.length} tidigare poster)\n`;
        });
        pricingHistoryText += '\nAnvänd dessa som referens för konsekvent prissättning.';
      }
    }

    // Bygg rates-text för prompten
    let ratesText = '';
    let hasCustomRates = false;
    
    if (hourlyRates && hourlyRates.length > 0) {
      ratesText = 'Använd EXAKT dessa timpriser som användaren har angivit:\n' + 
                  hourlyRates.map(r => `- ${r.work_type}: ${r.rate} kr/h`).join('\n');
      hasCustomRates = true;
      console.log('Using custom hourly rates:', hourlyRates);
    } else {
      ratesText = 'Användaren har inte angivit specifika timpriser. Använd standardpris 650 kr/h.';
      console.log('No custom rates found, using default 650 kr/h');
    }

    // Bygg equipment-text för prompten
    let equipmentText = '';
    let hasEquipment = false;
    
    // Bygg lista över användarens verktyg
    const userEquipment = equipmentRates || [];
    
    // Lägg till bransch-standard verktyg som fallback
    const standardEquipment = `

OM PROJEKTET KRÄVER VERKTYG SOM INTE FINNS I LISTAN OVAN:
Lägg till dem i materials-array med dessa standardpriser:
- Motorsåg (arborist): 250 kr/tim eller 1000 kr/dag
- Flishugg: 2000 kr/dag
- Minigrävare: 1000 kr/dag
- Grävmaskin: 2000 kr/dag
- Kakelskärare: 150 kr/dag
- Ställning: 300 kr/dag per sektion
- Blandare: 100 kr/dag
- Sprututrustning: 400 kr/dag
`;
    
    if (userEquipment.length > 0) {
      equipmentText = '\n\nAnvändarens maskiner och utrustning:\n' + 
        userEquipment.map(e => {
          const priceInfo = e.price_per_day 
            ? `${e.price_per_day} kr/dag`
            : `${e.price_per_hour} kr/timme`;
          const status = e.is_rented ? 'hyrd' : 'ägd';
          return `- ${e.name} (${e.equipment_type}): ${priceInfo} (${status}, standard antal: ${e.default_quantity})`;
        }).join('\n');
      hasEquipment = true;
      console.log('Using equipment rates:', equipmentRates);
    }
    
    equipmentText += standardEquipment;

    // Analysera användarens stil från tidigare offerter
    function analyzeUserStyle(userQuotes: any[]): any {
      if (!userQuotes || userQuotes.length === 0) return null;
      
      const descriptions = userQuotes.flatMap(q => {
        const quote = q.edited_quote || q.generated_quote;
        if (!quote || !quote.workItems) return [];
        return quote.workItems.map((w: any) => w.description || w.name);
      }).filter(Boolean);
      
      if (descriptions.length === 0) return null;
      
      const usesEmojis = descriptions.some(d => /[\p{Emoji}]/u.test(d));
      const avgLength = descriptions.reduce((sum, d) => sum + d.length, 0) / descriptions.length;
      
      return {
        usesEmojis,
        avgDescriptionLength: Math.round(avgLength),
        sampleSize: userQuotes.length
      };
    }

    const { data: userQuotes, error: userQuotesError } = await supabaseClient
      .from('quotes')
      .select('generated_quote, edited_quote')
      .eq('user_id', user_id)
      .in('status', ['accepted', 'completed', 'sent'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (userQuotesError) {
      console.error('Error fetching user quotes for style analysis:', userQuotesError);
    }

    // Fetch industry benchmarks for learning context
    const { data: industryBenchmarks, error: benchmarksError } = await supabaseClient
      .from('industry_benchmarks')
      .select('*')
      .order('last_updated', { ascending: false })
      .limit(50);

    if (benchmarksError) {
      console.error('Error fetching industry benchmarks:', benchmarksError);
    }

    // Fas 14A: Hämta användarens personliga patterns
    const { data: userPatterns, error: patternsError } = await supabaseClient
      .from('user_quote_patterns')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (patternsError) {
      console.error('Error fetching user patterns:', patternsError);
    }

    console.log('📈 Industry benchmarks loaded:', industryBenchmarks?.length || 0, 'entries');
    console.log('👤 User patterns loaded:', userPatterns ? 'yes' : 'no', userPatterns ? `(${userPatterns.sample_size} quotes analyzed)` : '');

    const userStyle = analyzeUserStyle(userQuotes || []);
    if (userStyle) {
      console.log('User style analyzed:', userStyle);
    }

    // Prepare learning metadata to return to frontend
    const learningMetadata = {
      hasUserPatterns: !!userPatterns,
      hasBenchmarks: (industryBenchmarks?.length || 0) > 0,
      quotesAnalyzed: userPatterns?.total_quotes_analyzed || 0,
      benchmarkCategories: industryBenchmarks?.length || 0
    };

    // Build learning context from industry benchmarks
    const buildLearningContext = (benchmarks: any[] | null) => {
      if (!benchmarks || benchmarks.length === 0) {
        return '';
      }

      // Group by work category
      const byCategory: Record<string, any[]> = {};
      benchmarks.forEach(b => {
        if (!byCategory[b.work_category]) {
          byCategory[b.work_category] = [];
        }
        byCategory[b.work_category].push(b);
      });

      let context = '\n\n**═══════════════════════════════════════════════════════════════**\n';
      context += '**BRANSCHKUNSKAP (aggregerad från historiska offerter)**\n';
      context += '**═══════════════════════════════════════════════════════════════**\n';
      
      for (const [category, data] of Object.entries(byCategory)) {
        context += `\n📊 ${category.toUpperCase()}:\n`;
        
        const hourlyRateData = data.find(d => d.metric_type === 'hourly_rate');
        const materialRatioData = data.find(d => d.metric_type === 'material_to_work_ratio');
        const totalHoursData = data.find(d => d.metric_type === 'total_hours');

        if (hourlyRateData) {
          context += `  • Timpriser: ${Math.round(hourlyRateData.min_value)}-${Math.round(hourlyRateData.max_value)} kr/h (median: ${Math.round(hourlyRateData.median_value)} kr/h)\n`;
        }
        if (materialRatioData) {
          context += `  • Material/arbete-ratio: ${(materialRatioData.min_value * 100).toFixed(0)}-${(materialRatioData.max_value * 100).toFixed(0)}% (median: ${(materialRatioData.median_value * 100).toFixed(0)}%)\n`;
        }
        if (totalHoursData) {
          context += `  • Typiska timmar för projekt: ${Math.round(totalHoursData.min_value)}-${Math.round(totalHoursData.max_value)}h (median: ${Math.round(totalHoursData.median_value)}h)\n`;
        }
      }

      context += `\n**ANVÄND BRANSCHDATA FÖR:**\n`;
      context += `• Jämföra dina priser mot marknadsstandarder\n`;
      context += `• Varna om stora avvikelser från median (>20% kan indikera fel eller särskilda förutsättningar)\n`;
      context += `• Göra rimliga antaganden när exakt info saknas\n`;
      context += `• Säkerställa att material/arbete-ratio är inom normala intervall\n`;

      return context;
    };

    const aiLearningContext = buildLearningContext(industryBenchmarks);

    // Fas 14A: Bygg personlig learning context från user patterns
    const buildPersonalContext = (patterns: any) => {
      if (!patterns || patterns.sample_size === 0) {
        return '';
      }

      let context = '\n\n**═══════════════════════════════════════════════════════════════**\n';
      context += '**DIN PERSONLIGA STATISTIK (baserat på dina tidigare offerter)**\n';
      context += '**═══════════════════════════════════════════════════════════════**\n\n';
      context += `Analyserad från ${patterns.sample_size} av dina tidigare offerter:\n\n`;

      if (patterns.avg_quote_value) {
        context += `• Genomsnittligt offervärde: ${Math.round(patterns.avg_quote_value)} kr\n`;
      }

      if (patterns.preferred_detail_level) {
        context += `• Föredraget detaljnivå: ${patterns.preferred_detail_level}\n`;
      }

      if (patterns.work_type_distribution && Object.keys(patterns.work_type_distribution).length > 0) {
        context += `\n**DINA VANLIGASTE ARBETSTYPER:**\n`;
        Object.entries(patterns.work_type_distribution)
          .sort(([, a]: any, [, b]: any) => b - a)
          .slice(0, 5)
          .forEach(([type, percent]: any) => {
            context += `  • ${type}: ${percent}% av dina projekt\n`;
          });
      }

      if (patterns.avg_hourly_rates && Object.keys(patterns.avg_hourly_rates).length > 0) {
        context += `\n**DINA GENOMSNITTLIGA TIMPRISER:**\n`;
        Object.entries(patterns.avg_hourly_rates).forEach(([type, rate]: any) => {
          context += `  • ${type}: ${rate} kr/h\n`;
        });
      }

      if (patterns.avg_material_to_work_ratio) {
        const ratio = (patterns.avg_material_to_work_ratio * 100).toFixed(0);
        context += `\n**DIN MATERIAL/ARBETE-RATIO:**\n`;
        context += `  • Du använder typiskt ${ratio}% av arbetskostnaden för material\n`;
      }

      if (patterns.uses_emojis || patterns.avg_description_length) {
        context += `\n**DIN STIL:**\n`;
        if (patterns.uses_emojis) {
          context += `  • Du använder emojis och ikoner i dina beskrivningar ✅\n`;
        }
        if (patterns.avg_description_length) {
          context += `  • Dina beskrivningar är i snitt ${patterns.avg_description_length} tecken\n`;
        }
      }

      context += `\n**INSTRUKTION:**\n`;
      context += `• Använd DIN egen statistik som primär referens\n`;
      context += `• Matcha din vanliga stil och detaljnivå\n`;
      context += `• Jämför med branschdata för att säkerställa rimlighet\n`;
      context += `• Om dina priser avviker >20% från bransch → använd DINA priser (du kanske har specialkompetens)\n`;

      return context;
    };

    const personalContext = buildPersonalContext(userPatterns);

    // Build deduction info based on type
    const deductionInfo = finalDeductionType === 'rot' 
      ? `ROT-avdrag: 50% av arbetskostnaden (max 50 000 kr per person/år). Gäller renovering, reparation, ombyggnad.`
      : finalDeductionType === 'rut'
      ? `RUT-avdrag: 50% av arbetskostnaden (max 75 000 kr per person/år). Gäller städning, underhåll, trädgård, hemservice.`
      : `Inget skatteavdrag tillämpas på detta arbete.`;

    // NYTT: Unified question phase - EN enda frågefas
    const exchangeCount = conversation_history ? Math.floor(conversation_history.length / 2) : 0;
    const userWantsQuoteNow = description.toLowerCase().match(
      /(generera|skapa|gör|ta fram|räcker|kör på|nu|direkt|klart|det räcker)/
    );
    
    const shouldAskQuestions = exchangeCount === 0 && !userWantsQuoteNow;

    if (shouldAskQuestions) {
      console.log('💬 Running SINGLE unified question phase...');
      
      // Bygg full kontext
      const fullContext = conversation_history && conversation_history.length > 0
        ? buildConversationSummary(conversation_history, description)
        : description;
      
      // Samla ALL info som KANSKE saknas
      const measurements = await extractMeasurements(fullContext, LOVABLE_API_KEY!);
      const { criticalFactors, projectType } = getDomainKnowledge(fullContext);
      
      // Bygg prioriterad lista av frågor
      const questions: string[] = [];
      
      // 1. KRITISKT: Helt saknade mått
      if (measurements.ambiguous && measurements.clarificationNeeded) {
        questions.push(measurements.clarificationNeeded);
      }
      
      // 2. VIKTIGT: Projektspecifika detaljer (endast om INGEN info finns)
      if (criticalFactors.length === 0 && description.length < 30) {
        questions.push('Kan du beskriva projektet lite mer detaljerat?');
      }
      
      // Om vi har minst 1 kritisk fråga → fråga ENDAST DEN
      if (questions.length > 0) {
        console.log(`🤔 Asking ${questions.length} critical question(s)`);
        return new Response(
          JSON.stringify({
            type: 'clarification',
            message: 'För att skapa en exakt offert behöver jag veta:',
            questions: questions.slice(0, 1) // MAX 1 fråga!
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }
    
    console.log('✅ Proceeding to quote generation...');

    // Om vi kommer hit ska vi generera offert
    console.log('✅ Enough information gathered - generating quote...');

    // Bygg complete description EN gång för alla (använd HELA konversationen)
    const completeDescription = buildConversationSummary(conversation_history || [], description);
    console.log('Complete description built:', completeDescription.slice(0, 200));

    // FAS 3.6: PROAKTIV REALITY CHECK (FÖRE calculateBaseTotals!)
    console.log('🔍 FAS 3.6: Running proactive reality check...');
    
    // ANVÄND completeDescription överallt
    const proactiveMeasurements = await extractMeasurements(completeDescription, LOVABLE_API_KEY!);
    const { projectType: proactiveProjectType } = getDomainKnowledge(completeDescription);
    
    let proactiveArea: number | undefined = undefined;
    if (proactiveMeasurements.area) {
      const areaMatch = proactiveMeasurements.area.match(/(\d+(?:[.,]\d+)?)/);
      if (areaMatch) {
        proactiveArea = parseFloat(areaMatch[1].replace(',', '.'));
      }
    }
    
    const proactiveCheck = await performProactiveRealityCheck({
      projectType: proactiveProjectType || completeDescription, // Fallback to full description
      description: completeDescription,  // HELA KONVERSATIONEN
      area: proactiveArea,
      conversationHistory: conversation_history,
      learningContext // FAS 5: Include learning context
    });
    
    console.log(`✅ Proaktiv check: ${proactiveCheck.reasoning}`);
    if (proactiveCheck.suggestedMaterialRatio) {
      console.log(`   → Materialratio justeras till ${(proactiveCheck.suggestedMaterialRatio * 100).toFixed(0)}%`);
    }

    // FAS 5: Save new learnings back to session
    if (proactiveCheck.newLearnings && validatedData.sessionId) {
      try {
        console.log('💾 FAS 5: Saving new learnings to session...');
        const currentPrefs = learningContext.learnedPreferences || {};
        const updatedPrefs = {
          ...currentPrefs,
          lastProjectType: proactiveCheck.newLearnings.projectType,
          lastQualityPreference: proactiveCheck.newLearnings.qualityPreference,
          preferredMaterialRatio: proactiveCheck.newLearnings.adjustedMaterialRatio,
          lastEstimatedPriceRange: proactiveCheck.newLearnings.estimatedPriceRange,
          usedDatabaseBenchmark: proactiveCheck.newLearnings.usedDatabaseBenchmark,
          updatedAt: new Date().toISOString()
        };
        
        await supabaseClient
          .from('conversation_sessions')
          .update({ learned_preferences: updatedPrefs })
          .eq('id', validatedData.sessionId)
          .eq('user_id', user_id);
        
        console.log('✅ FAS 5: Learnings saved successfully');
      } catch (error) {
        console.error('Error saving learnings:', error);
        // Don't fail quote generation if learning save fails
      }
    }

    // STEG 2: Beräkna baseTotals med complete description
    console.log('Step 2: Calculating base totals with complete conversation context...');
    
    const baseTotals = await calculateBaseTotals(
      completeDescription,  // <- HELA beskrivningen från konversationen!
      LOVABLE_API_KEY!, 
      hourlyRates, 
      equipmentRates,
      proactiveCheck.suggestedMaterialRatio // FAS 3.6: Använd justerad ratio från proaktiv check
    );
    console.log('Base totals calculated:', baseTotals);
    
    // Om diameter uppskattades automatiskt, spara info för varning senare
    let diameterWarning: string | undefined;
    if (baseTotals.diameterEstimated) {
      diameterWarning = `ℹ️ Diameter uppskattat till ${baseTotals.diameterEstimated} baserat på trädens höjd. Justera vid behov.`;
      console.log(`🌲 ${diameterWarning}`);
    }

    // KRITISK VALIDERING: Säkerställ att materialCost INTE är 0 för renoveringsprojekt
    const descLower = completeDescription.toLowerCase();
    const isRenovationProject = 
      descLower.includes('renovera') || 
      descLower.includes('bygga') || 
      descLower.includes('byta') ||
      descLower.includes('installera') ||
      descLower.includes('altandäck') ||
      descLower.includes('altan') ||
      descLower.includes('badrum') ||
      descLower.includes('kök') ||
      descLower.includes('kakel') ||
      descLower.includes('golv') ||
      descLower.includes('målning') ||
      descLower.includes('måla');

    // CRITICAL: Validate material cost BEFORE generating quote
    if (isRenovationProject && baseTotals.materialCost < 1000) {
      console.warn('⚠️ Material cost too low for renovation project, requesting clarification');
      return new Response(
        JSON.stringify({
          type: 'clarification',
          message: 'Jag behöver veta vilken materialnivå du vill ha för att kunna beräkna materialkostnaden korrekt. Välj mellan:\n\n• **Budget** - Enklare material, god kvalitet\n• **Mellan** - Standardmaterial från kända märken\n• **Premium** - Exklusiva material och design\n\nVilken nivå passar ditt projekt?',
          currentData: {}
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (isRenovationProject && baseTotals.materialCost === 0) {
      console.warn('⚠️ MATERIAL FALLBACK: materialCost är 0 för renoveringsprojekt!');
      
      // Fallback: Beräkna materialCost baserat på arbetskostnad (branschnorm ~30-40%)
      const totalWorkCost = Object.values(baseTotals.workHours as Record<string, number>).reduce((sum, hours) => {
        const rate = hourlyRates && hourlyRates.length > 0 
          ? (hourlyRates.find(r => Object.keys(baseTotals.workHours).includes(r.work_type))?.rate || 650)
          : 650;
        return sum + (hours * rate);
      }, 0);
      
      // Material är typiskt 30-40% av arbetskostnaden för renovering
      baseTotals.materialCost = Math.round(totalWorkCost * 0.35);
      console.log(`✅ AUTO-GENERATED materialCost: ${baseTotals.materialCost} kr (35% av arbetskostnad ${totalWorkCost} kr)`);
      console.log('AI_FALLBACK aktiverad - granska material noga i resulterande offert!');
    }

    console.log('✅ Base totals calculated:', baseTotals);

    // ==================
    // HELPER: LOCAL QUOTE BUILDER (FALLBACK)
    // ==================
    
    const buildFallbackQuote = (params: {
      description: string;
      baseTotals: any;
      detailLevel: string;
      hourlyRatesByType: { [key: string]: number };
      finalDeductionType: string;
      deductionRate: number;
      totalMaxRot: number;
      totalMaxRut: number;
    }) => {
      console.log('⚠️ Building fallback quote locally...');
      
      const { description, baseTotals, detailLevel, hourlyRatesByType, finalDeductionType, deductionRate, totalMaxRot, totalMaxRut } = params;
      
      // Generate work items from baseTotals.workHours
      const workItems: any[] = [];
      for (const [workType, hours] of Object.entries(baseTotals.workHours)) {
        const hourlyRate = hourlyRatesByType[workType] || 650;
        const subtotal = (hours as number) * hourlyRate;
        workItems.push({
          name: `${workType} - Arbete`,
          description: `Utförande av ${workType.toLowerCase()}-arbete enligt beskrivning`,
          hours: hours,
          hourlyRate: hourlyRate,
          subtotal: subtotal
        });
      }
      
      // Generate material items
      const materials: any[] = [];
      if (baseTotals.equipmentCost > 0) {
        materials.push({
          name: 'Maskiner och utrustning',
          quantity: 1,
          unit: 'post',
          pricePerUnit: baseTotals.equipmentCost,
          subtotal: baseTotals.equipmentCost
        });
      }
      if (baseTotals.materialCost > 0) {
        materials.push({
          name: 'Material och förbrukning',
          quantity: 1,
          unit: 'post',
          pricePerUnit: baseTotals.materialCost,
          subtotal: baseTotals.materialCost
        });
      }
      
      // Calculate summary
      const workCost = workItems.reduce((sum, item) => sum + item.subtotal, 0);
      const materialCost = baseTotals.materialCost + baseTotals.equipmentCost;
      const totalBeforeVAT = workCost + materialCost;
      const vat = Math.round(totalBeforeVAT * 0.25);
      const totalWithVAT = totalBeforeVAT + vat;
      
      let deductionAmount = 0;
      if (finalDeductionType === 'rot' || finalDeductionType === 'rut') {
        const workCostInclVAT = workCost * 1.25;
        const maxDeduction = finalDeductionType === 'rot' ? totalMaxRot : totalMaxRut;
        deductionAmount = Math.min(Math.round(workCostInclVAT * deductionRate), maxDeduction);
      }
      
      const customerPays = totalWithVAT - deductionAmount;
      
      // Generate simple title
      let title = 'Offert';
      if (description.toLowerCase().includes('träd') || description.toLowerCase().includes('fäll')) {
        title = 'Offert: Trädfällning';
      } else if (description.toLowerCase().includes('måla') || description.toLowerCase().includes('målning')) {
        title = 'Offert: Målning';
      } else if (description.toLowerCase().includes('badrum')) {
        title = 'Offert: Badrumsrenovering';
      } else if (description.toLowerCase().includes('altan')) {
        title = 'Offert: Altanbygge';
      } else if (description.toLowerCase().includes('kök')) {
        title = 'Offert: Köksrenovering';
      }
      
      const quote = {
        title: title,
        workItems: workItems,
        materials: materials,
        summary: {
          workCost: workCost,
          materialCost: materialCost,
          totalBeforeVAT: totalBeforeVAT,
          vat: vat,
          totalWithVAT: totalWithVAT,
          deductionAmount: deductionAmount,
          deductionType: finalDeductionType,
          customerPays: customerPays,
          ...(finalDeductionType === 'rot' ? { rotDeduction: deductionAmount } : {}),
          ...(finalDeductionType === 'rut' ? { rutDeduction: deductionAmount } : {})
        },
        deductionType: finalDeductionType,
        notes: `Offerten är baserad på de uppgifter som lämnats och gällande priser.\n\nObservera: Denna offert har skapats i offline-läge på grund av tillfälligt fel i AI-tjänsten. Beräkningarna bygger på dina timpriser och branschstandarder.`
      };
      
      console.log('✅ Fallback quote built:', { workCost, materialCost, totalWithVAT, customerPays });
      
      return quote;
    };

    // Define strict JSON schema for tool calling
    const quoteSchema = {
      type: "object",
      properties: {
        title: { type: "string", description: "Kort beskrivande titel för offerten" },
        workItems: {
          type: "array",
          description: "Lista över arbetsmoment",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Namn på arbetsmoment" },
              description: { type: "string", description: "Beskrivning av momentet" },
              hours: { type: "number", description: "Antal timmar" },
              hourlyRate: { type: "number", description: "Timpris i kronor" },
              subtotal: { type: "number", description: "Totalkostnad (hours × hourlyRate)" }
            },
            required: ["name", "description", "hours", "hourlyRate", "subtotal"],
            additionalProperties: false
          }
        },
        materials: {
          type: "array",
          description: "Lista över material",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Namn på material/produkt" },
              quantity: { type: "number", description: "Antal" },
              unit: { type: "string", description: "Enhet (st/m2/m/kg)" },
              pricePerUnit: { type: "number", description: "Pris per enhet" },
              subtotal: { type: "number", description: "Totalkostnad (quantity × pricePerUnit)" }
            },
            required: ["name", "quantity", "unit", "pricePerUnit", "subtotal"],
            additionalProperties: false
          }
        },
        summary: {
          type: "object",
          description: "Sammanfattning av kostnader",
          properties: {
            workCost: { type: "number", description: "Total arbetskostnad" },
            materialCost: { type: "number", description: "Total materialkostnad" },
            totalBeforeVAT: { type: "number", description: "Summa före moms" },
            vat: { type: "number", description: "Moms (25%)" },
            totalWithVAT: { type: "number", description: "Totalt inkl moms" },
            deductionAmount: { type: "number", description: "ROT/RUT-avdrag" },
            deductionType: { type: "string", enum: ["rot", "rut", "none"], description: "Typ av avdrag" },
            customerPays: { type: "number", description: "Kund betalar efter avdrag" }
          },
          required: ["workCost", "materialCost", "totalBeforeVAT", "vat", "totalWithVAT", "deductionAmount", "deductionType", "customerPays"],
          additionalProperties: false
        },
        notes: { type: "string", description: "Anteckningar och villkor" }
      },
      required: ["title", "workItems", "materials", "summary"],
      additionalProperties: false
    };

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        tools: [{
          type: "function",
          function: {
            name: "create_quote",
            description: "Skapa en strukturerad offert baserat på jobbeskrivning och förutberäknade totaler",
            parameters: quoteSchema
          }
        }],
        tool_choice: { type: "function", function: { name: "create_quote" } },
        messages: [
          {
            role: 'system',
            content: `Du är en erfaren svensk hantverkare som skapar offerter åt dig själv till dina kunder.

**DIN ROLL:**
- Du är INTE en assistent som samlar krav
- Du är EN HANTVERKARE som ska skapa en offert
- Användaren är DIG (hantverkaren), INTE kunden
- Du ska göra rimliga antaganden baserat på erfarenhet

**DIN APPROACH:**
1. Ta emot projektbeskrivning (kan vara kortfattad)
2. Gör professionella antaganden baserat på branschstandard
3. Skapa offerten DIREKT med de förutberäknade totalerna
4. Använd din branscherfarenhet för att fylla i detaljer

**KOMMUNIKATIONSTON:**
- Professionell och erfaren
- Gör antaganden där det behövs
- Fokusera på att leverera en korrekt offert

**═══════════════════════════════════════════════════════════════**
**KRITISKT - FÖR SVENSKA HANTVERKARE**
**═══════════════════════════════════════════════════════════════**

**═══════════════════════════════════════════════════════════════**
**DE 5 ABSOLUTA REGLERNA (BRYT ALDRIG DESSA!)**
**═══════════════════════════════════════════════════════════════**

1. **MATCHA ANVÄNDARENS FÖRFRÅGAN EXAKT**
   Användaren bad om: "${conversation_history && conversation_history.length > 0 ? conversation_history.filter((m: any) => m.role === 'user').map((m: any) => m.content).join(' → ') : description}"
   → Skapa offert för EXAKT detta (om "målning" → målningsoffert, INTE altan/kök)

2. **LÅS FÖRUTBERÄKNADE TOTALER (VIKTIGAST AV ALLT!)**
   Arbetstimmar: ${JSON.stringify(baseTotals.workHours)}
   Material: ${baseTotals.materialCost} kr | Utrustning: ${baseTotals.equipmentCost} kr
   → **DU MÅSTE** använda exakt dessa timmar i din offert
   → **ALDRIG** sätt 0 timmar om baseTotals säger något annat!
   → Summan av hours i alla workItems MÅSTE = baseTotals.workHours
   → FÅR INTE ändras, endast fördelas över poster!

3. **ANVÄND EXAKTA TIMPRISER**
   ${JSON.stringify(baseTotals.hourlyRatesByType, null, 2)}
   → Använd EXAKT dessa priser för matchande arbetstyper

4. **MATERIAL MÅSTE HA REALISTISKA PRISER**
   → ALDRIG pricePerUnit = 0 kr
   → Total materials.subtotal = ${baseTotals.materialCost + baseTotals.equipmentCost} kr

5. **FÖLJ DETALJNIVÅ "${detailLevel}"**
   ${detailLevel === 'quick' ? '→ 2-3 arbetsposter, 3-5 material, notes <100 tecken' : ''}
   ${detailLevel === 'standard' ? '→ 4-6 arbetsposter, 5-10 material, notes 200-300 tecken' : ''}
   ${detailLevel === 'detailed' ? '→ 6-10 arbetsposter, 10-15 material, notes 500-800 tecken med fasindelning' : ''}
   ${detailLevel === 'construction' ? '→ 10-15 arbetsposter (inkl. projektledning), 15-25 material, notes 1200-2000 tecken med projektledning+tidsplan+garanti+besiktning' : ''}

${personalContext}

${aiLearningContext}

**═══════════════════════════════════════════════════════════════**
**PROJEKTSPECIFIK KONTEXT**
**═══════════════════════════════════════════════════════════════**
            
${ratesText}
${equipmentText}
${customerHistoryText}
${pricingHistoryText}

${referenceQuotes.length > 0 ? `

**═══════════════════════════════════════════════════════════════**
**VIKTIGT - ANVÄND DESSA TIDIGARE OFFERTER SOM REFERENS**
**═══════════════════════════════════════════════════════════════**

Du har tillgång till ${referenceQuotes.length} tidigare liknande offert(er) från SAMMA användare.
Använd dessa för att hålla KONSEKVENT prissättning, omfattning och stil.

${referenceQuotes.map((ref, idx) => {
  const quoteData = ref.quote_data;
  if (!quoteData) return '';
  const summary = quoteData.summary;
  
  return `
════════════════════════════════════════════════════════════════
REFERENS ${idx + 1}: ${ref.title}
════════════════════════════════════════════════════════════════
Beskrivning: ${ref.description}

PRISER:
• Totalt: ${summary.totalWithVAT} kr (inkl. moms)
• Kund betalar: ${summary.customerPays} kr (efter ${summary.deductionType?.toUpperCase() || 'inget'}-avdrag)
• Arbete: ${summary.workCost} kr
• Material: ${summary.materialCost} kr
• Avdrag: ${summary.deductionAmount || 0} kr

ARBETSPOSTER:
${quoteData.workItems?.map((w: any) => `• ${w.name}: ${w.hours}h × ${w.hourlyRate} kr/h = ${w.subtotal} kr`).join('\n') || 'Inga arbetsposter'}

MATERIALPOSTER:
${quoteData.materials?.map((m: any) => `• ${m.name}: ${m.quantity} ${m.unit} × ${m.pricePerUnit} kr = ${m.subtotal} kr`).join('\n') || 'Inga materialposter'}
`;
}).join('\n')}

**MATCHNINGSREGLER FÖR REFERENSER:**
1. Om nya uppdraget är MINDRE än referensen → Skala ner proportionellt men håll struktur
2. Om nya uppdraget är STÖRRE → Skala upp men håll EXAKT samma timpris
3. Om materialnivå skiljer sig (budget/mellan/premium) → Justera materialpriser, ALDRIG timpriser
4. Behåll SAMMA timpris som i referensen för matchande arbetstyper
5. Om nya uppdraget är NÄSTAN identiskt → använd nästan exakt samma struktur och fördelning
6. Matcha arbetstyper: Om referens använder "Snickare" → använd samma arbetstyp i nya offerten

` : ''}

${userStyle ? `

**═══════════════════════════════════════════════════════════════**
**STIL-ANPASSNING (matcha användarens tidigare offerter)**
**═══════════════════════════════════════════════════════════════**

Analys av användarens senaste ${userStyle.sampleSize} offerter visar:
• ${userStyle.usesEmojis ? '✅ Använder emojis och ikoner i beskrivningar' : '❌ Använder ren text utan emojis'}
• Genomsnittlig beskrivningslängd: ~${userStyle.avgDescriptionLength} tecken

**INSTRUKTION:**
${userStyle.usesEmojis ? 'Inkludera relevanta emojis i workItems-beskrivningar och notes.' : 'Håll texten professionell och emoji-fri.'}
Håll beskrivningslängder runt ${userStyle.avgDescriptionLength} tecken.
Matcha tonen och stilen från användarens tidigare offerter.

` : ''}

**══════════════════════════════════════════════════════════════**
**PROJEKTSPECIFIK KONTEXT**
**══════════════════════════════════════════════════════════════**

**TIMPRIS-MATCHNING (workItem.name → hourlyRate):**
• "Snickare - Rivning" → använd ${baseTotals.hourlyRatesByType['Snickare'] || 650} kr/h
• "Målare - Målning" → använd ${baseTotals.hourlyRatesByType['Målare'] || 700} kr/h
• workItem.name MÅSTE börja med arbetstypen från baseTotals.hourlyRatesByType
• Fallback (om arbetstyp saknas): Städare 500, Arborist 1000, Trädgård 550, Elektriker 850, VVS 900

**MATERIAL-FÖRDELNING:**
• ALDRIG pricePerUnit = 0 kr!
• Total materials.subtotal = ${baseTotals.materialCost + baseTotals.equipmentCost} kr exakt
• Exempel badrum 5 kvm: Kakel vägg (1750 kr) + Klinker golv (2125 kr) + VVS (6000 kr) = 20000 kr ✓

**══════════════════════════════════════════════════════════════**
**MATEMATIK MÅSTE STÄMMA**
**══════════════════════════════════════════════════════════════**

• workItems.hours per arbetstyp = baseTotals.workHours exakt
• materials.subtotal totalt = ${baseTotals.materialCost + baseTotals.equipmentCost} kr exakt
• workItems.hourlyRate = baseTotals.hourlyRatesByType exakt
            
Baserat på uppdragsbeskrivningen ska du returnera en strukturerad offert i JSON-format med följande struktur:

{
  "title": "Kort beskrivande titel",
  "workItems": [
    {
      "name": "Arbetsmoment",
      "description": "Beskrivning av momentet",
      "hours": 10,
      "hourlyRate": 650,
      "subtotal": 6500
    }
  ],
  "materials": [
    {
      "name": "Material/produkt",
      "quantity": 1,
      "unit": "st/m2/m",
      "pricePerUnit": 1000,
      "subtotal": 1000
    }
  ],
        "summary": {
          "workCost": 10000,
          "materialCost": 5000,
          "totalBeforeVAT": 15000,
          "vat": 3750,
          "totalWithVAT": 18750,
          "deductionAmount": ${finalDeductionType !== 'none' ? '5000' : '0'},
          "deductionType": "${finalDeductionType}",
          ${finalDeductionType === 'rot' ? '"rotDeduction": 5000,' : ''}
          ${finalDeductionType === 'rut' ? '"rutDeduction": 5000,' : ''}
          "customerPays": ${finalDeductionType !== 'none' ? '13750' : '18750'}
        },
  "deductionType": "${finalDeductionType}",
  "notes": "Eventuella anteckningar eller villkor"
}

**VIKTIGT - SKATTEAVDRAGSTYP:**
Du MÅSTE inkludera exakt detta i ditt svar:
- "deductionType": "${finalDeductionType}"
${finalDeductionType === 'rot' ? '- Använd fältet "rotDeduction" för avdraget (INTE rutDeduction)' : ''}
${finalDeductionType === 'rut' ? '- Använd fältet "rutDeduction" för avdraget (INTE rotDeduction)' : ''}
${finalDeductionType === 'none' ? '- Inkludera INGET avdragsfält (varken rotDeduction eller rutDeduction)' : ''}

**═══════════════════════════════════════════════════════════════**
**KRITISKT - ROT/RUT-AVDRAG BERÄKNING (FÖLJ EXAKT!)**
**═══════════════════════════════════════════════════════════════**

${deductionPeriodText}

**ROT-AVDRAG (Renovering, Ombyggnad, Tillbyggnad):**
1. Beräkna arbetskostnad INKL moms: workCost × 1.25
2. ROT-avdrag = (workCost × 1.25) × ${deductionRate}
3. Max ${totalMaxRot} kr (${numberOfRecipients} ${numberOfRecipients === 1 ? 'person' : 'personer'} × ${maxRotPerPerson} kr/person)
4. Gäller ENDAST arbetskostnad, INTE material
5. Kund betalar: (workCost + materialCost) × 1.25 - rotDeduction

**EXEMPEL ROT (${numberOfRecipients} mottagare, ${deductionRate * 100}%):**
• Arbetskostnad: 40,000 kr (exkl moms)
• Arbetskostnad inkl moms: 40,000 × 1.25 = 50,000 kr
• ROT-avdrag (${deductionRate * 100}%): 50,000 × ${deductionRate} = ${Math.round(50000 * deductionRate)} kr
• Max-gräns: ${totalMaxRot} kr
• Faktiskt avdrag: ${Math.min(Math.round(50000 * deductionRate), totalMaxRot)} kr
• Material: 10,000 kr (× 1.25 = 12,500 kr inkl moms)
• Total inkl moms: 50,000 + 12,500 = 62,500 kr
• Kund betalar: 62,500 - ${Math.min(Math.round(50000 * deductionRate), totalMaxRot)} = ${62500 - Math.min(Math.round(50000 * deductionRate), totalMaxRot)} kr

**RUT-AVDRAG (Rengöring, Underhåll, Tvätt, Trädgård):**
1. Beräkna arbetskostnad INKL moms: workCost × 1.25
2. RUT-avdrag = (workCost × 1.25) × ${deductionRate}
3. Max ${totalMaxRut} kr (${numberOfRecipients} ${numberOfRecipients === 1 ? 'person' : 'personer'} × ${maxRutPerPerson} kr/person)
4. Gäller: Städning, trädgård, snöskottning, fönsterputsning
5. Kund betalar: (workCost + materialCost) × 1.25 - rutDeduction

**EXEMPEL RUT (${numberOfRecipients} mottagare, ${deductionRate * 100}%):**
• Arbetskostnad: 4,000 kr (exkl moms)
• Arbetskostnad inkl moms: 4,000 × 1.25 = 5,000 kr
• RUT-avdrag (${deductionRate * 100}%): 5,000 × ${deductionRate} = ${Math.round(5000 * deductionRate)} kr

**═══════════════════════════════════════════════════════════════**
**DITT UPPDRAG: SKAPA OFFERTEN NU**
**═══════════════════════════════════════════════════════════════**

Du har all information du behöver. Ditt jobb är att:

1. **ANALYSERA:** Förstå vad kunden vill ha gjort
2. **BERÄKNA:** Använd baseTotals som grund för alla siffror
3. **PRESENTERA:** Skapa en professionell, tydlig offert
4. **ANROPA:** create_quote med komplett data

**VIKTIGASTE REGLER:**

✅ **Använd EXAKT de siffror som finns i baseTotals:**
   • workCost: ${baseTotals.workCost} kr
   • materialCost: ${baseTotals.materialCost} kr
   • totalHours: ${baseTotals.totalHours}h

✅ **Detaljnivå "${detailLevel}":**
   • quick: 2-3 arbetsposter, 3-5 material
   • standard: 4-6 arbetsposter, 5-10 material  
   • detailed: 6-10 arbetsposter, 10-15 material

✅ **Matcha projektet:**
   • Offerten ska vara för: "${completeDescription}"
   • Om användaren sa "badrum" → gör badrumsoffert
   • Om användaren sa "altan" → gör altanoffert

❌ **GÖR INTE:**
   • Fråga om mer information (du har allt)
   • Avvika från baseTotals.workCost/materialCost med mer än 5%
   • Vänta eller tveka

**→ ANROPA create_quote NU med komplett offert**

**═══════════════════════════════════════════════════════════════**

• Max-gräns: ${totalMaxRut} kr
• Faktiskt avdrag: ${Math.min(Math.round(5000 * deductionRate), totalMaxRut)} kr
• Material: 500 kr (× 1.25 = 625 kr inkl moms)
• Total inkl moms: 5,000 + 625 = 5,625 kr
• Kund betalar: 5,625 - ${Math.min(Math.round(5000 * deductionRate), totalMaxRut)} = ${5625 - Math.min(Math.round(5000 * deductionRate), totalMaxRut)} kr

**KORREKT BERÄKNING I SUMMARY:**
{
  "workCost": 40000,           // Exkl moms
  "materialCost": 10000,       // Exkl moms
  "totalBeforeVAT": 50000,     // workCost + materialCost
  "vat": 12500,                // totalBeforeVAT × 0.25
  "totalWithVAT": 62500,       // totalBeforeVAT + vat
  "deductionAmount": ${Math.min(Math.round(50000 * deductionRate), totalMaxRot)},    // (workCost × 1.25) × ${deductionRate}
  "deductionType": "rot",
  "rotDeduction": ${Math.min(Math.round(50000 * deductionRate), totalMaxRot)},       // Samma som deductionAmount
  "customerPays": ${62500 - Math.min(Math.round(50000 * deductionRate), totalMaxRot)}        // totalWithVAT - rotDeduction
}

**FEL BERÄKNING (gör INTE så här!):**
{
  "deductionAmount": 12000,    // ❌ FEL: Använder workCost direkt (40000 × 0.30)
  "customerPays": 50500        // ❌ FEL: Blir fel totalt
}

**═══════════════════════════════════════════════════════════════**

**SKATTEAVDRAG:**
${deductionInfo}

${finalDeductionType !== 'none' ? `
VIKTIGT för ${finalDeductionType.toUpperCase()}-arbeten:
1. Var tydlig med vad som är arbetskostnad (avdragsgillt)
2. Material och utrustning är INTE avdragsgilla
3. Kunden får avdraget preliminärt direkt på fakturan
4. Visa tydligt i sammanfattningen: "Kund betalar efter ${finalDeductionType.toUpperCase()}-avdrag"
` : ''}

Viktig information:
- Använd realistiska svenska priser (2025)
- Använd de angivna timpriserna ovan för varje arbetsmoment
- Inkludera moms (25%)
- Specificera material och kvantiteter
- Var tydlig med vad som ingår och inte ingår`
          },
          {
            role: 'user',
            content: completeDescription // ✅ FIX 2: Använd HELA konversationen istället för bara senaste meddelandet
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error in main generation:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'För många förfrågningar. Försök igen om en stund.' }), 
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Tjänsten kräver betalning. Kontakta support.' }), 
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // For all other errors (400, 500, etc.) - use local fallback
      console.log('⚠️ AI Gateway error - using local quote builder as fallback');
      const fallbackQuote = buildFallbackQuote({
        description,
        baseTotals,
        detailLevel,
        hourlyRatesByType: baseTotals.hourlyRatesByType,
        finalDeductionType,
        deductionRate,
        totalMaxRot,
        totalMaxRut
      });
      
      // Skip to the final response with fallback quote
      return new Response(
        JSON.stringify({
          type: 'complete_quote',
          quote: fallbackQuote,
          customerId: customer_id,
          warnings: ['Offerten skapades i offline-läge på grund av ett tillfälligt fel i AI-tjänsten.']
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await response.json();
    
    // Extract quote from tool call response
    let generatedQuote;
    try {
      if (data.choices[0].message.tool_calls && data.choices[0].message.tool_calls[0]) {
        // Tool calling response format
        generatedQuote = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
      } else {
        // Fallback to old format if tool calling not used
        generatedQuote = JSON.parse(data.choices[0].message.content);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.log('⚠️ JSON parse error - using local quote builder as fallback');
      
      const fallbackQuote = buildFallbackQuote({
        description,
        baseTotals,
        detailLevel,
        hourlyRatesByType: baseTotals.hourlyRatesByType,
        finalDeductionType,
        deductionRate,
        totalMaxRot,
        totalMaxRut
      });
      
      return new Response(
        JSON.stringify({
          type: 'complete_quote',
          quote: fallbackQuote,
          customerId: customer_id,
          warnings: ['Offerten skapades i offline-läge på grund av ett tillfälligt fel i AI-tjänsten.']
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    // SANITY CHECK: Verify quote matches user's actual request
    console.log('🔍 Performing sanity check on generated quote...');
    
    const projectTypeCheck: Record<string, RegExp> = {
      målning: /målning|måla|färg|spackling|målare/i,
      altan: /altan|trall|uteplats|däck|spjäl/i,
      kök: /kök|köks|diskbänk|skåp|köksinredning/i,
      badrum: /badrum|kakel|dusch|toalett|wc|våtrum/i,
      tak: /tak|takläggning|takpannor|taktäckning|takrenovering/i,
      'trädfällning': /träd|fälla|fällning|arborist|stam/i
    };
    
    const userWanted = (conversation_history && conversation_history.length > 0 
      ? conversation_history.filter((m: any) => m.role === 'user').map((m: any) => m.content).join(' ')
      : description).toLowerCase();
    
    let expectedType: string | null = null;
    for (const [type, pattern] of Object.entries(projectTypeCheck)) {
      if (pattern.test(userWanted)) {
        expectedType = type;
        break;
      }
    }
    
    if (expectedType) {
      const quoteTitle = generatedQuote.title?.toLowerCase() || '';
      const workItemsText = generatedQuote.workItems?.map((w: any) => w.name + ' ' + w.description).join(' ').toLowerCase() || '';
      const materialsText = generatedQuote.materials?.map((m: any) => m.name).join(' ').toLowerCase() || '';
      const allQuoteText = quoteTitle + ' ' + workItemsText + ' ' + materialsText;
      
      const matchesExpectedType = projectTypeCheck[expectedType].test(allQuoteText);
      
      if (!matchesExpectedType) {
        console.error(`❌ KRITISKT FEL: Användaren bad om "${expectedType}" men offerten handlar om något annat!`);
        console.error(`Offertens innehåll: ${allQuoteText.substring(0, 200)}...`);
        console.error(`Användarens begäran: ${userWanted.substring(0, 200)}...`);
        
        return new Response(
          JSON.stringify({ 
            error: 'AI-kontextfel',
            message: `Tyvärr, AI:n skapade en offert för fel projekttyp. Du bad om "${expectedType}"-arbete men offerten verkar handla om något annat. Försök att omformulera din förfrågan mer specifikt.`,
            needsClarification: true,
            expectedType: expectedType,
            detectedContent: allQuoteText.substring(0, 100)
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      console.log(`✅ Sanity check OK: Offerten matchar förväntad projekttyp "${expectedType}"`);
    } else {
      console.log('ℹ️ Sanity check skipped: Kunde inte identifiera specifik projekttyp');
    }
    
    // POST-GENERATION VALIDATION & AUTO-REPAIR
    console.log('🔍 Performing post-generation validation...');
    
    const allWarnings: string[] = [];
    
    // Lägg till diameter-varning om diameter uppskattades automatiskt
    if (diameterWarning) {
      allWarnings.push(diameterWarning);
    }
    
    // Reality check - men fånga bara warnings, inga errors
    try {
      let realityCheckArea: number | undefined = undefined;
      const realityCheckAreaMatch = completeDescription.match(/(\d+(?:[.,]\d+)?)\s*(kvm|m2|kvadratmeter|kvadrat)/i);
      if (realityCheckAreaMatch) {
        realityCheckArea = parseFloat(realityCheckAreaMatch[1].replace(',', '.'));
      }
      
      const realityCheck = performRealityCheck(
        generatedQuote,
        completeDescription,
        realityCheckArea
      );
      
      if (realityCheck.warnings && realityCheck.warnings.length > 0) {
        console.log('⚠️ Reality check warnings:', realityCheck.warnings);
        allWarnings.push(...realityCheck.warnings);
      }
      
      console.log('✅ Reality check passed');
      
    } catch (error: any) {
      // AUTO-REPAIR: Istället för att fråga användaren, reparera tyst
      console.warn('⚠️ Reality check failed, auto-repairing quote:', error.message);
      
      console.log('🔧 Auto-repairing quote using fallback builder...');
      
      const repairedQuote = buildFallbackQuote({
        description: completeDescription,
        baseTotals,
        detailLevel,
        hourlyRatesByType: baseTotals.hourlyRatesByType,
        materialCost: baseTotals.materialCost,
        totalHours: baseTotals.totalHours,
        workCost: baseTotals.workCost,
        totalCost: baseTotals.totalCost,
        deductionType: finalDeductionType,
        deductionAmount: baseTotals.deductionAmount
      });
      
      allWarnings.push(`ℹ️ Offerten justerades automatiskt för korrekt kalkyl`);
      generatedQuote = repairedQuote;
    }
    
    // VALIDATION: Only mathematical validation (no retry loop)
    console.log('Validating quote output...');
    const validation = validateQuoteOutput(generatedQuote, baseTotals, baseTotals.hourlyRatesByType, detailLevel);
    
    let finalQuote = generatedQuote;
    
    if (!validation.valid) {
      console.error('Quote validation failed:', validation.errors);
      
      // Check if errors are minor and can be auto-corrected
      const hasOnlyMinorErrors = validation.errors.every(err => 
        err.includes('Material: Förväntade') || 
        err.includes('Notes ska vara') ||
        (err.includes('Ska ha') && err.includes('poster'))
      );
      
      if (hasOnlyMinorErrors) {
        console.log('→ Applying auto-correction for minor errors...');
        
        // Fix material cost if needed
        if (validation.errors.some(e => e.includes('Material: Förväntade'))) {
          const expectedMaterialCost = baseTotals.materialCost + baseTotals.equipmentCost;
          console.log(`→ Korrigerar materialkostnad till ${expectedMaterialCost} kr`);
          finalQuote.summary.materialCost = expectedMaterialCost;
          finalQuote.summary.totalBeforeVAT = finalQuote.summary.workCost + expectedMaterialCost;
          finalQuote.summary.vat = Math.round(finalQuote.summary.totalBeforeVAT * 0.25);
          finalQuote.summary.totalWithVAT = finalQuote.summary.totalBeforeVAT + finalQuote.summary.vat;
        }
        
        console.log('✅ Auto-correction applied');
      } else {
        // ✅ FIX 3: Major errors → Använd FALLBACK istället för att fråga igen
        console.error('❌ Major validation errors detected. Building fallback quote instead of asking again...');
        
        const fallbackQuote = buildFallbackQuote({
          description: completeDescription,
          baseTotals,
          detailLevel,
          hourlyRatesByType: baseTotals.hourlyRatesByType,
          finalDeductionType,
          deductionRate,
          totalMaxRot,
          totalMaxRut
        });
        
        // Replace finalQuote with fallback and add warning
        finalQuote = fallbackQuote;
        allWarnings.push('⚠️ Offerten skapades med automatisk korrigering på grund av valideringsfel i AI:ns ursprungliga utkast.');
        console.log('✅ Fallback quote created successfully');
      }
    }
    
    // Add deduction type to the quote
    finalQuote.deductionType = finalDeductionType;

    // Normalize deduction fields for consistent display
    if (finalDeductionType === 'rot') {
      // ROT deduction - använd dynamisk sats och max
      const workCostInclVAT = finalQuote.summary.workCost * 1.25;
      const calculatedRot = workCostInclVAT * deductionRate;
      finalQuote.summary.rotDeduction = Math.min(calculatedRot, totalMaxRot);
      finalQuote.summary.deductionAmount = finalQuote.summary.rotDeduction;
      finalQuote.summary.deductionType = 'rot';
      delete finalQuote.summary.rutDeduction;
      
      console.log(`✅ ROT (${deductionRate * 100}%): ${workCostInclVAT} kr × ${deductionRate} = ${calculatedRot} kr → begränsat till ${finalQuote.summary.rotDeduction} kr (max ${totalMaxRot} kr för ${numberOfRecipients} person${numberOfRecipients > 1 ? 'er' : ''})`);
    } else if (finalDeductionType === 'rut') {
      // RUT deduction - använd dynamisk sats och max
      const workCostInclVAT = finalQuote.summary.workCost * 1.25;
      const calculatedRut = workCostInclVAT * deductionRate;
      finalQuote.summary.rutDeduction = Math.min(calculatedRut, totalMaxRut);
      finalQuote.summary.deductionAmount = finalQuote.summary.rutDeduction;
      finalQuote.summary.deductionType = 'rut';
      delete finalQuote.summary.rotDeduction;
      
      console.log(`✅ RUT (${deductionRate * 100}%): ${workCostInclVAT} kr × ${deductionRate} = ${calculatedRut} kr → begränsat till ${finalQuote.summary.rutDeduction} kr (max ${totalMaxRut} kr för ${numberOfRecipients} person${numberOfRecipients > 1 ? 'er' : ''})`);
    } else {
      // No deduction
      finalQuote.summary.deductionAmount = 0;
      finalQuote.summary.deductionType = 'none';
      delete finalQuote.summary.rotDeduction;
      delete finalQuote.summary.rutDeduction;
    }
    
    console.log('Final quote summary after normalization:', finalQuote.summary);

    console.log('Generated quote successfully with detail level:', detailLevel);
    
    // Prepare response with quality indicators
    const responseData: any = {
      type: 'complete_quote',  // VIKTIGT: Lägg till type för frontend
      quote: finalQuote,
      hasCustomRates,
      hasEquipment,
      detailLevel,
      deductionType: finalDeductionType,
      usedReference: referenceQuotes.length > 0,
      referenceTitle: referenceQuotes[0]?.title || undefined,
      learningMetadata, // Include learning metadata for frontend
      warnings: allWarnings.length > 0 ? allWarnings : undefined, // Add reality check warnings
      reasoning: 'Offert genererad baserat på användarens information'
    };
    
    // Quality metadata (simplified - no warnings in new flow)

    return new Response(
      JSON.stringify(responseData),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in generate-quote:', error);
    return new Response(
      JSON.stringify({ error: "Ett fel uppstod vid generering av offert. Kontakta support om problemet kvarstår." }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// AI function to detect deduction type based on job description
async function detectDeductionType(description: string, apiKey: string): Promise<'rot' | 'rut' | 'none'> {
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Du är expert på svenska skatteregler för ROT och RUT-avdrag. Avgör om ett jobb klassificeras som ROT, RUT eller inget avdrag.

**ROT-arbeten (Reparation, Ombyggnad, Tillbyggnad):**
- Renovering av badrum, kök, våtrum
- Målning, måla om, tapetsering, spackling, väggmålning, fasadmålning
- Golvläggning, kakelläggning, plattsättning
- El- och VVS-installation som kräver byggarbete
- Värmepump, solpaneler, fönsterbyte
- Fasadrenovering, fasadarbeten, puts
- Takläggning, takbyte, takrenovering
- Tillbyggnad, ombyggnad av bostaden
- Altanbygge, trallbygge, uteplatser
- Installation av hiss
- Dränering runt huset
- KRÄVER OFTA SPECIALISTKUNSKAP OCH BYGGARBETE

**RUT-arbeten (Rengöring, Underhåll, Trädgård):**
- Städning (hemstädning, storstädning, trappstädning)
- Fönsterputs, rengöring
- Gräsklippning, snöskottning, ogräsrensning
- Trädfällning, häckklippning, trädgårdsskötsel
- Flyttjänster, flyttstädning
- Klädtvätt, matlagning (hemservice)
- IT-support i hemmet
- Reparation av vitvaror (diskmaskin, tvättmaskin, spis)
- Enkel reparation och underhåll som inte kräver bygglov
- SAKER SOM HUSHÅLL KAN GÖRA SJÄLVA

**Viktiga skillnader:**
- "Installera värmepump" = ROT (kräver byggarbete)
- "Rengöra värmepumpens filter" = RUT (underhåll)
- "Renovera badrum" = ROT (bygg och installation)
- "Städa badrum" = RUT (rengöring)
- "Måla fasad" = ROT (renovering av byggnad)
- "Tvätta fönster" = RUT (hemservice)
- "Bygga altandäck" = ROT (tillbyggnad)
- "Sopa och rensa däck" = RUT (underhåll)
- "Rensa stuprör" = RUT (underhåll)
- "Byta taket" = ROT (renovering)

Returnera ENDAST ett JSON-objekt med detta format:
{"type": "rot"} eller {"type": "rut"} eller {"type": "none"}`
          },
          {
            role: 'user',
            content: `Klassificera följande arbete: "${description}"`
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('AI detection failed, defaulting to ROT:', response.status, errorBody);
      return 'rot';
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    
    if (result.type === 'rot' || result.type === 'rut' || result.type === 'none') {
      return result.type;
    }
    
    console.warn('Invalid deduction type from AI, defaulting to ROT');
    return 'rot';
  } catch (error) {
    console.error('Error detecting deduction type:', error);
    return 'rot'; // Default fallback
  }
}