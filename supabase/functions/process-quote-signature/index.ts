import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { quoteId, response } = await req.json();

    if (!quoteId || !response) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the quote
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("user_id, status")
      .eq("id", quoteId)
      .single();

    if (quoteError || !quote) {
      console.error("Error fetching quote:", quoteError);
      return new Response(
        JSON.stringify({ error: "Quote not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newStatus = response === "accepted" ? "accepted" : "rejected";
    const oldStatus = quote.status;

    // Update quote status
    const { error: updateError } = await supabase
      .from("quotes")
      .update({
        status: newStatus,
        responded_at: new Date().toISOString(),
      })
      .eq("id", quoteId);

    if (updateError) {
      console.error("Error updating quote:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update quote" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log status change
    await supabase.from("quote_status_history").insert({
      quote_id: quoteId,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by: null, // Customer signature, no user_id
      note: `Customer ${response} the quote`,
    });

    console.log(`Quote ${quoteId} status updated to ${newStatus}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Quote ${response} successfully`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in process-quote-signature function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
