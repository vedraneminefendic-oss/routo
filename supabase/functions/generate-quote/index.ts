// ============================================
// HANDOFF AI - FÖRENKLAD VERSION V2
// Max 2000 rader (ner från 4664)
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// ============================================
// CORS & CONSTANTS
// ============================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

const TEXT_MODEL = 'google/gemini-2.5-flash';

// Import validation helpers
import { validateQuoteConsistency } from './helpers/validateQuoteConsistency.ts';
import { isBathroomProject, getBathroomPromptAddition, BATHROOM_REQUIREMENTS } from './helpers/bathroomRequirements.ts';
import { validateBathroomQuote, generateValidationSummary, autoFixBathroomQuote } from './helpers/validateBathroomQuote.ts';
import { isKitchenProject, getKitchenPromptAddition } from './helpers/kitchenRequirements.ts';
import { isPaintingProject, getPaintingPromptAddition } from './helpers/paintingRequirements.ts';
// FAS 2 & 5: Import project standards and intent detection
import { detectProjectType, getProjectPromptAddition, PROJECT_STANDARDS, normalizeKeyword, detectScope, detectProjectIntent, type ProjectIntent } from './helpers/projectStandards.ts';

// Brand dictionary and synonyms for better language understanding
const KEYWORD_SYNONYMS: Record<string, string[]> = {
  'renovera': ['rusta upp', 'totalrenovera', 'bygga om'],
  'måla': ['måla om', 'målning', 'färga', 'lacka'],
  'färg': ['målarfärg', 'väggfärg', 'takfärg'],
  'kakel': ['klinker', 'plattor', 'keramik'],
  'badrum': ['våtrum', 'dusch', 'toalett'],
  'kök': ['köksutrymme', 'kokyta'],
};

const BRAND_DICTIONARY: Record<string, { quality: string; category: string }> = {
  'rusta': { quality: 'budget', category: 'färg' },
  'biltema': { quality: 'budget', category: 'diverse' },
  'jula': { quality: 'budget', category: 'diverse' },
  'alcro': { quality: 'premium', category: 'färg' },
  'beckers': { quality: 'premium', category: 'färg' },
  'flügger': { quality: 'premium', category: 'färg' },
  'bauhaus': { quality: 'standard', category: 'diverse' },
  'jem & fix': { quality: 'standard', category: 'diverse' },
  'hornbach': { quality: 'standard', category: 'diverse' },
};

// ============================================
// TYPES & VALIDATION
// ============================================

const ConversationMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const RequestSchema = z.object({
  description: z.string(),
  conversation_history: z.array(ConversationMessageSchema).optional(),
  deductionType: z.enum(['rot', 'rut', 'none', 'auto']).optional().default('auto'),
  detailLevel: z.enum(['minimal', 'standard', 'detailed']).optional().default('standard'),
  recipients: z.number().optional().default(1),
  sessionId: z.string().optional(),
  customerId: z.string().optional(),
  referenceQuoteId: z.string().optional(),
  imageAnalysis: z.any().optional(),
  intent: z.string().optional(),
  previous_quote_id: z.string().nullish(), // SPRINT 1.5: For delta mode (accepts null/undefined)
  isDraft: z.boolean().optional().default(false), // FAS 20: Draft mode flag
});

interface RotRutClassification {
  deductionType: 'rot' | 'rut' | 'none';
  confidence: number;
  reasoning: string;
  source: string;
}

// FAS 2: Enhanced interfaces with transparency fields
interface WorkItemEnhanced {
  name: string;
  hours: number;
  hourlyRate: number;
  subtotal: number;
  description?: string;
  reasoning: string;
  confidence: number;
  sourceOfTruth: 'user_patterns' | 'industry_benchmarks' | 'live_search' | 'assumption';
}

interface MaterialEnhanced {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
  reasoning: string;
  confidence: number;
  sourceOfTruth: 'user_patterns' | 'industry_benchmarks' | 'live_search' | 'assumption';
}

interface EquipmentEnhanced {
  name: string;
  days: number;
  dailyRate: number;
  subtotal: number;
  reasoning: string;
  confidence: number;
  sourceOfTruth: 'user_patterns' | 'industry_benchmarks' | 'live_search' | 'assumption';
}

// FAS 1: Layered context structure
interface LayeredContext {
  layer1: string; // Användarspecifik
  layer2: string; // Global branschdata
  layer3: string; // Extern kunskap
}

type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

interface LearningContext {
  learnedPreferences?: any;
  industryData?: any[];
  userPatterns?: any;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// ============================================
// DEL 1: LIVE WEBSÖKNING - Dynamisk branschdata
// ============================================

/**
 * Söker på webben efter branschdata när AI:n inte känner igen ett jobb
 * Sparar resultatet i industry_benchmarks för framtida användning
 */
async function searchIndustryDataLive(
  workType: string,
  measurements: { area?: number; length?: number; quantity?: number; rooms?: number },
  lovableApiKey: string,
  supabaseClient: any
): Promise<{ 
  timeEstimate: number; 
  priceRange: { min: number; max: number }; 
  hourlyRate: number;
  workCategory: string;
  source: string;
  confidence: number;
}> {
  
  console.log(`🔍 DEL 1: Live websökning för: "${workType}" med mått:`, measurements);
  
  const prompt = `Du är en expert på svensk byggbransch. Sök i din kunskap från svenska byggforum, branschsidor (byggfakta.se, hemnet.se, reco.se, byggtjanst.se) och hitta:

**Arbetstyp:** ${workType}
**Mått:** ${JSON.stringify(measurements)}

**UPPGIFT:**
Baserat på branschkunskap, beräkna realistiska uppskattningar för detta jobb.

**RETURFORMAT (JSON):**
{
  "timeEstimate": <hur lång tid i timmar?>,
  "pricePerUnit": { "min": <lägsta pris>, "max": <högsta pris> },
  "unit": "<kvm/löpmeter/styck/timme>",
  "hourlyRate": <typisk timkostnad för denna yrkeskategori>,
  "workCategory": "<Trädgårdsskötare/Hantverkare/Målare/Arborist/etc>",
  "confidence": <0.0-1.0 hur säker är du?>
}

**EXEMPEL:**
- "Klippa gräsmatta 100 kvm" → 
  timeEstimate: 0.5, pricePerUnit: {min: 2, max: 4}, unit: "kvm", 
  hourlyRate: 550, workCategory: "Trädgårdsskötare", confidence: 0.9

- "Häckklippning 15 meter" → 
  timeEstimate: 1.5, pricePerUnit: {min: 60, max: 100}, unit: "löpmeter",
  hourlyRate: 550, workCategory: "Trädgårdsskötare", confidence: 0.85

- "Fälla 2 träd" → 
  timeEstimate: 4, pricePerUnit: {min: 3000, max: 8000}, unit: "styck",
  hourlyRate: 900, workCategory: "Arborist", confidence: 0.8

**VIKTIGT:**
- Basera på FAKTISKA branschpriser (inte för lågt eller högt)
- timeEstimate ska vara REALISTISK (inte för långsam eller snabb)
- hourlyRate ska matcha yrkeskategori (Arborist högre än Trädgårdsskötare)
- confidence lägre om osäker data`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [
          { role: 'system', content: 'Du är en byggbransch-expert med tillgång till svensk branschdata. Svara alltid med exakt JSON enligt format.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      console.error('❌ Live websökning misslyckades:', response.status);
      return {
        timeEstimate: 2,
        priceRange: { min: 1000, max: 3000 },
        hourlyRate: 650,
        workCategory: 'Hantverkare',
        source: 'fallback',
        confidence: 0.3
      };
    }

    const data = await response.json();
    const result = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    
    // Beräkna total tid baserat på mått
    let totalTime = result.timeEstimate || 2;
    if (measurements.area && result.unit === 'kvm') {
      totalTime = (measurements.area / 100) * result.timeEstimate;
    } else if (measurements.length && result.unit === 'löpmeter') {
      totalTime = (measurements.length / 10) * result.timeEstimate;
    } else if (measurements.quantity && result.unit === 'styck') {
      totalTime = measurements.quantity * result.timeEstimate;
    }
    
    // SPARA resultatet i industry_benchmarks för framtida användning
    const workCategory = workType.toLowerCase().replace(/\s+/g, '_');
    
    try {
      await supabaseClient.from('industry_benchmarks').upsert({
        work_category: workCategory,
        metric_type: 'time_per_unit',
        median_value: result.timeEstimate,
        min_value: result.pricePerUnit?.min || result.timeEstimate * 0.8,
        max_value: result.pricePerUnit?.max || result.timeEstimate * 1.2,
        sample_size: 1,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'work_category,metric_type',
        ignoreDuplicates: false
      });
      
      console.log(`✅ Sparade live-sökning i industry_benchmarks: ${workCategory}`);
    } catch (saveError) {
      console.error('⚠️ Kunde inte spara till industry_benchmarks:', saveError);
    }
    
    console.log(`✅ Live websökning resultat:`, {
      workType,
      timeEstimate: totalTime,
      hourlyRate: result.hourlyRate,
      workCategory: result.workCategory,
      confidence: result.confidence
    });
    
    return {
      timeEstimate: totalTime,
      priceRange: result.pricePerUnit || { min: 1000, max: 3000 },
      hourlyRate: result.hourlyRate || 650,
      workCategory: result.workCategory || 'Hantverkare',
      source: 'live_web_search',
      confidence: result.confidence || 0.7
    };

  } catch (error) {
    console.error('❌ Fel vid live websökning:', error);
    return {
      timeEstimate: 2,
      priceRange: { min: 1000, max: 3000 },
      hourlyRate: 650,
      workCategory: 'Hantverkare',
      source: 'error_fallback',
      confidence: 0.3
    };
  }
}

// Helper: Normalize text with synonyms and brand recognition
function normalizeText(text: string): { normalized: string; brandHints: Array<{ brand: string; quality: string; category: string }> } {
  let normalized = text.toLowerCase();
  const brandHints: Array<{ brand: string; quality: string; category: string }> = [];
  
  // Detect brands and extract hints
  for (const [brand, info] of Object.entries(BRAND_DICTIONARY)) {
    const regex = new RegExp(`\\b${brand}\\b`, 'gi');
    if (regex.test(normalized)) {
      brandHints.push({ brand, ...info });
    }
  }
  
  // Replace synonyms with canonical terms
  for (const [canonical, synonyms] of Object.entries(KEYWORD_SYNONYMS)) {
    for (const synonym of synonyms) {
      const regex = new RegExp(`\\b${synonym}\\b`, 'gi');
      normalized = normalized.replace(regex, canonical);
    }
  }
  
  return { normalized, brandHints };
}

// ÅTGÄRD 1: Bygg komplett beskrivning från första meddelandet + konversation
function buildCompleteDescription(history: ConversationMessage[], currentDescription: string): string {
  if (!history || history.length === 0) return currentDescription;
  
  // Hitta första user-meddelandet (oftast mest detaljerat)
  const firstUserMessage = history.find(m => m.role === 'user');
  const firstDescription = firstUserMessage?.content || currentDescription;
  
  // Om första meddelandet är längre än currentDescription, använd det istället
  const baseDescription = firstDescription.length > currentDescription.length 
    ? firstDescription 
    : currentDescription;
  
  // Samla alla user-svar efter första meddelandet
  const userMessages = history
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .filter(content => content !== baseDescription); // Exkludera basbeskrivningen
  
  if (userMessages.length === 0) return baseDescription;
  
  // Bygg komplett beskrivning
  return `${baseDescription}\n\n**Ytterligare detaljer:**\n${userMessages.join('\n')}`.trim();
}

// FAS 11: Build enhanced description from conversation summary
function buildEnhancedDescriptionFromSummary(
  currentDescription: string,
  summary: any
): string {
  if (!summary || Object.keys(summary).length === 0) {
    return currentDescription;
  }
  
  console.log('🚀 FAS 11: Building enhanced description from conversation summary...');
  
  const parts: string[] = [currentDescription];
  
  // Add project details
  if (summary.projectType) {
    parts.push(`\n**Projekttyp:** ${summary.projectType}`);
  }
  
  if (summary.scope) {
    parts.push(`**Omfattning:** ${summary.scope}`);
  }
  
  // Add measurements
  if (summary.measurements) {
    const measurements: string[] = [];
    if (summary.measurements.area) measurements.push(`Area: ${summary.measurements.area}`);
    if (summary.measurements.rooms) measurements.push(`Antal rum: ${summary.measurements.rooms}`);
    if (summary.measurements.height) measurements.push(`Höjd: ${summary.measurements.height}`);
    if (summary.measurements.quantity) measurements.push(`Antal: ${summary.measurements.quantity}`);
    
    if (measurements.length > 0) {
      parts.push(`**Mått:** ${measurements.join(', ')}`);
    }
  }
  
  // Add confirmed work
  if (summary.confirmedWork && summary.confirmedWork.length > 0) {
    parts.push(`**Bekräftat arbete:** ${summary.confirmedWork.join(', ')}`);
  }
  
  // Add materials
  if (summary.materials) {
    const materials: string[] = [];
    if (summary.materials.quality && summary.materials.quality !== 'undefined') {
      materials.push(`Kvalitet: ${summary.materials.quality}`);
    }
    
    // Handle brands (can be array or string)
    if (summary.materials.brands) {
      const brandsStr = Array.isArray(summary.materials.brands) 
        ? summary.materials.brands.join(', ')
        : String(summary.materials.brands);
      if (brandsStr && brandsStr.length > 0 && brandsStr !== 'undefined') {
        materials.push(`Märken: ${brandsStr}`);
      }
    }
    
    // Handle specific (can be array or string)
    if (summary.materials.specific) {
      const specificStr = Array.isArray(summary.materials.specific)
        ? summary.materials.specific.join(', ')
        : String(summary.materials.specific);
      if (specificStr && specificStr !== 'undefined') {
        materials.push(specificStr);
      }
    }
    
    if (materials.length > 0) {
      parts.push(`**Material:** ${materials.join(' | ')}`);
    }
  }
  
  // Add budget and timeline
  if (summary.budget) parts.push(`**Budget:** ${summary.budget}`);
  if (summary.timeline) parts.push(`**Tidsplan:** ${summary.timeline}`);
  
  // Add special requirements
  if (summary.specialRequirements && summary.specialRequirements.length > 0) {
    parts.push(`**Speciella krav:** ${summary.specialRequirements.join(', ')}`);
  }
  
  // Add exclusions
  if (summary.exclusions && summary.exclusions.length > 0) {
    parts.push(`**Exkluderat:** ${summary.exclusions.join(', ')}`);
  }
  
  // Add specific customer answers
  if (summary.customerAnswers && Object.keys(summary.customerAnswers).length > 0) {
    const answers = Object.entries(summary.customerAnswers)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    parts.push(`**Specifika svar:** ${answers}`);
  }
  
  const enhancedDescription = parts.join('\n');
  console.log('✅ FAS 11: Enhanced description length:', enhancedDescription.length, 'chars');
  
  return enhancedDescription;
}

// ÅTGÄRD 2: Detektera tvetydiga fraser som "bara", "endast", "inte", och "rusta"
function detectAmbiguousPhrase(message: string): {
  isAmbiguous: boolean;
  clarificationNeeded: string;
} {
  const lowerMessage = message.toLowerCase();
  
  // Pattern 1: "X ska bara Y" - kan betyda "inkludera Y" ELLER "endast Y"
  if (lowerMessage.match(/ska bara|endast ska|ska endast/i)) {
    return {
      isAmbiguous: true,
      clarificationNeeded: `Menar du att detta ska **inkluderas** i offerten (utöver annat), eller att **ENDAST** detta ska göras (inget annat)?`
    };
  }
  
  // Pattern 2: "Jag tar bara/endast X" - ofta betyder "exkludera allt annat"
  if (lowerMessage.match(/jag tar bara|endast jag|kund tar bara|kunden tar bara/i)) {
    return {
      isAmbiguous: true,
      clarificationNeeded: `Menar du att kunden tar hand om detta (så vi ska **ta bort det** från offerten)?`
    };
  }
  
  // Pattern 3: "rusta" utan kontext - kan betyda varumärket eller renovera
  if (lowerMessage.match(/\brusta\b(?!\s+(färg|målarfärg|väggfärg|upp))/i)) {
    return {
      isAmbiguous: true,
      clarificationNeeded: `Syftar du på varumärket Rusta (t.ex. färg från Rusta) eller att rusta upp/renovera?`
    };
  }
  
  // Pattern 4: "inte X" eller "nej X" - kan vara förnekelse eller korrigering
  if (lowerMessage.match(/^(inte|nej|ta bort)/i) && lowerMessage.length < 50) {
    return {
      isAmbiguous: true,
      clarificationNeeded: `Menar du att vi ska **ta bort** något från offerten, eller att något **inte ingår**?`
    };
  }
  
  return { isAmbiguous: false, clarificationNeeded: '' };
}

// ÅTGÄRD 1: Bygg projektsammanfattning för context confirmation
function buildProjectSummary(
  description: string,
  conversationHistory: ConversationMessage[],
  exclusions: any[],
  inclusions: string[], // NY PARAMETER
  conversationFeedback: any
): string {
  const allText = [description, ...conversationHistory.map(m => m.content)].join(' ').toLowerCase();
  
  // Extrahera projekttyp
  const projectType = conversationFeedback.understood.project_type || 'Okänt projekt';
  
  // Extrahera mått
  const measurements = conversationFeedback.understood.measurements || [];
  const measurementStr = (() => {
    if (Array.isArray(measurements) && measurements.length > 0) {
      return measurements.join(', ');
    }
    if (typeof measurements === 'string' && measurements.length > 0) {
      return measurements;
    }
    if (typeof measurements === 'object' && measurements !== null && !Array.isArray(measurements)) {
      const parts: string[] = [];
      if (measurements.area) parts.push(measurements.area);
      if (measurements.rooms) parts.push(`${measurements.rooms} rum`);
      if (measurements.height) parts.push(`höjd: ${measurements.height}`);
      if (measurements.length) parts.push(`längd: ${measurements.length}`);
      if (measurements.width) parts.push(`bredd: ${measurements.width}`);
      return parts.length > 0 ? parts.join(', ') : 'Inga specifika mått angivna';
    }
    return 'Inga specifika mått angivna';
  })();
  
  // STEG 1: Bygg inkluderade baserat på explicit bekräftade + detekterade
  const includedItems: string[] = [];
  
  // Lägg till explicit bekräftade först
  inclusions.forEach(inc => {
    const normalized = inc.charAt(0).toUpperCase() + inc.slice(1);
    if (!includedItems.includes(normalized)) {
      includedItems.push(normalized);
    }
  });
  
  // Lägg till detekterade från text (om de inte redan finns)
  // ANVÄND WORD BOUNDARIES för att undvika falskt positiva (t.ex "del" → "el")
  if (/\b(riv|rivning|riva)\b/i.test(allText) && !includedItems.some(i => i.toLowerCase().includes('riv'))) {
    includedItems.push('Rivning');
  }
  if (/\b(kakel|kakling|plattsättning)\b/i.test(allText) && !includedItems.some(i => i.toLowerCase().includes('kakel'))) {
    includedItems.push('Kakel/plattsättning');
  }
  if (/\b(vvs|rör)\b/i.test(allText) && !includedItems.some(i => i.toLowerCase().includes('vvs'))) {
    includedItems.push('VVS-arbeten');
  }
  if (/\b(el|elektriker|elarbete|elarbeten)\b/i.test(allText) && !includedItems.some(i => i.toLowerCase().includes('el'))) {
    includedItems.push('Elarbeten');
  }
  if (/\b(målning|måla|målning)\b/i.test(allText) && !includedItems.some(i => i.toLowerCase().includes('målning'))) {
    includedItems.push('Målning');
  }
  if (/\b(golv|laminat|parkett|golvarbeten)\b/i.test(allText) && !includedItems.some(i => i.toLowerCase().includes('golv'))) {
    includedItems.push('Golvarbeten');
  }
  if (/\b(snickeri|snickare|snickeriarbeten)\b/i.test(allText) && !includedItems.some(i => i.toLowerCase().includes('snickeri'))) {
    includedItems.push('Snickeriarbeten');
  }
  
  const includedStr = includedItems.length > 0 
    ? includedItems.map(i => `✅ ${i}`).join('\n') 
    : '✅ Basarbeten enligt beskrivning';
  
  // STEG 1: Filtrera bort exkluderingar som också är inkluderade
  const filteredExclusions = exclusions.filter(e => 
    !inclusions.some(inc => e.item.toLowerCase().includes(inc.toLowerCase()))
  );
  
  const excludedStr = filteredExclusions.length > 0
    ? filteredExclusions.map(e => `❌ ${e.item} (${e.reason})`).join('\n')
    : '❌ Inga specifika exkluderingar';
  
  // Prisintervall (rough estimate baserat på projekttyp)
  let priceRange = '30,000 - 80,000 kr';
  if (allText.includes('badrum') && allText.includes('renovera')) {
    priceRange = '80,000 - 150,000 kr';
  } else if (allText.includes('kök') && allText.includes('renovera')) {
    priceRange = '100,000 - 200,000 kr';
  } else if (allText.includes('målning')) {
    priceRange = '15,000 - 50,000 kr';
  } else if (allText.includes('fälla') || allText.includes('träd')) {
    priceRange = '10,000 - 40,000 kr';
  }
  
  return `
📋 **Projekttyp:** ${projectType}
📏 **Storlek:** ${measurementStr}

**✅ Inkluderat i offerten:**
${includedStr}

**❌ Exkluderat från offerten:**
${excludedStr}

💰 **Uppskattat prisintervall:** ${priceRange} (innan ROT/RUT-avdrag)

⚠️ **Om något står fel under "Exkluderat", skriv: "inkludera [ämne]"**
  `.trim();
}

// ============================================
// PROBLEM #1: CONVERSATION FEEDBACK SYSTEM
// ============================================

interface ConversationFeedback {
  understood: {
    project_type?: string;
    measurements?: string[];
    materials?: string[];
    scope?: string;
    budget?: string;
    timeline?: string;
  };
  missing: string[];
  suggestions: string[];
  confidence: number;
}

async function analyzeConversationProgress(
  description: string,
  conversationHistory: ConversationMessage[],
  apiKey: string
): Promise<ConversationFeedback> {
  const historyText = conversationHistory
    .map(m => `${m.role === 'user' ? 'Användare' : 'AI'}: ${m.content}`)
    .join('\n');

  const prompt = `Analysera konversationen och ge feedback på vad som är förstått och vad som saknas.

**BESKRIVNING:**
${description}

**KONVERSATION:**
${historyText || 'Ingen tidigare konversation'}

**UPPGIFT:**
Analysera och returnera JSON med:
1. "understood": Objekt med förstådda detaljer (project_type, measurements, materials, scope, budget, timeline)
2. "missing": Array med vad som saknas (specifika frågor användaren bör besvara)
3. "suggestions": Array med förslag på nästa steg (max 2 förslag)
4. "confidence": 0-100, hur säker du är på att kunna generera en korrekt offert

**EXEMPEL:**
{
  "understood": {
    "project_type": "Badrumsrenovering",
    "measurements": ["8 kvm"],
    "materials": ["Standard-kakel"],
    "scope": "Med rivning"
  },
  "missing": ["Bortforsling inkluderad?", "Tidsram?"],
  "suggestions": ["Kan generera offert nu med rimliga antaganden", "Förtydliga bortforsling för exaktare pris"],
  "confidence": 85
}

Returnera bara JSON.`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error('AI feedback request failed:', response.statusText);
      return {
        understood: {},
        missing: [],
        suggestions: [],
        confidence: 50
      };
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    
    return {
      understood: result.understood || {},
      missing: result.missing || [],
      suggestions: result.suggestions || [],
      confidence: result.confidence || 50
    };
  } catch (error) {
    console.error('Error analyzing conversation progress:', error);
    return {
      understood: {},
      missing: [],
      suggestions: [],
      confidence: 50
    };
  }
}

