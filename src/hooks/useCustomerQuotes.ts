import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CustomerQuote {
  id: string;
  title: string;
  status: string;
  created_at: string;
  work_address?: string;
  project_type?: string;
  generated_quote: any;
  edited_quote?: any;
}

export const useCustomerQuotes = (customerId: string | null) => {
  const [quotes, setQuotes] = useState<CustomerQuote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId) {
      setQuotes([]);
      setLoading(false);
      return;
    }

    loadQuotes();
  }, [customerId]);

  const loadQuotes = async () => {
    if (!customerId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("quotes")
        .select("id, title, status, created_at, work_address, project_type, generated_quote, edited_quote")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQuotes(data || []);
    } catch (error) {
      console.error("Error loading customer quotes:", error);
    } finally {
      setLoading(false);
    }
  };

  return { quotes, loading, refetch: loadQuotes };
};
