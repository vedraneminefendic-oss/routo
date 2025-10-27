import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { getProjectRequirements, ProjectRequirements } from "./helpers/smartQuestions.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const TEXT_MODEL = 'google/gemini-2.5-flash';

// ============================================
// FAS 16: AI-DRIVEN SMART QUESTIONS
// ============================================

async function generateSmartQuestions(
  projectDescription: string,
  conversationHistory: Array<{ role: string; content: string }>,
  conversationSummary: any,
  askedQuestions: string[],
  apiKey: string,
  maxQuestionsToGenerate: number = 3, // FAS 19: Explicit limit
  isRefinement: boolean = false // FAS 24: Refinement mode
): Promise<string[]> {
  const checklist = conversationSummary?.checklist || {
    scope: false,
    size: false,
    materials: false,
    timeline: false,
    specialRequirements: false
  };
  
  // FAS 23: Identify missing categories for balanced coverage
  const missingCategories = Object.entries(checklist)
    .filter(([_, covered]) => !covered)
    .map(([cat, _]) => cat);
  
  // FAS 24: Different prompt for refinement vs initial questions
  const refinementPrompt = isRefinement ? `
**FAS 24: REFINEMENT MODE - SPECIFIKA UPPFÖLJNINGSFRÅGOR**

Du ska nu ställa 2-3 SPECIFIKA frågor för att förbättra offertutkastet.

FOKUSERA PÅ:
- Förtydliga prisintervall genom att fråga om kvalitetsnivå/märken
- Bekräfta vaga omfattningar (t.ex. "Ingår förberedelser och städning?")
- Fråga om tillägg som kan påverka priset (t.ex. "Behövs bortforsling?")

UNDVIK:
- Generella frågor som redan besvarats
- Frågor om saker som inte påverkar priset märkbart
` : `
**FAS 23: INITIAL MODE - BRED TÄCKNING**

Saknade huvudkategorier: ${missingCategories.length > 0 ? missingCategories.join(', ') : 'Alla täckta!'}

STRATEGI:
1. Ställ MAX 1 fråga per saknad kategori
2. Om alla kategorier täckta → returnera [] (inga fler frågor)
3. Prioritera de mest kritiska kategorierna först
`;
  
  const prompt = `Du är en AI-assistent som hjälper en HANTVERKARE att skapa en offert.

**VIKTIGT ATT FÖRSTÅ:**
- Du pratar med en HANTVERKARE (t.ex. elektriker, byggnadsarbetare, målare, rörmokare)
- Hantverkaren ska senare skicka offerten till sin SLUTKUND
- Du ska hjälpa hantverkaren att samla in den information som behövs för att skapa en korrekt offert
- Ställ frågor som en kollega skulle ställa: "Vad är storleken på rummet?", inte "Hur stort är ert rum?"
- Var professionell och effektiv - hantverkaren vill snabbt kunna skapa offerten

**FAS 23: TWO-ROUND SYSTEM - Max 2 frågerundor**
${refinementPrompt}

**FAS 19: INTELLIGENT QUESTION BUDGET**
Vi vill INTE överbelasta hantverkaren med frågor. Målet är max 6-7 frågor TOTALT per offert.
- Frågor ställda hittills: ${askedQuestions.length}
- Max frågor totalt: 7
- Du får generera EXAKT: ${maxQuestionsToGenerate} frågor (INTE mer)

**CHECKLIST - Vilka huvudkategorier har vi täckt?**
- ✅/❌ Scope (vad ska göras?): ${checklist.scope ? '✅ JA' : '❌ NEJ - fråga om detta!'}
- ✅/❌ Size (hur mycket?): ${checklist.size ? '✅ JA' : '❌ NEJ - fråga om detta!'}
- ✅/❌ Materials (vilket material?): ${checklist.materials ? '✅ JA' : '❌ NEJ - fråga om detta!'}
- ✅/❌ Timeline (när?): ${checklist.timeline ? '✅ JA' : '❌ NEJ - fråga om detta!'}
- ✅/❌ Special Requirements (något speciellt?): ${checklist.specialRequirements ? '✅ JA' : '❌ NEJ - fråga om detta!'}

PROJEKTBESKRIVNING: ${projectDescription}

TIDIGARE STÄLLDA FRÅGOR: ${askedQuestions.join(', ') || 'Inga frågor ställda än'}

SAMMANFATTNING AV SAMTALET:
${JSON.stringify(conversationSummary, null, 2)}

**UPPDRAG:**
Generera EXAKT ${maxQuestionsToGenerate} relevanta frågor (inte mer, inte mindre).

**STRATEGI - PRIORITERA I DENNA ORDNING:**
1. **PRIO 1:** Fråga om saknade checklist-kategorier (de som är ❌)
2. **PRIO 2:** Om alla checklist-kategorier är ✅ → returnera [] (inga fler frågor behövs)
3. **PRIO 3:** Om användaren varit väldigt otydlig → fyll på med branschspecifika frågor

**Frågorna ska:**
- Vara SPECIFIKA för projekttypen (${conversationSummary.projectType || 'okänt'})
- INTE upprepa frågor som redan ställts
- Fokusera på de VIKTIGASTE saknade kategorierna först
- Vara konkreta och enkla att svara på
- Följa logisk ordning (omfattning → mätningar → material → tidplan)

**BRANSCHKUNSKAP att använda:**
- För dränering: fråga om dräneringslängd (meter), djup, mark/husgrund, avrinning, material
- För el-arbete: fråga om belysning, eluttag, säkringsskåp, certifiering
- För målning: fråga om yta i kvm, antal rum, färgval, tapeter, tak/väggar
- För badrum: fråga om storlek, kakel, golvvärme, VVS-arbete, ventilation
- För kök: fråga om storlek, apparater, bänkskivor, VVS, el
- För trädfällning: fråga om antal träd, höjd, diameter, stubbfräsning, bortforsling
- För städning: fråga om typ (hem/stor/flytt), area, antal rum, fönster
- För golv: fråga om area, typ (laminat/parkett), rivning, socklar
- För tak: fråga om area, material (plåt/tegel), rivning, isolering
- För trädgård: fråga om area, vad ska göras (gräs/sten/plantering), markarbete

**EXEMPEL:**
Om checklist visar: scope=false, size=false → fråga först om omfattning och storlek
Om checklist visar: alla true → returnera [] (inga fler frågor)

Svara ENDAST med en JSON-array av frågesträngar:
["Fråga 1?", "Fråga 2?", "Fråga 3?"]

Om alla checklist-kategorier är täckta, returnera: []`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [
          { role: 'system', content: 'Du är en AI som genererar strukturerad JSON. Svara ENDAST med giltlig JSON.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      console.error('❌ AI API error:', response.status, await response.text());
      return [];
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content;
    if (content.includes('```json')) {
      jsonStr = content.split('```json')[1].split('```')[0].trim();
    } else if (content.includes('```')) {
      jsonStr = content.split('```')[1].split('```')[0].trim();
    }
    
    const questions = JSON.parse(jsonStr);
    // FAS 23: Hard cap at 4 questions maximum
    const validQuestions = Array.isArray(questions) ? questions.slice(0, 4) : [];
    
    console.log(`✅ FAS 23: Generated ${validQuestions.length} ${isRefinement ? 'refinement' : 'initial'} questions`);
    return validQuestions;
  } catch (error) {
    console.error('❌ Error generating smart questions:', error);
    return [];
  }
}

// ============================================
// FAS 11: AI-DRIVEN CONVERSATION SUMMARY
// ============================================

interface InformationChecklist {
  scope: boolean;        // "Vad ska göras?" (rivning, nyinstallation, etc.)
  size: boolean;         // "Hur stort?" (kvm, antal enheter, etc.)
  materials: boolean;    // "Vilket material?" (kvalitet, märken)
  timeline: boolean;     // "När?" (brådskande, flexibel, etc.)
  specialRequirements: boolean; // "Något speciellt?" (arbetssätt, begränsningar)
}

interface ConversationSummary {
  projectType?: string;
  scope?: string;
  measurements?: {
    area?: string;
    rooms?: number;
    height?: string;
    quantity?: number;
    [key: string]: any;
  };
  confirmedWork?: string[];
  materials?: {
    quality?: string;
    brands?: string[];
    specific?: string[];
  };
  budget?: string;
  timeline?: string;
  specialRequirements?: string[];
  exclusions?: string[];
  customerAnswers?: Record<string, any>;
  checklist?: InformationChecklist; // FAS 19: Track main categories
}

async function generateConversationSummary(
  allMessages: Array<{ role: string; content: string }>,
  apiKey: string
): Promise<ConversationSummary> {
  const conversationText = allMessages
    .map(m => `${m.role === 'user' ? 'Användare' : 'AI'}: ${m.content}`)
    .join('\n');

  const prompt = `Du analyserar en konversation mellan en AI-assistent och en HANTVERKARE som ska skapa en offert.

**VIKTIGT KONTEXT:**
- Hantverkaren beskriver ett projekt som de ska offerera på
- Detta är INTE en konversation med slutkunden
- Extrahera strukturerad data för att kunna beräkna en korrekt offert

**KONVERSATION:**
${conversationText}

**UPPGIFT 1: Extrahera information**
Extrahera följande information och returnera som JSON:

1. **projectType**: Typ av projekt (t.ex. "Badrumsrenovering", "Trädfällning", "Målning")
2. **scope**: Omfattning (t.ex. "Totalrenovering", "Delrenovering", "Endast målning")
3. **measurements**: Mått och storlekar
   - area: "X kvm" om nämnt
   - rooms: antal rum om nämnt
   - height: höjd om nämnt (t.ex. träd)
   - quantity: antal enheter (t.ex. 3 träd)
4. **confirmedWork**: Lista med bekräftade arbetsmoment (t.ex. ["Rivning", "Kakelläggning", "VVS"])
5. **materials**: Information om material
   - quality: "budget", "standard" eller "premium" om nämnt
   - brands: Lista med nämnda märken
   - specific: Specifika material som nämnts
6. **budget**: Budgetram om nämnt
7. **timeline**: Tidsplan om nämnt
8. **specialRequirements**: Speciella krav eller önskemål
9. **exclusions**: Saker som INTE ska ingå i offerten
10. **customerAnswers**: Objekt med specifika svar på frågor (t.ex. {"rivning": "ja", "bortforsling": "nej"})

**UPPGIFT 2: Markera vilka huvudkategorier som är BESVARADE (FAS 19)**
Returnera också ett "checklist"-objekt som markerar om vi har fått svar på dessa 5 huvudkategorier:
{
  "checklist": {
    "scope": true/false,     // Har vi fått svar på VAD som ska göras? (rivning, renovering, nyinstallation, etc.)
    "size": true/false,      // Har vi fått svar på STORLEK/OMFATTNING? (kvm, antal enheter, höjd, etc.)
    "materials": true/false, // Har vi fått svar om MATERIAL/KVALITET? (budget/standard/premium, specifika material)
    "timeline": true/false,  // Har vi fått svar om TIDSPLAN? (brådskande, flexibel, specifikt datum)
    "specialRequirements": true/false // Har vi fått svar om SPECIELLA KRAV? (arbetssätt, begränsningar, önskemål)
  }
}

**EXEMPEL OUTPUT:**
{
  "projectType": "Badrumsrenovering",
  "scope": "Totalrenovering med rivning",
  "measurements": {
    "area": "8 kvm",
    "rooms": 1
  },
  "confirmedWork": ["Rivning", "Kakelläggning", "VVS-installation", "Elarbeten", "Målning"],
  "materials": {
    "quality": "standard",
    "brands": ["Alcro"],
    "specific": ["Vit kakel 20x20cm"]
  },
  "specialRequirements": ["Jobba på kvällar"],
  "exclusions": ["Bortforsling"],
  "customerAnswers": {
    "rivning": "ja",
    "golvvärme": "ny installation",
    "kvalitet": "standard",
    "bortforsling": "nej, kunden sköter det"
  },
  "checklist": {
    "scope": true,
    "size": true,
    "materials": true,
    "timeline": false,
    "specialRequirements": true
  }
}

**VIKTIGT:**
- Om information inte nämnts, lämna fältet tomt eller undefined
- Extrahera ENDAST information som faktiskt nämnts i konversationen
- Var specifik med mått och enheter
- customerAnswers ska innehålla råa svar från användaren
- checklist ska reflektera om vi har TILLRÄCKLIG information i varje kategori för att skapa en offert

Returnera bara JSON, ingen annan text.`;

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
      console.error('❌ AI summary request failed:', response.statusText);
      return {};
    }

    const data = await response.json();
    const summary = JSON.parse(data.choices[0].message.content);
    
    console.log('✅ Generated conversation summary:', JSON.stringify(summary, null, 2));
    return summary;
  } catch (error) {
    console.error('❌ Error generating conversation summary:', error);
    return {};
  }
}

