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
import { Clock, User, FileText, Send, Eye, CheckCircle, XCircle, Check } from "lucide-react";

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

const STATUS_ICONS: Record<string, any> = {
  draft: FileText,
  sent: Send,
  viewed: Eye,
  accepted: CheckCircle,
  rejected: XCircle,
  completed: Check,
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted",
  sent: "bg-blue-500/10 border-blue-500/20",
  viewed: "bg-sky-400/10 border-sky-400/20",
  accepted: "bg-green-500/10 border-green-500/20",
  rejected: "bg-red-500/10 border-red-500/20",
  completed: "bg-emerald-700/10 border-emerald-700/20",
};

const STATUS_ICON_COLORS: Record<string, string> = {
  draft: "text-muted-foreground",
  sent: "text-blue-500",
  viewed: "text-sky-400",
  accepted: "text-green-500",
  rejected: "text-red-500",
  completed: "text-emerald-700",
};

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
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />
          
          <div className="space-y-6">
            {history.map((item, index) => {
              const StatusIcon = STATUS_ICONS[item.new_status] || Clock;
              const iconColor = STATUS_ICON_COLORS[item.new_status] || "text-muted-foreground";
              const bgColor = STATUS_COLORS[item.new_status] || "bg-muted";
              
              return (
                <div key={item.id} className="relative flex gap-4 group">
                  {/* Icon circle */}
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 ${bgColor} transition-all duration-200 group-hover:scale-110`}>
                    <StatusIcon className={`h-5 w-5 ${iconColor}`} />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 pb-2">
                    <div className={`rounded-lg border p-4 ${bgColor} transition-all duration-200 hover:shadow-sm`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">
                            {item.old_status ? (
                              <>
                                <span className="capitalize">{item.old_status}</span>
                                {" → "}
                                <span className="capitalize">{item.new_status}</span>
                              </>
                            ) : (
                              <>Skapad som <span className="capitalize">{item.new_status}</span></>
                            )}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(item.changed_at), "d MMM yyyy 'kl.' HH:mm", {
                                locale: sv,
                              })}
                            </p>
                          </div>
                          {item.note && (
                            <div className="mt-3 rounded-md bg-background/50 p-2 border">
                              <p className="text-sm text-muted-foreground italic">
                                "{item.note}"
                              </p>
                            </div>
                          )}
                        </div>
                        {item.changed_by && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground bg-background/50 rounded-full px-2 py-1">
                            <User className="h-3 w-3" />
                            <span>Användare</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
