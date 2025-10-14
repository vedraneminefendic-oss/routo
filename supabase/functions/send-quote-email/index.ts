import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

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
    // Input validation schema
    const requestSchema = z.object({
      quoteId: z.string().uuid("Invalid quote ID format"),
      recipientEmail: z.string().trim().email("Invalid email format").max(255, "Email too long"),
      recipientName: z.string().trim().min(1, "Name required").max(100, "Name too long")
    });

    // Parse and validate request body
    const body = await req.json();
    const validatedData = requestSchema.parse(body);

    const { quoteId, recipientEmail, recipientName } = validatedData;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization")!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get quote details with customer and recipients information
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select(`
        *,
        customers (
          name,
          email,
          phone,
          address,
          personnummer,
          property_designation
        )
      `)
      .eq("id", quoteId)
      .single();

    // Get recipients for multi-recipient ROT/RUT scenarios
    const { data: quoteRecipients } = await supabase
      .from("quote_recipients")
      .select("*")
      .eq("quote_id", quoteId);

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
    
    // Use customer information if available, otherwise use provided recipient info
    const customer = quote.customers;
    const finalRecipientName = customer?.name || recipientName;
    const finalRecipientEmail = customer?.email || recipientEmail;
    
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
        Hej ${finalRecipientName},
      </p>
      
      <p style="color: #333; font-size: 16px; line-height: 26px; padding: 0 48px;">
        Vi har skapat en offert åt dig: <strong>${quote.title}</strong>
      </p>
      
      ${customer ? `
      <div style="background-color: #f6f9fc; border-left: 4px solid #0066ff; padding: 16px; margin: 0 48px 16px;">
        <p style="color: #333; font-size: 14px; line-height: 20px; margin: 0 0 8px;">
          <strong>Kunduppgifter:</strong>
        </p>
        ${customer.address ? `<p style="color: #666; font-size: 14px; line-height: 20px; margin: 0;">Adress: ${customer.address}</p>` : ''}
        ${customer.phone ? `<p style="color: #666; font-size: 14px; line-height: 20px; margin: 0;">Telefon: ${customer.phone}</p>` : ''}
        ${customer.property_designation ? `<p style="color: #666; font-size: 14px; line-height: 20px; margin: 0;">Fastighetsbeteckning: ${customer.property_designation}</p>` : ''}
      </div>
      ` : ''}
      
      ${quoteRecipients && quoteRecipients.length > 1 ? `
      <div style="background-color: #fff7ed; border-left: 4px solid #f59e0b; padding: 16px; margin: 0 48px 16px;">
        <p style="color: #333; font-size: 14px; line-height: 20px; margin: 0 0 8px;">
          <strong>Mottagare för ${quoteData.deductionType?.toUpperCase() || 'ROT'}-avdrag:</strong>
        </p>
        ${quoteRecipients.map(r => `
          <p style="color: #666; font-size: 13px; line-height: 18px; margin: 4px 0;">
            • ${r.customer_name} (${r.customer_personnummer}) - ${Math.round((r.ownership_share || 0) * 100)}%
          </p>
        `).join('')}
        <p style="color: #888; font-size: 12px; line-height: 16px; margin: 8px 0 0; font-style: italic;">
          Skatteverket fördelar avdraget automatiskt baserat på ägarandel.
        </p>
      </div>
      ` : ''}
      
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
      to: [finalRecipientEmail],
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
      recipient_email: finalRecipientEmail,
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
        note: `Email sent to ${finalRecipientEmail}${customer ? ` (${customer.name})` : ''}`,
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
