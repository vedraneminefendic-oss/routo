import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// KORRIGERADE SÖKVÄGAR: Allt ligger i 'helpers' enligt din filstruktur
import { interpretUserInput } from "./helpers/interpretUserInput.ts";
import { runQuotePipeline } from "./helpers/pipelineOrchestrator.ts";
import { findJobDefinition } from "./helpers/jobRegistry.ts";

console.log("🚀 Function 'generate-quote' starting (FIXED PATHS & INLINED CORS)");

// Inline CORS headers för att undvika import-fel
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mycket tolerant schema för att förhindra valideringskrascher
const RequestSchema = z.object({
  message: z.string().optional(),
  description: z.any().optional(),
  sessionId: z.any().optional(),
  userId: z.any().optional(),
  previousContext: z.any().optional(),
  conversationHistory: z.array(z.any()).optional().default([]),
  userSettings: z.any().optional().default({})
});

serve(async (req) => {
  // Hantera CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    
    // Säker parsing som inte kraschar
    const parseResult = RequestSchema.safeParse(rawBody);
    const data = parseResult.success ? parseResult.data : rawBody;
    
    // 1. NORMALISERA INPUT
    const message = typeof data.message === 'string' ? data.message : "";
    // Använd description om det finns, annars fallback till message
    const description = (data.description && typeof data.description === 'string') 
      ? data.description 
      : message;

    // Garantera ett sessionId
    let sessionId = "";
    if (data.sessionId && typeof data.sessionId === 'string') {
      sessionId = data.sessionId;
    } else {
      sessionId = crypto.randomUUID();
    }

    const userId = typeof data.userId === 'string' ? data.userId : 'anonymous';
    const apiKey = Deno.env.get('LOVABLE_AI_API_KEY') || "";

    // 2. KONTROLLERA ATT VI HAR MINSTA MÖJLIGA DATA
    if (!description || !description.trim()) {
      console.log("⚠️ Empty input received");
      return new Response(JSON.stringify({
        error: "Message or description is required"
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`🤖 Processing request for session: ${sessionId}`);
    console.log(`📝 Description: ${description.substring(0, 50)}...`);

    // 3. AI TOLKNING
    const interpretation = await interpretUserInput(
      description, 
      data.conversationHistory || [], 
      apiKey
    );
    
    // 4. FÖRTYDLIGANDE-LÄGE (Interrogation Mode)
    if (interpretation.missingCriticalInfo && interpretation.clarificationsNeeded?.length > 0) {
      console.log("🛑 Missing critical info -> Interrogation Mode");
      
      // Kolla om det verkligen är kritiskt enligt jobRegistry
      const jobDef = findJobDefinition(interpretation.jobType);
      const isActuallyCritical = jobDef?.requiredInput?.some(field => !interpretation[field as keyof typeof interpretation]);
      
      if (isActuallyCritical || interpretation.missingCriticalInfo) {
         return new Response(JSON.stringify({
          type: 'clarification_request',
          message: interpretation.clarificationsNeeded[0],
          questions: interpretation.clarificationsNeeded,
          interpretation: interpretation,
          projectType: interpretation.jobType
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 5. KÖR OFFERT-PIPELINE
    console.log("⚙️ Running calculation pipeline...");
    
    const pipelineInput = {
      description: description,
      conversationHistory: data.conversationHistory || [],
      ...interpretation
    };
    
    const pipelineResult = await runQuotePipeline(pipelineInput, {
      userId: userId,
      sessionId: sessionId,
      supabase: null, 
      ...data.userSettings
    });

    // 6. SKAPA SVAR
    const responseData = {
      type: 'complete_quote',
      quote: {
        ...pipelineResult.quote,
        totalPrice: pipelineResult.summary.totalWithVAT,
        priceAfterRot: pipelineResult.summary.customerPays,
        appliedRotRut: pipelineResult.summary.rotRutDeduction > 0 ? pipelineResult.quote.deductionType : 'none',
        deductionAmount: pipelineResult.summary.rotRutDeduction
      },
      interpretation: interpretation,
      message: `Här är en offert för ${interpretation.jobType}. \n\n` +
               `Totalt pris: ${Math.round(pipelineResult.summary.customerPays).toLocaleString()} kr efter avdrag.`
    };

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ CRITICAL ERROR IN EDGE FUNCTION:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown internal error',
      details: 'Check function logs for stack trace'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