// FAS 8: Extract answered topics from user message
function extractAnsweredTopics(userMessage: string, requirements: ProjectRequirements): string[] {
  const topics: string[] = [];
  const lower = userMessage.toLowerCase();
  
  // Pattern matching för vanliga svar
  const patterns: Record<string, RegExp> = {
    'area': /(\d+)\s*(kvm|kvadratmeter|m2|kvadrat)/i,
    'rivning': /(ja|nej|behövs|ingå|riva|demontera|rivning)/i,
    'golvvärme': /(ja|nej|ny|befintlig|golvvärme)/i,
    'el': /(ja|nej|ny dragning|armaturer|elarbete|el-|uttag)/i,
    'ventilation': /(ja|nej|fläkt|ventilation)/i,
    'kakel': /(budget|standard|premium|billig|dyr|högkvalitet)/i,
    'kvalitet': /(budget|standard|premium|billig|dyr|högkvalitet)/i,
    'antal_träd': /(\d+)\s*(träd|ek|gran|tall|ekar|granar|tallar)/i,
    'höjd': /(\d+)\s*(meter|m)\s*(hög|höjd|höga)?/i,
    'diameter': /(\d+)\s*(cm|meter|m)\s*(diameter|tjock|bred)?/i,
    'stubbfräsning': /(stubb|fräsa|stubbar|stubbfräsning)/i,
    'bortforsling': /(forsla|bortforsling|transport|ta bort)/i,
    'maskin': /(maskin|tillgång|manuellt|åtkomst)/i,
    'scope': /(total|del|helt|komplett|renovering|nytt)/i,
    'vvs': /(vvs|vatten|avlopp|diskho|dusch)/i,
    'målning': /(måla|målning|färg|stryk)/i,
    'tak': /(tak|taket)/i,
    'golv': /(golv|parkett|laminat)/i,
    'fönster': /(fönster|fönstren)/i,
    'strykningar': /(strykning|strykningar|gång|gånger)/i
  };
  
  // Check each pattern
  for (const [topic, pattern] of Object.entries(patterns)) {
    if (pattern.test(lower)) {
      topics.push(topic);
      console.log(`    🎯 Pattern match: "${topic}" found in message`);
    }
  }
  
  // Check mot mandatory questions keywords
  for (const question of requirements.mandatoryQuestions) {
    const questionKeywords = question.toLowerCase()
      .replace(/[?.,]/g, '')
      .split(' ')
      .filter(w => w.length > 3) // Bara ord längre än 3 tecken
      .slice(0, 3); // Första 3 nyckelorden
    
    const matchesKeywords = questionKeywords.some(kw => lower.includes(kw));
    
    if (matchesKeywords && lower.length > 10) { // Inte bara "ja" eller "nej"
      const topicName = question.split(' ').slice(0, 2).join('_').toLowerCase();
      if (!topics.includes(topicName)) {
        topics.push(topicName);
        console.log(`    🎯 Keyword match: "${topicName}" from question: "${question}"`);
      }
    }
  }
  
  return topics;
}

