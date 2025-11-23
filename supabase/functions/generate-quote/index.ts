import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { interpretUserInput } from "./core/interpretUserInput.ts";
import { runQuotePipeline } from "./core/pipelineOrchestrator.ts";
import { corsHeaders } from "./utils/cors.ts";
import { findJobDefinition } from "./data/jobRegistry.ts";

console.log("🚀 Function 'generate-quote' starting (PHASE 6B: ROBUST INPUT HANDLING)");

// Robust schema som tillåter optional fält
const RequestSchema = z.object({
  message: z.string().optional(),
  description: z.string().optional(),
  sessionId: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
  previousContext: z.any().optional(),
  conversationHistory: z.array(z.any()).optional().default([]),
  userSettings: z.any().optional().default({})
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Parse och Validera Input säkert
    const rawBody = await req.json();
    const parseResult = RequestSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.error("❌ Validation warning:", parseResult.error);
      // Fortsätt ändå med "bästa försök" istället för att krascha
    }
    
    const data = parseResult.success ? parseResult.data : rawBody;
    
    // Normalisera input: Använd message om description saknas
    const inputDescription = data.description || data.message || "";
    const sessionId = data.sessionId || crypto.randomUUID(); // Skapa ID om det saknas
    const apiKey = Deno.env.get('LOVABLE_AI_API_KEY') || "";

    if (!inputDescription.trim()) {
      return new Response(JSON.stringify({
        error: "Message or description is required"
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. AI INTERPRETATION LAYER
    console.log("🤖 AI interpreting intent for:", inputDescription.substring(0, 50) + "...");
    
    const interpretation = await interpretUserInput(
      inputDescription, 
      data.conversationHistory || [], 
      apiKey
    );
    
    console.log("✅ Interpretation result:", JSON.stringify(interpretation, null, 2));

    // 3. HANDOFF LOGIC
    if (interpretation.missingCriticalInfo && interpretation.clarificationsNeeded && interpretation.clarificationsNeeded.length > 0) {
      console.log("🛑 Missing critical info, entering interrogation mode");
      
      const jobDef = findJobDefinition(interpretation.jobType);
      // Dubbelkolla om det verkligen är kritiskt
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

    // 4. PIPELINE ORCHESTRATION LAYER
    console.log("⚙️ Running pipeline...");
    
    const pipelineInput = {
      description: inputDescription,
      conversationHistory: data.conversationHistory || [],
      ...interpretation
    };
    
    const pipelineResult = await runQuotePipeline(pipelineInput, {
      userId: data.userId || 'anonymous',
      sessionId: sessionId,
      supabase: null,
      ...data.userSettings
    });

    // 5. RESPONSE FORMATTING
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
      debug: {
        source: "Phase 6B Pipeline",
        calculations: pipelineResult.traceLog
      },
      message: `Här är en offert för ${interpretation.jobType}. \n\n` +
               `Totalt pris: ${Math.round(pipelineResult.summary.customerPays).toLocaleString()} kr efter avdrag.`
    };

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in generate-quote:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
