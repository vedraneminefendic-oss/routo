import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type QuoteStatus = "draft" | "sent" | "viewed" | "accepted" | "rejected" | "completed";

interface StatusTransition {
  from: QuoteStatus;
  to: QuoteStatus[];
}

const ALLOWED_TRANSITIONS: StatusTransition[] = [
  { from: "draft", to: ["accepted", "rejected"] }, // "sent" sätts automatiskt vid e-post
  { from: "sent", to: ["viewed", "accepted", "rejected", "draft"] },
  { from: "viewed", to: ["accepted", "rejected", "sent"] },
  { from: "accepted", to: ["completed", "rejected"] }, // Kan ångras
  { from: "rejected", to: ["accepted", "sent"] }, // Kan ändras
  { from: "completed", to: [] }, // Slutgiltig status
];

export const useQuoteStatus = () => {
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const { toast } = useToast();

  const getAllowedTransitions = (currentStatus: QuoteStatus): QuoteStatus[] => {
    const transition = ALLOWED_TRANSITIONS.find((t) => t.from === currentStatus);
    return transition?.to || [];
  };

  const isTransitionAllowed = (from: QuoteStatus, to: QuoteStatus): boolean => {
    const allowedTransitions = getAllowedTransitions(from);
    return allowedTransitions.includes(to);
  };

  const changeStatus = async (
    quoteId: string,
    currentStatus: QuoteStatus,
    newStatus: QuoteStatus,
    note?: string
  ) => {
    if (!isTransitionAllowed(currentStatus, newStatus)) {
      toast({
        title: "Ogiltig statusändring",
        description: `Kan inte ändra status från "${currentStatus}" till "${newStatus}"`,
        variant: "destructive",
      });
      return false;
    }

    setIsChangingStatus(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Update quote status
      const updates: any = { status: newStatus };
      
      // Set appropriate timestamp based on new status
      if (newStatus === "sent") updates.sent_at = new Date().toISOString();
      if (newStatus === "viewed") updates.viewed_at = new Date().toISOString();
      if (newStatus === "accepted" || newStatus === "rejected") updates.responded_at = new Date().toISOString();
      if (newStatus === "completed") updates.completed_at = new Date().toISOString();

      const { error: updateError } = await supabase
        .from("quotes")
        .update(updates)
        .eq("id", quoteId);

      if (updateError) throw updateError;

      // Log status change in history
      const { error: historyError } = await supabase
        .from("quote_status_history")
        .insert({
          quote_id: quoteId,
          old_status: currentStatus,
          new_status: newStatus,
          changed_by: user?.id,
          note,
        });

      if (historyError) throw historyError;

      toast({
        title: "Status uppdaterad",
        description: `Offertens status ändrades till "${newStatus}"`,
      });

      return true;
    } catch (error) {
      console.error("Error changing status:", error);
      toast({
        title: "Fel",
        description: "Kunde inte uppdatera status",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsChangingStatus(false);
    }
  };

  return {
    changeStatus,
    getAllowedTransitions,
    isTransitionAllowed,
    isChangingStatus,
  };
};
