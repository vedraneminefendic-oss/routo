import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Clock, User } from "lucide-react";

interface StatusHistoryItem {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  changed_at: string;
  note: string | null;
}

interface QuoteStatusTimelineProps {
  quoteId: string;
}

export const QuoteStatusTimeline = ({ quoteId }: QuoteStatusTimelineProps) => {
  const [history, setHistory] = useState<StatusHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [quoteId]);

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("quote_status_history")
        .select("*")
        .eq("quote_id", quoteId)
        .order("changed_at", { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error("Error loading status history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Statushistorik</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Laddar...</p>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Statushistorik</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ingen statushistorik ännu
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Statushistorik</CardTitle>
        <CardDescription>
          Visar alla statusändringar för denna offert
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {history.map((item, index) => (
            <div key={item.id}>
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  {index < history.length - 1 && (
                    <div className="h-full w-px bg-border mt-2" />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        {item.old_status ? (
                          <>
                            Status ändrad från <strong>{item.old_status}</strong>{" "}
                            till <strong>{item.new_status}</strong>
                          </>
                        ) : (
                          <>
                            Status satt till <strong>{item.new_status}</strong>
                          </>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(item.changed_at), "d MMM yyyy 'kl.' HH:mm", {
                          locale: sv,
                        })}
                      </p>
                      {item.note && (
                        <p className="text-sm text-muted-foreground mt-2 italic">
                          "{item.note}"
                        </p>
                      )}
                    </div>
                    {item.changed_by && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>Användare</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {index < history.length - 1 && <Separator className="my-2" />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