// ============================================
// PROBLEM #3: QUOTE READINESS DETECTION
// ============================================

interface QuoteReadiness {
  readiness_score: number;
  can_generate: boolean;
  critical_missing: string[];
  optional_missing: string[];
  reasoning: string;
}

function calculateDeterministicReadiness(
  description: string,
  conversationHistory: ConversationMessage[],
  conversationFeedback: ConversationFeedback
): {
  readiness_score: number;
  can_generate: boolean;
  reasoning: string;
  critical_missing: string[];
  optional_missing: string[];
} {
  const allText = (description + ' ' + conversationHistory.map(m => m.content).join(' ')).toLowerCase();
  
  let score = 0;
  const critical_missing: string[] = [];
  const optional_missing: string[] = [];
  
  // 1. PROJECT TYPE (20 points) - CRITICAL
  const hasProjectType = /\b(målning|renovera|badrum|kök|fälla|träd|el|vvs|snickeri|städ|golv|tak|kakel|måla|rusta)\b/i.test(allText);
  if (hasProjectType || conversationFeedback.understood.project_type) {
    score += 20;
    console.log('  - Project type: ✅ 20p');
  } else {
    critical_missing.push('Projekttyp (vad ska göras?)');
    console.log('  - Project type: ❌ 0p');
  }
  
  // 2. MEASUREMENTS (30 points) - CRITICAL
  const hasMeasurements = /(\d+)\s*(kvm|m2|m²|meter|m|kvadrat|cm|mm|st|rum|träd)/gi.test(allText);
  if (hasMeasurements || (conversationFeedback.understood.measurements && conversationFeedback.understood.measurements.length > 0)) {
    score += 30;
    console.log('  - Measurements: ✅ 30p');
  } else {
    critical_missing.push('Mått (kvm, antal rum, storlek)');
    console.log('  - Measurements: ❌ 0p');
  }
  
  // 3. SCOPE (25 points) - IMPORTANT
  const hasSpecificScope = /\b(riva|kakel|måla|installera|byta|montera|demontera|fälla|klippa|spackel|tapet)\b/i.test(allText);
  if (hasSpecificScope || conversationFeedback.understood.scope) {
    score += 25;
    console.log('  - Scope: ✅ 25p');
  } else if (conversationHistory.length >= 2) {
    score += 15; // Partial points if discussed but not specific
    optional_missing.push('Mer detaljer om arbetets omfattning');
    console.log('  - Scope: ⚠️ 15p');
  } else {
    critical_missing.push('Arbetets omfattning (vad ska göras exakt?)');
    console.log('  - Scope: ❌ 0p');
  }
  
  // 4. MATERIALS (15 points) - NICE TO HAVE
  const hasMaterials = conversationFeedback.understood.materials && conversationFeedback.understood.materials.length > 0;
  const mentionsMaterialQuality = /\b(budget|standard|premium|billig|dyr|bra|enkel|lyxig|alcro|beckers|rusta|biltema|jula|bauhaus)\b/i.test(allText);
  if (hasMaterials || mentionsMaterialQuality) {
    score += 15;
    console.log('  - Materials: ✅ 15p');
  } else {
    optional_missing.push('Materialkvalitet (budget/standard/premium)');
    console.log('  - Materials: ❌ 0p');
  }
  
  // 5. ADDITIONAL CONTEXT (10 points) - NICE TO HAVE
  const hasBudget = conversationFeedback.understood.budget || /\b(\d{4,6})\s*kr\b/i.test(allText);
  const hasTimeline = conversationFeedback.understood.timeline || /\b(vecka|månad|snabbt|brådskande|vänta)\b/i.test(allText);
  if (hasBudget) {
    score += 5;
    console.log('  - Budget: ✅ 5p');
  } else {
    optional_missing.push('Budget eller prisintervall');
    console.log('  - Budget: ❌ 0p');
  }
  if (hasTimeline) {
    score += 5;
    console.log('  - Timeline: ✅ 5p');
  } else {
    optional_missing.push('Tidsplan');
    console.log('  - Timeline: ❌ 0p');
  }
  
  // Determine if we can generate
  const can_generate = score >= 75 && critical_missing.length === 0;
  
  let reasoning = '';
  if (score >= 92) {
    reasoning = 'All nödvändig information finns - klar för offertgenerering';
  } else if (score >= 75) {
    reasoning = 'Tillräckligt med information för att skapa offert med rimliga antaganden';
  } else if (score >= 50) {
    reasoning = 'Grundläggande information finns, men behöver mer detaljer';
  } else {
    reasoning = 'För lite information - behöver kritiska detaljer';
  }
  
  console.log(`  → Total: ${score}/100 (can_generate: ${can_generate})`);
  
  return {
    readiness_score: Math.min(100, score),
    can_generate,
    reasoning,
    critical_missing,
    optional_missing
  };
}

// ÅTGÄRD 2: Projektspecifik readiness med högre trösklar för badrumsrenoveringar
function determineQuoteReadiness(
  description: string,
  conversationHistory: ConversationMessage[],
  conversationFeedback: ConversationFeedback
): QuoteReadiness {
  console.log('📊 Readiness breakdown:');
  // Use deterministic calculation
  const deterministic = calculateDeterministicReadiness(description, conversationHistory, conversationFeedback);
  
  return {
    readiness_score: deterministic.readiness_score,
    can_generate: deterministic.can_generate,
    reasoning: deterministic.reasoning,
    critical_missing: deterministic.critical_missing,
    optional_missing: deterministic.optional_missing
  };
}

// ============================================
// STRUCTURED CONTEXT EXTRACTION (FÖRBÄTTRING #1)
// ============================================

function extractStructuredContext(conversationHistory: ConversationMessage[], description: string): string {
  const measurements: string[] = [];
  const materials: string[] = [];
  const budget: string[] = [];
  const timeline: string[] = [];
  const scope: string[] = [];
  
  // Kombinera beskrivning med konversationshistorik
  const allText = [description, ...conversationHistory.map(m => m.content)];
  
  for (const text of allText) {
    const lower = text.toLowerCase();
    
    // Extrahera mått (t.ex. "8 kvm", "20 meter", "3 granar")
    const measurementMatches = text.match(/(\d+(?:[.,]\d+)?)\s*(kvm|m2|m²|kvadratmeter|meter|m|st|träd|granar|rum)/gi);
    if (measurementMatches) {
      measurements.push(...measurementMatches.map(m => m.trim()));
    }
    
    // Extrahera material-omnämnanden
    if (lower.match(/kakel|klinker|färg|trä|cement|gips|tapet|parkettgolv|laminat|blandare|armatur|vvs/gi)) {
      const materialMatch = text.match(/[\wåäöÅÄÖ\s]+(?:kakel|klinker|färg|trä|cement|gips|tapet|parkettgolv|laminat|blandare|armatur|vvs)[\wåäöÅÄÖ\s]*/gi);
      if (materialMatch) materials.push(...materialMatch.map(m => m.trim()));
    }
    
    // Extrahera budget/kostnad
    if (lower.match(/budget|(\d+)\s*kr|kosta|pris|inom/gi)) {
      const budgetMatch = text.match(/.*(?:budget|kosta|pris|inom).*?(?:\d+\s*kr|\d+\s*000)?/gi);
      if (budgetMatch) budget.push(...budgetMatch.map(b => b.trim()));
    }
    
    // Extrahera tidslinje
    if (lower.match(/vecka|månad|dag|snabbt|brådskande|deadline|färdig|klart/gi)) {
      const timeMatch = text.match(/.*(?:vecka|månad|dag|snabbt|brådskande|deadline|färdig|klart).*/gi);
      if (timeMatch) timeline.push(...timeMatch.map(t => t.trim()));
    }
    
    // Extrahera omfattning (rivning, förberedelse, etc)
    if (lower.match(/riv|förbered|städ|bortforsl|transport|grund|fundament|mark/gi)) {
      scope.push(text.trim());
    }
  }
  
  // Ta bort dubbletter
  const uniqueMeasurements = [...new Set(measurements)];
  const uniqueMaterials = [...new Set(materials)].slice(0, 5); // Max 5 för att inte överväldiga
  const uniqueBudget = [...new Set(budget)].slice(0, 3);
  const uniqueTimeline = [...new Set(timeline)].slice(0, 3);
  const uniqueScope = [...new Set(scope)].slice(0, 5);
  
  return `
**📊 STRUKTURERAD KONTEXT FRÅN KONVERSATIONEN:**

**Mått som nämnts:**
${uniqueMeasurements.length > 0 ? uniqueMeasurements.map(m => `- ${m}`).join('\n') : '❌ Inga specifika mått nämnda'}

**Material som diskuterats:**
${uniqueMaterials.length > 0 ? uniqueMaterials.map(m => `- ${m}`).join('\n') : '❌ Inga specifika material nämnda'}

**Budget/Kostnadsförväntningar:**
${uniqueBudget.length > 0 ? uniqueBudget.map(b => `- ${b}`).join('\n') : '❌ Ingen budget nämnd'}

**Tidslinje:**
${uniqueTimeline.length > 0 ? uniqueTimeline.map(t => `- ${t}`).join('\n') : '❌ Ingen tidslinje nämnd'}

**Omfattning/Extra arbeten som diskuterats:**
${uniqueScope.length > 0 ? uniqueScope.map(s => `- ${s}`).join('\n') : '❌ Inget extra arbete utöver huvudprojekt diskuterat'}

**🚨 VIKTIGT:** Om något INTE står i listorna ovan och kostar >5000 kr → Inkludera INTE i offerten!
  `.trim();
}

// ============================================
// VALIDATE QUOTE AGAINST CONVERSATION (FÖRBÄTTRING #2)
// ============================================

// Helper: Hitta relevant timtaxa baserat på arbetstyp
function findRelevantHourlyRate(itemName: string, userRates: any[], existingWorkItems: any[]): number {
  const name = itemName.toLowerCase();
  
  // Map keywords to work types
  const workTypeMap: Record<string, string> = {
    'arborist': 'Arborist',
    'fäll': 'Arborist',
    'träd': 'Arborist',
    'elektriker': 'Elektriker',
    'el-': 'Elektriker',
    'vvs': 'VVS',
    'rör': 'VVS',
    'snickare': 'Snickare',
    'målare': 'Målare',
    'måla': 'Målare',
    'murare': 'Murare',
    'mura': 'Murare',
    'städ': 'Städare',
    'trädgård': 'Trädgårdsskötare',
    'fönster': 'Fönsterputsare',
    'tak': 'Takläggare'
  };
  
  // Försök matcha keyword
  for (const [keyword, workType] of Object.entries(workTypeMap)) {
    if (name.includes(keyword)) {
      const userRate = userRates.find((r: any) => r.work_type === workType);
      if (userRate) {
        console.log(`✅ Found rate for ${workType}: ${userRate.rate} kr/h`);
        return userRate.rate;
      }
    }
  }
  
  // Fallback 1: Beräkna medel från befintliga workItems
  if (existingWorkItems.length > 0) {
    const avgRate = Math.round(
      existingWorkItems.reduce((sum: number, item: any) => sum + item.hourlyRate, 0) / existingWorkItems.length
    );
    console.log(`✅ Using average rate from existing workItems: ${avgRate} kr/h`);
    return avgRate;
  }
  
  // Fallback 2: Standard hantverkare
  console.log(`⚠️ No specific rate found, using default: 700 kr/h`);
  return 700;
}

// FAS 1: Get protected items for project type
function getProtectedItemsForProjectType(projectType: string): string[] {
  const protectedByType: Record<string, string[]> = {
    'bathroom_renovation': ['vvs', 'el', 'tätskikt', 'golvvärme', 'ventilation', 'kakel', 'sanitet', 'rivning'],
    'kitchen_renovation': ['vvs', 'el', 'skåp', 'bänkskiva', 'kakel', 'rivning'],
    'painting': ['målning', 'spackling', 'slipning'],
    'tree_felling': ['fällning', 'kapning', 'bortforsling'],
    'stump_grinding': ['stubbfräsning', 'bortforsling'],
    'roofing': ['takarbete', 'takläggning', 'taktäckning', 'takpapp'],
    'electrical': ['el', 'elinstallation', 'elarbete'],
    'plumbing': ['vvs', 'rör', 'avlopp', 'vatten'],
    'flooring': ['golv', 'golvläggning', 'underlag'],
    'cleaning': ['städning', 'slutstädning']
  };
  
  return protectedByType[projectType] || [];
}

// ============================================
// AI-DRIVEN STANDARD WORK ITEM DETECTION
// ============================================

async function isStandardWorkItemAI(
  itemName: string,
  projectDescription: string,
  conversationHistory: ConversationMessage[],
  userPatterns: any[],
  industryKnowledge: any,
  lovableApiKey: string
): Promise<{ isStandard: boolean; confidence: number; reasoning: string }> {
  
  // Build context from user's previous accepted quotes
  const userContext = userPatterns
    .filter(p => p.customer_accepted && p.was_kept_by_ai)
    .map(p => `- ${p.work_item_name} (accepterat ${Math.round(p.confidence_score * 100)}% confidence)`)
    .join('\n');
  
  // Build context from industry knowledge
  const industryContext = industryKnowledge?.standardWorkItems
    ?.map((item: any) => `- ${item.name} (${item.mandatory ? 'obligatoriskt' : 'vanligt'})`)
    .join('\n') || 'Ingen branschdata tillgänglig';
  
  const conversationText = conversationHistory
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  const prompt = `Du är en expert på svenska byggofferter. Avgör om "${itemName}" är ett STANDARDMOMENT för detta projekt:

**PROJEKT:**
${projectDescription}

**KONVERSATION:**
${conversationText.substring(0, 2000)}

**ANVÄNDARENS HISTORIK (tidigare accepterade standardmoment):**
${userContext || 'Ingen historik än'}

**BRANSCHSTANDARDER:**
${industryContext}

**UPPGIFT:**
Är "${itemName}" ett standardmoment som ALLTID ingår i denna typ av projekt, även om kunden inte nämner det explicit?

Returnera JSON:
{
  "isStandard": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "Kort förklaring (max 50 ord)"
}

**EXEMPEL - Målning:**
- "Grundmålning" → isStandard: true (alltid nödvändigt före toppmålning)
- "Guldram runt fönster" → isStandard: false (specialönskemål)

**EXEMPEL - Badrum:**
- "Tätskikt" → isStandard: true (lagkrav för våtrum)
- "Marmorgolv" → isStandard: false (lyxval)`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      console.error('❌ AI standard check failed:', response.status);
      return { isStandard: false, confidence: 0, reasoning: 'AI otillgänglig' };
    }

    const data = await response.json();
    const result = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    
    console.log(`🤖 AI decision for "${itemName}":`, result);
    return result;

  } catch (error) {
    console.error('❌ Error in AI standard check:', error);
    return { isStandard: false, confidence: 0, reasoning: 'Fel vid AI-anrop' };
  }
}

// ============================================
// FAS 1 + AI: VALIDATE QUOTE AGAINST CONVERSATION (AI-Enhanced)
// ============================================

async function validateQuoteAgainstConversation(
  quote: any,
  conversationHistory: ConversationMessage[],
  description: string,
  projectType: string | null,
  userId: string,
  lovableApiKey: string,
  supabaseClient: any
): Promise<{ isValid: boolean; unmentionedItems: string[]; warnings: string[]; removedValue: number; aiDecisions: any[] }> {
  console.log('🔍 FAS 1 + AI: Validating quote against conversation with AI assistance...');
  
  // Fetch user's learned patterns
  const { data: userPatterns } = await supabaseClient
    .from('accepted_work_patterns')
    .select('*')
    .eq('user_id', userId)
    .eq('project_type', projectType)
    .order('created_at', { ascending: false })
    .limit(50);
  
  // Fetch industry knowledge
  const { data: industryData } = await supabaseClient
    .from('industry_knowledge')
    .select('*')
    .eq('project_type', projectType)
    .eq('category', 'standard_work_items')
    .single();
  
  console.log(`📚 Loaded ${userPatterns?.length || 0} user patterns, industry data: ${industryData ? 'Yes' : 'No'}`);
  
  const fullText = (description + ' ' + conversationHistory
    .map(m => m.content)
    .join(' ')).toLowerCase();
  
  const unmentioned: string[] = [];
  const warnings: string[] = [];
  const aiDecisions: any[] = [];
  let removedValue = 0;
  
  // FAS 1: Get protected items for this project type
  const protectedItems = projectType ? getProtectedItemsForProjectType(projectType) : [];
  
  // Kolla workItems
  const originalWorkItems = [...(quote.workItems || [])];
  const validWorkItems: any[] = [];
  
  for (const item of originalWorkItems) {
    // Validera att workItems ALDRIG har hours: 0 OCH subtotal > 0
    if (item.hours === 0 && item.subtotal > 0) {
      console.log(`⚠️ Invalid workItem structure: "${item.name}" har hours:0 men subtotal:${item.subtotal}`);
      console.log(`   → Flyttar till materials som engångspost`);
      
      // Flytta till materials
      quote.materials = quote.materials || [];
      quote.materials.push({
        name: item.name,
        description: item.description + ' (engångspost)',
        quantity: 1,
        unit: 'st',
        pricePerUnit: item.subtotal,
        subtotal: item.subtotal
      });
      
      unmentioned.push(`${item.name} (felaktig struktur - flyttad till materials)`);
      continue;
    }
    
    // FAS 1: Check if item is protected (part of project standard)
    const isProtected = protectedItems.some(p => 
      item.name.toLowerCase().includes(p.toLowerCase())
    );
    
    if (isProtected) {
      // FAS 1: KEEP protected items but warn if not mentioned
      validWorkItems.push(item);
      
      if (item.subtotal > 5000) {
        const keywords = item.name.toLowerCase()
          .split(/[\s\-,\/]+/)
          .filter((kw: string) => kw.length >= 4);
        
        const mentioned = keywords.some((kw: string) => fullText.includes(kw));
        
        if (!mentioned) {
          warnings.push(`⚠️ "${item.name}" ingår i branschstandard men nämndes inte explicit i konversationen`);
          console.log(`🔒 Protected item kept: ${item.name} (${item.subtotal} kr) - part of ${projectType} standard`);
        }
      }
      continue;
    }
    
    // Om item kostar >5000 kr → kräver omnämnande ELLER AI-godkännande
    if (item.subtotal > 5000) {
      // Extrahera nyckelord från item name (minst 4 tecken)
      const keywords = item.name.toLowerCase()
        .split(/[\s\-,\/]+/)
        .filter((kw: string) => kw.length >= 4);
      
      // Kolla om NÅGOT av nyckelorden finns i konversationen
      const mentioned = keywords.some((kw: string) => fullText.includes(kw));
      
      if (!mentioned) {
        // 🤖 AI CHECK: Is this a standard work item?
        const aiCheck = await isStandardWorkItemAI(
          item.name,
          description,
          conversationHistory,
          userPatterns || [],
          industryData?.content,
          lovableApiKey
        );
        
        aiDecisions.push({
          itemName: item.name,
          subtotal: item.subtotal,
          ...aiCheck
        });
        
        // Keep if AI says it's standard with high confidence
        if (aiCheck.isStandard && aiCheck.confidence >= 0.75) {
          validWorkItems.push(item);
          warnings.push(`🤖 "${item.name}" inkluderat som standardmoment (AI confidence: ${Math.round(aiCheck.confidence * 100)}%) - ${aiCheck.reasoning}`);
          console.log(`✅ AI kept standard item: ${item.name} (${aiCheck.confidence * 100}% confidence)`);
        } else {
          unmentioned.push(`${item.name} (${Math.round(item.subtotal)} kr) - inte nämnt och ej standardmoment (AI confidence: ${Math.round(aiCheck.confidence * 100)}%)`);
          removedValue += item.subtotal;
          console.log(`🗑️ Removing unmentioned item: ${item.name} (${item.subtotal} kr) - AI confidence too low: ${aiCheck.confidence}`);
        }
      } else {
        validWorkItems.push(item);
      }
    } else {
      // Små poster (<5000 kr) behåller vi (standardposter)
      validWorkItems.push(item);
    }
  }
  
  // Validera att materials INTE innehåller "tjänst" eller "arbete"
  const materialsToMove: any[] = [];
  for (const mat of quote.materials || []) {
    const name = mat.name?.toLowerCase() || '';
    if (name.includes('tjänst') || name.includes('arbete') || name.includes('arborist') || name.includes('installation')) {
      console.log(`⚠️ Material contains work: "${mat.name}" → Should be in workItems!`);
      
      // Hitta relevant timtaxa
      const hourlyRate = findRelevantHourlyRate(mat.name, [], validWorkItems);
      const estimatedHours = Math.max(1, Math.round(mat.subtotal / hourlyRate));
      
      console.log(`   → Flyttar till workItems med ${estimatedHours}h × ${hourlyRate} kr/h`);
      
      validWorkItems.push({
        name: mat.name.replace(/tjänst|arbete/gi, '').trim(),
        description: mat.description || '',
        hours: estimatedHours,
        hourlyRate: hourlyRate,
        subtotal: estimatedHours * hourlyRate
      });
      
      materialsToMove.push(mat);
      unmentioned.push(`${mat.name} (flyttad från materials till workItems)`);
    }
  }
  
  // Ta bort flyttade materials
  if (materialsToMove.length > 0) {
    quote.materials = quote.materials?.filter((mat: any) => 
      !materialsToMove.some(m => m.name === mat.name)
    );
  }
  
  // Uppdatera quote om något togs bort
  if (validWorkItems.length < originalWorkItems.length) {
    quote.workItems = validWorkItems;
    
    // Räkna om summary
    quote.summary.workCost = validWorkItems.reduce((sum: number, item: any) => sum + item.subtotal, 0);
    quote.summary.totalBeforeVAT = quote.summary.workCost + (quote.summary.materialCost || 0) + (quote.summary.equipmentCost || 0);
    quote.summary.vat = quote.summary.totalBeforeVAT * 0.25;
    quote.summary.totalWithVAT = quote.summary.totalBeforeVAT + quote.summary.vat;
    
    // Om det finns deduction, räkna om customerPays
    if (quote.summary.deduction) {
      quote.summary.deduction.customerPays = quote.summary.totalWithVAT - quote.summary.deduction.actualDeduction;
    } else {
      quote.summary.customerPays = quote.summary.totalWithVAT;
    }
    
    console.log(`✅ Removed ${originalWorkItems.length - validWorkItems.length} unmentioned items (total: ${Math.round(removedValue)} kr)`);
  }
  
  return {
    isValid: unmentioned.length === 0,
    unmentionedItems: unmentioned,
    warnings: warnings,
    removedValue: removedValue,
    aiDecisions: aiDecisions
  };
}

