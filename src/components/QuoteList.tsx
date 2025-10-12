import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { sv } from "date-fns/locale";

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

const QuoteList = ({ quotes, onQuoteClick }: QuoteListProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-secondary text-secondary-foreground';
      case 'accepted': return 'bg-accent text-accent-foreground';
      case 'rejected': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return 'Utkast';
      case 'sent': return 'Skickad';
      case 'accepted': return 'Accepterad';
      case 'rejected': return 'Avböjd';
      default: return status;
    }
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
      {quotes.map((quote) => (
        <Card 
          key={quote.id} 
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => onQuoteClick?.(quote)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">{quote.title}</h3>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDistanceToNow(new Date(quote.created_at), { 
                      addSuffix: true, 
                      locale: sv 
                    })}
                  </span>
                  {quote.generated_quote?.summary && (
                    <span className="font-medium">
                      {formatCurrency(quote.generated_quote.summary.customerPays)}
                    </span>
                  )}
                </div>
              </div>
              <Badge className={getStatusColor(quote.status)}>
                {getStatusText(quote.status)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default QuoteList;