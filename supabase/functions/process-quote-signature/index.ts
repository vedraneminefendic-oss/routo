import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Input validation schema matching client-side validation
    const signatureSchema = z.object({
      quoteId: z.string().uuid("Invalid quote ID format"),
      response: z.enum(['accepted', 'rejected'], { errorMap: () => ({ message: "Response must be 'accepted' or 'rejected'" }) }),
      signerName: z.string().trim().min(1, "Name required").max(100, "Name too long").optional(),
      signerEmail: z.string().trim().email("Invalid email").max(255, "Email too long").optional(),
      signerPersonnummer: z.string().regex(/^\d{6,8}-?\d{4}$/, "Invalid personnummer format").optional().or(z.literal('')),
      propertyDesignation: z.string().max(100, "Property designation too long").optional().or(z.literal('')),
      message: z.string().max(1000, "Message too long").optional().or(z.literal(''))
    });

    // Parse and validate request body
    const body = await req.json();
    const validatedData = signatureSchema.parse(body);

    const { quoteId, response } = validatedData;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the quote
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("user_id, status")
      .eq("id", quoteId)
      .single();

    if (quoteError || !quote) {
      console.error("Error fetching quote:", quoteError);
      return new Response(
        JSON.stringify({ error: "Offerten kunde inte hittas" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent changes to already processed quotes (rate limiting)
    if (quote.status === "accepted" || quote.status === "rejected") {
      return new Response(
        JSON.stringify({ error: "Offerten har redan besvarats" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        JSON.stringify({ error: "Ett fel uppstod vid uppdatering. Kontakta support om problemet kvarstår." }),
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
      JSON.stringify({ error: "Ett fel uppstod. Kontakta support om problemet kvarstår." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