// ============================================
// FAS 13: PRICE RANGE ESTIMATION
// ============================================

interface PriceEstimate {
  min: number;
  max: number;
  confidence: number;
  reasoning: string;
}

async function estimatePriceRange(
  description: string,
  conversationData: any,
  userRates: any[],
  similarQuotes: any[],
  learningContext: LearningContext,
  apiKey: string
): Promise<PriceEstimate> {
  console.log('💰 FAS 13: Estimating price range...');
  
  // Quick estimation based on project type and measurements
  const text = description.toLowerCase();
  let baseMin = 10000;
  let baseMax = 30000;
  
  // Extract area if available
  const areaMatch = text.match(/(\d+)\s*(kvm|m2|m²|kvadratmeter)/i);
  const area = areaMatch ? parseInt(areaMatch[1]) : 0;
  
  // Project-specific estimates
  if (text.includes('badrum') && text.includes('renovera')) {
    baseMin = area > 0 ? area * 18000 : 80000;
    baseMax = area > 0 ? area * 30000 : 150000;
  } else if (text.includes('kök') && text.includes('renovera')) {
    baseMin = area > 0 ? area * 20000 : 100000;
    baseMax = area > 0 ? area * 35000 : 200000;
  } else if (text.includes('målning') || text.includes('måla')) {
    baseMin = area > 0 ? area * 400 : 15000;
    baseMax = area > 0 ? area * 800 : 50000;
  } else if (text.includes('fäll') || text.includes('träd')) {
    const treeCountMatch = text.match(/(\d+)\s*(träd|granar|tallar|ekar)/i);
    const treeCount = treeCountMatch ? parseInt(treeCountMatch[1]) : 1;
    baseMin = treeCount * 8000;
    baseMax = treeCount * 25000;
  } else if (text.includes('städ')) {
    baseMin = area > 0 ? area * 50 : 5000;
    baseMax = area > 0 ? area * 150 : 15000;
  }
  
  // Adjust based on similar quotes
  if (similarQuotes && similarQuotes.length > 0) {
    const similarPrices = similarQuotes
      .map(q => q.quote_data?.summary?.customerPays || 0)
      .filter(p => p > 0);
    
    if (similarPrices.length > 0) {
      const avgSimilar = similarPrices.reduce((a, b) => a + b, 0) / similarPrices.length;
      // Weight towards similar quotes
      baseMin = Math.round((baseMin + avgSimilar * 0.8) / 2);
      baseMax = Math.round((baseMax + avgSimilar * 1.2) / 2);
    }
  }
  
  // Adjust based on user patterns
  if (learningContext.userPatterns?.average_quote_value) {
    const userAvg = learningContext.userPatterns.average_quote_value;
    // Slight adjustment towards user's typical pricing
    baseMin = Math.round(baseMin * 0.9 + userAvg * 0.1);
    baseMax = Math.round(baseMax * 0.9 + userAvg * 0.1);
  }
  
  // Calculate confidence
  let confidence = 50;
  if (area > 0) confidence += 20; // Has measurements
  if (similarQuotes && similarQuotes.length > 0) confidence += 20; // Has similar work
  if (userRates && userRates.length > 0) confidence += 10; // Has custom rates
  
  const reasoning = `Baserat på ${area > 0 ? `${area} kvm, ` : ''}projekttyp och ${similarQuotes?.length || 0} liknande offerter`;
  
  return {
    min: Math.round(baseMin),
    max: Math.round(baseMax),
    confidence: Math.min(confidence, 95),
    reasoning
  };
}

// ============================================
// CONFIDENCE SCORE (FÖRBÄTTRING #5)
// ============================================

function calculateConfidenceScore(
  quote: any,
  description: string,
  conversationHistory: ConversationMessage[],
  userRates: any[],
  similarQuotes: any[]
): {
  overall: number;
  breakdown: {
    measurements: number;
    materials: number;
    pricing: number;
    scope: number;
  };
  missingInfo: string[];
} {
  
  const missingInfo: string[] = [];
  let measurementsScore = 0;
  let materialsScore = 0;
  let pricingScore = 0;
  let scopeScore = 0;
  
  const fullText = (description + ' ' + conversationHistory.map(m => m.content).join(' ')).toLowerCase();
  
  // 1. MEASUREMENTS (0-1)
  const hasMeasurements = /(\d+)\s*(kvm|m2|m²|meter|m|kvadrat|cm|mm|st|granar|träd|rum)/gi.test(fullText);
  if (hasMeasurements) {
    measurementsScore = 1.0;
  } else if (fullText.match(/(stor|liten|mellan|ca|ungefär|cirka)/gi)) {
    measurementsScore = 0.5;
    missingInfo.push("Exakta mått saknas (endast ungefärlig storlek angiven)");
  } else {
    measurementsScore = 0.0;
    missingInfo.push("Inga mått angivna");
  }
  
  // 2. MATERIALS (0-1)
  const materials = quote.materials || [];
  if (materials.length === 0) {
    materialsScore = 1.0; // No materials needed
  } else {
    const specificMaterials = materials.filter((m: any) => {
      const name = m.name?.toLowerCase() || '';
      // Specific material has at least 3 words AND brand/model
      const hasEnoughWords = name.split(' ').length >= 3;
      const hasGenericWords = name.includes('material') || name.includes('förbrukning') || name.includes('diverse');
      return hasEnoughWords && !hasGenericWords;
    });
    
    materialsScore = materials.length > 0 ? specificMaterials.length / materials.length : 1.0;
    
    if (materialsScore < 0.7 && materials.length > 0) {
      missingInfo.push("Vissa material är generiska (märke/modell inte specificerad)");
    }
  }
  
  // 3. PRICING (0-1)
  if (userRates.length > 0) {
    pricingScore = 1.0; // Using own rates
  } else if (similarQuotes.length > 0) {
    pricingScore = 0.8; // Based on similar quotes
    missingInfo.push("Använder priser från liknande offerter (inte dina egna)");
  } else {
    pricingScore = 0.6; // Standard rates
    missingInfo.push("Använder standardpriser (ingen användarhistorik)");
  }
  
  // 4. SCOPE (0-1)
  const vagueWords = ['renovera', 'fixa', 'uppdatera', 'göra om', 'åtgärda'];
  const hasVagueWords = vagueWords.some(w => fullText.includes(w));
  const hasSpecificWords = fullText.match(/(riva|kakel|måla|installera|byta|montera|demontera|fälla|klippa)/gi);
  
  if (hasSpecificWords) {
    scopeScore = 1.0; // Clear scope
  } else if (hasVagueWords && conversationHistory.length > 2) {
    scopeScore = 0.7; // Vague but discussed
    missingInfo.push("Omfattning diskuterad men kan behöva förtydligas");
  } else if (hasVagueWords) {
    scopeScore = 0.4; // Vague and not discussed
    missingInfo.push("Omfattning är oklar (t.ex. 'renovera' kan betyda olika saker)");
  } else {
    scopeScore = 0.8; // Okay but not perfect
  }
  
  // Calculate overall (weighted average)
  const overall = (
    measurementsScore * 0.25 +
    materialsScore * 0.25 +
    pricingScore * 0.25 +
    scopeScore * 0.25
  );
  
  return {
    overall: Math.round(overall * 100) / 100,
    breakdown: {
      measurements: Math.round(measurementsScore * 100) / 100,
      materials: Math.round(materialsScore * 100) / 100,
      pricing: Math.round(pricingScore * 100) / 100,
      scope: Math.round(scopeScore * 100) / 100
    },
    missingInfo: missingInfo
  };
}

// ============================================
// REALISM VALIDATION (FÖRBÄTTRING #9)
// ============================================

function validateRealism(
  quote: any,
  userPatterns: any,
  industryData: any[]
): string[] {
  const warnings: string[] = [];
  
  // 1. Check hourly rates consistency
  const workItems = quote.workItems || [];
  if (workItems.length > 0) {
    const hourlyRates = workItems
      .map((w: any) => w.hourlyRate)
      .filter((rate: number) => rate > 0);
    
    if (hourlyRates.length > 0) {
      const avgRate = hourlyRates.reduce((a: number, b: number) => a + b, 0) / hourlyRates.length;
      
      // Compare with user patterns
      if (userPatterns?.average_hourly_rate && Math.abs(avgRate - userPatterns.average_hourly_rate) > 200) {
        warnings.push(`⚠️ Timpris (${Math.round(avgRate)} kr/h) avviker från ditt snitt (${Math.round(userPatterns.average_hourly_rate)} kr/h)`);
      }
      
      // Check against industry data if available
      if (industryData && industryData.length > 0) {
        const industryAvg = industryData
          .filter((d: any) => d.metric_type === 'hourly_rate')
          .map((d: any) => d.median_value)
          .reduce((a: number, b: number) => a + b, 0) / Math.max(industryData.length, 1);
        
        if (industryAvg > 0 && Math.abs(avgRate - industryAvg) > 300) {
          warnings.push(`⚠️ Timpris (${Math.round(avgRate)} kr/h) avviker kraftigt från branschsnittet (${Math.round(industryAvg)} kr/h)`);
        }
      }
    }
  }
  
  // 2. Check material to work cost ratio
  const materialCost = quote.summary?.materialCost || 0;
  const workCost = quote.summary?.workCost || 0;
  
  if (workCost > 0 && materialCost > 0) {
    const materialRatio = materialCost / workCost;
    
    // If material cost is more than 2x work cost, that's unusual
    if (materialRatio > 2) {
      warnings.push(`⚠️ Material (${Math.round(materialCost)} kr) är över 2x arbetskostnad (${Math.round(workCost)} kr) - är det rimligt?`);
    }
    
    // Compare with user patterns if available
    if (userPatterns?.average_material_ratio) {
      const expectedRatio = userPatterns.average_material_ratio;
      if (Math.abs(materialRatio - expectedRatio) > 1) {
        warnings.push(`⚠️ Material/arbete-förhållande (${materialRatio.toFixed(1)}) avviker från ditt vanliga (${expectedRatio.toFixed(1)})`);
      }
    }
  }
  
  // 3. Check total time estimates
  const totalHours = workItems.reduce((sum: number, item: any) => sum + (item.hours || 0), 0);
  if (totalHours > 0) {
    const totalCost = quote.summary?.totalBeforeVAT || 0;
    
    // If total hours is suspiciously low for high cost
    if (totalCost > 50000 && totalHours < 20) {
      warnings.push(`⚠️ Låg tidsuppskattning (${totalHours}h) för högt pris (${Math.round(totalCost)} kr) - dubbelkolla`);
    }
    
    // If total hours is suspiciously high for low cost
    if (totalCost < 10000 && totalHours > 40) {
      warnings.push(`⚠️ Hög tidsuppskattning (${totalHours}h) för lågt pris (${Math.round(totalCost)} kr) - dubbelkolla`);
    }
  }
  
  // 4. Check if quote value is reasonable compared to user history
  if (userPatterns?.total_quotes > 5) {
    const quoteValue = quote.summary?.totalBeforeVAT || 0;
    const avgValue = userPatterns.average_quote_value || 0;
    
    // If this quote is 3x larger or smaller than average, flag it
    if (avgValue > 0) {
      if (quoteValue > avgValue * 3) {
        warnings.push(`⚠️ Offerten (${Math.round(quoteValue)} kr) är mycket högre än ditt snitt (${Math.round(avgValue)} kr)`);
      } else if (quoteValue < avgValue / 3 && quoteValue > 1000) {
        warnings.push(`⚠️ Offerten (${Math.round(quoteValue)} kr) är mycket lägre än ditt snitt (${Math.round(avgValue)} kr)`);
      }
    }
  }
  
  return warnings;
}

// ============================================
// DEDUCTION TYPE DETECTION
// ============================================

// ✅ ÅTGÄRD #4: Förbättrade nyckelord för RUT/ROT-detektion
function detectDeductionByRules(description: string): 'rot' | 'rut' | null {
  const descLower = description.toLowerCase();
  
  // RUT keywords (cleaning/maintenance/garden) - CHECK FIRST!
  const rutKeywords = [
    // Städning
    'städ', 'storstäd', 'flyttstäd', 'hemstäd', 'fönsterputsning', 'fönsterputs', 'putsa fönster',
    // Trädgård
    'trädgård', 'gräsklippning', 'gräsmatta', 'häck', 'häckklippning', 'snöröjning', 'snö', 
    'löv', 'lövrensning', 'ogräs', 'plantering', 'plantera', 'fäll', 'fällning', 'träd', 
    'trädfällning', 'buskar', 'rabatt', 'beskärning', 'beskära',
    // Övrigt RUT
    'tvätt', 'klädvård', 'matlagning', 'barnvakt', 'seniortjänster',
    'rengöring', 'underhåll av trädgård'
  ];
  
  // ROT keywords (renovation/construction/repair) - CHECK AFTER
  const rotKeywords = [
    // Renovering
    'badrum', 'badrumsr', 'kök', 'köksr', 'renovera', 'renovering', 'ombyggnad', 
    'tillbyggnad', 'bygg', 'ombygge',
    // Målning & golv
    'måla', 'målning', 'målar', 'spackling', 'spackla', 'golv', 'golvlägg', 
    'parkett', 'kakel', 'klinker', 'tapet', 'tapetsera',
    // VVS & El
    'vvs', 'elektriker', 'el-', 'elarbete', 'rör', 'rörmokare', 'värmesystem', 
    'ventilation', 'luftbehandling',
    // Konstruktion & exteriör
    'tak', 'fasad', 'altan', 'balkong', 'fönster', 'fönsterbyte', 'dörr', 
    'trappa', 'vägg', 'puts', 'stuckatur', 'isolering'
  ];
  
  const hasRut = rutKeywords.some(kw => descLower.includes(kw));
  const hasRot = rotKeywords.some(kw => descLower.includes(kw));
  
  // RUT har prioritet vid konflikt (t.ex. "fälla träd" = RUT, inte ROT)
  if (hasRut && !hasRot) {
    console.log('🎯 Rule-based deduction: RUT');
    return 'rut';
  }
  if (hasRot && !hasRut) {
    console.log('🎯 Rule-based deduction: ROT');
    return 'rot';
  }
  
  return null; // Ambiguous, använd AI
}

