import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// AI JSON helpers
function stripMarkdownCodeFences(text: string): string {
  if (!text) return text;
  return text
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/, '')
    .trim();
}
function parseAIJSON(text: string): any {
  const t = (text || '').trim();
  if (!t) return {};
  try { return JSON.parse(stripMarkdownCodeFences(t)); } catch {}
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { try { return JSON.parse(fence[1].trim()); } catch {} }
  const i = t.indexOf('{'), j = t.lastIndexOf('}');
  if (i !== -1 && j > i) { const sub = t.slice(i, j + 1); try { return JSON.parse(sub); } catch {} }
  console.error('❌ parseAIJSON failed (suggest-templates). Raw:', t.slice(0, 500));
  throw new Error('Invalid AI JSON');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description, userId } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Fetch user's templates
    const { data: templates, error: templatesError } = await supabaseClient
      .from("quote_templates")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (templatesError) throw templatesError;

    if (!templates || templates.length === 0) {
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Lovable AI to match description with templates
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const templateList = templates
      .map((t) => `- ${t.name}: ${t.description}`)
      .join("\n");

    const prompt = `Du är en smart assistent som matchar kundförfrågningar med offermallar.

Användarens beskrivning: "${description}"

Tillgängliga mallar:
${templateList}

Returnera de 1-3 mest relevanta mallarna i JSON-format:
{
  "suggestions": [
    {
      "templateId": "uuid",
      "relevanceScore": 0.95,
      "reason": "Matchar perfekt för badrumsrenovering"
    }
  ]
}

Om ingen mall är relevant (under 0.6), returnera tom array.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const result = parseAIJSON(aiData.choices[0].message.content);
    
    // Enrich with template data
    const enrichedSuggestions = result.suggestions.map((s: any) => {
      const template = templates.find((t) => t.id === s.templateId);
      return template ? { ...s, template } : null;
    }).filter(Boolean);

    return new Response(
      JSON.stringify({ suggestions: enrichedSuggestions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in suggest-templates:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});