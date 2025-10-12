import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar, Send, Eye, CheckCircle, XCircle, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { sv } from "date-fns/locale";
import { QuoteStatus } from "@/hooks/useQuoteStatus";

interface Quote {
  id: string;
  title: string;
  status: string;
  created_at: string;
  generated_quote: any;
}

interface QuoteListProps {
  quotes: Quote[];
  onQuoteClick?: (quote: Quote) => void;
}

const STATUS_CONFIG = {
  draft: {
    label: "Utkast",
    icon: FileText,
    color: "bg-accent text-white",
  },
  sent: {
    label: "Skickad",
    icon: Send,
    color: "bg-primary text-white",
  },
  viewed: {
    label: "Visad",
    icon: Eye,
    color: "bg-secondary/70 text-white",
  },
  accepted: {
    label: "Accepterad",
    icon: CheckCircle,
    color: "bg-secondary text-white",
  },
  rejected: {
    label: "Avvisad",
    icon: XCircle,
    color: "bg-destructive text-white",
  },
  completed: {
    label: "Slutförd",
    icon: Check,
    color: "bg-secondary/90 text-white",
  },
};

const QuoteList = ({ quotes, onQuoteClick }: QuoteListProps) => {
  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status as QuoteStatus] || {
      label: status,
      icon: FileText,
      color: "bg-muted",
    };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (quotes.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Inga offerter ännu. Skapa din första offert ovan!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {quotes.map((quote) => {
        const statusConfig = getStatusConfig(quote.status);
        const StatusIcon = statusConfig.icon;
        
        return (
          <Card 
            key={quote.id} 
            className="cursor-pointer hover:bg-muted/30 transition-colors border-border"
            onClick={() => onQuoteClick?.(quote)}
          >
            <CardContent className="p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    <h3 className="font-semibold text-sm text-foreground">{quote.title}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDistanceToNow(new Date(quote.created_at), { 
                        addSuffix: true, 
                        locale: sv 
                      })}
                    </span>
                    {quote.generated_quote?.summary && (
                      <span className="font-medium text-primary">
                        {formatCurrency(quote.generated_quote.summary.customerPays)}
                      </span>
                    )}
                  </div>
                </div>
                <Badge className={`${statusConfig.color} text-white flex items-center gap-1 text-xs px-2 py-0.5`}>
                  <StatusIcon className="h-3 w-3" />
                  {statusConfig.label}
                </Badge>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default QuoteList;