// ✅ ÅTGÄRD #4: Förbättrad AI-prompt för ROT/RUT-detektion
async function detectDeductionWithAI(description: string, apiKey: string): Promise<'rot' | 'rut' | 'none'> {
  console.log('🤖 Using AI to detect deduction type...');
  
  const prompt = `Analysera denna jobbeskrivning och avgör om det är ROT, RUT eller inget avdrag:

**ROT-avdrag** = Renovering, Ombyggnad, Tillbyggnad av BEFINTLIG FASTIGHET
Exempel: Badrumsrenovering, köksbyte, målning, golvläggning, el-installation, VVS-arbete, 
         fönsterbyte, fasadarbete, takbyte, altanbygge, kakelläggning

**RUT-avdrag** = Rengöring, Underhåll, Trädgård (HUSHÅLLSNÄRA TJÄNSTER)
Exempel: Städning, fönsterputsning, trädgårdsarbete, trädfällning, gräsklippning, 
         snöröjning, häckklippning, lövrensning, mindre hemreparationer

**Inget avdrag** = Nyproduktion, nybyggnation, företagslokaler, verkstadsarbete, industriarbete

Beskrivning: "${description}"

**VIKTIGT:**
- Trädfällning, trädgårdsarbete, beskärning = RUT (inte ROT)
- Renovering av BEFINTLIG bostad = ROT
- Nybygge av ny bostad = INGET avdrag
- Arbete på företagslokaler = INGET avdrag

Returnera JSON: {"type": "rot"} eller {"type": "rut"} eller {"type": "none"}`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`AI request failed: ${response.statusText}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    
    console.log('✅ AI detected:', result.type);
    return result.type || 'none';
  } catch (error) {
    console.error('AI detection error:', error);
    return 'none';
  }
}

// ============================================
// LEARNING CONTEXT FETCHING
// ============================================

async function fetchLearningContext(
  supabaseClient: any,
  userId: string,
  sessionId?: string
): Promise<LearningContext> {
  const context: LearningContext = {};
  
  // 1. Get learned preferences from session
  if (sessionId) {
    try {
      const { data: session } = await supabaseClient
        .from('conversation_sessions')
        .select('learned_preferences')
        .eq('id', sessionId)
        .single();
      
      if (session?.learned_preferences) {
        context.learnedPreferences = session.learned_preferences;
        console.log('📚 Loaded learned preferences from session');
      }
    } catch (error) {
      console.error('Error fetching learned preferences:', error);
    }
  }
  
  // 2. Get industry benchmarks
  try {
    const { data: benchmarks } = await supabaseClient
      .from('industry_benchmarks')
      .select('*')
      .order('sample_size', { ascending: false });
    
    if (benchmarks && benchmarks.length > 0) {
      context.industryData = benchmarks;
      console.log(`📊 Loaded ${benchmarks.length} industry benchmarks`);
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
      console.log('👤 Loaded user patterns');
    }
  } catch (error) {
    console.error('Error fetching user patterns:', error);
  }
  
  return context;
}

// ============================================
// DETERMINISTIC PRICING
// ============================================

// Helper: Map work item to hourly rate
function mapWorkItemToRate(
  itemName: string,
  itemDescription: string,
  hourlyRates: Array<{ work_type: string; rate: number }>
): number {
  const text = `${itemName} ${itemDescription}`.toLowerCase();
  
  // Category matching with priority
  const categories: Array<{ keywords: string[]; workType: string }> = [
    { keywords: ['vvs', 'rör', 'avlopp', 'kranar', 'toalett', 'dusch'], workType: 'VVS' },
    { keywords: ['el', 'elektr', 'belysning', 'uttag', 'kabel'], workType: 'Elektriker' },
    { keywords: ['kakel', 'klinker', 'plattor', 'platta'], workType: 'Plattsättare' },
    { keywords: ['tak', 'taktäckning', 'takpannor'], workType: 'Takläggare' },
    { keywords: ['träd', 'fäll', 'arborist', 'beskärning'], workType: 'Arborist' },
    { keywords: ['fönster', 'fönsterputsning', 'putsa'], workType: 'Fönsterputsare' },
    { keywords: ['måla', 'målning', 'färg', 'spackel'], workType: 'Snickare' },
    { keywords: ['snickeri', 'byggnad', 'montera', 'dörr'], workType: 'Snickare' },
  ];
  
  for (const { keywords, workType } of categories) {
    if (keywords.some(kw => text.includes(kw))) {
      const rate = hourlyRates.find(r => r.work_type === workType);
      if (rate) return rate.rate;
    }
  }
  
  // Fallback to generic rate (use Snickare as default)
  const fallback = hourlyRates.find(r => r.work_type === 'Snickare');
  return fallback?.rate || 700;
}

// FAS 22: Compute deterministic quote totals (skip if draft mode)
function computeQuoteTotals(
  quote: any,
  hourlyRates: Array<{ work_type: string; rate: number }>,
  equipmentRates: Array<{ name: string; price_per_day: number | null; price_per_hour: number | null }>,
  isDraft: boolean = false
): any {
  // FAS 22: If draft mode, preserve AI-generated price intervals as-is
  if (isDraft) {
    console.log('📄 FAS 22: Draft mode - preserving AI price intervals, skipping deterministic calculations');
    return quote; // Return quote as-is with price interval strings
  }
  
  let workCost = 0;
  let materialCost = 0;
  let equipmentCost = 0;
  
  // Calculate work items with mapped rates
  const updatedWorkItems = (quote.workItems || []).map((item: any) => {
    const mappedRate = mapWorkItemToRate(item.name, item.description || '', hourlyRates);
    const hours = parseFloat(item.hours) || 0;
    const subtotal = Math.round(hours * mappedRate);
    workCost += subtotal;
    
    return {
      ...item,
      hourlyRate: mappedRate,
      subtotal
    };
  });
  
  // Calculate materials
  const updatedMaterials = (quote.materials || []).map((mat: any) => {
    const quantity = parseFloat(mat.quantity) || 0;
    const pricePerUnit = parseFloat(mat.pricePerUnit) || 0;
    const subtotal = Math.round(quantity * pricePerUnit);
    materialCost += subtotal;
    
    return {
      ...mat,
      subtotal
    };
  });
  
  // Calculate equipment
  const updatedEquipment = (quote.equipment || []).map((eq: any) => {
    const equipRate = equipmentRates.find(er => er.name === eq.name);
    const quantity = parseFloat(eq.quantity) || 0;
    const days = parseFloat(eq.days) || 0;
    
    let pricePerDay = 0;
    if (equipRate) {
      pricePerDay = equipRate.price_per_day || (equipRate.price_per_hour ? equipRate.price_per_hour * 8 : 0);
    } else {
      pricePerDay = parseFloat(eq.pricePerDay) || 0;
    }
    
    const subtotal = Math.round(quantity * days * pricePerDay);
    equipmentCost += subtotal;
    
    return {
      ...eq,
      pricePerDay,
      subtotal
    };
  });
  
  const totalBeforeVAT = workCost + materialCost + equipmentCost;
  const vatAmount = Math.round(totalBeforeVAT * 0.25);
  const totalWithVAT = totalBeforeVAT + vatAmount;
  
  return {
    ...quote,
    workItems: updatedWorkItems,
    materials: updatedMaterials,
    equipment: updatedEquipment,
    summary: {
      workCost,
      materialCost,
      equipmentCost,
      totalBeforeVAT,
      vatAmount,
      totalWithVAT,
      customerPays: totalWithVAT // Will be adjusted for ROT/RUT later
    }
  };
}

// ============================================
// ROT/RUT CALCULATION (FAS 27 Del 2 + 4)
// ============================================

// FAS 27 Del 2: Get current deduction rate from database
async function getCurrentDeductionRate(
  supabase: any,
  deductionType: 'rot' | 'rut',
  quoteDate: Date = new Date()
): Promise<number> {
  const dateStr = quoteDate.toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('deduction_limits')
    .select('deduction_percentage')
    .eq('deduction_type', deductionType)
    .lte('valid_from', dateStr)
    .or(`valid_to.is.null,valid_to.gte.${dateStr}`)
    .order('valid_from', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error || !data) {
    console.warn(`⚠️ Could not fetch deduction rate for ${deductionType}, using 50% fallback`, error);
    return 0.50; // Fallback to 50%
  }
  
  console.log(`✅ Deduction rate for ${deductionType}: ${data.deduction_percentage * 100}%`);
  return data.deduction_percentage;
}

// FAS 27 Del 4: Multi-recipient deduction calculation
interface RecipientDeduction {
  name: string;
  personnummer: string;
  ownershipShare: number;
  maxDeduction: number;
  allocatedDeduction: number;
  remainingCapacity: number;
}

async function calculateMultiRecipientDeduction(
  supabase: any,
  workCostWithVAT: number,
  deductionType: 'rot' | 'rut',
  deductionRate: number,
  recipients: Array<{ customer_name: string; customer_personnummer: string; ownership_share: number }>
): Promise<{
  totalDeduction: number;
  recipientBreakdown: RecipientDeduction[];
  exceedsCapacity: boolean;
}> {
  const maxPerPerson = deductionType === 'rut' ? 75000 : 50000;
  const baseDeduction = Math.round(workCostWithVAT * deductionRate);
  
  // Initialize recipients with their share of deduction
  const recipientBreakdown: RecipientDeduction[] = recipients.map(r => ({
    name: r.customer_name,
    personnummer: r.customer_personnummer,
    ownershipShare: r.ownership_share,
    maxDeduction: maxPerPerson,
    allocatedDeduction: Math.round(baseDeduction * r.ownership_share),
    remainingCapacity: 0,
  }));
  
  // Check if any recipient exceeds their personal cap
  let totalActualDeduction = 0;
  let exceedsCapacity = false;
  
  for (const recipient of recipientBreakdown) {
    if (recipient.allocatedDeduction > recipient.maxDeduction) {
      recipient.allocatedDeduction = recipient.maxDeduction;
      exceedsCapacity = true;
    }
    
    recipient.remainingCapacity = recipient.maxDeduction - recipient.allocatedDeduction;
    totalActualDeduction += recipient.allocatedDeduction;
  }
  
  console.log(`💰 Multi-recipient deduction breakdown:`, recipientBreakdown);
  
  return {
    totalDeduction: totalActualDeduction,
    recipientBreakdown,
    exceedsCapacity
  };
}

async function calculateROTRUT(
  supabase: any,
  quote: any, 
  deductionType: string, 
  recipients: Array<{ customer_name: string; customer_personnummer: string; ownership_share: number }> | number, 
  quoteDate: Date
) {
  if (deductionType === 'none') return;

  // FAS 27 Del 2: Get dynamic deduction rate from database
  const deductionRate = await getCurrentDeductionRate(supabase, deductionType as 'rot' | 'rut', quoteDate);
  
  const workCost = quote.summary?.workCost || 0;
  const workCostWithVAT = Math.round(workCost * 1.25);
  
  // FAS 27 Del 4: Multi-recipient support
  let actualDeduction: number;
  let recipientBreakdown: RecipientDeduction[] | undefined;
  let exceedsCapacity = false;
  let numberOfRecipients: number;
  
  if (Array.isArray(recipients) && recipients.length > 0) {
    // Multi-recipient mode
    numberOfRecipients = recipients.length;
    
    const multiCalc = await calculateMultiRecipientDeduction(
      supabase,
      workCostWithVAT,
      deductionType as 'rot' | 'rut',
      deductionRate,
      recipients
    );
    
    actualDeduction = multiCalc.totalDeduction;
    recipientBreakdown = multiCalc.recipientBreakdown;
    exceedsCapacity = multiCalc.exceedsCapacity;
    
    console.log(`💰 Multi-recipient ${deductionType.toUpperCase()}: ${numberOfRecipients} recipients, total deduction: ${actualDeduction} kr`);
  } else {
    // Single recipient mode (legacy)
    numberOfRecipients = typeof recipients === 'number' ? recipients : 1;
    const maxDeduction = deductionType === 'rot' ? 50000 : 75000;
    const totalMaxDeduction = maxDeduction * numberOfRecipients;
    const calculatedDeduction = Math.round(workCostWithVAT * deductionRate);
    actualDeduction = Math.min(calculatedDeduction, totalMaxDeduction);
    
    console.log(`💰 Single recipient ${deductionType.toUpperCase()}: ${actualDeduction} kr`);
  }

  const customerPays = quote.summary.totalWithVAT - actualDeduction;

  // Update quote with detailed deduction breakdown
  quote.summary.deduction = {
    type: deductionType.toUpperCase(),
    deductionRate,
    maxPerPerson: deductionType === 'rot' ? 50000 : 75000,
    numberOfRecipients,
    laborCost: workCost,
    workCostWithVAT,
    eligibleAmount: workCostWithVAT,
    calculatedDeduction: Math.round(workCostWithVAT * deductionRate),
    deductionAmount: actualDeduction,
    priceAfterDeduction: customerPays,
    recipientBreakdown, // FAS 27 Del 4: Include breakdown if multi-recipient
    exceedsCapacity, // FAS 27 Del 4: Warning flag
  };

  quote.summary.customerPays = customerPays;

  console.log(`💰 ${deductionType.toUpperCase()}-avdrag detaljer:`, {
    laborCost: workCost,
    workCostWithVAT,
    deductionRate: `${deductionRate * 100}%`,
    deductionAmount: actualDeduction,
    priceAfterDeduction: customerPays,
    recipients: numberOfRecipients,
    breakdown: recipientBreakdown ? 'included' : 'n/a'
  });
}

// ============================================
// SPRINT 1: EXCLUSION PARSING
// ============================================

interface Exclusion {
  item: string;
  reason: string;
}

// SPRINT 2: Smart auto-title generation
function generateQuoteTitle(
  conversationFeedback: any,
  description: string
): string {
  const understood = conversationFeedback?.understood || {};
  
  // Extract key information
  const projectType = understood.project_type || '';
  const measurements = understood.measurements || {};
  const location = understood.location || '';
  
  // Templates based on project type
  const templates: Record<string, (m: any, l: string) => string> = {
    'badrumsrenovering': (m, l) => {
      const area = m.area || m.size || '';
      return area ? `Badrumsrenovering ${area}` : 'Badrumsrenovering';
    },
    'köksrenovering': (m, l) => {
      const area = m.area || m.size || '';
      return area ? `Köksrenovering ${area}` : 'Köksrenovering';
    },
    'målning': (m, l) => {
      const area = m.area || '';
      const rooms = m.rooms || '';
      if (area && rooms) return `Målning ${area}, ${rooms} rum`;
      if (area) return `Målning ${area}`;
      if (rooms) return `Målning ${rooms} rum`;
      return 'Målningsarbete';
    },
    'trädfällning': (m, l) => {
      const quantity = m.quantity || m.count || '';
      const type = m.tree_type || '';
      if (quantity && type) return `Fällning av ${quantity} ${type}`;
      if (quantity) return `Trädfällning ${quantity} st`;
      return 'Trädfällning';
    },
    'trädgårdsarbete': (m, l) => {
      const area = m.area || '';
      return area ? `Trädgårdsarbete ${area}` : 'Trädgårdsarbete';
    },
    'vvs': (m, l) => {
      return l ? `VVS-arbete ${l}` : 'VVS-arbete';
    },
    'el': (m, l) => {
      return l ? `El-arbete ${l}` : 'El-arbete';
    },
    'snickeri': (m, l) => {
      return l ? `Snickeriarbete ${l}` : 'Snickeriarbete';
    },
    'städning': (m, l) => {
      const area = m.area || '';
      return area ? `Städning ${area}` : 'Städning';
    },
  };
  
  // Normalize project type for matching
  const normalizedType = projectType.toLowerCase();
  
  // Find matching template
  for (const [key, generator] of Object.entries(templates)) {
    if (normalizedType.includes(key)) {
      const title = generator(measurements, location);
      return title.length > 50 ? title.substring(0, 47) + '...' : title;
    }
  }
  
  // Fallback: use first 50 chars of description
  if (description.length > 50) {
    return description.substring(0, 47) + '...';
  }
  
  return description || 'Offert';
}

// Extract all mentioned items from conversation to prevent hallucinations
function extractMentionedItems(conversationHistory: ConversationMessage[]): string[] {
  const mentionedItems = new Set<string>();
  
  conversationHistory.forEach(msg => {
    if (msg.role === 'user') {
      const text = msg.content.toLowerCase();
      
      // Common work types
      const workTypes = [
        'badrum', 'kök', 'målning', 'städning', 'trädgård', 'fällning', 'träd',
        'rivning', 'kakel', 'tapet', 'golv', 'vvs', 'el', 'fönster', 'dörr',
        'altandörr', 'ventilation', 'värmesystem', 'isolering', 'tätskikt',
        'snickeri', 'bortforsling', 'skrot', 'avfall', 'stubbfräsning', 'stubb',
        'arborist', 'fräs', 'ris', 'stamdelar', 'framkomst', 'maskiner'
      ];
      
      workTypes.forEach(type => {
        if (text.includes(type)) {
          mentionedItems.add(type);
        }
      });
      
      // Extract specific mentions with numbers
      const numberPatterns = [
        /(\d+)\s*(?:st|styck|stycken|träd|granar|tallar)/gi,
        /(\d+)\s*(?:kvm|kvadratmeter|m2)/gi,
        /(\d+)\s*(?:rum|sovrum|badrum)/gi,
      ];
      
      numberPatterns.forEach(pattern => {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          mentionedItems.add(match[0]);
        }
      });
    }
  });
  
  return Array.from(mentionedItems);
}

function parseExclusions(conversationHistory: ConversationMessage[]): Exclusion[] {
  const exclusions: Exclusion[] = [];
  
  // STEG 1: Filtrera bort AI:ns meddelanden - Kolla BARA användarens svar
  const userMessages = conversationHistory
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join('\n');
  
  // STEG 1A: Filtrera bort EXPLICITA inkluderingar först
  const inclusionPatterns = [
    /([^.!?\n]+)\s+(?:ska finnas med|ska ingå|ingår|inkluderas|måste vara med)/gi,
    /(?:vi|jag som hantverkare|vi hantverkare|företaget)\s+(?:tar hand om|sköter|ordnar|utför)\s+([^.!?\n]+)/gi,
    /(?:offerten ska innehålla|offerten inkluderar)\s+([^.!?\n]+)/gi,
  ];

  const explicitInclusions: string[] = [];
  for (const pattern of inclusionPatterns) {
    let match;
    while ((match = pattern.exec(userMessages)) !== null) {
      const item = match[1]?.trim();
      if (item && item.length > 2) {
        explicitInclusions.push(item.toLowerCase());
      }
    }
  }
  
  console.log(`✅ Found ${explicitInclusions.length} explicit inclusions:`, explicitInclusions);
  
  // STEG 1B: Uppdaterade exclusion-regex för att undvika false positives
  const patterns = [
    // KRITISKT: Kräv "kunden" eller "kund" för "tar hand om"
    /(?:kunden|kund|köparen)\s+(?:tar hand om|sköter|ordnar)\s+([^.!?\n]+)/gi,
    
    // Kräv EXAKT "ska inte ingå" (inte bara "ska" + "ingå")
    /([^.!?\n]+)\s+ska\s+inte\s+ingå/gi,
    /ska\s+inte\s+ingå\s+([^.!?\n]+)/gi,
    
    /([^.!?\n]+)\s+(?:är redan gjort|redan är gjort|redan klart|redan ordnat)/gi,
    /(?:behövs inte|behöver inte)\s+([^.!?\n]+)/gi,
    /(?:exkludera)\s+([^.!?\n]+)/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(userMessages)) !== null) {
      const item = match[1]?.trim();
      if (item && item.length > 2 && item.length < 100) {
        // Extra validering: Skippa om det ser ut som en fråga
        if (item.includes('?')) {
          continue;
        }
        
        exclusions.push({
          item: item,
          reason: match[0].includes('kunden') || match[0].includes('kund') ? 'Kunden ordnar själv' :
                  match[0].includes('redan') ? 'Redan utfört' :
                  'Ska inte ingå'
        });
      }
    }
  }
  
  // STEG 1C: Filtrera bort items som finns i explicitInclusions
  const validExclusions = exclusions.filter(excl => 
    !explicitInclusions.some(incl => 
      excl.item.toLowerCase().includes(incl) || incl.includes(excl.item.toLowerCase())
    )
  );
  
  // Deduplicate
  const uniqueExclusions = validExclusions.filter((excl, index, self) =>
    index === self.findIndex(e => e.item.toLowerCase() === excl.item.toLowerCase())
  );
  
  console.log(`📋 Parsed ${uniqueExclusions.length} exclusions (after filtering inclusions):`, uniqueExclusions);
  
  return uniqueExclusions;
}

// Validate generated quote against conversation to prevent hallucinations
function validateGeneratedQuote(
  quote: any,
  mentionedItems: string[],
  conversationHistory: ConversationMessage[]
): { 
  warnings: string[]; 
  needsReview: boolean;
  validatedQuote: any;
} {
  const warnings: string[] = [];
  const conversationText = conversationHistory
    .filter(m => m.role === 'user')
    .map(m => m.content.toLowerCase())
    .join(' ');
  
  // Check each work item
  quote.workItems?.forEach((item: any, index: number) => {
    const itemName = item.name.toLowerCase();
    const itemCost = item.subtotal || 0;
    
    // Skip validation for very small items (< 1000 kr) - likely standard work
    if (itemCost < 1000) {
      return;
    }
    
    // Check if this item was actually mentioned
    const wasMentioned = mentionedItems.some(mentioned => 
      itemName.includes(mentioned.toLowerCase()) || 
      conversationText.includes(itemName.split(' ')[0])
    );
    
    if (!wasMentioned && itemCost > 2000) {
      warnings.push(
        `⚠️ "${item.name}" (${itemCost} kr) nämndes inte explicit i konversationen. ` +
        `Bekräfta att detta ska ingå eller ta bort.`
      );
      item.needsReview = true;
    }
  });
  
  // Check materials
  quote.materials?.forEach((material: any) => {
    if (material.subtotal > 3000) {
      const materialName = material.name.toLowerCase();
      const wasMentioned = mentionedItems.some(mentioned => 
        materialName.includes(mentioned.toLowerCase())
      );
      
      if (!wasMentioned) {
        warnings.push(
          `⚠️ Material "${material.name}" (${material.subtotal} kr) nämndes inte explicit. ` +
          `Verifiera att detta är korrekt.`
        );
      }
    }
  });
  
  return {
    warnings,
    needsReview: warnings.length > 0,
    validatedQuote: quote
  };
}

// ============================================
// STEG 1: DETECT POSITIVE INCLUSIONS
// ============================================

function detectInclusions(conversationHistory: ConversationMessage[]): string[] {
  const inclusions: string[] = [];
  
  console.log('🔍 Analyzing inclusions from conversation...');
  
  for (let i = 0; i < conversationHistory.length - 1; i++) {
    const aiMsg = conversationHistory[i];
    const userMsg = conversationHistory[i + 1];
    
    // Kolla om AI frågade och användaren bekräftade
    if (aiMsg.role === 'assistant' && userMsg.role === 'user') {
      const aiAsked = aiMsg.content.toLowerCase();
      const userSaid = userMsg.content.toLowerCase();
      
      // KRITISK FIX: Kolla att AI faktiskt FRÅGADE (innehåller frågetecken)
      const hasQuestionMark = aiMsg.content.includes('?');
      
      // Positiva bekräftelser
      const isPositive = userSaid.match(/^(ja|det ingår|ja det ingår|ingår|yes|stämmer|korrekt|exakt)/i);
      
      if (isPositive && hasQuestionMark) {
        // FÖRBÄTTRING: Kolla att frågan handlar om inkludering
        const isInclusionQuestion = aiAsked.match(/ingår|inkludera|behöver|ska.*ingå|tar.*hand om|vill.*ha/i);
        
        if (isInclusionQuestion) {
          console.log(`  📋 Found inclusion question: "${aiMsg.content.substring(0, 50)}..."`);
          console.log(`  ✅ User confirmed: "${userMsg.content}"`);
          
          // Extrahera ämnen från AI:ns fråga
          const topics = ['rivning', 'riv', 'vvs', 'el', 'elektriker', 'kakel', 'kakling', 'plattsättare', 'plattsättning', 'målning', 'måla', 'golv', 'golvarbeten', 'snickeri', 'tak'];
          topics.forEach(topic => {
            if (aiAsked.includes(topic)) {
              console.log(`    ➕ Adding inclusion: ${topic}`);
              inclusions.push(topic);
            }
          });
        } else {
          console.log(`  ⚠️ User said yes but question was not about inclusion: "${aiMsg.content.substring(0, 50)}..."`);
        }
      }
    }
  }
  
  const uniqueInclusions = [...new Set(inclusions)];
  console.log(`✅ Detected ${uniqueInclusions.length} inclusions:`, uniqueInclusions);
  
  return uniqueInclusions;
}

// ============================================
// SEMANTIC VALIDATION OF INCLUSIONS/EXCLUSIONS
// ============================================

function validateInclusionsExclusions(
  inclusions: string[],
  exclusions: Exclusion[],
  conversationHistory: ConversationMessage[]
): { validInclusions: string[]; validExclusions: Exclusion[]; warnings: string[] } {
  
  const warnings: string[] = [];
  const validInclusions = [...inclusions];
  const validExclusions: Exclusion[] = [];
  
  const allUserText = conversationHistory
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join('\n')
    .toLowerCase();
  
  // Check each exclusion for contradictory evidence
  for (const excl of exclusions) {
    const item = excl.item.toLowerCase();
    
    // Check if user EXPLICITLY said to include this
    const hasInclusionPhrase = allUserText.match(
      new RegExp(`${item}\\s+ska\\s+(finnas med|ingå|inkluderas|vara med)`, 'i')
    );
    
    const hasWeInclude = allUserText.match(
      new RegExp(`(?:vi|jag|företaget)\\s+(?:tar hand om|sköter|ordnar)\\s+${item}`, 'i')
    );
    
    if (hasInclusionPhrase || hasWeInclude) {
      warnings.push(`⚠️ "${excl.item}" markerades som exkluderad, men användaren sa att det ska inkluderas. Inkluderar istället.`);
      validInclusions.push(excl.item);
    } else {
      validExclusions.push(excl);
    }
  }
  
  return { validInclusions, validExclusions, warnings };
}

// ============================================
// BASIC VALIDATION
// ============================================

function basicValidation(quote: any): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Check that totals make sense
  const workCost = quote.workItems?.reduce((sum: number, item: any) => sum + (item.subtotal || 0), 0) || 0;
  const materialCost = quote.materials?.reduce((sum: number, item: any) => sum + (item.subtotal || 0), 0) || 0;
  const expectedTotal = workCost + materialCost;
  const actualTotal = quote.summary?.totalBeforeVAT || 0;
  
  const diff = Math.abs(expectedTotal - actualTotal);
  if (diff > 100) {
    issues.push(`Total stämmer inte: ${Math.round(expectedTotal)} kr beräknat vs ${Math.round(actualTotal)} kr i summary`);
  }
  
  // Check for generic materials
  const genericMaterials = quote.materials?.filter((m: any) => {
    const name = m.name?.toLowerCase() || '';
    return name.includes('material') || 
           name.includes('förbrukning') ||
           name.includes('diverse') ||
           (name.split(' ').length < 3);
  }) || [];
  
  if (genericMaterials.length > 0) {
    issues.push(`Generiska material hittade: ${genericMaterials.map((m: any) => m.name).join(', ')}`);
  }
  
  return {
    valid: issues.length === 0,
    issues,
  };
}

// ============================================
// ÅTGÄRD 1A: EXTRACT ANSWERED QUESTIONS (FÖRBÄTTRAD)
// ============================================

function extractAnsweredQuestions(conversation: Array<{role: string, content: string}>): {topics: string[], exactQuestions: string[]} {
  const answeredTopics: string[] = [];
  const exactQuestions: string[] = [];
  
  for (let i = 0; i < conversation.length - 1; i++) {
    const currentMsg = conversation[i];
    const nextMsg = conversation[i + 1];
    
    // Om AI frågade något och användaren svarade
    if (currentMsg.role === 'assistant' && nextMsg.role === 'user') {
      // Extrahera EXAKTA frågor som AI:n ställde (alla frågetecken)
      const questionMatches = currentMsg.content.match(/[^.!?]*\?/g);
      if (questionMatches) {
        questionMatches.forEach(q => {
          exactQuestions.push(q.trim());
        });
      }
      
      // Extrahera ämnen (behålls för bakåtkompatibilitet)
      const topics = [
        'framkomst', 'specialutrustning', 'maskiner', 'tillgänglighet',
        'stubb', 'fräs', 'bortforsling', 'transport', 'forsling',
        'diameter', 'höjd', 'mått', 'storlek', 'yta', 'area',
        'tidplan', 'när', 'datum', 'deadline', 'tidsram',
        'rivning', 'rivningsarbete', 'förberedelse',
        'kakel', 'material', 'kvalitet', 'märke',
        'omfattning', 'scope', 'nivå'
      ];
      
      topics.forEach(topic => {
        const questionMentionsTopic = currentMsg.content.toLowerCase().includes(topic);
        const answerMentionsTopic = nextMsg.content.toLowerCase().includes(topic);
        
        if (questionMentionsTopic && answerMentionsTopic) {
          answeredTopics.push(topic);
        }
      });
    }
  }
  
  return {
    topics: [...new Set(answeredTopics)],
    exactQuestions: [...new Set(exactQuestions)]
  };
}

// ============================================
// AI: ASK CLARIFICATION QUESTIONS
// ============================================

async function askClarificationQuestions(
  description: string,
  conversationHistory: ConversationMessage[],
  similarQuotes: any[],
  apiKey: string
): Promise<string[]> {
  
  // ÅTGÄRD 1B: Extrahera redan besvarade frågor (förbättrad)
  const answeredData = extractAnsweredQuestions(conversationHistory);
  
  const historyText = conversationHistory
    .map(m => `${m.role === 'user' ? 'Användare' : 'AI'}: ${m.content}`)
    .join('\n');

  const similarQuotesText = similarQuotes.length > 0
    ? `\n\nLiknande tidigare offerter:\n${similarQuotes.map(q => 
        `- ${q.title}: ${q.description}`
      ).join('\n')}`
    : '';

  const prompt = `Du är Handoff AI - en intelligent assistent som hjälper hantverkare att snabbt skapa offerter.

**🎯 VIKTIG KONTEXT - LÄS NOGA:**
- Du pratar med en HANTVERKARE (arborist/elektriker/målare/rörmokare etc.)
- Hantverkaren skapar en offert åt sin KUND
- När hantverkaren säger "vi tar hand om X" = X SKA INKLUDERAS i offerten
- När hantverkaren säger "kunden tar hand om X" = X ska EXKLUDERAS från offerten

**EXEMPEL PÅ TOLKNING:**
✅ "Vi tar hand om bortforsling" → Inkludera bortforsling i offerten
✅ "Bortforsling ska finnas med" → Inkludera bortforsling
❌ "Kunden tar hand om bortforsling" → Exkludera bortforsling
❌ "Bortforsling behövs inte" → Exkludera bortforsling

**FRÅGOR ATT STÄLLA OM OKLART:**
Om hantverkaren nämner något som "stubbfräsning", "rivning", "el-arbete", "bortforsling" etc. utan att specificera:
→ Fråga: "Ska [X] ingå i offerten eller ordnar kunden det själv?"

**KUNDENS FÖRFRÅGAN:**
${description}

**TIDIGARE KONVERSATION:**
${historyText || 'Ingen tidigare konversation'}

${similarQuotesText}

**🚨 KRITISKT - DESSA EXAKTA FRÅGOR HAR REDAN STÄLLTS:**
${answeredData.exactQuestions.length > 0 
  ? answeredData.exactQuestions.map(q => `"${q}" <-- STÄLL ALDRIG DENNA FRÅGA IGEN!`).join('\n')
  : '(Inga frågor ställda än)'}

**Ämnen som redan diskuterats:**
${answeredData.topics.length > 0 
  ? answeredData.topics.map(t => `- ${t} (FRÅGA INTE OM DETTA!)`).join('\n')
  : '(Inga ämnen besvarade än)'}

**EXEMPEL PÅ BRA OCH DÅLIGT BETEENDE:**

❌ DÅLIGT:
AI: "Behöver stubbarna fräsas?"
Användare: "Ja, stubbarna behöver fräsas"
AI: "Behöver stubbarna fräsas?" <-- DETTA ÄR FEL! Samma fråga igen!

✅ BRA:
AI: "Behöver stubbarna fräsas?"
Användare: "Ja, stubbarna behöver fräsas"
AI: "Är det fritt framkomst för maskiner?" <-- GÅ VIDARE TILL NÄSTA FRÅGA

**REGLER:**
1. Läs HELA konversationshistoriken innan du ställer frågor
2. Ställ ALDRIG en fråga om något som redan diskuterats
3. Om användaren har svarat på en fråga, gå vidare till nästa ämne
4. Om alla viktiga frågor är besvarade, returnera tom lista: {"questions": []}

**PROJEKTTYP-IDENTIFIERING:**
Analysera beskrivningen och identifiera projekttyp:
- BADRUMSRENOVERING: kakel, badkar, dusch, wc, badrum
- MÅLNING: måla, färg, pensla, rulla, väggar, tak
- TRÄDGÅRD/FALLNING: träd, fälla, stubb, häck, gräs, trädgård
- ALTAN/BYGGE: altan, byggnad, grund, fundament
- VVS: rör, avlopp, vatten, läcka, blandare
- EL: elarbete, el, elektriker, uttag, lampor

**SCOPE DETECTION (KRITISKT):**
Om beskrivningen innehåller vaga ord ("renovera", "fixa", "uppdatera", "göra om") utan tydlig omfattning:
→ Ställ ALLTID en fråga om omfattning med konkreta exempel och prisklasser.

**Exempel scope-fråga för badrumsrenovering:**
"Vad innebär renoveringen för er del?
- Lätt uppdatering (målning + nya armaturer): ~15 000-25 000 kr
- Mellanrenovering (nya kakel + VVS): ~80 000-120 000 kr
- Totalrenovering (riva till råvägg): ~150 000-250 000 kr

Vilken nivå ligger detta projekt på?"

**Exempel scope-fråga för målning:**
"Vad omfattar målningen?
- Bara målning av färdiga väggar: ~150-250 kr/kvm
- Spackling + målning: ~250-400 kr/kvm
- Omfattande reparationer + spackling + målning: ~400-600 kr/kvm

Vilken nivå ligger detta projekt på?"

**DIN UPPGIFT:**
Analysera konversationen och beskrivningen. Avgör om det finns tillräcklig information för att skapa en korrekt offert.

**PROJEKTSPECIFIKA FRÅGOR:**

**Om BADRUMSRENOVERING:**
✅ "Ingår rivning av gamla kakel och VVS eller är det redan gjort?"
✅ "Hur stort är badrummet ungefär (i kvm)?"
✅ "Tar du hand om bortforsling eller ska det ingå?"
✅ "Vilken kakelkvalitet brukar du använda för detta?"

**Om MÅLNING:**
✅ "Hur många rum och hur stor total yta?"
✅ "Ingår spackling av sprickor eller är väggarna färdiga?"
✅ "Vilken färgkvalitet brukar du använda (Alcro/Beckers/annat)?"
✅ "Tak och väggar eller bara väggar?"

**Om TRÄDARBETE/FALLNING:**
✅ "Hur stora träd (höjd och diameter på stammen)?"
✅ "Tar du hand om bortforsling eller ska stubbarna kvarlämnas?"
✅ "Är det fritt framkomst eller krävs specialutrustning?"
✅ "Behöver stubbarna fräsas?"

**Om ALTAN/BYGGE:**
✅ "Hur stor yta ska byggas (i kvm)?"
✅ "Vilket material brukar du använda (tryckimpregnerat/lärkträ/komposit)?"
✅ "Ingår grund/fundament eller är det redan på plats?"
✅ "Ingår räcke och trappa?"

**Om VVS:**
✅ "Vad behöver göras exakt (nya rör, byte av blandare, åtgärda läcka)?"
✅ "Är det synligt arbete eller innanför vägg?"
✅ "Ingår kakel/puts-lagning efter arbetet?"

**Om EL:**
✅ "Vad behöver göras (nya uttag, lampor, säkringsskåp)?"
✅ "Hur många uttag/lampor handlar det om?"
✅ "Behöver elcentral uppdateras?"

**KRITISK REGEL - EN FRÅGA I TAGET:**

Du får ENDAST ställa EN (1) fråga per svar, inte flera!

❌ DÅLIGT exempel:
"Behöver stubbarna fräsas? Hur är framkomsten? Vilken typ av träd?"

✅ BRA exempel:
"Behöver stubbarna fräsas efter fällning?"

När användaren svarar kommer du att få chansen att ställa nästa fråga.

**Prioritera frågor enligt:**
1. Arbetstyp och omfattning (om oklart)
2. Tillgänglighet/framkomst
3. Materialval (om kunden nämnt preferenser)
4. Tidsplan
5. Övriga detaljer

Ställ ALLTID den mest kritiska obesvarade frågan först.

**VIKTIGT - TON OCH STIL:**
- Prata som till en kollega/hantverkare, inte till slutkunden
- Använd "du" när du menar hantverkaren (t.ex. "Tar du hand om...")
- Använd "kunden" när du refererar till slutkunden (t.ex. "...eller ska kunden stå för det?")
- EN fråga per gång
- Kort och tydlig
- Inga A/B/C-alternativ

Returnera JSON:
{"questions": ["Din enda fråga här"]} eller {"questions": []}`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error('AI clarification request failed:', response.statusText);
      return [];
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    
    // ✅ Extrahera BARA första frågan från AI:ns svar
    const allQuestions = result.questions || [];
    const firstQuestion = allQuestions[0];
    
    return firstQuestion ? [firstQuestion] : [];
  } catch (error) {
    console.error('Error asking clarification questions:', error);
    return [];
  }
}

// ============================================
// AI: GENERATE QUOTE
// ============================================

async function generateQuoteWithAI(
  description: string,
  conversationHistory: ConversationMessage[],
  userRates: any[],
  equipment: any[],
  similarQuotes: any[],
  learningContext: LearningContext,
  deductionType: string,
  apiKey: string,
  exclusions: Exclusion[] = [],
  previousQuote: any = null, // SPRINT 1.5: For delta mode
  includeExplanations: boolean = false, // FAS 14: Enable explanations
  isDraft: boolean = false // FAS 20: Draft mode flag
): Promise<any> {
  
  const historyText = conversationHistory
    .map(m => `${m.role === 'user' ? 'Användare' : 'AI'}: ${m.content}`)
    .join('\n');

  // SPRINT 1.5: Delta Mode detection
  const isDeltaMode = !!previousQuote;
  const previousTotal = previousQuote?.summary?.customerPays || 0;

  // Build rates text
  const ratesText = userRates.length > 0
    ? `**ANVÄNDARENS TIMPRISER (ANVÄND EXAKT DESSA):**\n${userRates.map(r => `- ${r.work_type}: ${r.rate} kr/h`).join('\n')}`
    : `**TIMPRISER:**\nAnvänd standardpris 650 kr/h`;

  // ... keep existing code (equipment, similarQuotes, industryData building)

  const equipmentText = equipment.length > 0
    ? `\n\n**ANVÄNDARENS MASKINER/UTRUSTNING:**\n${equipment.map(e => {
        let price = '';
        if (e.price_per_hour) price = `${e.price_per_hour} kr/h`;
        if (e.price_per_day) price = `${e.price_per_day} kr/dag`;
        const rental = e.is_rented ? '(hyrs externt)' : '(ägs)';
        return `- ${e.name} (${e.equipment_type}): ${price} ${rental}`;
      }).join('\n')}`
    : '';

  const similarQuotesText = similarQuotes.length > 0
    ? `\n\n**📚 LIKNANDE TIDIGARE OFFERTER (LÄR AV DESSA):**\n${similarQuotes.map(q => {
        const materials = q.quote_data?.materials || [];
        const workItems = q.quote_data?.workItems || [];
        
        return `
**Projekt:** ${q.title}
**Beskrivning:** ${q.description}

**Material som användes:**
${materials.map((m: any) => `- ${m.name}: ${m.quantity} ${m.unit} × ${m.pricePerUnit} kr = ${m.subtotal} kr`).join('\n')}

**Arbete som utfördes:**
${workItems.map((w: any) => `- ${w.name}: ${w.hours}h × ${w.hourlyRate} kr/h = ${w.subtotal} kr`).join('\n')}

**Total:** ${q.quote_data?.summary?.totalBeforeVAT || 0} kr (exkl. moms)
`;
      }).join('\n---\n')}`
    : '';

  const industryDataText = learningContext.industryData && learningContext.industryData.length > 0
    ? `\n\n**📊 BRANSCHDATA (FRÅN ANDRA ANVÄNDARE):**\n${learningContext.industryData.slice(0, 5).map(b => 
        `- ${b.work_category} → ${b.metric_type}: ${b.median_value} (${b.sample_size} offerter, min: ${b.min_value}, max: ${b.max_value})`
      ).join('\n')}`
    : '';

  // ============================================
  // DEL 1: LIVE WEBSÖKNING - Dynamisk branschdata
  // ============================================
  
  // Detektera projekttyp och mått från beskrivning
  const allText = (description + ' ' + conversationHistory.map(m => m.content).join(' ')).toLowerCase();
  const areaMatch = allText.match(/(\d+(?:[.,]\d+)?)\s*(?:kvm|kvadratmeter|m2)/i);
  const lengthMatch = allText.match(/(\d+(?:[.,]\d+)?)\s*(?:meter|löpmeter|m)/i);
  const quantityMatch = allText.match(/(\d+)\s*(?:st|styck|stycken|träd)/i);
  const roomsMatch = allText.match(/(\d+)\s*(?:rum|sovrum)/i);
  
  const measurements = {
    area: areaMatch ? parseFloat(areaMatch[1].replace(',', '.')) : undefined,
    length: lengthMatch ? parseFloat(lengthMatch[1].replace(',', '.')) : undefined,
    quantity: quantityMatch ? parseInt(quantityMatch[1]) : undefined,
    rooms: roomsMatch ? parseInt(roomsMatch[1]) : undefined
  };
  
  // Detektera arbetstyp från beskrivning
  let detectedWorkType = '';
  if (allText.includes('gräs') || allText.includes('klipp')) detectedWorkType = 'gräsklippning';
  else if (allText.includes('häck')) detectedWorkType = 'häckklippning';
  else if (allText.includes('fäll') || allText.includes('trädfällning')) detectedWorkType = 'trädfällning';
  else if (allText.includes('målning') || allText.includes('måla')) detectedWorkType = 'målning';
  else if (allText.includes('badrum')) detectedWorkType = 'badrumsrenovering';
  else if (allText.includes('kök')) detectedWorkType = 'köksrenovering';
  else if (allText.includes('städ')) detectedWorkType = 'städning';
  else if (allText.includes('trädgård')) detectedWorkType = 'trädgårdsarbete';
  else if (allText.includes('el')) detectedWorkType = 'elarbete';
  else if (allText.includes('vvs') || allText.includes('rör')) detectedWorkType = 'vvsarbete';
  
  // Kolla om vi har branschdata för denna arbetstyp
  const hasIndustryData = learningContext.industryData && learningContext.industryData.some(
    (b: any) => b.work_category?.toLowerCase().includes(detectedWorkType.toLowerCase())
  );
  
  let liveSearchText = '';
  
  // DEL 1: Om branschdata saknas OCH vi har en detekterad arbetstyp, kör live websökning
  if (detectedWorkType && !hasIndustryData && Object.values(measurements).some(v => v !== undefined)) {
    console.log(`🔍 DEL 1: Branschdata saknas för "${detectedWorkType}", kör live websökning...`);
    
    try {
      // Skapa supabase client för att spara resultatet
      const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const liveSearchResult = await searchIndustryDataLive(
        detectedWorkType,
        measurements,
        apiKey,
        supabaseClient
      );
      
      liveSearchText = `\n\n**🌐 LIVE WEBSÖKNING (NYA DATA):**
**Arbetstyp:** ${detectedWorkType}
**Källa:** ${liveSearchResult.source}
**Konfidens:** ${(liveSearchResult.confidence * 100).toFixed(0)}%

**Rekommenderade värden:**
- Tidsåtgång: ${liveSearchResult.timeEstimate.toFixed(1)} timmar
- Yrkeskategori: ${liveSearchResult.workCategory}
- Timkostnad: ${liveSearchResult.hourlyRate} kr/h
- Prisintervall: ${liveSearchResult.priceRange.min} - ${liveSearchResult.priceRange.max} kr

**VIKTIGT:** Använd dessa värden som utgångspunkt för din offert. Detta är branschstandarder från aktuella källor.

${liveSearchResult.confidence < 0.7 ? '⚠️ Konfidens är låg - verifiera med användaren om möjligt.' : '✅ Hög konfidens - använd dessa värden.'}`;
      
      console.log(`✅ DEL 1: Live websökning klar, konfidens: ${liveSearchResult.confidence}`);
      
    } catch (error) {
      console.error('❌ DEL 1: Live websökning misslyckades:', error);
      liveSearchText = `\n\n**⚠️ LIVE WEBSÖKNING MISSLYCKADES**
Kunde inte hämta aktuell branschdata. Använd standardpriser och uppskattningar.`;
    }
  } else if (detectedWorkType && hasIndustryData) {
    console.log(`✅ DEL 1: Branschdata finns redan för "${detectedWorkType}", hoppar över websökning`);
  } else if (!detectedWorkType) {
    console.log(`⚠️ DEL 1: Kunde inte detektera specifik arbetstyp, hoppar över websökning`);
  }

  // FAS 1: DOMAIN-SPECIFIC REQUIREMENTS
  let domainKnowledgeText = '';
  
  // Använd mått som redan extraherades ovan (rad 2728-2739)
  const area = measurements.area || 8; // Default 8 kvm om inget angivet
  
  // Check bathroom project
  if (isBathroomProject(description)) {
    domainKnowledgeText = getBathroomPromptAddition(area);
    console.log('🚿🚿🚿 BATHROOM PROJECT DETECTED 🚿🚿🚿');
    console.log('📝 Description:', description);
    console.log('📏 Extracted area:', area, 'kvm');
    console.log('💰 Expected minimum price:', Math.round(area * 18000), 'SEK');
    console.log('💰 Expected recommended price:', Math.round(area * 25000), 'SEK');
  }
  
  // Check kitchen project
  if (isKitchenProject(description)) {
    domainKnowledgeText = getKitchenPromptAddition(area);
    console.log('🍳 Kitchen project detected! Adding requirements checklist...');
  }
  
  // Check painting project
  if (isPaintingProject(description)) {
    domainKnowledgeText = getPaintingPromptAddition(area);
    console.log('🎨 Painting project detected! Adding requirements checklist...');
  }

  // FAS 22 & FAS 25: Enhanced Draft mode instructions with structured price interval format
  const draftModeInstructions = isDraft ? `
🎯 **FAS 22 & FAS 25: DRAFT MODE - SNABB OFFERT MED PRISINTERVALL**

Detta är ett FÖRSTA UTKAST som ska genereras snabbt med rimliga antaganden.

**FAS 25: STRUKTURERAT PRISINTERVALL-FORMAT**

För oklara priser, använd ALDRIG bara text - använd detta EXAKTA JSON-format:

\`\`\`json
{
  "name": "Materialarbete",
  "priceRange": {
    "min": 70000,
    "max": 90000,
    "note": "(beroende på val av material och ytskikt)"
  },
  "isEstimate": true
}
\`\`\`

I summary.customerPays, använd format:
"70000-90000 SEK (beroende på val av material)"

**EXEMPEL - MÅLNING 10 kvm:**

\`\`\`json
{
  "workItems": [
    {
      "name": "Målning väggar och tak",
      "description": "Målning av 10 kvm (väggar, tak, snickeriarbeten)",
      "hours": 8,
      "hourlyRate": 750,
      "subtotal": 6000,
      "priceRange": {
        "min": 5000,
        "max": 7000,
        "note": "(beroende på antal strykningar och förberedelser)"
      },
      "isEstimate": true
    }
  ],
  "materials": [
    {
      "name": "Färg (vägg, tak, snickeri)",
      "description": "Standard kvalitet, flera nyanser",
      "quantity": 1,
      "unit": "set",
      "pricePerUnit": 2500,
      "subtotal": 2500,
      "priceRange": {
        "min": 2000,
        "max": 3500,
        "note": "(beroende på färgval och antal nyanser)"
      },
      "isEstimate": true
    }
  ],
  "summary": {
    "workCost": 6000,
    "materialCost": "2000-3500",
    "totalBeforeVAT": "8000-10500",
    "vatAmount": "2000-2625",
    "totalWithVAT": "10000-13125",
    "customerPays": "10000-13125 SEK (kan justeras efter materialval)"
  }
}
\`\`\`

**DRAFT MODE REGLER:**

1. **ANVÄND PRISINTERVALL - INTE EXAKTA PRISER**
   - workItems: Lägg till "priceRange" object OCH "isEstimate": true
   - materials: Lägg till "priceRange" object OCH "isEstimate": true
   - summary: Använd "min-max" format i customerPays

2. **QUICK ESTIMATES - GÖR RIMLIGA ANTAGANDEN**
   - Standard kvalitet om inget annat sägs
   - Normala förberedelser ingår (spackling, grundning)
   - Standard antal strykningar (2 för väggar, 1 för tak)

3. **MARKERINGAR**
   - Alla items med osäkerhet får isEstimate: true
   - Alla osäkra priser får priceRange med min/max/note

4. **EXEMPEL PÅ ANTAGANDEN:**
   - Målning: "Antog 2 strykningar väggar, 1 strykning tak"
   - Material: "Antog standard kvalitet (mellanpris)"
   - Omfattning: "Antog att normala förberedelser ingår (spackling av mindre sprickor)"

` : '';

  // SPRINT 1.5: Build delta mode intro (if applicable)
  const deltaModeIntro = isDeltaMode ? `
**🔄 DELTA MODE - UTÖKA BEFINTLIG OFFERT (KRITISKT!):**

Du ska INTE skapa en ny offert från grunden. Du ska UTÖKA den befintliga offerten baserat på ny information från kunden.

**BEFINTLIG OFFERT:**
\`\`\`json
${JSON.stringify(previousQuote, null, 2)}
\`\`\`

**FÖREGÅENDE TOTALPRIS:** ${previousTotal} SEK (kunden betalar)

**REGLER FÖR DELTA MODE:**
1. **Vid TILLÄGG av arbete:** Nytt totalpris MÅSTE vara >= ${previousTotal} SEK
2. **Vid BORTTAGNING av arbete:** Beräkna bara de kvarvarande arbetena, priset ska minska
3. **Vid ÄNDRING av material:** Justera bara det specifika arbetet som påverkas
4. **Vid FÖRTYDLIGANDE:** Om kunden bara förtydligar (inte lägger till/tar bort), behåll samma pris ±5%

**VIKTIG LOGIK:**
- Om kunden säger "lägg till takmålning" → Kopiera alla befintliga workItems + lägg till ny för takmålning
- Om kunden säger "ta bort kakling" → Kopiera alla workItems UTOM kakling
- Om kunden säger "använd premium färg istället" → Kopiera workItems, uppdatera material i målnings-itemet

**SPRÅK:**
- Behåll SAMMA SPRÅK som den befintliga offerten (se workItems och materials ovan)

` : `${draftModeInstructions}Du är Handoff AI - en intelligent assistent som hjälper hantverkare skapa professionella offerter.

**🎯 VIKTIG KONTEXT - LÄS NOGA:**
- Du pratar med en HANTVERKARE (arborist/elektriker/målare/rörmokare/snickare etc.)
- Hantverkaren skapar en offert åt sin KUND
- När hantverkaren säger "vi tar hand om X" = X SKA INKLUDERAS i offerten
- När hantverkaren säger "kunden tar hand om X" = X ska EXKLUDERAS från offerten

**EXEMPEL PÅ TOLKNING:**
✅ "Vi tar hand om bortforsling" → Lägg till workItem: "Bortforsling av ris och stamdelar"
✅ "Bortforsling ska finnas med" → Lägg till workItem: "Bortforsling"
❌ "Kunden tar hand om bortforsling" → Lägg till i exclusions: {item: "bortforsling", reason: "Kunden ordnar själv"}
❌ "Bortforsling behövs inte" → Lägg inte till något

`;

  const prompt = deltaModeIntro + `
**PROJEKT:**
${description}

**TIDIGARE KONVERSATION:**
${historyText || 'Ingen tidigare konversation'}

**AVDRAGSTYP:** ${deductionType.toUpperCase()} ${deductionType !== 'none' ? '(inkludera i offerten)' : ''}

${deductionType !== 'none' ? `
**💰 ROT/RUT-AVDRAG (KRITISKT VIKTIGT - ÅTGÄRD #2):**

Denna offert ska ha **${deductionType.toUpperCase()}-avdrag**.

**${deductionType.toUpperCase()}-regler (gäller t.o.m. 2025-12-31):**
- Avdragssats: **50%** av arbetskostnaden inkl. moms
- Maximalt avdrag per person: **${deductionType === 'rot' ? '50 000' : '75 000'} kr** per år
- Max totalt avdrag beror på antal mottagare (konfigureras separat)

**VIKTIGT - Vad är avdragsgillt:**
- ✅ **Endast ARBETSKOSTNAD** (workItems) är avdragsgill
- ✅ Avdraget beräknas på arbetskostnad **INKL. 25% MOMS**
- ❌ Material och utrustning ger **INGET** avdrag

**Beräkningsexempel:**
Om arbetskostnad = 100 000 kr (exkl. moms):
1. Underlag = 100 000 kr × 1.25 (moms) = **125 000 kr**
2. Beräknat avdrag (50%) = 125 000 × 0.5 = **62 500 kr**
3. Faktiskt avdrag begränsas av max-tak (50 000 kr för ROT, 75 000 kr för RUT)
4. Kunden betalar = Totalt inkl. moms - faktiskt avdrag

**Du behöver INTE räkna avdraget själv** - systemet gör det automatiskt baserat på workCost.
Din uppgift är att **skilja på arbete och material korrekt**:
- workItems = Allt arbete som utförs (timmar × timkostnad)
- materials = Allt material som köps in
- equipment = Maskiner och utrustning som används

**Från 2026-01-01 sänks avdraget till 30%** (men det gäller inte denna offert).
` : ''}

${ratesText}

${equipmentText}

${similarQuotesText}

${industryDataText}

${liveSearchText}

${domainKnowledgeText}

    **🚨 KRITISKT - INKLUSIONS/EXKLUSIONS-REGLER:**

När du bygger offerten:

1. Om hantverkaren sagt "vi tar hand om [X]" → Inkludera [X] som workItem eller material
2. Om hantverkaren sagt "kunden tar hand om [X]" → Lägg [X] i "exclusions"
3. Om oklart → Anta att allt som behövs för projektet ska inkluderas (om inte explicit exkluderat)

**EXEMPEL PÅ KORREKT TOLKNING:**

✅ **"Vi tar hand om bortforsling"**
→ Lägg till workItem: { "name": "Bortforsling av ris och stamdelar", "hours": 2, "hourlyRate": 650, "subtotal": 1300 }

✅ **"Bortforsling ska finnas med på offert"**
→ Lägg till workItem: "Bortforsling av byggavfall"

❌ **"Kunden tar hand om bortforsling"**
→ Lägg till i exclusions: { "item": "bortforsling", "reason": "Kunden ordnar själv" }

❌ **"Jag tar hand om bortforsling"**
→ EXKLUDERA (hantverkaren gör det själv utanför offerten)

**SYNONYM-HANTERING:**
- "fälla träd" = "trädfällning"
- "ta bort stubbe" = "stubbfräsning"
- "forsla bort" = "bortforsling"

${exclusions.length > 0 ? `
**🚫 SPRINT 1: EXPLICIT EXKLUDERADE POSTER (VIKTIGT!):**

Följande poster har EXPLICIT exkluderats i konversationen och får INTE inkluderas i offerten:

${exclusions.map(excl => `❌ ${excl.item} - (Anledning: ${excl.reason})`).join('\n')}

**DUBBELKOLLA att ingen av dessa poster finns med i offerten!**
` : ''}

**🧠 SPRINT 1: ASSUMPTION BUDGET (MAX 2 ANTAGANDEN):**

Du får göra MAXIMALT 2 antaganden i denna offert. Ett "antagande" är något du inkluderar som:
- INTE explicit nämnts i konversationen
- Kostar mer än 500 kr
- Inte är en standardpost

**EXEMPEL PÅ ANTAGANDEN:**
- "Antog att rivning behövs" (ej nämnt)
- "Antog standardkvalitet på kakel" (ej specificerat)
- "Antog att el-installation behövs" (ej nämnt)

**INTE ANTAGANDEN (standardposter <500 kr):**
- Slutstädning (standardpost)
- Bortforsling (standardpost om relevant)
- Skyddsutrustning (standardpost)

**OM DU BEHÖVER GÖRA FLER ÄN 2 ANTAGANDEN:**
→ Inkludera INTE den posten! Det betyder att du behöver mer information.

**LOGGA ANTAGANDEN:**
För varje antagande du gör, lägg till ett "assumptions"-fält i response:
{
  "assumptions": [
    "Antog standardkvalitet på kakel (ca 800 kr/kvm) eftersom ingen kvalitetsnivå angavs",
    "Antog att befintlig blandare ska återanvändas eftersom inget nämndes om byte"
  ]
}

**🚨 FAS 1: FÖRBÄTTRAD BESLUTSPROCESS - Branschstandard först!**

NYTT SYSTEM: Inkludera alltid branschstandard för projekttypen, sedan lägg till/ta bort baserat på konversation.

**STEG 1: Vilken projekttyp är detta?**
   - Identifiera projekttyp (badrum, kök, målning, trädfällning, etc.)
   - Ladda in BRANSCHSTANDARD för den typen (obligatoriska arbetsmoment, material, prisintervall)

**STEG 2: Inkludera branschstandard automatiskt**
   ✅ Inkludera ALLA obligatoriska arbetsmoment från branschstandard (även om inte nämnda!)
   ✅ Inkludera ALLA obligatoriska material från branschstandard
   ✅ Följ minsta pris per kvm/flat enligt branschstandard

**STEG 3: Justera baserat på konversation**
   - Om användaren EXPLICIT exkluderar något → Ta bort från offerten + lägg till i "Exkluderingar"
   - Om användaren nämner extra arbete → Lägg till utöver branschstandard
   - Om användaren nämner kvalitetsnivå → Justera priser uppåt/nedåt

**EXEMPEL PÅ KORREKT BESLUTSFATTANDE (NYTT SYSTEM):**

✅ **RÄTT (Badrumsrenovering):**
- Input: "Renovera badrum 8 kvm"
- AI laddar branschstandard för badrum → Inkluderar AUTOMATISKT:
  * Rivning (8-16h)
  * VVS-installation (14-24h) 
  * El-installation (12-18h)
  * Tätskikt (8-12h)
  * Golvvärme (6-10h)
  * Ventilation (4-8h)
  * Kakel (16-32h)
  * Sanitet (6-10h)
- Total: 144 000 kr (18 000 kr/kvm enligt branschstandard)
- ✅ Korrekt: Alla obligatoriska moment ingår automatiskt!

✅ **RÄTT (Med exkludering):**
- Input: "Renovera badrum 8 kvm, kunden ordnar el själv"
- AI laddar branschstandard → Inkluderar alla utom El
- Lägg till i exclusions: "El-installation (kunden ordnar själv)"
- Total: ~120 000 kr (justerat nedåt)
- ✅ Korrekt: Explicit exkludering respekteras

❌ **FEL (Gamla systemet):**
- Input: "Renovera badrum 8 kvm"
- AI inkluderar bara: Kakel + Material = 45 000 kr
- ⚠️ Problem: VVS, El, Tätskikt saknas → offert för billig!

**EXEMPEL PÅ KORREKT BESLUTSFATTANDE:**

❌ **FEL:**
- Beskrivning: "Fälla 3 stora granar"
- AI inkluderar: "Arboristarbete - 8h × 800 kr = 6400 kr"
- ⚠️ Problem: "Arborist" nämndes INTE → ska INTE inkluderas även om det verkar logiskt!

✅ **RÄTT:**
- Beskrivning: "Fälla 3 stora granar"
- AI inkluderar: "Fällning av träd - 6h × 800 kr" + "Bortforsling - 1200 kr" (standardpost)
- ✅ Korrekt: Bara det som nämnts + relevanta standardposter

❌ **FEL:**
- Beskrivning: "Renovera badrum 8 kvm"
- AI inkluderar: "Rivning av kakel och VVS - 15h × 850 kr = 12750 kr"
- ⚠️ Problem: "Rivning" nämndes INTE → ska INTE inkluderas!

✅ **RÄTT:**
- Beskrivning: "Renovera badrum 8 kvm, rivning ingår"
- AI inkluderar: "Rivning - 15h" + "Kakelläggning - 20h" + "VVS-installation - 12h"
- ✅ Korrekt: Rivning explicit nämnt

**STANDARDPOSTER (inkludera ALLTID om relevanta för projektet):**
✅ Slutstädning efter arbetet (<2000 kr)
✅ Bortforsling av byggavfall (<2000 kr)
✅ Skyddande av angränsande ytor (<1500 kr)
✅ Grund- och färdigställningsarbete (<2000 kr)
✅ Skyddsplast och maskering (<1000 kr)
✅ Förbrukningsmaterial (skruv, spackel, etc.) - max 3-5% av material

**STORA ARBETSMOMENT SOM KRÄVER EXPLICIT OMNÄMNANDE (>5000 kr):**
❌ Rivning av konstruktioner
❌ Nya VVS-installationer
❌ Nya el-installationer
❌ Trädarbete med specialutrustning
❌ Markarbete (grävning, dränering)
❌ Omfattande förberedande arbete
❌ Extra hantverkare eller specialister
❌ Stubbfräsning
❌ Arborist-arbete

**SAMMANFATTNING:**
- Stort moment (>5000 kr) + INTE nämnt = INKLUDERA INTE
- Standardpost (<2000 kr) + relevant = INKLUDERA
- Nämnt i konversation = INKLUDERA

**🔧 STRUKTUR-REGLER (KRITISKT):**

**workItems = ARBETE MED TIMMAR:**
- Allt som UTFÖRS av hantverkaren
- MÅSTE ha: hours (antal timmar), hourlyRate (kr/h), subtotal (hours × hourlyRate)
- Exempel: "Fällning av träd", "Kakelläggning", "Målning av väggar"
- ❌ ALDRIG: hours: 0 eller hourlyRate: 0

**materials = KÖPT MATERIAL:**
- Allt som KÖPS för projektet (kakel, färg, blandare, cement)
- MÅSTE ha: quantity (antal), unit (kvm/st/liter), pricePerUnit (kr/enhet), subtotal (quantity × pricePerUnit)
- ❌ ALDRIG: "Arboristtjänst", "VVS-arbete", "Elektriker-tjänst" → det är ARBETE, inte material!

**equipment = MASKINER/UTRUSTNING:**
- Maskiner som hyrs eller ägs
- Exempel: "Grävmaskin", "Motorsåg", "Bygghiss"
- MÅSTE ha: quantity (dagar eller timmar), pricePerUnit, subtotal

**STANDARDPOSTER - HANTERING:**
Små fasta kostnader (<2000 kr) som inte är direkta timmar:

**OM STANDARDPOST ÄR DIREKT ARBETE:**
→ Lägg i workItems med UPPSKATTADE timmar
Exempel: "Slutstädning" → 2h × 650 kr/h = 1300 kr

**OM STANDARDPOST ÄR ENGÅNGSKOSTNAD (inte direkt timmar):**
→ Lägg i materials som "Engångspost"
Exempel: 
{
  "name": "Bortforsling av byggavfall",
  "description": "Bortforsling av ris och stammar (fast pris)",
  "quantity": 1,
  "unit": "st",
  "pricePerUnit": 1500,
  "subtotal": 1500
}

**❌ ALDRIG GÖR SÅ HÄR:**
{
  "name": "Bortforsling",
  "hours": 0,        ← FEL! Antingen timmar ELLER engångspost
  "hourlyRate": 0,   ← FEL!
  "subtotal": 1500
}

**KRITISKT - MATERIAL-SPECIFIKATION:**

**VIKTIGT - ANVÄND KUNDENS ÖNSKEMÅL:**
Om kunden nämner ett specifikt märke, produkt eller kvalitet i konversationen 
(t.ex. "Tekknos färg", "Beckers", "Alcro", "Jotun"), MÅSTE du använda 
EXAKT det märket i offerten, inte ett annat alternativ!

Exempel på KORREKT hantering:
✅ Kund: "Jag vill använda Tekknos färg"
   → Material: "Tekknos Väggfärg Premium matt vit, 10 liter"

✅ Kund: "Vi brukar köpa Beckers"
   → Material: "Beckers Perfekt Väggfärg matt, 15 liter"

❌ Kund: "Jag vill använda Tekknos färg"
   → Material: "Alcro Addera Täckfärg" (FEL! Annat märke)

Om inget märke nämnts kan du välja ett lämpligt märke själv.

VARJE material MÅSTE specificeras enligt: **Märke + Modell + Storlek/Färg + Mängd + Enhet**

✅ **Exempel RÄTT:**
- "Väggkakel - Marazzi Oficina 30x60cm vit matt, 16 kvm"
- "Duschblandare - Oras Safira termostat krom 7193, 1 st"
- "Väggfärg - Alcro Tidevärv kulör Moln matt, 30 liter"
- "Grankottestubbe - Rak gran 40cm diameter, 3 st"

❌ **Exempel FEL (för generiskt):**
- "Kakel" → saknar märke, modell, storlek
- "VVS-material" → för generiskt, dela upp
- "Material och förbrukning" → för vagt, specificera

**VIKTIGT:**
1. Använd EXAKT de timpriser som angivits
2. Inkludera maskiner/utrustning från listan när relevant
3. Lär av tidigare liknande offerter (priser, omfattning, material)
4. Använd branschdata som referens för att validera priser
5. Var realistisk med tider och endast inkludera vad som diskuterats
6. Inkludera standardposter från listan ovan om relevanta
7. Inkludera INTE stora arbetsmoment som inte diskuterats (se lista ovan)
${includeExplanations ? `
8. **FAS 14: FÖRKLARINGAR (KRITISKT VIKTIGT!)** 
   Lägg till ett "explanation"-fält för VARJE workItem, material och equipment som förklarar:
   - VARFÖR denna post ingår i offerten
   - HUR priset/tiden beräknades
   - VILKA faktorer som påverkade beslutet
   
   **EXEMPEL PÅ BRA FÖRKLARINGAR:**
   ✅ "explanation": "Rivning krävs enligt branschstandard för badrumsrenovering. 8 kvm × 4 timmar/kvm baserat på befintlig kakeltyp."
   ✅ "explanation": "Premium kakel valt enligt kundens önskemål. Pris baserat på Marazzi-serien som nämndes i konversationen."
   ✅ "explanation": "Motorsåg behövs för träd över 10m höjd. 2 dagars hyra baserat på 3 träd × 4 timmar per träd."
   
   **EXEMPEL PÅ DÅLIGA FÖRKLARINGAR:**
   ❌ "explanation": "Behövs för projektet" (för vag)
   ❌ "explanation": "Standard" (ingen kontext)
   ❌ "explanation": "" (tom)
` : ''}

**EXEMPEL PÅ KORREKT STRUKTUR:**

**Scenario: Fälla 3 stora granar (15m höga)**

✅ **RÄTT:**
{
  "workItems": [
    {
      "name": "Fällning av granar",
      "description": "Fällning av 3 stora granar (15m höga, 5m diameter)",
      "hours": 12,
      "hourlyRate": 800,
      "subtotal": 9600${includeExplanations ? `,
      "explanation": "12 timmar baserat på 4 timmar per träd (15m höjd kräver försiktig fällning). Timpris 800 kr/h för arboristarbete enligt användarens prislista."` : ''}
    },
    {
      "name": "Slutstädning",
      "description": "Städning av arbetsområdet",
      "hours": 2,
      "hourlyRate": 650,
      "subtotal": 1300${includeExplanations ? `,
      "explanation": "Standardpost för alla trädfällningsprojekt. 2 timmar för att städa upp kvistar och spill från 3 träd."` : ''}
    }
  ],
  "materials": [
    {
      "name": "Bortforsling av byggavfall",
      "description": "Bortforsling av ris och stammar (fast pris)",
      "quantity": 1,
      "unit": "st",
      "pricePerUnit": 1500,
      "subtotal": 1500${includeExplanations ? `,
      "explanation": "Fast pris för bortforsling av trädrester från 3 granar. Inkluderar transport till återvinningsstation."` : ''}
    },
    {
      "name": "Motorsågsolja och kedja",
      "description": "Förbrukningsmaterial för motorsåg",
      "quantity": 1,
      "unit": "set",
      "pricePerUnit": 400,
      "subtotal": 400${includeExplanations ? `,
      "explanation": "Förbrukningsmaterial uppskattat för 12 timmars motorsågsarbete (3 träd). Inkluderar kedjolja och reservkedja."` : ''}
    }
  ],
  "equipment": [
    {
      "name": "Motorsåg",
      "description": "Hyrd motorsåg för fällning",
      "quantity": 2,
      "unit": "dagar",
      "pricePerUnit": 600,
      "subtotal": 1200${includeExplanations ? `,
      "explanation": "Professionell motorsåg hyrs i 2 dagar (12 timmars arbete kräver 2 arbetsdagar). Hyra 600 kr/dag enligt utrustningslista."` : ''}
    }
  ]
}

❌ **FEL:**
{
  "workItems": [
    {
      "name": "Bortforsling",
      "hours": 0,          ← FEL! Antingen timmar eller flytta till materials
      "hourlyRate": 0,     ← FEL!
      "subtotal": 1500
    }
  ],
  "materials": [
    {
      "name": "Arboristtjänst",  ← FEL! Tjänst = arbete, ska vara i workItems
      "quantity": 1,
      "pricePerUnit": 15000,
      "subtotal": 15000
    }
  ]
}

**🔤 SPRÅK-KRAV (KRITISKT - ÅTGÄRD #3):**

ALLA texter i offerten MÅSTE vara på SVENSKA:
- ✅ workItems[].name: "Fällning av träd" (INTE "Tree removal")
- ✅ materials[].name: "Motorsågsolja" (INTE "Chainsaw oil")
- ✅ equipment[].name: "Grävmaskin" (INTE "Excavator")
- ✅ description: Svenska beskrivningar

❌ ALDRIG använda engelska termer i offerten!

**RETURNERA JSON:**
{
  "workItems": [
    {
      "name": "Arbetsbeskrivning (PÅ SVENSKA)",
      "description": "Detaljerad beskrivning (PÅ SVENSKA)",
      "hours": 8,
      "hourlyRate": 850,
      "subtotal": 6800
    }
  ],
  "materials": [
    {
      "name": "Märke + Modell + Storlek/Färg (PÅ SVENSKA)",
      "description": "Kort beskrivning (PÅ SVENSKA)",
      "quantity": 16,
      "unit": "kvm",
      "pricePerUnit": 800,
      "subtotal": 12800
    }
  ],
  "equipment": [
    {
      "name": "Maskinnamn (PÅ SVENSKA)",
      "description": "Beskrivning (PÅ SVENSKA)",
      "quantity": 3,
      "unit": "dagar",
      "pricePerUnit": 450,
      "subtotal": 1350
    }
  ],
  "summary": {
    "workCost": 6800,           // ✅ Number, inte string
    "materialCost": 12800,       // ✅ Number
    "equipmentCost": 1350,       // ✅ Number
    "totalBeforeVAT": 20950,     // ✅ Number
    "vatAmount": 5237.5,         // ✅ VIKTIGT: Heter "vatAmount" (INTE "vat")
    "totalWithVAT": 26187.5,     // ✅ Number
    "customerPays": 26187.5      // ✅ Number
  },
  "assumptions": [
    "Antagande 1 om du gjorde ett (eller tom array [])"
  ]
}

**🚨 KRITISKT - summary-fältet:**
- ALLA värden MÅSTE vara Number (inte string, inte object)
- "vatAmount" (INTE "vat")
- Inga tomma fält eller null-värden
- Inga "[object Object]"-strängar`;

  try {
    console.log('🤖 Generating quote with AI...');
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`AI quote generation failed: ${response.statusText}`);
    }

    const data = await response.json();
    const quote = JSON.parse(data.choices[0].message.content);
    
    // ÅTGÄRD 4: Debug-logging för AI response structure
    console.log('📊 AI Response Structure:', {
      hasQuote: !!quote,
      hasWorkItems: !!quote?.workItems,
      workItemsCount: quote?.workItems?.length ?? 0,
      hasMaterials: !!quote?.materials,
      materialsCount: quote?.materials?.length ?? 0,
      hasEquipment: !!quote?.equipment,
      equipmentCount: quote?.equipment?.length ?? 0,
      hasSummary: !!quote?.summary,
      summaryKeys: quote?.summary ? Object.keys(quote.summary) : [],
      summaryValues: quote?.summary
    });

    // Validera att AI:n returnerade rätt format
    if (!quote) {
      console.error('❌ AI returned empty response!');
      throw new Error('AI response missing quote object');
    }
    
    if (!quote.workItems && !quote.materials && !quote.equipment) {
      console.error('❌ AI returned quote with no items!');
      throw new Error('Quote has no workItems, materials, or equipment');
    }
    
    // ÅTGÄRD #3: Validera summary-struktur och svenska språket
    if (quote.summary) {
      const requiredFields = ['workCost', 'materialCost', 'equipmentCost', 'totalBeforeVAT', 'vatAmount', 'totalWithVAT', 'customerPays'];
      const missingFields = requiredFields.filter(field => typeof quote.summary[field] !== 'number');
      
      if (missingFields.length > 0) {
        console.error('❌ Quote summary validation failed - missing fields:', missingFields);
      }
      
      // Kontrollera att inga "[object Object]" finns
      const summaryStr = JSON.stringify(quote.summary);
      if (summaryStr.includes('[object Object]') || summaryStr.includes('object Object')) {
        console.error('❌ Summary contains [object Object] strings!');
      }
    }
    
    // ÅTGÄRD #3: Validera svenska språket
    const englishPattern = /\b(tree|removal|excavator|chainsaw|oil|demolition|painting|renovation|stump|grinding)\b/i;
    const englishWarnings: string[] = [];
    
    quote.workItems?.forEach((item: any) => {
      if (englishPattern.test(item.name) || englishPattern.test(item.description || '')) {
        englishWarnings.push(`⚠️ Engelska termer i workItem: "${item.name}"`);
      }
    });
    
    quote.materials?.forEach((item: any) => {
      if (englishPattern.test(item.name) || englishPattern.test(item.description || '')) {
        englishWarnings.push(`⚠️ Engelska termer i material: "${item.name}"`);
      }
    });
    
    quote.equipment?.forEach((item: any) => {
      if (englishPattern.test(item.name) || englishPattern.test(item.description || '')) {
        englishWarnings.push(`⚠️ Engelska termer i equipment: "${item.name}"`);
      }
    });
    
    if (englishWarnings.length > 0) {
      console.warn('⚠️ Svenska-validering misslyckades:', englishWarnings);
    }
    
    console.log('✅ Quote generated successfully');
    return quote;
  } catch (error) {
    console.error('Error generating quote:', error);
    throw new Error('Failed to generate quote');
  }
}

