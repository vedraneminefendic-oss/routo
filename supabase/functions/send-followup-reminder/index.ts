import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { quoteId, reminderType = '3_days' } = await req.json();

    if (!quoteId) {
      return new Response(
        JSON.stringify({ error: 'quoteId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Hämta offert-detaljer
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select(`
        *,
        customers (
          name,
          email,
          phone
        ),
        company_settings:user_id (
          company_name,
          email
        )
      `)
      .eq('id', quoteId)
      .single();

    if (quoteError || !quote) {
      return new Response(
        JSON.stringify({ error: 'Quote not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const quoteData = quote.edited_quote || quote.generated_quote;
    const customerEmail = quote.customers?.email;
    const customerName = quote.customers?.name || 'kund';
    const companyName = quote.company_settings?.company_name || 'Företaget';
    const companyEmail = quote.company_settings?.email;
    const amount = quoteData?.summary?.customerPays || 0;

    if (!customerEmail) {
      return new Response(
        JSON.stringify({ error: 'No customer email found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Beräkna dagar sedan offerten skickades
    const sentDate = quote.sent_at ? new Date(quote.sent_at) : new Date(quote.viewed_at);
    const daysSince = Math.floor((Date.now() - sentDate.getTime()) / (1000 * 60 * 60 * 24));

    // Generera personligt meddelande med Lovable AI
    let followupMessage = '';
    
    if (lovableApiKey) {
      try {
        const prompt = `Skapa ett kort, vänligt och professionellt uppföljningsmail för en offert.

Kontext:
- Offert skickades för ${daysSince} dagar sedan
- Projekt: ${quote.title}
- Kund: ${customerName}
- Värde: ${amount.toLocaleString('sv-SE')} kr
- Företag: ${companyName}

Stil: Personlig, inte pushy, erbjud hjälp och öppenhet för frågor
Längd: 2-3 korta meningar
Ton: Varm men professionell
CTA: Be om feedback eller om det finns några frågor

Skriv endast meddelandetexten, ingen rubrik eller hälsning.`;

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'Du är en hjälpsam assistent som skriver professionella men personliga uppföljningsmejl.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          followupMessage = aiData.choices?.[0]?.message?.content || '';
        }
      } catch (error) {
        console.error('AI generation failed, using fallback:', error);
      }
    }

    // Fallback-meddelande om AI misslyckades
    if (!followupMessage) {
      followupMessage = `Vi hoppas att du har haft tid att gå igenom vår offert för ${quote.title}. Om du har några frågor eller funderingar är du varmt välkommen att höra av dig till oss. Vi hjälper gärna till!`;
    }

    // Bygg e-post
    const quoteUrl = `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/quote/${quote.unique_token}`;
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #D4925F; margin-bottom: 20px;">Hej ${customerName}!</h2>
        
        <p style="color: #1A3A52; font-size: 16px; line-height: 1.6;">
          ${followupMessage}
        </p>
        
        <div style="background: linear-gradient(135deg, #F5EFE7 0%, #E8DED0 100%); padding: 20px; border-radius: 12px; margin: 30px 0;">
          <h3 style="color: #1A3A52; margin-top: 0;">Offert: ${quote.title}</h3>
          <p style="color: #7A9B7E; font-size: 24px; font-weight: bold; margin: 10px 0;">
            ${amount.toLocaleString('sv-SE')} kr
          </p>
          <a href="${quoteUrl}" 
             style="display: inline-block; background: linear-gradient(135deg, #D4925F, #C07D44); 
                    color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; 
                    font-weight: 600; margin-top: 15px;">
            Se offerten
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Vänliga hälsningar,<br/>
          <strong>${companyName}</strong>
        </p>
        
        <hr style="border: none; border-top: 1px solid #E8DED0; margin: 30px 0;" />
        
        <p style="color: #999; font-size: 12px; text-align: center;">
          Detta är en automatisk påminnelse från Routo
        </p>
      </div>
    `;

    // Skicka e-post
    const { error: emailError } = await resend.emails.send({
      from: `${companyName} <onboarding@resend.dev>`,
      to: [customerEmail],
      subject: `Uppföljning: ${quote.title}`,
      html: emailHtml,
      replyTo: companyEmail || undefined,
    });

    if (emailError) {
      throw emailError;
    }

    // Uppdatera offert med ny followup-tid och räknare
    const nextFollowup = new Date();
    nextFollowup.setDate(nextFollowup.getDate() + 7); // Nästa påminnelse om 7 dagar

    await supabase
      .from('quotes')
      .update({
        next_followup_at: nextFollowup.toISOString(),
        followup_count: (quote.followup_count || 0) + 1,
      })
      .eq('id', quoteId);

    // Logga påminnelsen
    await supabase
      .from('quote_reminders')
      .insert({
        quote_id: quoteId,
        user_id: quote.user_id,
        reminder_type: reminderType,
        email_sent: true,
      });

    console.log(`Followup reminder sent for quote ${quoteId} to ${customerEmail}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Followup reminder sent' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error sending followup reminder:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});