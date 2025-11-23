import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { interpretUserInput } from "./core/interpretUserInput.ts";
import { runQuotePipeline } from "./core/pipelineOrchestrator.ts";
import { corsHeaders } from "./utils/cors.ts";
import { findJobDefinition } from "./data/jobRegistry.ts";

console.log("🚀 Function 'generate-quote' starting (PHASE 6C: MAXIMUM TOLERANCE)");

// Relaxed schema to prevent 500 errors
const RequestSchema = z.object({
  message: z.string().optional(),
  description: z.any().optional(), // Allow any type, handle in code
  sessionId: z.any().optional(),   // Allow any type
  userId: z.any().optional(),
  previousContext: z.any().optional(),
  conversationHistory: z.array(z.any()).optional().default([]),
  userSettings: z.any().optional().default({})
});

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    
    // Safe parsing
    const parseResult = RequestSchema.safeParse(rawBody);
    const data = parseResult.success ? parseResult.data : rawBody;
    
    // 1. NORMALISERA INPUT (Garantera att vi har strängar)
    const message = typeof data.message === 'string' ? data.message : "";
    // Om description saknas eller är konstigt, använd message
    const description = (typeof data.description === 'string' && data.description.length > 0) 
      ? data.description 
      : message;

    // Garantera ett sessionId
    let sessionId = "";
    if (typeof data.sessionId === 'string') sessionId = data.sessionId;
    else sessionId = crypto.randomUUID();

    const userId = typeof data.userId === 'string' ? data.userId : 'anonymous';
    const apiKey = Deno.env.get('LOVABLE_AI_API_KEY') || "";

    // 2. VALIDERA ATT VI HAR NÅGOT ATT JOBBA MED
    if (!description.trim()) {
      console.log("⚠️ Empty input received");
      return new Response(JSON.stringify({
        error: "Message or description is required"
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`🤖 Processing request for session: ${sessionId}`);
    console.log(`📝 Description: ${description.substring(0, 50)}...`);

    // 3. AI INTERPRETATION
    const interpretation = await interpretUserInput(
      description, 
      data.conversationHistory || [], 
      apiKey
    );
    
    // 4. HANDOFF / INTERROGATION MODE
    if (interpretation.missingCriticalInfo && interpretation.clarificationsNeeded?.length > 0) {
      console.log("🛑 Missing critical info -> Interrogation Mode");
      
      // Dubbelkolla mot registry om det verkligen är kritiskt
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

    // 5. PIPELINE ORCHESTRATION
    console.log("⚙️ Running calculation pipeline...");
    
    const pipelineInput = {
      description: description,
      conversationHistory: data.conversationHistory || [],
      ...interpretation
    };
    
    const pipelineResult = await runQuotePipeline(pipelineInput, {
      userId: userId,
      sessionId: sessionId,
      supabase: null, // No direct DB access needed in edge function context for now
      ...data.userSettings
    });

    // 6. RESPONSE
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
    console.error('❌ CRITICAL ERROR:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown internal error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