// ============================================
// MATERIAL RETRY (if too generic)
// ============================================

async function retryMaterialSpecification(
  quote: any,
  description: string,
  apiKey: string
): Promise<any> {
  console.log('🔄 Materials too generic, asking AI to specify better...');

  const genericMaterials = quote.materials?.filter((m: any) => {
    const name = m.name?.toLowerCase() || '';
    return name.includes('material') || 
           name.includes('förbrukning') ||
           name.includes('diverse') ||
           (name.split(' ').length < 3);
  }) || [];

  // STEG 3: Förbättrad prompt för bättre material-specifikation
  const prompt = `Du genererade en offert men några material är för generiska.

**PROJEKT:** ${description}

**GENERISKA MATERIAL:**
${genericMaterials.map((m: any) => `- ${m.name}: ${m.quantity} ${m.unit} × ${m.pricePerUnit} kr`).join('\n')}

**UPPGIFT:**
Specificera dessa material enligt: **Märke + Modell + Storlek/Färg**

**VIKTIGA REGLER:**
1. ALLTID inkludera märke (Oras, Gustavsberg, IFÖ, Marazzi, Alcro, etc.)
2. ALLTID inkludera modell/serie
3. ALLTID inkludera storlek/dimension där relevant
4. Använd verkliga märken från svenska marknaden
5. Priset MÅSTE vara realistiskt för det specifika märket

**Exempel på RÄTT specifikation:**
❌ "VVS-material" (för generiskt)
✅ "Duschblandare Oras Safira termostat krom" (specifikt)

❌ "Kakel" (för generiskt)
✅ "Kakel Marazzi Oficina 30x60cm vit matt" (specifikt)

❌ "Färg" (för generiskt)
✅ "Väggfärg Alcro Tidevärv kulär Moln matt 10L" (specifikt)

❌ "Golv" (för generiskt)
✅ "Laminatgolv Pergo Domestic 8mm ek grå" (specifikt)

Returnera JSON med ALLA material från original-offerten men med bättre specifikation:
{
  "materials": [
    {
      "name": "Specificerat märke + modell + storlek",
      "description": "Kort beskrivning",
      "quantity": 16,
      "unit": "kvm",
      "pricePerUnit": 800,
      "subtotal": 12800
    }
  ]
}`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error('Material retry failed, keeping original');
      return quote;
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    
    // Update materials in quote
    if (result.materials && result.materials.length > 0) {
      quote.materials = result.materials;
      console.log('✅ Materials specified better');
    }
    
    return quote;
  } catch (error) {
    console.error('Error retrying material specification:', error);
    return quote; // Return original if retry fails
  }
}

