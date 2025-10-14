import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar, Send, Eye, CheckCircle, XCircle, Check, Hammer, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { sv } from "date-fns/locale";
import { QuoteStatus } from "@/hooks/useQuoteStatus";
import { EmptyState } from "@/components/EmptyState";

interface Quote {
  id: string;
  title: string;
  status: string;
  created_at: string;
  generated_quote: any;
  edited_quote?: any;
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

  const getDeductionType = (quote: Quote): 'rot' | 'rut' | 'none' | null => {
    const quoteData = quote.edited_quote || quote.generated_quote;
    return quoteData?.deductionType || quoteData?.summary?.deductionType || null;
  };

  if (quotes.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Inga offerter ännu"
        description="Börja med att skapa din första offert med AI-assistenten ovan. Beskriv uppdraget så genererar vi en komplett offert åt dig på några sekunder!"
      />
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
            className="cursor-pointer hover:bg-muted/30 hover:border-primary/30 hover:shadow-sm transition-all duration-200 border-border focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
            onClick={() => onQuoteClick?.(quote)}
            role="button"
            tabIndex={0}
            aria-label={`Öppna offert: ${quote.title}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onQuoteClick?.(quote);
              }
            }}
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
                <div className="flex items-center gap-2">
                  {(() => {
                    const deductionType = getDeductionType(quote);
                    if (deductionType === 'rot') {
                      return (
                        <Badge variant="outline" className="text-blue-600 border-blue-600 text-xs px-2 py-0.5">
                          <Hammer className="h-3 w-3 mr-1" />
                          ROT
                        </Badge>
                      );
                    }
                    if (deductionType === 'rut') {
                      return (
                        <Badge variant="outline" className="text-green-600 border-green-600 text-xs px-2 py-0.5">
                          <Sparkles className="h-3 w-3 mr-1" />
                          RUT
                        </Badge>
                      );
                    }
                    return null;
                  })()}
                  <Badge className={`${statusConfig.color} text-white flex items-center gap-1 text-xs px-2 py-0.5`}>
                    <StatusIcon className="h-3 w-3" />
                    {statusConfig.label}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default QuoteList;