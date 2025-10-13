import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PendingQuote {
  id: string;
  title: string;
  status: string;
  sent_at: string | null;
  viewed_at: string | null;
  generated_quote: any;
  edited_quote: any | null;
  user_id: string;
}

interface UserQuotes {
  user_id: string;
  company_name: string;
  email: string;
  quotes: PendingQuote[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      console.error('RESEND_API_KEY is not set');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Beräkna tidsgräns (3 dagar sedan)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoISO = threeDaysAgo.toISOString();

    console.log(`Checking for quotes older than: ${threeDaysAgoISO}`);

    // Hämta offerter som behöver uppföljning
    const { data: pendingQuotes, error: quotesError } = await supabase
      .from('quotes')
      .select('id, title, status, sent_at, viewed_at, generated_quote, edited_quote, user_id')
      .in('status', ['sent', 'viewed'])
      .or(`sent_at.lt.${threeDaysAgoISO},viewed_at.lt.${threeDaysAgoISO}`);

    if (quotesError) {
      console.error('Error fetching quotes:', quotesError);
      throw quotesError;
    }

    if (!pendingQuotes || pendingQuotes.length === 0) {
      console.log('No pending quotes found');
      return new Response(
        JSON.stringify({ message: 'No pending quotes found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${pendingQuotes.length} pending quotes`);

    // Gruppera per användare
    const quotesByUser = new Map<string, PendingQuote[]>();
    for (const quote of pendingQuotes) {
      if (!quotesByUser.has(quote.user_id)) {
        quotesByUser.set(quote.user_id, []);
      }
      quotesByUser.get(quote.user_id)!.push(quote);
    }

    // Hämta användaruppgifter och skicka e-post
    const results = [];
    for (const [userId, quotes] of quotesByUser.entries()) {
      // Kontrollera om vi redan skickat påminnelse för dessa offerter inom 24h
      const { data: recentReminders } = await supabase
        .from('quote_reminders')
        .select('quote_id')
        .eq('user_id', userId)
        .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const recentReminderQuoteIds = new Set(recentReminders?.map(r => r.quote_id) || []);
      const quotesToRemind = quotes.filter(q => !recentReminderQuoteIds.has(q.id));

      if (quotesToRemind.length === 0) {
        console.log(`Skipping user ${userId}, recent reminders already sent`);
        continue;
      }

      // Hämta företagsinformation
      const { data: companySettings } = await supabase
        .from('company_settings')
        .select('company_name, email')
        .eq('user_id', userId)
        .single();

      if (!companySettings?.email) {
        console.log(`No email configured for user ${userId}`);
        continue;
      }

      // Bygg e-post innehåll
      const quoteList = quotesToRemind.map((quote, index) => {
        const quoteData = quote.edited_quote || quote.generated_quote;
        const amount = quoteData?.summary?.customerPays || 0;
        const daysAgo = quote.sent_at 
          ? Math.floor((Date.now() - new Date(quote.sent_at).getTime()) / (1000 * 60 * 60 * 24))
          : Math.floor((Date.now() - new Date(quote.viewed_at!).getTime()) / (1000 * 60 * 60 * 24));
        
        const statusText = quote.status === 'sent' ? 'Skickad' : 'Visad';
        
        return `${index + 1}. ${quote.title} - ${amount.toLocaleString('sv-SE')} kr (${statusText} för ${daysAgo} dagar sedan)`;
      }).join('\n');

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Hej ${companySettings.company_name || 'där'},</h2>
          
          <p style="color: #666; font-size: 16px;">
            Du har <strong>${quotesToRemind.length}</strong> ${quotesToRemind.length === 1 ? 'offert' : 'offerter'} 
            som väntar på svar i över 3 dagar:
          </p>
          
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <pre style="font-family: Arial, sans-serif; white-space: pre-wrap; margin: 0; color: #333;">${quoteList}</pre>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            🔗 <a href="${supabaseUrl.replace('.supabase.co', '.lovable.app')}" style="color: #0066cc; text-decoration: none;">
              Logga in för att följa upp
            </a>
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          
          <p style="color: #999; font-size: 12px;">
            Vänliga hälsningar,<br/>
            Offertverktyget
          </p>
        </div>
      `;

      try {
        // Skicka e-post
        const { error: emailError } = await resend.emails.send({
          from: 'Offertverktyget <onboarding@resend.dev>',
          to: [companySettings.email],
          subject: `${quotesToRemind.length} ${quotesToRemind.length === 1 ? 'offert behöver' : 'offerter behöver'} uppföljning`,
          html: emailHtml,
        });

        if (emailError) {
          console.error(`Error sending email to ${companySettings.email}:`, emailError);
          results.push({ userId, success: false, error: emailError.message });
          continue;
        }

        // Logga påminnelser
        const reminderInserts = quotesToRemind.map(quote => ({
          quote_id: quote.id,
          user_id: userId,
          reminder_type: 'pending_3_days',
          email_sent: true,
        }));

        const { error: reminderError } = await supabase
          .from('quote_reminders')
          .insert(reminderInserts);

        if (reminderError) {
          console.error('Error logging reminders:', reminderError);
        }

        console.log(`Email sent to ${companySettings.email} for ${quotesToRemind.length} quotes`);
        results.push({ userId, success: true, quotesCount: quotesToRemind.length });
      } catch (error: any) {
        console.error(`Error processing user ${userId}:`, error);
        results.push({ userId, success: false, error: error.message });
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Reminder check completed',
        results,
        totalPendingQuotes: pendingQuotes.length,
        usersNotified: results.filter(r => r.success).length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in check-pending-quotes function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
