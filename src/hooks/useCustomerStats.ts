import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CustomerStats {
  totalQuotes: number;
  acceptedQuotes: number;
  totalValue: number;
  acceptanceRate: number;
  lastQuoteDate: string | null;
}

export const useCustomerStats = (customerId: string) => {
  const [stats, setStats] = useState<CustomerStats>({
    totalQuotes: 0,
    acceptedQuotes: 0,
    totalValue: 0,
    acceptanceRate: 0,
    lastQuoteDate: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [customerId]);

  const loadStats = async () => {
    try {
      const { data: quotes, error } = await supabase
        .from("quotes")
        .select("status, created_at, generated_quote, edited_quote")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (quotes && quotes.length > 0) {
        const totalQuotes = quotes.length;
        const acceptedQuotes = quotes.filter(
          (q) => q.status === "accepted" || q.status === "completed"
        ).length;
        
        const totalValue = quotes.reduce((sum, quote) => {
          const quoteData = quote.edited_quote || quote.generated_quote;
          if (quoteData && typeof quoteData === 'object') {
            const summary = (quoteData as any).summary;
            const value = summary?.customerPays || 0;
            return sum + parseFloat(value.toString());
          }
          return sum;
        }, 0);

        const acceptanceRate = totalQuotes > 0 ? (acceptedQuotes / totalQuotes) * 100 : 0;

        setStats({
          totalQuotes,
          acceptedQuotes,
          totalValue,
          acceptanceRate,
          lastQuoteDate: quotes[0].created_at,
        });
      }
    } catch (error) {
      console.error("Error loading customer stats:", error);
    } finally {
      setLoading(false);
    }
  };

  return { stats, loading };
};
