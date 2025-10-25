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
});

type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

interface LearningContext {
  learnedPreferences?: any;
  industryData?: any[];
  userPatterns?: any;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function buildConversationSummary(history: ConversationMessage[], currentDescription: string): string {
  if (!history || history.length === 0) return currentDescription;
  
  const userMessages = history
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join(' ');
  
  return `${currentDescription} ${userMessages}`.trim();
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

function validateQuoteAgainstConversation(
  quote: any,
  conversationHistory: ConversationMessage[],
  description: string
): { isValid: boolean; unmentionedItems: string[]; removedValue: number } {
  
  const fullText = (description + ' ' + conversationHistory
    .map(m => m.content)
    .join(' ')).toLowerCase();
  
  const unmentioned: string[] = [];
  let removedValue = 0;
  
  // Kolla workItems
  const originalWorkItems = [...(quote.workItems || [])];
  const validWorkItems: any[] = [];
  
  for (const item of originalWorkItems) {
    // Om item kostar >5000 kr → kräver omnämnande
    if (item.subtotal > 5000) {
      // Extrahera nyckelord från item name (minst 4 tecken)
      const keywords = item.name.toLowerCase()
        .split(/[\s\-,\/]+/)
        .filter((kw: string) => kw.length >= 4);
      
      // Kolla om NÅGOT av nyckelorden finns i konversationen
      const mentioned = keywords.some((kw: string) => fullText.includes(kw));
      
      if (!mentioned) {
        unmentioned.push(`${item.name} (${Math.round(item.subtotal)} kr) - inte nämnt i konversation`);
        removedValue += item.subtotal;
        console.log(`🗑️ Removing unmentioned item: ${item.name} (${item.subtotal} kr)`);
      } else {
        validWorkItems.push(item);
      }
    } else {
      // Små poster (<5000 kr) behåller vi (standardposter)
      validWorkItems.push(item);
    }
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
    removedValue: removedValue
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
// DEDUCTION TYPE DETECTION
// ============================================

function detectDeductionByRules(description: string): 'rot' | 'rut' | null {
  const descLower = description.toLowerCase();
  
  // RUT keywords (cleaning/maintenance/garden) - CHECK FIRST!
  const rutKeywords = ['städ', 'storstäd', 'flyttstäd', 'fönsterputsning', 'fönsterputs',
    'trädgård', 'gräsklippning', 'häck', 'snöröjning', 'löv', 'ogräs', 'plantering', 'fäll', 'träd'];
  
  // ROT keywords (renovation/construction/repair) - CHECK AFTER
  const rotKeywords = ['badrum', 'kök', 'renovera', 'renovering', 'ombyggnad', 'bygg', 
    'måla', 'målning', 'golv', 'golvlägg', 'tak', 'fasad', 'altan', 'balkong', 
    'fönster', 'dörr', 'kakel', 'klinker', 'tapet', 'spackel', 'puts'];
  
  const hasRut = rutKeywords.some(kw => descLower.includes(kw));
  const hasRot = rotKeywords.some(kw => descLower.includes(kw));
  
  if (hasRut && !hasRot) {
    console.log('🎯 Rule-based deduction: RUT');
    return 'rut';
  }
  if (hasRot && !hasRut) {
    console.log('🎯 Rule-based deduction: ROT');
    return 'rot';
  }
  
  return null; // Ambiguous
}

async function detectDeductionWithAI(description: string, apiKey: string): Promise<'rot' | 'rut' | 'none'> {
  console.log('🤖 Using AI to detect deduction type...');
  
  const prompt = `Analysera denna jobbeskrivning och avgör om det är ROT, RUT eller inget avdrag:

ROT = Renovering, Ombyggnad, Tillbyggnad (fastighetsarbete)
RUT = Rengöring, Underhåll, Trädgård (hushållsnära tjänster)

Beskrivning: "${description}"

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
// ROT/RUT CALCULATION
// ============================================

function calculateROTRUT(quote: any, deductionType: string, recipients: number, quoteDate: Date) {
  if (deductionType === 'none') return;

  const year = quoteDate.getFullYear();
  const deductionRate = year >= 2025 ? 0.5 : 0.3;
  
  // Max amounts per recipient
  const maxROT = 50000;
  const maxRUT = 75000;
  const maxDeduction = deductionType === 'rot' ? maxROT : maxRUT;
  const totalMaxDeduction = maxDeduction * recipients;

  // Calculate work cost (labor only, 50% of work if ROT, 100% if RUT)
  const workCost = quote.summary?.workCost || 0;
  const eligibleAmount = deductionType === 'rot' ? workCost * 0.5 : workCost;
  
  // Apply deduction rate and cap
  const calculatedDeduction = eligibleAmount * deductionRate;
  const actualDeduction = Math.min(calculatedDeduction, totalMaxDeduction);

  // Update quote
  quote.summary.deduction = {
    type: deductionType.toUpperCase(),
    deductionRate,
    maxPerPerson: maxDeduction,
    numberOfRecipients: recipients,
    totalMaxDeduction,
    eligibleAmount,
    calculatedDeduction,
    actualDeduction,
    customerPays: quote.summary.totalWithVAT - actualDeduction,
  };

  console.log(`💰 ${deductionType.toUpperCase()}-avdrag: ${Math.round(actualDeduction)} kr (${recipients} mottagare)`);
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
// AI: ASK CLARIFICATION QUESTIONS
// ============================================

async function askClarificationQuestions(
  description: string,
  conversationHistory: ConversationMessage[],
  similarQuotes: any[],
  apiKey: string
): Promise<string[]> {
  
  const historyText = conversationHistory
    .map(m => `${m.role === 'user' ? 'Användare' : 'AI'}: ${m.content}`)
    .join('\n');

  const similarQuotesText = similarQuotes.length > 0
    ? `\n\nLiknande tidigare offerter:\n${similarQuotes.map(q => 
        `- ${q.title}: ${q.description}`
      ).join('\n')}`
    : '';

  const prompt = `Du är Handoff AI - en intelligent assistent som hjälper hantverkare att snabbt skapa offerter.

**VIKTIG KONTEXT:**
Du hjälper en HANTVERKARE (arborist/elektriker/rörmokare/snickare/målare/etc.) att skapa en offert baserat på vad deras KUND har beskrivit. Du pratar INTE direkt med slutkunden.

**KUNDENS FÖRFRÅGAN:**
${description}

**TIDIGARE KONVERSATION:**
${historyText || 'Ingen tidigare konversation'}

${similarQuotesText}

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

**VIKTIGT - TON OCH STIL:**
- Prata som till en kollega/hantverkare, inte till slutkunden
- Använd "du" när du menar hantverkaren (t.ex. "Tar du hand om...")
- Använd "kunden" när du refererar till slutkunden (t.ex. "...eller ska kunden stå för det?")
- Max 2 frågor
- Korta och tydliga
- Inga A/B/C-alternativ

Returnera JSON:
{"questions": ["Fråga 1", "Fråga 2"]} eller {"questions": []}`;

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
    
    return result.questions || [];
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
  apiKey: string
): Promise<any> {
  
  const historyText = conversationHistory
    .map(m => `${m.role === 'user' ? 'Användare' : 'AI'}: ${m.content}`)
    .join('\n');

  // Build rates text
  const ratesText = userRates.length > 0
    ? `**ANVÄNDARENS TIMPRISER (ANVÄND EXAKT DESSA):**\n${userRates.map(r => `- ${r.work_type}: ${r.rate} kr/h`).join('\n')}`
    : `**TIMPRISER:**\nAnvänd standardpris 650 kr/h`;

  // Build equipment text
  const equipmentText = equipment.length > 0
    ? `\n\n**ANVÄNDARENS MASKINER/UTRUSTNING:**\n${equipment.map(e => {
        let price = '';
        if (e.price_per_hour) price = `${e.price_per_hour} kr/h`;
        if (e.price_per_day) price = `${e.price_per_day} kr/dag`;
        const rental = e.is_rented ? '(hyrs externt)' : '(ägs)';
        return `- ${e.name} (${e.equipment_type}): ${price} ${rental}`;
      }).join('\n')}`
    : '';

  // Build similar quotes text with full details
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

  // Build industry data text
  const industryDataText = learningContext.industryData && learningContext.industryData.length > 0
    ? `\n\n**📊 BRANSCHDATA (FRÅN ANDRA ANVÄNDARE):**\n${learningContext.industryData.slice(0, 5).map(b => 
        `- ${b.work_category} → ${b.metric_type}: ${b.median_value} (${b.sample_size} offerter, min: ${b.min_value}, max: ${b.max_value})`
      ).join('\n')}`
    : '';

  const prompt = `Du är Handoff AI - en intelligent assistent som hjälper hantverkare skapa professionella offerter.

**VIKTIG KONTEXT:**
Du hjälper en HANTVERKARE att skapa en offert för deras KUND. Basera offerten på vad hantverkaren beskrivit från kundens förfrågan.

**PROJEKT:**
${description}

**TIDIGARE KONVERSATION:**
${historyText || 'Ingen tidigare konversation'}

**AVDRAGSTYP:** ${deductionType.toUpperCase()} ${deductionType !== 'none' ? '(inkludera i offerten)' : ''}

${ratesText}

${equipmentText}

${similarQuotesText}

${industryDataText}

**🚨 BESLUTSPROCESS (FÖLJ STRIKT I ORDNING) - FÖRBÄTTRING #3:**

När du överväger att inkludera ett arbetsmoment eller material i offerten, FÖLJ DENNA TRAPPA:

**STEG 1: Är detta EXPLICIT nämnt i konversationen ovan?**
   ✅ JA → Gå till steg 2
   ❌ NEJ → Gå till steg 3

**STEG 2: Kostar det mer än 5000 kr?**
   ✅ JA → Inkludera INTE (även om det verkar logiskt!)
   ❌ NEJ (under 5000 kr) → Gå till steg 3

**STEG 3: Är det en standardpost <2000 kr?**
   ✅ JA → Inkludera om relevant för projekttypen
   ❌ NEJ → Inkludera INTE

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

**KRITISKT - MATERIAL-SPECIFIKATION:**
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

**RETURNERA JSON:**
{
  "workItems": [
    {
      "name": "Arbetsbeskrivning",
      "description": "Detaljerad beskrivning",
      "hours": 8,
      "hourlyRate": 850,
      "subtotal": 6800
    }
  ],
  "materials": [
    {
      "name": "Märke + Modell + Storlek/Färg",
      "description": "Kort beskrivning",
      "quantity": 16,
      "unit": "kvm",
      "pricePerUnit": 800,
      "subtotal": 12800
    }
  ],
  "equipment": [
    {
      "name": "Maskinnamn",
      "description": "Beskrivning",
      "quantity": 3,
      "unit": "dagar",
      "pricePerUnit": 450,
      "subtotal": 1350
    }
  ],
  "summary": {
    "workCost": 6800,
    "materialCost": 12800,
    "equipmentCost": 1350,
    "totalBeforeVAT": 20950,
    "vat": 5237.5,
    "totalWithVAT": 26187.5,
    "customerPays": 26187.5
  }
}`;

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

  const prompt = `Du genererade en offert men några material är för generiska.

**PROJEKT:** ${description}

**GENERISKA MATERIAL:**
${genericMaterials.map((m: any) => `- ${m.name}: ${m.quantity} ${m.unit} × ${m.pricePerUnit} kr`).join('\n')}

**UPPGIFT:**
Specificera dessa material bättre enligt formatet: **Märke + Modell + Storlek/Färg + Mängd + Enhet**

Exempel:
- "Kakel" → "Marazzi Oficina 30x60cm vit matt"
- "VVS-material" → "Duschblandare Oras Safira termostat krom + Duschslang Hansa 1.5m krom"
- "Färg" → "Alcro Tidevärv kulär Moln matt"

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
    } = validatedData;

    console.log('Description:', description);
    console.log('Deduction type requested:', deductionType);
    console.log('Conversation history length:', conversation_history.length);

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

    // Build complete description from conversation
    const completeDescription = buildConversationSummary(conversation_history, description);

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
    
    if (finalDeductionType === 'auto') {
      // Check cache first
      const cachedDeduction = learningContext.learnedPreferences?.deductionType;
      if (cachedDeduction) {
        finalDeductionType = cachedDeduction;
        console.log(`💾 Using cached deduction: ${finalDeductionType}`);
      } else {
        // Try rule-based first
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
    }

    console.log(`📅 Deduction type: ${finalDeductionType}`);
    console.log(`📊 Recipients: ${recipients} → Max ROT: ${50000 * recipients} kr, Max RUT: ${75000 * recipients} kr`);

    // ============================================
    // STEP 4: CHECK IF CLARIFICATION NEEDED
    // ============================================

    // Only ask clarification on first message or if very unclear
    const shouldAskClarification = conversation_history.length === 0 || 
      (conversation_history.length === 2 && conversation_history[conversation_history.length - 1].role === 'user');

    if (shouldAskClarification) {
      console.log('🤔 Checking if clarification needed...');
      
      const questions = await askClarificationQuestions(
        completeDescription,
        conversation_history,
        similarQuotes,
        LOVABLE_API_KEY
      );

      if (questions && questions.length > 0) {
        console.log(`💬 Asking ${questions.length} clarification question(s)`);
        
        return new Response(
          JSON.stringify({
            type: 'clarification',
            questions,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
    }

    // ============================================
    // STEP 5: GENERATE QUOTE
    // ============================================

    console.log('🎯 Generating complete quote...');
    
    let quote = await generateQuoteWithAI(
      completeDescription,
      conversation_history,
      hourlyRates || [],
      equipmentRates || [],
      similarQuotes,
      learningContext,
      finalDeductionType,
      LOVABLE_API_KEY
    );

    // ============================================
    // STEP 6: VALIDATE QUOTE AGAINST CONVERSATION (FÖRBÄTTRING #2)
    // ============================================
    
    console.log('🔍 Validating quote against conversation...');
    const conversationValidation = validateQuoteAgainstConversation(
      quote,
      conversation_history,
      description
    );
    
    if (!conversationValidation.isValid) {
      console.log(`⚠️ Removed ${conversationValidation.unmentionedItems.length} unmentioned items:`);
      conversationValidation.unmentionedItems.forEach(item => console.log(`  - ${item}`));
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
    // STEP 7: BASIC VALIDATION & MATERIAL RETRY IF NEEDED
    // ============================================

    const validation = basicValidation(quote);
    
    if (!validation.valid) {
      console.log('⚠️ Validation issues:', validation.issues);
      
      // If materials are too generic, retry once
      if (validation.issues.some(issue => issue.includes('Generiska material'))) {
        quote = await retryMaterialSpecification(quote, completeDescription, LOVABLE_API_KEY);
      }
    }

    // ============================================
    // STEP 8: CALCULATE ROT/RUT
    // ============================================

    if (finalDeductionType !== 'none') {
      calculateROTRUT(quote, finalDeductionType, recipients, new Date());
    }

    // ============================================
    // STEP 9: RETURN QUOTE
    // ============================================

    console.log('✅ Quote generation complete');

    return new Response(
      JSON.stringify({
        type: 'complete_quote',
        quote,
        deductionType: finalDeductionType,
        confidence: confidenceScore,
        validation: validation.issues.length > 0 ? {
          warnings: validation.issues
        } : undefined,
        conversationValidation: !conversationValidation.isValid ? {
          removedItems: conversationValidation.unmentionedItems,
          removedValue: Math.round(conversationValidation.removedValue)
        } : undefined,
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
