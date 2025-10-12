import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization")!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { quoteId, recipientEmail, recipientName } = await req.json();

    if (!quoteId || !recipientEmail || !recipientName) {
      console.error("Missing required fields:", { quoteId, recipientEmail, recipientName });
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get quote details
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("*, generated_quote, edited_quote, unique_token, title, user_id")
      .eq("id", quoteId)
      .single();

    if (quoteError || !quote) {
      console.error("Error fetching quote:", quoteError);
      return new Response(
        JSON.stringify({ error: "Quote not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get company settings
    const { data: companySettings } = await supabase
      .from("company_settings")
      .select("*")
      .eq("user_id", quote.user_id)
      .single();

    // Generate unique token if not exists
    let uniqueToken = quote.unique_token;
    if (!uniqueToken) {
      uniqueToken = crypto.randomUUID();
      await supabase
        .from("quotes")
        .update({ unique_token: uniqueToken })
        .eq("id", quoteId);
    }

    const quoteData = quote.edited_quote || quote.generated_quote;
    
    // Build the quote URL - use the actual app URL
    const appUrl = Deno.env.get("APP_URL") || supabaseUrl.replace('.supabase.co', '.lovableproject.com');
    const quoteUrl = `${appUrl}/quote/${uniqueToken}`;

    // Create email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif; background-color: #f6f9fc; margin: 0; padding: 0;">
    <div style="background-color: #ffffff; max-width: 600px; margin: 0 auto; padding: 20px 0 48px;">
      <h1 style="color: #333; font-size: 24px; font-weight: bold; margin: 40px 0; padding: 0 48px;">
        Ny offert från ${companySettings?.company_name || "Offerthantering"}
      </h1>
      
      <p style="color: #333; font-size: 16px; line-height: 26px; padding: 0 48px;">
        Hej ${recipientName},
      </p>
      
      <p style="color: #333; font-size: 16px; line-height: 26px; padding: 0 48px;">
        Vi har skapat en offert åt dig: <strong>${quote.title}</strong>
      </p>
      
      <p style="color: #333; font-size: 16px; line-height: 26px; padding: 0 48px;">
        Totalt belopp: <strong>${(quoteData?.summary?.customerPays || 0).toLocaleString("sv-SE")} kr</strong>
      </p>
      
      <div style="padding: 27px 48px;">
        <a href="${quoteUrl}" style="background-color: #0066ff; border-radius: 5px; color: #fff; font-size: 16px; font-weight: bold; text-decoration: none; text-align: center; display: inline-block; padding: 12px 24px;">
          Visa offert
        </a>
      </div>
      
      <p style="color: #333; font-size: 16px; line-height: 26px; padding: 0 48px;">
        När du klickar på länken ovan kan du:
      </p>
      <ul style="color: #333; font-size: 16px; line-height: 26px; padding-left: 72px;">
        <li>Se detaljerad information om offerten</li>
        <li>Acceptera eller avvisa offerten direkt</li>
        <li>Ladda ner offerten som PDF</li>
      </ul>
      
      <p style="color: #333; font-size: 16px; line-height: 26px; padding: 0 48px;">
        Om du har några frågor är du välkommen att kontakta oss på 
        <a href="mailto:${companySettings?.email || ''}" style="color: #0066ff; text-decoration: underline;">
          ${companySettings?.email || ''}
        </a>
      </p>
      
      <p style="color: #333; font-size: 16px; line-height: 26px; padding: 0 48px; margin-top: 32px;">
        Med vänlig hälsning,<br/>
        ${companySettings?.company_name || "Offerthantering"}
      </p>
      
      <p style="color: #8898aa; font-size: 12px; line-height: 18px; padding: 0 48px; margin-top: 16px;">
        Denna länk är unik för dig och kan användas för att svara på offerten.
      </p>
    </div>
  </body>
</html>
    `;

    // Send email via Resend
    // Always use Resend's verified domain for sending
    const fromEmail = "onboarding@resend.dev";
    const replyToEmail = companySettings?.email;
    
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: fromEmail,
      replyTo: replyToEmail,
      to: [recipientEmail],
      subject: `Offert: ${quote.title}`,
      html: emailHtml,
    });

    if (emailError) {
      console.error("Error sending email:", emailError);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: emailError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Email sent successfully:", emailData);

    // Log email in database
    await supabase.from("quote_email_logs").insert({
      quote_id: quoteId,
      recipient_email: recipientEmail,
      email_type: "quote_sent",
      email_provider_id: emailData?.id || null,
    });

    // Update quote status to 'sent' if it was 'draft'
    if (quote.status === "draft") {
      await supabase
        .from("quotes")
        .update({ 
          status: "sent",
          sent_at: new Date().toISOString()
        })
        .eq("id", quoteId);

      // Log status change
      await supabase.from("quote_status_history").insert({
        quote_id: quoteId,
        old_status: "draft",
        new_status: "sent",
        changed_by: quote.user_id,
        note: `Email sent to ${recipientEmail}`,
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email sent successfully",
        quoteUrl 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-quote-email function:", error);
    return new Response(
      JSON.stringify({ error: "Ett fel uppstod vid skickande av e-post. Kontakta support om problemet kvarstår." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
