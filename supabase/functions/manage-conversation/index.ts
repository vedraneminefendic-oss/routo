import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { getProjectRequirements, generateNextQuestion, generateBatchQuestions, ProjectRequirements } from "./helpers/smartQuestions.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const TEXT_MODEL = 'google/gemini-2.5-flash';

// ============================================
// FAS 11: AI-DRIVEN CONVERSATION SUMMARY
// ============================================

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
}

async function generateConversationSummary(
  allMessages: Array<{ role: string; content: string }>,
  apiKey: string
): Promise<ConversationSummary> {
  const conversationText = allMessages
    .map(m => `${m.role === 'user' ? 'Användare' : 'AI'}: ${m.content}`)
    .join('\n');

  const prompt = `Analysera denna konversation och extrahera strukturerad data för en offertkalkyl.

**KONVERSATION:**
${conversationText}

**UPPGIFT:**
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
  }
}

**VIKTIGT:**
- Om information inte nämnts, lämna fältet tomt eller undefined
- Extrahera ENDAST information som faktiskt nämnts i konversationen
- Var specifik med mått och enheter
- customerAnswers ska innehålla råa svar från användaren

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
        
        // FAS 4: Calculate readiness score (with potentially updated topics)
        const { data: updatedSession } = await supabaseClient
          .from('conversation_sessions')
          .select('asked_questions, answered_topics')
          .eq('id', sessionId)
          .single();
        
        const askedQuestions = updatedSession?.asked_questions || [];
        const answeredTopics = updatedSession?.answered_topics || [];
        const mandatoryQuestions = requirements.mandatoryQuestions || [];
        
        // Count how many mandatory questions have been answered
        const mandatoryAnswered = mandatoryQuestions.filter(q =>
          answeredTopics.some((topic: string) => q.toLowerCase().includes(topic.toLowerCase()))
        );
        
        const readinessScore = mandatoryQuestions.length > 0 
          ? (mandatoryAnswered.length / mandatoryQuestions.length) * 100
          : 0;
        
        console.log('🧠 READINESS CHECK:');
        console.log('  📊 Readiness score:', `${readinessScore.toFixed(0)}%`);
        console.log('  ✅ Mandatory answered:', mandatoryAnswered.length, '/', mandatoryQuestions.length);
        console.log('  📋 Project type:', requirements.projectType);
        
        // FIX 2: Generate batch questions (4-6 questions at once)
        const batchQuestions = generateBatchQuestions(
          requirements,
          askedQuestions,
          answeredTopics,
          6 // Max 6 questions
        );
        
        console.log('  ❓ Generated questions:', batchQuestions.length);
        console.log('  📝 Already asked:', askedQuestions.length, 'questions');
        
        // FAS 4: Only return questions if readiness is below threshold (80%)
        if (batchQuestions.length > 0 && readinessScore < 80) {
          // Save all questions to the session
          await supabaseClient
            .from('conversation_sessions')
            .update({
              asked_questions: [...askedQuestions, ...batchQuestions]
            })
            .eq('id', sessionId);
          
          console.log('  💾 Saved', batchQuestions.length, 'questions to session');
          console.log('  ⏸️  Blocking quote generation - needs more info');
          
          return new Response(
            JSON.stringify({ 
              message: savedMessage,
              suggestedQuestions: batchQuestions, // Plural - array
              needsMoreInfo: true, // Signal that we need more info
              readinessScore: Math.round(readinessScore),
              mandatoryAnswered: mandatoryAnswered.length,
              mandatoryTotal: mandatoryQuestions.length,
              projectRequirements: requirements
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log('  ✅ Ready to generate quote (readiness:', `${readinessScore.toFixed(0)}%)` );
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
