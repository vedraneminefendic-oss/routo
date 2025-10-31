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

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Ingen autentisering" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Ogiltig autentisering" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[GDPR EXPORT] User ${user.id} requested data export`);

    // Gather all user data across tables
    const userData: any = {
      export_info: {
        exported_at: new Date().toISOString(),
        user_id: user.id,
        email: user.email,
        format_version: "1.0"
      },
      account: {
        email: user.email,
        created_at: user.created_at,
        last_sign_in: user.last_sign_in_at
      }
    };

    // Company settings
    const { data: companySettings } = await supabase
      .from("company_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();
    
    if (companySettings) {
      userData.company_settings = companySettings;
    }

    // Customers (with decrypted personnummer)
    const { data: customers } = await supabase
      .from("customers")
      .select("*")
      .eq("user_id", user.id);
    
    if (customers && customers.length > 0) {
      // Decrypt personnummer for export
      userData.customers = customers.map(customer => ({
        ...customer,
        personnummer: customer.personnummer ? '[ENCRYPTED]' : null,
        note: 'Personnummer encrypted for security'
      }));
    }

    // Quotes
    const { data: quotes } = await supabase
      .from("quotes")
      .select("*")
      .eq("user_id", user.id);
    
    if (quotes && quotes.length > 0) {
      userData.quotes = quotes;
    }

    // Quote recipients
    const { data: recipients } = await supabase
      .from("quote_recipients")
      .select("*")
      .in("quote_id", quotes?.map(q => q.id) || []);
    
    if (recipients && recipients.length > 0) {
      userData.quote_recipients = recipients.map(r => ({
        ...r,
        customer_personnummer: r.customer_personnummer ? '[ENCRYPTED]' : null
      }));
    }

    // Hourly rates
    const { data: hourlyRates } = await supabase
      .from("hourly_rates")
      .select("*")
      .eq("user_id", user.id);
    
    if (hourlyRates && hourlyRates.length > 0) {
      userData.hourly_rates = hourlyRates;
    }

    // Equipment rates
    const { data: equipmentRates } = await supabase
      .from("equipment_rates")
      .select("*")
      .eq("user_id", user.id);
    
    if (equipmentRates && equipmentRates.length > 0) {
      userData.equipment_rates = equipmentRates;
    }

    // Quote templates
    const { data: templates } = await supabase
      .from("quote_templates")
      .select("*")
      .eq("user_id", user.id);
    
    if (templates && templates.length > 0) {
      userData.quote_templates = templates;
    }

    // Conversation sessions
    const { data: sessions } = await supabase
      .from("conversation_sessions")
      .select("*")
      .eq("user_id", user.id);
    
    if (sessions && sessions.length > 0) {
      userData.conversation_sessions = sessions;

      // Conversation messages
      const { data: messages } = await supabase
        .from("conversation_messages")
        .select("*")
        .in("session_id", sessions.map(s => s.id));
      
      if (messages && messages.length > 0) {
        userData.conversation_messages = messages;
      }
    }

    // User patterns
    const { data: patterns } = await supabase
      .from("user_quote_patterns")
      .select("*")
      .eq("user_id", user.id);
    
    if (patterns && patterns.length > 0) {
      userData.user_patterns = patterns;
    }

    // Add metadata
    userData.metadata = {
      total_quotes: quotes?.length || 0,
      total_customers: customers?.length || 0,
      total_templates: templates?.length || 0,
      total_conversations: sessions?.length || 0,
      export_size_kb: Math.round(JSON.stringify(userData).length / 1024)
    };

    // Log export in audit trail
    await supabase.from("personnummer_access_log").insert({
      user_id: user.id,
      table_name: "all_tables",
      record_id: user.id,
      action: "gdpr_export",
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    });

    console.log(`[GDPR EXPORT] Successfully exported ${userData.metadata.export_size_kb}KB for user ${user.id}`);

    // Return as downloadable JSON
    return new Response(
      JSON.stringify(userData, null, 2),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="routo-data-export-${new Date().toISOString().split('T')[0]}.json"`
        },
      }
    );

  } catch (error: any) {
    console.error(`[GDPR EXPORT] Error:`, error);
    return new Response(
      JSON.stringify({ error: "Ett fel uppstod vid dataexporten" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