// ============================================
// FAS 12: NEGATION AND CORRECTION DETECTION
// ============================================

interface NegationResult {
  isNegation: boolean;
  correctionType?: 'remove' | 'replace' | 'clarify';
  targetItems?: string[];
  newValue?: string;
  explanation?: string;
}

function detectNegationOrCorrection(
  userMessage: string,
  conversationSummary: any
): NegationResult {
  const lower = userMessage.toLowerCase();
  
  // Pattern 1: Direct negation ("Nej", "Glöm det")
  const directNegations = [
    /^nej[,.]?\s/i,
    /glöm\s+(det|tidigare|att jag sa)/i,
    /inte\s+längre/i,
    /ångrar\s+mig/i,
    /fel[,.]?\s/i,
    /inte\s+(det|så)/i,
  ];
  
  for (const pattern of directNegations) {
    if (pattern.test(lower)) {
      console.log('🚫 FAS 12: Direct negation detected:', userMessage);
      
      // Try to identify what they're negating
      const targetItems: string[] = [];
      
      // Check against confirmed work
      if (conversationSummary?.confirmedWork) {
        conversationSummary.confirmedWork.forEach((work: string) => {
          if (lower.includes(work.toLowerCase())) {
            targetItems.push(work);
          }
        });
      }
      
      return {
        isNegation: true,
        correctionType: 'remove',
        targetItems: targetItems.length > 0 ? targetItems : ['senaste svar'],
        explanation: 'Användaren ångrar/korrigerar sitt tidigare svar'
      };
    }
  }
  
  // Pattern 2: Replacement ("istället för X, Y")
  const replacementPatterns = [
    /istället\s+för\s+([^,]+),?\s+(.+)/i,
    /inte\s+([^,]+)\s+utan\s+(.+)/i,
    /byt\s+ut\s+([^,]+)\s+mot\s+(.+)/i,
  ];
  
  for (const pattern of replacementPatterns) {
    const match = lower.match(pattern);
    if (match) {
      console.log('🔄 FAS 12: Replacement detected:', match[1], '→', match[2]);
      return {
        isNegation: true,
        correctionType: 'replace',
        targetItems: [match[1].trim()],
        newValue: match[2].trim(),
        explanation: `Ersätter "${match[1]}" med "${match[2]}"`
      };
    }
  }
  
  // Pattern 3: Correction of quantity/measurement
  const quantityCorrections = [
    /(?:egentligen|faktiskt|snarare)\s+(\d+)/i,
    /rättelse[:\s]+(\d+)/i,
    /menade\s+(\d+)/i,
  ];
  
  for (const pattern of quantityCorrections) {
    const match = lower.match(pattern);
    if (match) {
      console.log('📏 FAS 12: Quantity correction detected:', match[1]);
      return {
        isNegation: true,
        correctionType: 'replace',
        newValue: match[1],
        explanation: 'Korrigerar tidigare angiven siffra'
      };
    }
  }
  
  // Pattern 4: "Ta bort X" / "Exkludera X"
  const removalPatterns = [
    /ta\s+bort\s+(.+)/i,
    /exkludera\s+(.+)/i,
    /skippa\s+(.+)/i,
    /behövs\s+inte\s+(.+)/i,
  ];
  
  for (const pattern of removalPatterns) {
    const match = lower.match(pattern);
    if (match) {
      console.log('❌ FAS 12: Removal request detected:', match[1]);
      return {
        isNegation: true,
        correctionType: 'remove',
        targetItems: [match[1].trim()],
        explanation: `Ta bort "${match[1]}" från offerten`
      };
    }
  }
  
  return { isNegation: false };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verifiera användare
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, sessionId, message, status, learnedPreferences } = await req.json();

    // CREATE SESSION
    if (action === 'create_session') {
      const { data: session, error } = await supabaseClient
        .from('conversation_sessions')
        .insert({
          user_id: user.id,
          status: 'active'
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating session:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to create session' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ session }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SAVE MESSAGE
    if (action === 'save_message') {
      if (!sessionId || !message || !message.role || !message.content) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verifiera att sessionen tillhör användaren
      const { data: session } = await supabaseClient
        .from('conversation_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

      if (!session) {
        return new Response(
          JSON.stringify({ error: 'Session not found or unauthorized' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Spara meddelandet
      const { data: savedMessage, error } = await supabaseClient
        .from('conversation_messages')
        .insert({
          session_id: sessionId,
          role: message.role,
          content: message.content
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving message:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to save message' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // SPRINT 1: Track AI questions and user topics
      const updateData: any = { last_message_at: new Date().toISOString() };
      
      // Track AI questions to prevent repetition
      if (message.role === 'assistant' && message.aiQuestions && Array.isArray(message.aiQuestions)) {
        const currentAskedQuestions = session.asked_questions || [];
        const newQuestions = message.aiQuestions.filter((q: string) => !currentAskedQuestions.includes(q));
        
        if (newQuestions.length > 0) {
          updateData.asked_questions = [...currentAskedQuestions, ...newQuestions];
          console.log('📝 Tracked new AI questions:', newQuestions);
        }
      }
      
      // Track answered topics from user messages
      if (message.role === 'user') {
        // Extrahera svar från meddelandet
        const content = message.content.toLowerCase();
        const currentAnswers = session.answered_questions || {};
        
        // Spara svar baserat på nyckelord
        if (content.match(/\d+\s*(kvm|m2|m²|kvadratmeter)/i)) {
          const match = content.match(/(\d+(?:[.,]\d+)?)\s*(kvm|m2|m²)/i);
          if (match) currentAnswers.area = `${match[1]} ${match[2]}`;
        }
        if (content.match(/rivning/i)) {
          currentAnswers.demolition = content.match(/ja|ingår|med/i) ? 'ja' : 'nej';
        }
        if (content.match(/kakel|material/i)) {
          if (content.match(/standard/i)) currentAnswers.material_quality = 'standard';
          if (content.match(/premium|hög/i)) currentAnswers.material_quality = 'premium';
          if (content.match(/budget|enkel/i)) currentAnswers.material_quality = 'budget';
        }
        if (content.match(/bortforsling/i)) {
          currentAnswers.disposal = content.match(/ja|ingår|med/i) ? 'ingår' : 'ej ingår';
        }
        
        updateData.answered_questions = currentAnswers;
        
        // Track topics
        const answeredTopics: string[] = [];
        const topicKeywords = [
          { keywords: ['kvm', 'kvadratmeter', 'm2'], topic: 'area' },
          { keywords: ['badrum', 'kök', 'rum'], topic: 'room_type' },
          { keywords: ['budget', 'kr', 'kostar'], topic: 'budget' },
          { keywords: ['rot', 'rut'], topic: 'deduction_type' },
        ];

        topicKeywords.forEach(({ keywords, topic }) => {
          if (keywords.some(kw => content.includes(kw))) {
            answeredTopics.push(topic);
          }
        });

        if (answeredTopics.length > 0) {
          const currentAnswered = session.answered_topics || [];
          updateData.answered_topics = [...new Set([...currentAnswered, ...answeredTopics])];
        }
      }

      await supabaseClient
        .from('conversation_sessions')
        .update(updateData)
        .eq('id', sessionId);

      // FIX 2 + FAS 4 + FAS 8: Generate batch questions and check readiness for user messages
      if (message.role === 'user') {
        const { data: allMessages } = await supabaseClient
          .from('conversation_messages')
          .select('role, content')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });
        
        // FAS 11: Generate AI-driven conversation summary
        console.log('🧠 FAS 11: Generating AI-driven conversation summary...');
        const conversationSummary = await generateConversationSummary(
          allMessages || [],
          LOVABLE_API_KEY
        );
        
        // FAS 12: Check for negations/corrections in user message
        console.log('🔍 FAS 12: Checking for negations/corrections...');
        const negationResult = detectNegationOrCorrection(
          message.content,
          conversationSummary
        );
        
        if (negationResult.isNegation) {
          console.log('🚫 FAS 12: Negation detected!', negationResult);
          
          // Update conversation summary to reflect correction
          if (negationResult.correctionType === 'remove' && negationResult.targetItems) {
            // Remove from confirmedWork
            if (conversationSummary.confirmedWork) {
              conversationSummary.confirmedWork = conversationSummary.confirmedWork.filter(
                (work: string) => !negationResult.targetItems?.some(
                  target => work.toLowerCase().includes(target.toLowerCase())
                )
              );
            }
            
            // Add to exclusions
            if (!conversationSummary.exclusions) conversationSummary.exclusions = [];
            negationResult.targetItems.forEach(item => {
              if (conversationSummary.exclusions && !conversationSummary.exclusions.includes(item)) {
                conversationSummary.exclusions.push(item);
              }
            });
          } else if (negationResult.correctionType === 'replace' && negationResult.targetItems && negationResult.newValue) {
            // Update value in summary
            if (conversationSummary.customerAnswers) {
              const oldKey = negationResult.targetItems[0];
              const newValue = negationResult.newValue;
              
              // Find and update the relevant answer
              Object.keys(conversationSummary.customerAnswers).forEach(key => {
                if (key.toLowerCase().includes(oldKey.toLowerCase()) && conversationSummary.customerAnswers) {
                  conversationSummary.customerAnswers[key] = newValue;
                }
              });
            }
          }
          
          console.log('✅ FAS 12: Updated conversation summary after correction');
        }
        
        // Save summary to session
        await supabaseClient
          .from('conversation_sessions')
          .update({ conversation_summary: conversationSummary })
          .eq('id', sessionId);
        
        console.log('✅ FAS 11: Conversation summary saved to database');
        
        const fullDescription = allMessages
          ?.filter((m: any) => m.content)
          .map((m: any) => m.content)
          .join(' ') || '';
        
        const requirements = getProjectRequirements(fullDescription);
        
        // FAS 8: Extract answered topics from current user message
        const extractedTopics = extractAnsweredTopics(message.content, requirements);
        
        if (extractedTopics.length > 0) {
          console.log('  ✅ Extracted topics from user message:', extractedTopics);
          
          // Merge with existing answered topics (no duplicates)
          const currentAnsweredTopics = session.answered_topics || [];
          const updatedTopics = [...new Set([...currentAnsweredTopics, ...extractedTopics])];
          
          await supabaseClient
            .from('conversation_sessions')
            .update({ answered_topics: updatedTopics })
            .eq('id', sessionId);
          
          console.log('  💾 Updated answered_topics in database:', updatedTopics);
        }
        
        // FAS 19: Get checklist from conversation summary
        const { data: updatedSession } = await supabaseClient
          .from('conversation_sessions')
          .select('asked_questions, answered_topics')
          .eq('id', sessionId)
          .single();
        
        const askedQuestions = updatedSession?.asked_questions || [];
        const answeredTopics = updatedSession?.answered_topics || [];
        
        // FAS 19: Checklist-based completeness tracking
        const checklist = conversationSummary?.checklist || {
          scope: false,
          size: false,
          materials: false,
          timeline: false,
          specialRequirements: false
        };
        
        const answeredCategories = Object.values(checklist).filter(Boolean).length;
        const totalCategories = 5;
        const completenessPercentage = (answeredCategories / totalCategories) * 100;
        
        // FAS 19: Question budget - lowered to 10
        const MAX_QUESTIONS = 10;
        const totalQuestionsAsked = askedQuestions.length;
        
        console.log('🧠 FAS 19: CHECKLIST STATUS:');
        console.log('  ✅ Scope (vad?):', checklist.scope);
        console.log('  ✅ Size (hur mycket?):', checklist.size);
        console.log('  ✅ Materials (vilket?):', checklist.materials);
        console.log('  ✅ Timeline (när?):', checklist.timeline);
        console.log('  ✅ Special (något speciellt?):', checklist.specialRequirements);
        console.log('  📊 Total:', `${answeredCategories}/${totalCategories} (${Math.round(completenessPercentage)}%)`);
        console.log('  ❓ Questions asked:', totalQuestionsAsked, '/', MAX_QUESTIONS);
        
        // FAS 20: Two-Stage Quote Generation System
        const STAGE_1_MAX_QUESTIONS = 4; // Initial round
        const STAGE_2_MAX_QUESTIONS = 3; // Refinement round
        const TOTAL_MAX_QUESTIONS = 6;   // Absolute max (down from 10)
        
        let maxQuestionsToGenerate = 0;
        let shouldGenerateDraftQuote = false;
        let shouldGenerateFinalQuote = false;
        const isRefinementRequested = session.refinement_requested || false;
        
        // STAGE 1: Initial information gathering (3-4 questions)
        if (totalQuestionsAsked === 0) {
          maxQuestionsToGenerate = 3;
          console.log('🎯 FAS 20 STAGE 1: Asking initial 3 questions');
        }
        // FAS 22: FORCE DRAFT QUOTE EARLIER - After 3 questions (not 4)
        else if (!isRefinementRequested && totalQuestionsAsked >= 3) {
          shouldGenerateDraftQuote = true;
          console.log('📄 FAS 22: Generating DRAFT QUOTE after 3 questions (forced earlier)');
          console.log('  ✅ Questions asked:', totalQuestionsAsked);
          console.log('  ✅ Categories answered:', answeredCategories, '/', totalCategories);
        }
        // STAGE 2: Refinement (user clicks "Förfina offerten")
        else if (isRefinementRequested && totalQuestionsAsked < TOTAL_MAX_QUESTIONS) {
          maxQuestionsToGenerate = Math.min(2, TOTAL_MAX_QUESTIONS - totalQuestionsAsked);
          console.log('🔧 FAS 20 STAGE 2: Asking refinement questions (max', maxQuestionsToGenerate, ')');
        }
        // STAGE 2 → FINAL: After refinement OR absolute max OR all categories answered
        else if (totalQuestionsAsked >= TOTAL_MAX_QUESTIONS || answeredCategories >= 4) {
          shouldGenerateFinalQuote = true;
          console.log('✅ FAS 20: Generating FINAL QUOTE');
          console.log('  ✅ Questions asked:', totalQuestionsAsked);
          console.log('  ✅ Categories answered:', answeredCategories, '/', totalCategories);
        }
        // Continue asking questions
        else if (answeredCategories >= 2) {
          maxQuestionsToGenerate = 2;
          console.log('💡 FAS 20: 2+ categories answered - asking 2 more questions');
        } else {
          maxQuestionsToGenerate = 3;
          console.log('💡 FAS 20: <2 categories answered - asking 3 questions');
        }
        
        // FAS 20: Generate questions or trigger quote generation
        if (!shouldGenerateDraftQuote && !shouldGenerateFinalQuote && maxQuestionsToGenerate > 0) {
          console.log('🤖 FAS 20: Generating AI-driven smart questions (max:', maxQuestionsToGenerate, ')');
          
          // FAS 26: Enhanced logging for debugging
          console.log('🎯 FAS 26: Question round tracking:', {
            totalAsked: totalQuestionsAsked,
            thisRound: maxQuestionsToGenerate,
            categoriesCovered: answeredCategories,
            isRefinement: isRefinementRequested,
            missingCategories: Object.entries(checklist).filter(([_, v]) => !v).map(([k]) => k)
          });
          
          const batchQuestions = await generateSmartQuestions(
            fullDescription,
            allMessages || [],
            conversationSummary,
            askedQuestions,
            LOVABLE_API_KEY,
            maxQuestionsToGenerate,
            isRefinementRequested // FAS 24: Pass refinement mode flag
          );
          
          console.log('  ❓ Generated questions:', batchQuestions.length);
          console.log('  📝 Already asked:', totalQuestionsAsked, 'questions');
          
          if (batchQuestions.length > 0) {
            // FAS 24 & FAS 26: Track question count and refinement status
            await supabaseClient
              .from('conversation_sessions')
              .update({
                asked_questions: [...askedQuestions, ...batchQuestions],
                last_questions_count: batchQuestions.length // FAS 24: Track for debugging
              })
              .eq('id', sessionId);
            
            console.log('  💾 Saved', batchQuestions.length, 'questions to session');
            console.log('  ⏸️  Blocking quote generation - needs more info');
            
            return new Response(
              JSON.stringify({ 
                message: savedMessage,
                suggestedQuestions: batchQuestions,
                needsMoreInfo: true,
                completenessScore: Math.round(completenessPercentage),
                questionsAsked: totalQuestionsAsked,
                maxQuestions: TOTAL_MAX_QUESTIONS,
                answeredCategories: answeredCategories,
                totalCategories: totalCategories,
                isRefinement: isRefinementRequested
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
        
        // FAS 20: Signal draft or final quote readiness
        if (shouldGenerateDraftQuote) {
          console.log('  📄 FAS 20: Ready for DRAFT quote (categories:', `${answeredCategories}/${totalCategories})`);
          
          return new Response(
            JSON.stringify({ 
              message: savedMessage,
              readyForDraftQuote: true,
              isDraft: true,
              answeredCategories: answeredCategories,
              totalCategories: totalCategories,
              completenessScore: Math.round(completenessPercentage)
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (shouldGenerateFinalQuote) {
          console.log('  ✅ FAS 20: Ready for FINAL quote (categories:', `${answeredCategories}/${totalCategories})`);
          
          return new Response(
            JSON.stringify({ 
              message: savedMessage,
              readyForFinalQuote: true,
              isDraft: false,
              answeredCategories: answeredCategories,
              totalCategories: totalCategories,
              completenessScore: Math.round(completenessPercentage)
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log('  ✅ FAS 20: Ready to generate quote (categories:', `${answeredCategories}/${totalCategories})`);
      }

      return new Response(
        JSON.stringify({ message: savedMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET HISTORY
    if (action === 'get_history') {
      if (!sessionId) {
        return new Response(
          JSON.stringify({ error: 'Missing sessionId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verifiera att sessionen tillhör användaren
      const { data: session } = await supabaseClient
        .from('conversation_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

      if (!session) {
        return new Response(
          JSON.stringify({ error: 'Session not found or unauthorized' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Hämta meddelanden
      const { data: messages, error } = await supabaseClient
        .from('conversation_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch messages' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ session, messages }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // UPDATE SESSION STATUS
    if (action === 'update_status') {
      if (!sessionId || !status) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabaseClient
        .from('conversation_sessions')
        .update({ status })
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating session:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to update session' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // FAS 22 & FAS 24: REQUEST REFINEMENT (triggers Stage 2)
    if (action === 'request_refinement') {
      if (!sessionId) {
        return new Response(
          JSON.stringify({ error: 'Missing sessionId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        // FAS 24: Mark refinement as requested and reset completion flag
        const { data: session, error } = await supabaseClient
          .from('conversation_sessions')
          .update({ 
            refinement_requested: true,
            refinement_completed: false // FAS 24: Reset for new refinement round
          })
          .eq('id', sessionId)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;
        
        console.log('🔧 FAS 24: Refinement requested for session:', sessionId);
        console.log('  📊 Current state:', {
          totalQuestions: session.asked_questions?.length || 0,
          refinementCompleted: session.refinement_completed
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Refinement requested. Send a new message to get refinement questions.',
            refinementMode: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error('Error requesting refinement:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to request refinement' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // UPDATE LEARNED PREFERENCES (FAS 5)
    if (action === 'update_learned_preferences') {
      if (!sessionId || !learnedPreferences) {
        return new Response(
          JSON.stringify({ error: 'Missing sessionId or learnedPreferences' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabaseClient
        .from('conversation_sessions')
        .update({ 
          learned_preferences: learnedPreferences,
          last_message_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating learned preferences:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to update learned preferences' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CLEAR SESSION (för testing/development)
    if (action === 'clear_session') {
      if (!sessionId) {
        return new Response(
          JSON.stringify({ error: 'Missing sessionId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabaseClient
        .from('conversation_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error clearing session:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to clear session' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in manage-conversation function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
