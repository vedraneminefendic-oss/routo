import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Users, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Quote {
  id: string;
  customer_id: string | null;
  status: string;
  generated_quote?: any;
  edited_quote?: any;
  created_at: string;
}

interface Customer {
  id: string;
  name: string;
}

interface CustomerLifetimeValueProps {
  quotes: Quote[];
  customers: Customer[];
  loading: boolean;
}

interface CustomerStats {
  customer_id: string;
  customer_name: string;
  total_quotes: number;
  total_value: number;
  accepted_quotes: number;
  acceptance_rate: number;
}

export const CustomerLifetimeValue = ({ quotes, customers, loading }: CustomerLifetimeValueProps) => {
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Calculate customer stats
  const customerStatsMap = new Map<string, CustomerStats>();

  quotes.forEach(quote => {
    if (!quote.customer_id) return;

    const value = (quote.edited_quote?.summary?.customerPays || quote.generated_quote?.summary?.customerPays || 0);
    const isAccepted = ['accepted', 'completed'].includes(quote.status);

    if (!customerStatsMap.has(quote.customer_id)) {
      const customer = customers.find(c => c.id === quote.customer_id);
      customerStatsMap.set(quote.customer_id, {
        customer_id: quote.customer_id,
        customer_name: customer?.name || 'Okänd kund',
        total_quotes: 0,
        total_value: 0,
        accepted_quotes: 0,
        acceptance_rate: 0
      });
    }

    const stats = customerStatsMap.get(quote.customer_id)!;
    stats.total_quotes += 1;
    stats.total_value += isAccepted ? value : 0;
    stats.accepted_quotes += isAccepted ? 1 : 0;
  });

  // Calculate acceptance rates and sort
  const customerStats = Array.from(customerStatsMap.values())
    .map(stats => ({
      ...stats,
      acceptance_rate: stats.total_quotes > 0 ? (stats.accepted_quotes / stats.total_quotes) * 100 : 0
    }))
    .filter(stats => stats.total_quotes > 0)
    .sort((a, b) => b.total_value - a.total_value)
    .slice(0, 10);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const totalCustomers = customerStatsMap.size;
  const recurringCustomers = Array.from(customerStatsMap.values()).filter(s => s.total_quotes > 1).length;
  const recurringRate = totalCustomers > 0 ? (recurringCustomers / totalCustomers) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          Customer Lifetime Value
        </CardTitle>
        <CardDescription>
          Dina mest värdefulla kunder och återköpsfrekvens
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Totalt kunder</span>
            </div>
            <div className="text-2xl font-bold">{totalCustomers}</div>
          </div>

          <div className="p-4 bg-gradient-to-br from-secondary/10 to-secondary/5 rounded-lg border border-secondary/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-secondary" />
              <span className="text-sm text-muted-foreground">Återkommande</span>
            </div>
            <div className="text-2xl font-bold">{recurringCustomers}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {recurringRate.toFixed(0)}% av alla kunder
            </div>
          </div>

          <div className="p-4 bg-gradient-to-br from-accent/10 to-accent/5 rounded-lg border border-accent/20">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-4 w-4 text-accent" />
              <span className="text-sm text-muted-foreground">Snitt offerter/kund</span>
            </div>
            <div className="text-2xl font-bold">
              {totalCustomers > 0 ? (quotes.filter(q => q.customer_id).length / totalCustomers).toFixed(1) : '0'}
            </div>
          </div>
        </div>

        {/* Top Customers Table */}
        {customerStats.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground">Top 10 Kunder</h4>
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground">#</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground">Kund</th>
                      <th className="text-right p-3 text-xs font-medium text-muted-foreground">Offerter</th>
                      <th className="text-right p-3 text-xs font-medium text-muted-foreground">Accepterade</th>
                      <th className="text-right p-3 text-xs font-medium text-muted-foreground">Acceptansgrad</th>
                      <th className="text-right p-3 text-xs font-medium text-muted-foreground">Totalt värde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerStats.map((customer, index) => (
                      <tr key={customer.customer_id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          {index < 3 ? (
                            <Badge variant={index === 0 ? "default" : "secondary"} className="w-6 h-6 flex items-center justify-center p-0">
                              {index + 1}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground ml-2">{index + 1}</span>
                          )}
                        </td>
                        <td className="p-3 font-medium">{customer.customer_name}</td>
                        <td className="p-3 text-right text-sm">{customer.total_quotes}</td>
                        <td className="p-3 text-right text-sm">{customer.accepted_quotes}</td>
                        <td className="p-3 text-right">
                          <Badge variant={customer.acceptance_rate >= 70 ? "default" : customer.acceptance_rate >= 40 ? "secondary" : "outline"}>
                            {customer.acceptance_rate.toFixed(0)}%
                          </Badge>
                        </td>
                        <td className="p-3 text-right font-semibold">
                          {formatCurrency(customer.total_value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Ingen kunddata tillgänglig än</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