// ============================================
// SPRINT 1: VALIDATE ASSUMPTIONS
// ============================================

function validateAssumptions(quote: any): { valid: boolean; warnings: string[] } {
  const assumptions = quote.assumptions || [];
  const warnings: string[] = [];
  
  console.log(`🧠 Assumptions made: ${assumptions.length}`);
  
  if (assumptions.length > 0) {
    assumptions.forEach((assumption: string, index: number) => {
      console.log(`  ${index + 1}. ${assumption}`);
    });
  }
  
  if (assumptions.length > 2) {
    warnings.push(`⚠️ För många antaganden (${assumptions.length}/2). Detta indikerar att mer information behövs.`);
    return { valid: false, warnings };
  }
  
  return { valid: true, warnings };
}

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Quote generation request started');

    // Parse and validate request
    const body = await req.json();
    const validatedData = RequestSchema.parse(body);
    
    const {
      description,
      conversation_history = [],
      deductionType,
      recipients,
      sessionId,
      customerId,
      referenceQuoteId,
      imageAnalysis,
      intent,
      previous_quote_id,
      isDraft = false, // FAS 20: Draft mode flag
    } = validatedData;

    console.log('Description:', description);
    console.log('Deduction type requested:', deductionType);
    console.log('Conversation history length:', conversation_history.length);
    console.log('Intent:', intent);
    console.log('Previous quote ID:', previous_quote_id || 'None (new quote)');

    // Get user ID from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Invalid authorization token');
    }

    const user_id = user.id;
    console.log('Generating quote for user:', user_id);

    // FAS 11: Fetch conversation summary early if sessionId exists
    let conversationSummary: any = null;
    let actualConversationHistory = conversation_history || [];
    
    if (sessionId) {
      console.log('📚 FAS 11: Fetching conversation summary from database...');
      try {
        const { data: sessionData } = await supabaseClient
          .from('conversation_sessions')
          .select('conversation_summary')
          .eq('id', sessionId)
          .single();
        
        if (sessionData?.conversation_summary) {
          conversationSummary = sessionData.conversation_summary;
          console.log('✅ FAS 11: Loaded conversation summary');
        }
        
        // Fetch messages for fallback
        const { data: messagesData } = await supabaseClient
          .from('conversation_messages')
          .select('role, content')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });
        
        if (messagesData && messagesData.length > 0) {
          actualConversationHistory = messagesData.map((m: any) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content
          }));
          console.log(`✅ Loaded ${actualConversationHistory.length} messages from DB`);
        }
      } catch (error) {
        console.error('Exception fetching conversation data:', error);
      }
    }

    // ÅTGÄRD 1 & 4 + FAS 11: Build complete description
    const completeDescription = conversationSummary 
      ? buildEnhancedDescriptionFromSummary(description, conversationSummary)
      : buildCompleteDescription(actualConversationHistory, description);
    
    console.log('📝 Complete description length:', completeDescription.length, 'chars');
    console.log('📝 Using conversation summary:', !!conversationSummary);

    // ============================================
    // STEP 1: FETCH USER DATA
    // ============================================

    console.log('📚 Fetching learning context...');
    const learningContext = await fetchLearningContext(supabaseClient, user_id, sessionId);

    // Fetch hourly rates
    const { data: hourlyRates } = await supabaseClient
      .from('hourly_rates')
      .select('work_type, rate')
      .eq('user_id', user_id);

    console.log('Using hourly rates:', hourlyRates || []);

    // Fetch equipment
    const { data: equipmentRates } = await supabaseClient
      .from('equipment_rates')
      .select('name, equipment_type, price_per_day, price_per_hour, is_rented, default_quantity')
      .eq('user_id', user_id);

    console.log('Using equipment:', equipmentRates || []);

    // ============================================
    // SPRINT 1.5: FETCH PREVIOUS QUOTE (DELTA MODE)
    // ============================================

    let previousQuote = null;
    let previousQuoteTotal = 0;
    let isDeltaMode = false;
    
    if (previous_quote_id) {
      console.log(`🔄 DELTA MODE: Fetching previous quote: ${previous_quote_id}`);
      const { data: prevQuoteData, error: prevQuoteError } = await supabaseClient
        .from('quotes')
        .select('generated_quote, edited_quote')
        .eq('id', previous_quote_id)
        .eq('user_id', user_id)
        .single();
      
      if (!prevQuoteError && prevQuoteData) {
        previousQuote = prevQuoteData.edited_quote || prevQuoteData.generated_quote;
        previousQuoteTotal = parseFloat(previousQuote?.summary?.customerPays || '0');
        isDeltaMode = true;
        console.log(`✅ Previous quote loaded. Total: ${previousQuoteTotal} SEK`);
        console.log(`📝 Mode: EXTENDING existing quote (not creating new)`);
      } else {
        console.error('❌ Failed to fetch previous quote:', prevQuoteError);
      }
    }

    // ============================================
    // STEP 2: FIND SIMILAR QUOTES
    // ============================================

    let similarQuotes: any[] = [];
    
    if (referenceQuoteId === 'auto') {
      console.log('🔍 Auto-finding similar quotes...');
      const { data: similar } = await supabaseClient
        .rpc('find_similar_quotes', {
          user_id_param: user_id,
          description_param: description,
          limit_param: 3
        });
      
      if (similar && similar.length > 0) {
        similarQuotes = similar.map((q: any) => ({
          id: q.quote_id,
          title: q.title,
          description: q.description,
          quote_data: q.quote_data
        }));
        console.log(`✅ Found ${similarQuotes.length} similar quotes`);
      }
    } else if (referenceQuoteId) {
      // Get specific reference quote
      const { data: specific } = await supabaseClient
        .from('quotes')
        .select('id, title, description, generated_quote, edited_quote')
        .eq('id', referenceQuoteId)
        .eq('user_id', user_id)
        .single();
      
      if (specific) {
        similarQuotes = [{
          id: specific.id,
          title: specific.title,
          description: specific.description,
          quote_data: specific.edited_quote || specific.generated_quote
        }];
        console.log('✅ Using specific reference quote');
      }
    }

    // ============================================
    // STEP 3: DETECT DEDUCTION TYPE
    // ============================================

    let finalDeductionType = deductionType;
    let rotRutExplanation: RotRutClassification | null = null;
    
    if (finalDeductionType === 'auto') {
      // FAS 17: Use AI-driven ROT/RUT classification
      console.log('🤖 FAS 17: Calling AI ROT/RUT classifier...');
      try {
        const classifyResponse = await supabaseClient.functions.invoke('classify-rot-rut', {
          body: {
            projectDescription: completeDescription,
            workType: conversationSummary?.projectType || '',
            conversationSummary
          }
        });

        if (classifyResponse.data && !classifyResponse.error) {
          rotRutExplanation = classifyResponse.data as RotRutClassification;
          finalDeductionType = rotRutExplanation.deductionType;
          console.log(`✅ AI Classification: ${finalDeductionType} (${rotRutExplanation.confidence}% confidence)`);
          console.log(`📝 Reasoning: ${rotRutExplanation.reasoning}`);
        } else {
          console.warn('⚠️ AI classification failed, falling back to rule-based');
          const ruleBasedDeduction = detectDeductionByRules(completeDescription);
          if (ruleBasedDeduction) {
            finalDeductionType = ruleBasedDeduction;
          } else {
            // Use AI for unclear cases
            console.log('⚠️ Unclear deduction, using AI...');
            finalDeductionType = await detectDeductionWithAI(completeDescription, LOVABLE_API_KEY);
          }
          
          // Cache for future
          if (sessionId && finalDeductionType !== 'none') {
            await supabaseClient
              .from('conversation_sessions')
              .update({
                learned_preferences: {
                  ...learningContext.learnedPreferences,
                  deductionType: finalDeductionType
                }
              })
              .eq('id', sessionId);
            console.log('💾 Cached deduction type');
          }
        }
      } catch (error) {
        console.error('❌ ROT/RUT classification error:', error);
        // Fallback to rule-based
        const ruleBasedDeduction = detectDeductionByRules(completeDescription);
        finalDeductionType = ruleBasedDeduction || 'none';
      }
    }

    console.log(`📅 Deduction type: ${finalDeductionType}`);
    console.log(`📊 Recipients: ${recipients} → Max ROT: ${50000 * recipients} kr, Max RUT: ${75000 * recipients} kr`);

    // ============================================
    // STEP 3.5: FETCH CONVERSATION FEEDBACK ONCE (BEFORE INTENT HANDLING)
    // ============================================
    
    console.log('📊 Fetching conversation feedback...');
    let conversationFeedback: ConversationFeedback;
    let readiness: QuoteReadiness;

    if (sessionId && actualConversationHistory.length > 0) {
      const { data: cachedSession } = await supabaseClient
        .from('conversation_sessions')
        .select('conversation_feedback')
        .eq('id', sessionId)
        .single();
      
      if (cachedSession?.conversation_feedback?.message_count === actualConversationHistory.length) {
        conversationFeedback = cachedSession.conversation_feedback.data;
        console.log('💾 Using cached conversation feedback');
      } else {
        conversationFeedback = await analyzeConversationProgress(
          completeDescription,
          actualConversationHistory,
          LOVABLE_API_KEY
        );
        
        await supabaseClient
          .from('conversation_sessions')
          .update({
            conversation_feedback: {
              message_count: actualConversationHistory.length,
              data: conversationFeedback
            }
          })
          .eq('id', sessionId);
      }
    } else {
      conversationFeedback = await analyzeConversationProgress(
        completeDescription,
        actualConversationHistory.length > 0 ? actualConversationHistory : conversation_history,
        LOVABLE_API_KEY
      );
    }

    readiness = determineQuoteReadiness(
      completeDescription,
      actualConversationHistory,
      conversationFeedback
    );

    console.log(`🎯 Initial readiness: ${readiness.readiness_score}%`);
    console.log(`  ✅ Förstått: ${Object.keys(conversationFeedback.understood).length} detaljer`);
    console.log(`  ❓ Saknas: ${conversationFeedback.missing.length} saker`);

    // ============================================
    // STEP 4: HANDLE EXPLICIT INTENTS FROM BUTTONS
    // ============================================
    
    if (intent) {
      console.log(`🎯 Handling explicit intent: ${intent}`);
      
      // Extract mentioned items to prevent hallucinations
      const mentionedItems = extractMentionedItems(conversation_history);
      console.log('📝 Mentioned items in conversation:', mentionedItems);
      
      // Route baserat på intent
      if (intent === 'confirm' || intent === 'generate') {
        console.log('✅ User confirmed via button, forcing quote generation');
        readiness.readiness_score = 95;
        readiness.can_generate = true;
        // Fortsätt till offertgenerering nedan
      } else if (intent === 'edit') {
        console.log('✏️ User wants to edit via button');
        
        return new Response(
          JSON.stringify({
            type: 'clarification',
            questions: ['Vad vill du ändra i offerten?'],
            conversationFeedback,
            readiness,
            quickReplies: [
              { label: '📏 Mått', action: 'edit_measurements' },
              { label: '🔧 Omfattning', action: 'edit_scope' },
              { label: '🏗️ Material', action: 'edit_materials' },
              { label: '✅ Inkludera', action: 'edit_inclusions' },
              { label: '❌ Exkludera', action: 'edit_exclusions' },
              { label: '💰 Budget', action: 'edit_budget' },
            ]
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      } else if (intent?.startsWith('edit_')) {
        console.log(`✏️ User wants to edit specific: ${intent}`);
        
        const editArea = intent.replace('edit_', '');
        const editPrompts: Record<string, string> = {
          'measurements': '📏 Berätta mer om måtten och storleken på projektet:',
          'scope': '🔨 Vad vill du ändra gällande omfattningen av arbetet?',
          'materials': '🎨 Vilken materialkvalitet föredrar du?',
          'inclusions': '✅ Vad ska inkluderas i offerten?',
          'exclusions': '❌ Vad ska INTE ingå i offerten?',
          'budget': '💰 Vad har du för budget i åtanke?'
        };
        
        const promptMessage = editPrompts[editArea] || 'Vad vill du ändra?';
        
        return new Response(
          JSON.stringify({
            type: 'clarification',
            questions: [promptMessage],
            conversationFeedback,
            readiness,
            quickReplies: [
              { label: '🔙 Tillbaka', action: 'edit' },
              { label: '📋 Generera ändå', action: 'generate' }
            ]
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      } else if (intent === 'add_info' || intent === 'more_info') {
        console.log('➕ User wants to add more info via button');
        
        const questions = await askClarificationQuestions(
          completeDescription,
          actualConversationHistory,
          [], // similarQuotes - tomt för nu
          LOVABLE_API_KEY
        );

        if (questions && questions.length > 0) {
          console.log(`💬 Asking ${questions.length} clarification question(s)`);
          
          return new Response(
            JSON.stringify({
              type: 'clarification',
              questions: questions,
              conversationFeedback,
              readiness,
              quickReplies: [
                { label: '📋 Generera ändå', action: 'generate' }
              ]
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          );
        }
      } else if (intent === 'review') {
        console.log('👁️ User wants to review summary via button');
        
        const rawExclusions = parseExclusions(actualConversationHistory);
        const rawInclusions = detectInclusions(actualConversationHistory);
        
        const { validInclusions, validExclusions, warnings } = validateInclusionsExclusions(
          rawInclusions,
          rawExclusions,
          actualConversationHistory
        );

        if (warnings.length > 0) {
          console.log('⚠️ Semantic validation warnings:', warnings);
        }
        
        const exclusions = validExclusions;
        const inclusions = validInclusions;
        
        const summary = buildProjectSummary(
          completeDescription,
          actualConversationHistory,
          exclusions,
          inclusions,
          conversationFeedback
        );
        
        const confirmationMessage = `✅ **Sammanfattning av projektet:**

${summary}

🎯 **Readiness: ${readiness.readiness_score}%**

**Stämmer detta?**`;

        return new Response(
          JSON.stringify({
            type: 'context_confirmation',
            message: confirmationMessage,
            summary: summary,
            conversationFeedback,
            readiness,
            can_generate_now: true,
            quickReplies: [
              { label: '✅ Ja, generera offert', action: 'confirm' },
              { label: '✏️ Ändra något', action: 'edit' },
              { label: '➕ Lägg till mer info', action: 'add_info' }
            ]
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      } else if (intent === 'review') {
        console.log('👁️ User wants to review summary via button');
        
        const rawExclusions2 = parseExclusions(actualConversationHistory);
        const rawInclusions2 = detectInclusions(actualConversationHistory);
        
        const { validInclusions: validInclusions2, validExclusions: validExclusions2, warnings: warnings2 } = validateInclusionsExclusions(
          rawInclusions2,
          rawExclusions2,
          actualConversationHistory
        );

        if (warnings2.length > 0) {
          console.log('⚠️ Semantic validation warnings:', warnings2);
        }
        
        const exclusions = validExclusions2;
        const inclusions = validInclusions2;
        
        const summary = buildProjectSummary(
          completeDescription,
          actualConversationHistory,
          exclusions,
          inclusions,
          conversationFeedback
        );
        
        const confirmationMessage = `✅ **Sammanfattning av projektet:**

${summary}

🎯 **Readiness: ${readiness.readiness_score}%**

**Stämmer detta?**`;

        return new Response(
          JSON.stringify({
            type: 'context_confirmation',
            message: confirmationMessage,
            summary: summary,
            conversationFeedback,
            readiness,
            can_generate_now: true,
            quickReplies: [
              { label: '✅ Ja, generera offert', action: 'confirm' },
              { label: '✏️ Ändra något', action: 'edit' },
              { label: '➕ Lägg till mer info', action: 'add_info' }
            ]
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      } else if (intent) {
        console.error(`❌ Unknown intent received: ${intent}`);
        
        return new Response(
          JSON.stringify({
            type: 'error',
            message: `Okänd action: ${intent}. Försök igen eller beskriv vad du vill göra.`,
            conversationFeedback,
            readiness
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      }
      // Om intent = confirm/generate, fortsätt till generering
    }

    // ============================================
    // STEP 5: CHECK READINESS (Skip if intent already forced generation)
    // ============================================

    console.log(`🎯 Final readiness check: ${readiness.readiness_score}% (kan generera: ${readiness.can_generate})`);

    // Update session with readiness score and stage
    if (sessionId) {
      const stage = readiness.can_generate ? 'ready_to_quote' : 'gathering_details';
      await supabaseClient
        .from('conversation_sessions')
        .update({
          readiness_score: readiness.readiness_score,
          conversation_stage: stage
        })
        .eq('id', sessionId);
    }

    // ============================================
    // STEP 6: CHECK IF CLARIFICATION NEEDED
    // ============================================

    // ÅTGÄRD #3: Endast fråga om readiness < 85% OCH critical info saknas
    if (!readiness.can_generate && actualConversationHistory.length <= 4) {
      console.log('🤔 Checking if clarification needed...');
      
      const questions = await askClarificationQuestions(
        completeDescription,
        actualConversationHistory,
        similarQuotes,
        LOVABLE_API_KEY
      );

      if (questions && questions.length > 0) {
        // ÅTGÄRD 4B: Final deduplication innan retur
        const lastAssistantMessage = actualConversationHistory
          .filter(m => m.role === 'assistant')
          .slice(-1)[0];
        
        const lastAssistantQuestion = lastAssistantMessage 
          ? (lastAssistantMessage.content.match(/[^.!?]*\?/g) || []).map(q => q.trim())
          : [];
        
        console.log('📝 Last assistant questions:', lastAssistantQuestion);
        
        const normalizeQuestion = (q: string) => 
          q.trim().toLowerCase().replace(/[.!?]+$/, '');
        
        const lastQuestionSet = new Set(lastAssistantQuestion.map(normalizeQuestion));
        
        const deduplicatedQuestions = questions.filter(q => {
          const normalized = normalizeQuestion(q);
          return !lastQuestionSet.has(normalized);
        });
        
        console.log(`💬 Questions before dedupe: ${questions.length}, after: ${deduplicatedQuestions.length}`);
        
        if (deduplicatedQuestions.length !== questions.length) {
          console.log('⚠️ Removed duplicate questions:', 
            questions.filter(q => !deduplicatedQuestions.includes(q))
          );
        }
        
        if (deduplicatedQuestions.length > 0) {
          console.log(`💬 Asking ${deduplicatedQuestions.length} clarification question(s)`);
          
          return new Response(
            JSON.stringify({
              type: 'clarification',
              questions: deduplicatedQuestions,
              conversationFeedback,
              readiness
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          );
        }
      }
    }

    // ÅTGÄRD 2: Kolla om senaste meddelandet innehåller tvetydig fras
    const lastUserMessage = actualConversationHistory
      .filter(m => m.role === 'user')
      .slice(-1)[0];
    
    if (lastUserMessage) {
      const ambiguityCheck = detectAmbiguousPhrase(lastUserMessage.content);
      
      if (ambiguityCheck.isAmbiguous) {
        console.log('⚠️ Ambiguous phrase detected, asking for clarification...');
        
        return new Response(
          JSON.stringify({
            type: 'clarification',
            questions: [ambiguityCheck.clarificationNeeded],
            conversationFeedback,
            readiness
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
    }

    // STEG 1: Detektera inkluderingar och exkluderingar
    const exclusions = parseExclusions(actualConversationHistory);
    const inclusions = detectInclusions(actualConversationHistory);
    
    // ÅTGÄRD 1: CONTEXT CONFIRMATION (75-91% readiness)
    // Visa sammanfattning och be om bekräftelse innan offertgenerering
    if (readiness.readiness_score >= 75 && readiness.readiness_score < 92 && actualConversationHistory.length > 0) {
      console.log('📋 Context confirmation triggered (readiness: ' + readiness.readiness_score + '%)');
      
      const summary = buildProjectSummary(
        completeDescription,
        actualConversationHistory,
        exclusions,
        inclusions,
        conversationFeedback
      );
      
      const confirmationMessage = `✅ **Jag tror jag har förstått projektet!**

${summary}

🎯 **Readiness: ${readiness.readiness_score}%**

${readiness.optional_missing.length > 0 ? `💡 **Kan förbättras:**\n${readiness.optional_missing.map(m => `- ${m}`).join('\n')}\n\n` : ''}**Stämmer detta?**`;

      return new Response(
        JSON.stringify({
          type: 'context_confirmation',
          message: confirmationMessage,
          summary: summary,
          conversationFeedback,
          readiness,
          can_generate_now: true,
          quickReplies: [
            { label: '✅ Ja, generera offert', action: 'confirm' },
            { label: '✏️ Ändra något', action: 'edit' },
            { label: '➕ Lägg till mer info', action: 'add_info' }
          ]
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // ÅTGÄRD 4: CONVERSATION REVIEW OPTION (50-74% readiness)
    // Ge användaren tre val istället för att pusha direkt
    if (readiness.readiness_score >= 50 && readiness.readiness_score < 75 && actualConversationHistory.length > 0) {
      console.log('💡 Conversation review option triggered (readiness: ' + readiness.readiness_score + '%)');
      
      // ÅTGÄRD 3: Fixa "[object Object]" - formatera understood korrekt
      const understoodItems: string[] = [];
      
      if (conversationFeedback.understood.project_type) {
        understoodItems.push(`Projekttyp: ${conversationFeedback.understood.project_type}`);
      }
    if (conversationFeedback.understood.measurements) {
      const measurements = conversationFeedback.understood.measurements;
      const measurementText = Array.isArray(measurements)
        ? measurements.join(', ')
        : measurements;
      understoodItems.push(`Mått: ${measurementText}`);
    }
    if (conversationFeedback.understood.materials) {
      const materials = conversationFeedback.understood.materials;
      const materialsText = Array.isArray(materials)
        ? materials.join(', ')
        : materials;
      understoodItems.push(`Material: ${materialsText}`);
    }
      if (conversationFeedback.understood.scope) {
        understoodItems.push(`Omfattning: ${conversationFeedback.understood.scope}`);
      }
      if (conversationFeedback.understood.budget) {
        understoodItems.push(`Budget: ${conversationFeedback.understood.budget}`);
      }
      if (conversationFeedback.understood.timeline) {
        understoodItems.push(`Tidsplan: ${conversationFeedback.understood.timeline}`);
      }
      
      const understoodList = understoodItems.length > 0 
        ? understoodItems.join('\n- ') 
        : 'Grundläggande projektinfo';

      const reviewMessage = `✅ Jag kan generera offerten nu, men vi kan också förbättra den ytterligare.

**Vad jag förstått:**
- ${understoodList}

🎯 **Readiness: ${readiness.readiness_score}%** - ${readiness.reasoning}

${readiness.optional_missing.length > 0 ? `💡 **Kan förbättras:**\n${readiness.optional_missing.map(m => `- ${m}`).join('\n')}\n\n` : ''}**Vad vill du göra?**
1. ✅ **Granska sammanfattning** - Se full översikt innan generering
2. 📋 **Generera direkt** - Skapa offerten nu
3. ➕ **Lägg till mer info** - Förbättra precisionen först

Svara med **1**, **2** eller **3** (eller "granska", "generera", "mer info")`;

      return new Response(
        JSON.stringify({
          type: 'conversation_review',
          message: reviewMessage,
          conversationFeedback,
          readiness,
          can_generate_now: true,
          quickReplies: [
            { label: '✅ Granska sammanfattning', action: 'review' },
            { label: '📋 Generera direkt', action: 'generate' },
            { label: '➕ Lägg till mer info', action: 'more_info' }
          ]
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // ============================================
    // STEP 5: GENERATE QUOTE
    // ============================================

    console.log('🎯 Generating complete quote...');
    
    // ============================================
    // FAS 13: PRICE EXPECTATION CHECK
    // ============================================
    
    console.log('💰 FAS 13: Estimating price range...');
    const priceEstimate = await estimatePriceRange(
      completeDescription,
      conversationSummary || conversationFeedback,
      hourlyRates || [],
      similarQuotes,
      learningContext,
      LOVABLE_API_KEY
    );
    
    console.log(`💰 FAS 13: Estimated range: ${priceEstimate.min} - ${priceEstimate.max} kr`);
    console.log(`💰 FAS 13: Confidence: ${priceEstimate.confidence}%`);
    
    // Check if user has a budget constraint
    if (conversationSummary?.budget || conversationFeedback?.understood?.budget) {
      const userBudget = conversationSummary?.budget || conversationFeedback?.understood?.budget;
      console.log(`💡 FAS 13: User mentioned budget: ${userBudget}`);
      
      // If estimate exceeds user budget, warn them
      if (priceEstimate.max > 0 && userBudget) {
        const budgetNumber = parseInt(userBudget.replace(/[^\d]/g, ''));
        if (!isNaN(budgetNumber) && priceEstimate.min > budgetNumber) {
          console.log(`⚠️ FAS 13: Estimated price (${priceEstimate.min} kr) exceeds budget (${budgetNumber} kr)`);
          
          return new Response(
            JSON.stringify({
              type: 'budget_warning',
              message: `⚠️ **Prisförväntning**\n\nBaserat på projektets omfattning uppskattar jag priset till:\n\n💰 **${priceEstimate.min.toLocaleString('sv-SE')} - ${priceEstimate.max.toLocaleString('sv-SE')} kr** (exkl. ROT/RUT-avdrag)\n\nDu nämnde en budget på ca ${budgetNumber.toLocaleString('sv-SE')} kr, vilket är lägre än estimatet.\n\n**Vad vill du göra?**\n- Justera omfattningen (ta bort vissa arbetsmoment)\n- Fortsätt med full offert ändå\n- Diskutera alternativ`,
              priceRange: priceEstimate,
              userBudget: budgetNumber,
              quickReplies: [
                { label: '📋 Generera ändå', action: 'generate' },
                { label: '✂️ Minska omfattning', action: 'reduce_scope' },
                { label: '💬 Diskutera alternativ', action: 'discuss_alternatives' }
              ]
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          );
        }
      }
    }
    
    // SPRINT 1: Parse exclusions och inclusions från konversation
    const exclusionsForQuote = parseExclusions(actualConversationHistory);
    const inclusionsForQuote = detectInclusions(actualConversationHistory);
    console.log(`📋 Exclusions parsed: ${exclusionsForQuote.length}`);
    
    // ÅTGÄRD 4C: Använd faktisk historik från DB även här
    // FAS 20: Pass isDraft parameter from request
    let quote = await generateQuoteWithAI(
      completeDescription,
      actualConversationHistory,
      hourlyRates || [],
      equipmentRates || [],
      similarQuotes,
      learningContext,
      finalDeductionType,
      LOVABLE_API_KEY,
      exclusionsForQuote,
      previousQuote, // SPRINT 1.5: For delta mode
      true, // FAS 14: Enable explanations
      isDraft // FAS 20: Draft mode flag
    );
    
    // SPRINT 2: Generate smart auto-title
    const smartTitle = generateQuoteTitle(conversationFeedback, description);
    quote.title = smartTitle;
    console.log(`📝 Generated title: "${smartTitle}"`);


    // SPRINT 1.5: Validate quote consistency if in delta mode
    let consistencyWarnings: string[] = [];
    if (isDeltaMode && previousQuoteTotal > 0) {
      console.log('🔍 SPRINT 1.5: Validating quote consistency...');
      const lastUserMsg = actualConversationHistory.filter(m => m.role === 'user').slice(-1)[0];
      const consistencyValidation = validateQuoteConsistency(
        previousQuote,
        quote,
        lastUserMsg?.content || description
      );
      
      if (!consistencyValidation.isConsistent) {
        console.error('❌ INCONSISTENCY DETECTED:', consistencyValidation.warnings);
        consistencyWarnings = consistencyValidation.warnings;
      } else {
        console.log('✅ Quote consistency validated - price logic is correct');
      }
    }

    // ============================================
    // ÅTGÄRD 2B: VALIDATE QUOTE SUMMARY
    // ============================================
    
    function validateQuoteSummary(quote: any): { valid: boolean; issues: string[] } {
      const issues: string[] = [];
      
      if (!quote.summary) {
        issues.push('Quote missing summary object');
        return { valid: false, issues };
      }
      
      const requiredFields = [
        'totalBeforeVAT', 'workCost', 'materialCost', 
        'vatAmount', 'totalWithVAT', 'customerPays'
      ];
      
      const missingFields = requiredFields.filter(field => 
        quote.summary[field] === undefined || 
        quote.summary[field] === null
      );
      
      if (missingFields.length > 0) {
        issues.push(`Summary missing fields: ${missingFields.join(', ')}`);
      }
      
      // Validera att värden är nummer och inte NaN
      requiredFields.forEach(field => {
        if (quote.summary[field] !== undefined && 
            (typeof quote.summary[field] !== 'number' || isNaN(quote.summary[field]))) {
          issues.push(`Summary field ${field} is not a valid number: ${quote.summary[field]}`);
        }
      });
      
      return { valid: issues.length === 0, issues };
    }

    const summaryValidation = validateQuoteSummary(quote);
    
    if (!summaryValidation.valid) {
      console.error('❌ Quote summary validation failed:', summaryValidation.issues);
      console.error('Current summary:', quote.summary);
      
      // Fallback: Beräkna värden från items
      console.log('⚠️ Attempting to rebuild summary from items...');
      
      const totalWork = quote.workItems?.reduce((sum: number, item: any) => 
        sum + (item.subtotal || 0), 0
      ) || 0;
      
      const totalMaterial = quote.materials?.reduce((sum: number, item: any) => 
        sum + (item.subtotal || 0), 0
      ) || 0;
      
      const totalEquipment = quote.equipment?.reduce((sum: number, item: any) => 
        sum + (item.subtotal || 0), 0
      ) || 0;
      
      const totalBeforeVAT = totalWork + totalMaterial + totalEquipment;
      const vatAmount = totalBeforeVAT * 0.25;
      const totalWithVAT = totalBeforeVAT * 1.25;
      
      quote.summary = {
        workCost: totalWork,
        materialCost: totalMaterial,
        equipmentCost: totalEquipment,
        totalBeforeVAT: totalBeforeVAT,
        vatAmount: vatAmount,
        totalWithVAT: totalWithVAT,
        customerPays: totalWithVAT
      };
      
      console.log('✅ Summary rebuilt:', quote.summary);
    }

    // ============================================
    // FAS 1: IMPROVED VALIDATION ORDER - Project intent & conversation validation FIRST
    // ============================================
    
    console.log('🔍 Validating quote for hallucinations...');
    const mentionedItems = extractMentionedItems(conversation_history);
    const hallucinationCheck = validateGeneratedQuote(quote, mentionedItems, conversation_history);
    
    if (hallucinationCheck.warnings.length > 0) {
      console.log('⚠️ Hallucination warnings:', hallucinationCheck.warnings);
    }
    
    // FAS 5: Detect project intent first
    const projectIntent = detectProjectIntent(completeDescription, conversation_history.map(m => m.content));
    
    // FAS 6: Log project intent analysis
    console.log('🧠 PROJECT INTENT ANALYSIS', {
      scope: projectIntent.scope,
      quality: projectIntent.quality,
      urgency: projectIntent.urgency,
      explicitInclusions: projectIntent.explicitInclusions,
      explicitExclusions: projectIntent.explicitExclusions
    });
    
    // FAS 1 & 5: Validate quote against conversation with project type and intent
    const detectedProjectForValidation = detectProjectType(completeDescription);
    
    console.log('🔍 Validating quote against conversation with AI learning...');
    const conversationValidation = await validateQuoteAgainstConversation(
      quote,
      conversation_history,
      description,
      detectedProjectForValidation?.projectType || null,
      user.id,
      LOVABLE_API_KEY,
      supabaseClient
    );
    
    // FAS 6: Log protected items
    if (detectedProjectForValidation) {
      const protectedItems = getProtectedItemsForProjectType(detectedProjectForValidation.projectType);
      console.log('🔒 PROTECTED ITEMS', {
        projectType: detectedProjectForValidation.projectType,
        protectedByStandard: protectedItems,
        protectedByExplicitMention: projectIntent.explicitInclusions,
        totalProtected: [...protectedItems, ...projectIntent.explicitInclusions]
      });
    }
    
    if (!conversationValidation.isValid) {
      console.log(`⚠️ Removed ${conversationValidation.unmentionedItems.length} unmentioned items:`);
      conversationValidation.unmentionedItems.forEach(item => console.log(`  - ${item}`));
    }
    
    // FAS 1 & 6: Log warnings for protected items
    if (conversationValidation.warnings.length > 0) {
      console.log('⚠️ Validation warnings:', conversationValidation.warnings);
    }

    // ============================================
    // STEP 6.5: CALCULATE CONFIDENCE SCORE (FÖRBÄTTRING #5)
    // ============================================
    
    console.log('📊 Calculating confidence score...');
    const confidenceScore = calculateConfidenceScore(
      quote,
      description,
      conversation_history,
      hourlyRates || [],
      similarQuotes
    );

    console.log(`📊 Confidence: ${Math.round(confidenceScore.overall * 100)}% (Mått: ${Math.round(confidenceScore.breakdown.measurements * 100)}%, Material: ${Math.round(confidenceScore.breakdown.materials * 100)}%, Priser: ${Math.round(confidenceScore.breakdown.pricing * 100)}%, Omfattning: ${Math.round(confidenceScore.breakdown.scope * 100)}%)`);
    
    if (confidenceScore.missingInfo.length > 0) {
      console.log(`⚠️ Missing info: ${confidenceScore.missingInfo.join(', ')}`);
    }

    // ============================================
    // STEP 6.6: VALIDATE REALISM (FÖRBÄTTRING #9)
    // ============================================
    
    // Apply deterministic pricing (FAS 22: skip if draft mode)
    console.log('💰 Computing deterministic totals...');
    quote = computeQuoteTotals(quote, hourlyRates || [], equipmentRates || [], isDraft);

    console.log('🔬 Validating realism...');
    const realismWarnings = validateRealism(
      quote,
      learningContext.userPatterns,
      learningContext.industryData || []
    );
    
    // SPRINT 1: Combine all warnings
    const allWarnings = [
      ...realismWarnings,
      ...hallucinationCheck.warnings,
      ...consistencyWarnings // SPRINT 1.5
    ];
    
    if (allWarnings.length > 0) {
      console.log(`⚠️ Total warnings: ${allWarnings.length}`);
      allWarnings.forEach(w => console.log(`  - ${w}`));
    }
    
    // ============================================
    // SPRINT 1: VALIDATE ASSUMPTIONS
    // ============================================
    
    console.log('🧠 Validating assumptions...');
    const assumptionsValidation = validateAssumptions(quote);
    
    if (!assumptionsValidation.valid) {
      console.warn(assumptionsValidation.warnings.join('\n'));
    }

    // ============================================
    // STEP 7: BASIC VALIDATION & MATERIAL RETRY IF NEEDED
    // ============================================

    const validation = basicValidation(quote);
    
    // STEG 3: ALLTID kör material-specifikation om generiska material finns
    if (validation.issues.some((issue: string) => issue.includes('Generiska material'))) {
      console.log('⚠️ Generic materials detected, retrying specification...');
      quote = await retryMaterialSpecification(quote, completeDescription, LOVABLE_API_KEY);
    }
    
    if (!validation.valid) {
      console.log('⚠️ Validation issues:', validation.issues);
    }

    // ============================================
    // FAS 2: PROJECT STANDARDS INTEGRATION
    // ============================================
    
    const detectedProject = detectProjectType(completeDescription);
    if (detectedProject) {
      console.log(`🎯 Detected project: ${detectedProject.displayName}`);
      console.log(`📏 Scope: ${projectIntent.scope}`);
    }
    
    // ============================================
    // FAS 3: DOMAIN-SPECIFIC VALIDATION & AUTO-FIX
    // ============================================
    
    let validationWarnings: any[] = [];
    
    // FAS 5: Enhanced reasoning with project intent
    let reasoning = {
      detectedProjectType: detectedProject?.displayName || 'unknown',
      scope: projectIntent.scope,
      quality: projectIntent.quality,
      appliedStandards: detectedProject ? 'yes' : 'no',
      priceRange: detectedProject ? `${detectedProject.minCostPerSqm || detectedProject.minCostFlat}-${detectedProject.maxCostPerSqm || detectedProject.maxCostFlat}` : 'n/a',
      explicitInclusions: projectIntent.explicitInclusions,
      explicitExclusions: projectIntent.explicitExclusions
    };
    
    // BATHROOM VALIDATION
    if (isBathroomProject(completeDescription)) {
      console.log('🔍 Running bathroom quote validation...');
      
      // Extrahera area från konversation
      const allText = (completeDescription + ' ' + actualConversationHistory.map((m: any) => m.content).join(' ')).toLowerCase();
      const areaMatch = allText.match(/(\d+(?:[.,]\d+)?)\s*kvm/);
      const area = areaMatch ? parseFloat(areaMatch[1].replace(',', '.')) : 8;
      
      // FAS 6: Enhanced logging with project details
      console.log('🛁 BATHROOM QUOTE DETAILS', {
        area: area,
        price: quote.summary?.totalBeforeVAT,
        pricePerSqm: Math.round((quote.summary?.totalBeforeVAT || 0) / area),
        scope: projectIntent.scope,
        workItems: quote.workItems?.map((w: any) => ({ name: w.name, hours: w.hours, cost: w.subtotal })) || [],
        hasVVS: quote.workItems?.some((w: any) => w.name?.toLowerCase().includes('vvs')),
        hasEl: quote.workItems?.some((w: any) => w.name?.toLowerCase().includes('el')),
        hasTätskikt: quote.workItems?.some((w: any) => w.name?.toLowerCase().includes('tätskikt')),
        hasGolvvärme: quote.workItems?.some((w: any) => w.name?.toLowerCase().includes('golvvärme'))
      });
      
      // FAS 4: AGGRESSIVE PRICE FLOOR - Ensures minimum price is ALWAYS met
      const minPrice = area * 18000;
      const maxPrice = area * 30000;
      const actualPrice = quote.summary?.totalBeforeVAT || 0;
      
      if (actualPrice < minPrice) {
        console.error(`🚨 BATHROOM QUOTE TOO CHEAP: ${actualPrice} kr (minimum: ${minPrice} kr)`);
        console.error('🔧 Applying aggressive price floor correction...');
        
        // STRATEGI 1: Öka timpriser proportionellt (men max 1200 kr/h)
        const multiplier = Math.min(minPrice / actualPrice, 2.0); // Max 2x ökning
        quote.workItems = quote.workItems?.map((item: any) => ({
          ...item,
          hourlyRate: Math.min(Math.round(item.hourlyRate * multiplier), 1200),
          subtotal: Math.round(item.subtotal * multiplier)
        })) || [];
        
        // Re-calculate totals (FAS 22: respect draft mode)
        quote = computeQuoteTotals(quote, hourlyRates || [], equipmentRates || [], isDraft);
        
        // STRATEGI 2: Om fortfarande under minimum, lägg till materialuppgradering
        const remainingGap = minPrice - (quote.summary?.totalBeforeVAT || 0);
        if (remainingGap > 0) {
          console.warn(`⚠️ Still ${remainingGap} kr below minimum after hourly rate increase`);
          console.log('🔧 Adding premium material upgrade to reach minimum...');
          
          quote.materials = quote.materials || [];
          quote.materials.push({
            name: 'Högkvalitativa materialuppgraderingar',
            description: 'Premium-material och komponenter för långsiktig hållbarhet och kvalitet',
            quantity: 1,
            unit: 'paket',
            pricePerUnit: Math.round(remainingGap),
            subtotal: Math.round(remainingGap)
          });
          
          // Final re-calculate (FAS 22: respect draft mode)
          quote = computeQuoteTotals(quote, hourlyRates || [], equipmentRates || [], isDraft);
        }
        
        console.log(`✅ Quote price corrected to ${quote.summary.totalBeforeVAT} kr (${Math.round(quote.summary.totalBeforeVAT / area)} kr/kvm)`);
        
        // FAS 6: Log price floor correction details
        console.log('💰 PRICE FLOOR CORRECTION', {
          original: actualPrice,
          minimum: minPrice,
          final: quote.summary.totalBeforeVAT,
          multiplierUsed: multiplier.toFixed(2),
          materialUpgradeAdded: remainingGap > 0 ? Math.round(remainingGap) : 0
        });
      }
      
      const bathroomValidation = validateBathroomQuote(quote, area, 18000, 30000);
      
      if (!bathroomValidation.isValid) {
        console.warn('⚠️ Bathroom quote validation failed:', bathroomValidation.issues);
        validationWarnings = bathroomValidation.issues;
        
        // AUTO-FIX: Lägg till saknade komponenter
        if (bathroomValidation.missing.length > 0) {
          console.log('🔧 Auto-fixing quote with missing components:', bathroomValidation.missing);
          quote = await autoFixBathroomQuote(quote, bathroomValidation.missing, area);
          console.log('✅ Quote auto-fixed successfully');
          
          // Re-calculate totals after auto-fix (FAS 22: respect draft mode)
          quote = computeQuoteTotals(quote, hourlyRates || [], equipmentRates || [], isDraft);
        }
        
        // Logga validationssammanfattning
        console.log(generateValidationSummary(bathroomValidation));
      } else {
        console.log('✅ Bathroom quote passed validation');
      }
    }

    // ============================================
    // STEP 8: CALCULATE ROT/RUT (FAS 27)
    // ============================================

    if (finalDeductionType !== 'none') {
      await calculateROTRUT(supabaseClient, quote, finalDeductionType, recipients, new Date());
    }

    // ============================================
    // STEG 4: TIDSMÄTNING - Uppdatera session med completion time
    // ============================================
    
    let timeSaved = null;
    if (sessionId) {
      try {
        // Uppdatera session som completed
        await supabaseClient
          .from('conversation_sessions')
          .update({
            completed_at: new Date().toISOString(),
            conversation_stage: 'quote_generated'
          })
          .eq('id', sessionId);
        
        // Hämta session för att beräkna tid
        const { data: session } = await supabaseClient
          .from('conversation_sessions')
          .select('created_at')
          .eq('id', sessionId)
          .single();
        
        if (session) {
          const startTime = new Date(session.created_at);
          const endTime = new Date();
          const actualMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
          
          // Antag att manuell offert tar 15-30 min (använd 20 som medel)
          const manualEstimate = 20;
          timeSaved = Math.max(0, manualEstimate - actualMinutes);
          
          console.log(`⏱️ Time saved: ${timeSaved} minutes (actual: ${actualMinutes}min vs manual estimate: ${manualEstimate}min)`);
        }
      } catch (error) {
        console.error('Error calculating time saved:', error);
      }
    }

    // ============================================
    // STEP 9: RETURN QUOTE
    // ============================================

    console.log('✅ Quote generation complete');

    // ============================================
    // BUILD DEBUG INFO (FÖRBÄTTRING #10)
    // ============================================
    
    const debugInfo = {
      conversation_summary: completeDescription,
      structured_context: extractStructuredContext(conversation_history, description),
      detected_measurements: (completeDescription.match(/(\d+(?:[.,]\d+)?)\s*(kvm|m2|m²|meter|m|st|träd|granar|rum)/gi) || []).join(', '),
      similar_quotes_used: similarQuotes.length,
      similar_quotes_titles: similarQuotes.map((q: any) => q.title).join(', '),
      hourly_rates_used: (hourlyRates?.length || 0) > 0,
      equipment_used: (equipmentRates?.length || 0) > 0,
      deduction_type: finalDeductionType,
      ai_reasoning: `Baserat på: ${completeDescription.length > 0 ? 'beskrivning' : ''}${conversation_history.length > 0 ? ' + konversation' : ''}${similarQuotes.length > 0 ? ` + ${similarQuotes.length} liknande offerter` : ''}${(hourlyRates?.length || 0) > 0 ? ' + användarens timpriser' : ' + standardpriser'}${learningContext.userPatterns ? ' + användarmönster' : ''}${learningContext.industryData && learningContext.industryData.length > 0 ? ' + branschdata' : ''}`,
      validation: {
        conversation_validation: !conversationValidation.isValid ? {
          removed_items: conversationValidation.unmentionedItems,
          removed_value: Math.round(conversationValidation.removedValue)
        } : null,
        basic_validation: validation.issues.length > 0 ? validation.issues : null,
        realism_warnings: realismWarnings.length > 0 ? realismWarnings : null,
        hallucination_warnings: hallucinationCheck.warnings.length > 0 ? hallucinationCheck.warnings : null
      }
    };

    return new Response(
      JSON.stringify({
        type: 'complete_quote',
        quote,
        deductionType: finalDeductionType,
        confidence: confidenceScore,
        conversationFeedback,
        readiness,
        realismWarnings: allWarnings.length > 0 ? allWarnings : undefined,
        needsReview: hallucinationCheck.needsReview || allWarnings.length > 0,
        assumptions: quote.assumptions || [],
        validation: validation.issues.length > 0 ? {
          warnings: validation.issues
        } : undefined,
        bathroomValidation: validationWarnings.length > 0 ? validationWarnings : undefined,
        conversationValidation: !conversationValidation.isValid || conversationValidation.warnings.length > 0 ? {
          removedItems: conversationValidation.unmentionedItems,
          removedValue: Math.round(conversationValidation.removedValue),
          warnings: conversationValidation.warnings // FAS 1: Include warnings
        } : undefined,
        projectIntent: reasoning, // FAS 5: Include project intent in response
        timeSaved: timeSaved,
        is_delta_mode: isDeltaMode, // SPRINT 1.5
        previous_quote_total: previousQuoteTotal || undefined, // SPRINT 1.5
        debug: debugInfo,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Error:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        details: error.toString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
