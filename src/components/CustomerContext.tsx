import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, TrendingUp, FileText, Calendar, Phone, Mail, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerStats, CustomerStats } from "@/hooks/useCustomerStats";
import { Skeleton } from "@/components/ui/skeleton";

interface CustomerContextProps {
  customerId: string;
  onQuoteClick?: (quoteId: string) => void;
}

export const CustomerContext = ({ customerId, onQuoteClick }: CustomerContextProps) => {
  const [customer, setCustomer] = useState<any>(null);
  const [recentQuotes, setRecentQuotes] = useState<any[]>([]);
  const { stats, loading: statsLoading } = useCustomerStats(customerId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomerData();
  }, [customerId]);

  const loadCustomerData = async () => {
    setLoading(true);
    try {
      // Ladda kundinfo
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (customerError) throw customerError;
      setCustomer(customerData);

      // Ladda senaste offerterna för denna kund
      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select('id, title, status, created_at, generated_quote, edited_quote')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(3);

      if (quotesError) throw quotesError;
      setRecentQuotes(quotesData || []);
    } catch (error) {
      console.error('Error loading customer data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      draft: { label: 'Utkast', variant: 'secondary' },
      sent: { label: 'Skickad', variant: 'default' },
      viewed: { label: 'Visad', variant: 'default' },
      accepted: { label: 'Accepterad', className: 'bg-success text-white' },
      rejected: { label: 'Avvisad', variant: 'destructive' },
      completed: { label: 'Slutförd', className: 'bg-success text-white' },
    };
    const config = variants[status] || { label: status, variant: 'secondary' };
    return <Badge {...config}>{config.label}</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading || statsLoading) {
    return (
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!customer) {
    return null;
  }

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          Kundhistorik: {customer.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Kundkontaktinfo */}
        <div className="space-y-2">
          {customer.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{customer.email}</span>
            </div>
          )}
          {customer.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{customer.phone}</span>
            </div>
          )}
          {customer.address && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{customer.address}</span>
            </div>
          )}
        </div>

        {/* Statistik */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-card border-2 border-border/50">
            <div className="text-2xl font-bold text-primary">
              {stats.totalQuotes}
            </div>
            <div className="text-sm text-muted-foreground">Totala offerter</div>
          </div>
          <div className="p-4 rounded-xl bg-card border-2 border-border/50">
            <div className="text-2xl font-bold text-success">
              {stats.acceptanceRate.toFixed(0)}%
            </div>
            <div className="text-sm text-muted-foreground">Acceptansgrad</div>
          </div>
          <div className="col-span-2 p-4 rounded-xl bg-card border-2 border-border/50">
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(stats.totalValue)}
            </div>
            <div className="text-sm text-muted-foreground">Totalt värde</div>
          </div>
        </div>

        {/* Senaste offerter */}
        {recentQuotes.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Tidigare offerter
            </h4>
            {recentQuotes.map((quote) => {
              const quoteData = quote.edited_quote || quote.generated_quote;
              const amount = quoteData?.summary?.customerPays || 0;
              
              return (
                <div
                  key={quote.id}
                  className="p-3 rounded-lg bg-card border border-border/50 hover:border-primary/30 transition-all cursor-pointer"
                  onClick={() => onQuoteClick?.(quote.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{quote.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3 inline mr-1" />
                        {formatDate(quote.created_at)}
                      </div>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(quote.status)}
                      <div className="text-sm font-semibold text-primary mt-1">
                        {formatCurrency(amount)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* AI-insikter */}
        {stats.acceptanceRate > 60 && (
          <div className="p-3 rounded-lg bg-success/10 border border-success/20">
            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 text-success mt-0.5" />
              <div className="text-sm">
                <span className="font-semibold text-success">Stark relation! </span>
                <span className="text-muted-foreground">
                  Denna kund har hög acceptansgrad. Överväg att erbjuda premiumalternativ.
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};