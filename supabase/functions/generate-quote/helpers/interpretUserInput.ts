/**
 * USER INPUT INTERPRETER - FAS 6
 * AI:n tolkar ENDAST användarens input och extraherar strukturerad data
 * Gör INGA beräkningar av timmar, priser eller totaler
 */

interface UserInterpretation {
  jobType: string;
  area?: number;
  length?: number;
  quantity?: number;
  rooms?: number;
  complexity: 'simple' | 'normal' | 'complex';
  accessibility: 'easy' | 'normal' | 'hard';
  qualityLevel: 'budget' | 'standard' | 'premium';
  specialRequirements: string[];
  customerProvidesMaterial: boolean;
  customerProvidesDetails: string[];
  exclusions: string[];
  inclusions: string[];
  assumptions: string[];
  clarificationsNeeded: string[];
  missingCriticalInfo: boolean;
  startMonth?: number;
  location?: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Tolkar användarens konversation och extraherar strukturerad data
 * AI:n får ENDAST returnera tolkad data, INGA beräkningar
 */
export async function interpretUserInput(
  description: string,
  conversationHistory: ConversationMessage[],
  apiKey: string,
  requiredFields: string[] = []
): Promise<UserInterpretation> {
  
  console.log('🧠 FAS 6: Interpreting user input with AI...');
  
  const conversationText = conversationHistory
    .map(m => `${m.role === 'user' ? 'Kund' : 'Assistent'}: ${m.content}`)
    .join('\n');
  
  const requiredFieldsText = requiredFields.length > 0 
    ? `\n**OBLIGATORISKA FÄLT FÖR DENNA JOBBTYP:** ${requiredFields.join(', ')}`
    : '';

  const promptText = `
Du är en AI som TOLKAR användarbehov för offertgenerering.

**DIN UPPGIFT:**
Extrahera strukturerad data från konversationen. Returnera ENDAST tolkad information.
${requiredFieldsText}

**VIKTIG REGEL OM OBLIGATORISKA FÄLT:**
- Om något av de obligatoriska fälten saknas: sätt "missingCriticalInfo": true och lägg till en relevant fråga i "clarificationsNeeded"
- Om användaren explicit ber om en uppskattning (t.ex. "mellan tummen och pekfingret", "ungefärligt", "bara en snabb kalkyl"), IGNORERA detta och sätt "missingCriticalInfo": false ENDAST om de obligatoriska fälten finns
- Obligatoriska fält kan INTE approximeras - de måste finnas explicit

**KONVERSATION:**
${conversationText}

**PROJEKTBESKRIVNING:**
${description}

**RETURNERA JSON:**
{
  "jobType": "<detekterad jobbtyp: 'målning', 'badrum', 'kök', 'städning', 'trädgård', 'el', 'fasad', 'golv', 'övrigt'>",
  "area": <antal kvm om nämnt, annars null>,
  "length": <antal löpmeter om nämnt, annars null>,
  "quantity": <antal styck om nämnt, annars null>,
  "rooms": <antal rum om nämnt, annars null>,
  "complexity": "simple" | "normal" | "complex",
  "accessibility": "easy" | "normal" | "hard",
  "qualityLevel": "budget" | "standard" | "premium",
  "specialRequirements": ["mörk färg", "takmålning", etc],
  "customerProvidesMaterial": <true om kunden ska stå för material>,
  "customerProvidesDetails": ["kök", "vitvaror", etc om applicerbart],
  "exclusions": ["moment som explicit exkluderats"],
  "inclusions": ["moment som explicit inkluderats"],
  "assumptions": ["antaganden du behöver göra"],
  "clarificationsNeeded": ["frågor som behöver besvaras"],
  "missingCriticalInfo": <true om något obligatoriskt fält saknas>,
  "startMonth": <1-12 om nämnt, annars null>,
  "location": "<stad om nämnd, annars null>"
}

**VIKTIGA REGLER:**
- Returnera ENDAST strukturerad data
- Gör INGA beräkningar av timmar eller priser
- Tolka komplexitet från beskrivningar som "enkelt", "svårt", "komplicerat"
- Tolka tillgänglighet från "hiss", "våning 4", "trång", "svåråtkomligt"
- Tolka kvalitetsnivå från "budget", "billigt", "premium", "lyxigt"
- Identifiera om kunden står för material från fraser som "vi/jag har redan", "kunden tillhandahåller"

**EXEMPEL PÅ TOLKNINGAR:**

Kund: "Jag ska måla om tre rum, ca 45 kvm totalt, mörka färger"
→ {
  "jobType": "målning",
  "area": 45,
  "rooms": 3,
  "complexity": "normal",
  "specialRequirements": ["mörka färger"],
  "assumptions": ["Antog 45 kvm inklusive tak och väggar"]
}

Kund: "Renovera badrum, vi har redan köpt kakel och golvvärme"
→ {
  "jobType": "badrum",
  "customerProvidesMaterial": true,
  "customerProvidesDetails": ["kakel", "golvvärme"],
  "assumptions": ["Kunden står för material - exkludera materialkostnader"]
}

**RETURNERA ENDAST VALID JSON - INGA KOMMENTARER ELLER FÖRKLARINGAR UTANFÖR JSON!**
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
          content: 'Du är en AI som tolkar användarbehov och returnerar strukturerad data. Returnera ENDAST JSON, inga beräkningar.'
        },
        { role: 'user', content: promptText }
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ AI interpretation failed:', response.status, errorText);
    throw new Error(`AI interpretation failed: ${response.status}`);
  }

  const data = await response.json();
  const rawContent = data.choices[0].message.content;
  
  console.log('🔍 Raw AI interpretation:', rawContent);
  
  // Parse JSON safely
  let interpretation: UserInterpretation;
  try {
    // Strip markdown code fences if present
    let jsonContent = rawContent;
    if (jsonContent.includes('```json')) {
      jsonContent = jsonContent.split('```json')[1].split('```')[0].trim();
    } else if (jsonContent.includes('```')) {
      jsonContent = jsonContent.split('```')[1].split('```')[0].trim();
    }
    
    interpretation = JSON.parse(jsonContent);
  } catch (e) {
    console.error('❌ Failed to parse AI interpretation:', e);
    console.error('Raw content:', rawContent);
    
    // Fallback to basic extraction
    interpretation = {
      jobType: 'målning',
      complexity: 'normal',
      accessibility: 'normal',
      qualityLevel: 'standard',
      specialRequirements: [],
      customerProvidesMaterial: false,
      customerProvidesDetails: [],
      exclusions: [],
      inclusions: [],
      assumptions: ['AI-tolkning misslyckades - använder standardvärden'],
      clarificationsNeeded: [],
      missingCriticalInfo: true
    };
  }
  
  console.log('✅ Interpretation complete:', interpretation);
  
  return interpretation;
}
