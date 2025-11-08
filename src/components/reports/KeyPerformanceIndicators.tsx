import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Clock, Award } from 'lucide-react';

interface Statistics {
  total_quotes: number;
  sent_count: number;
  accepted_count: number;
  rejected_count: number;
}

interface Quote {
  status: string;
  sent_at: string | null;
  responded_at: string | null;
  completed_at: string | null;
  description: string;
  generated_quote?: any;
  edited_quote?: any;
}

interface KeyPerformanceIndicatorsProps {
  statistics: Statistics | null;
  quotes: Quote[];
  loading: boolean;
}

export const KeyPerformanceIndicators = ({ statistics, quotes, loading }: KeyPerformanceIndicatorsProps) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-24 mb-2" />
              <Skeleton className="h-3 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!statistics) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Calculate acceptance rate
  const conversionRate = statistics.sent_count > 0
    ? (statistics.accepted_count / statistics.sent_count) * 100
    : 0;

  // Calculate average response time (from sent to responded/accepted)
  const responseTimes: number[] = [];
  quotes.forEach(quote => {
    if (quote.sent_at && quote.responded_at) {
      const sentTime = new Date(quote.sent_at).getTime();
      const respondedTime = new Date(quote.responded_at).getTime();
      const diffHours = (respondedTime - sentTime) / (1000 * 60 * 60);
      if (diffHours >= 0) responseTimes.push(diffHours);
    }
  });

  const avgResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
    : null;

  // Calculate conversion time (sent to accepted)
  const conversionTimes: number[] = [];
  quotes
    .filter(q => ['accepted', 'completed'].includes(q.status) && q.sent_at)
    .forEach(quote => {
      const sentTime = new Date(quote.sent_at!).getTime();
      const acceptedTime = quote.responded_at 
        ? new Date(quote.responded_at).getTime()
        : quote.completed_at 
          ? new Date(quote.completed_at).getTime()
          : null;
      
      if (acceptedTime) {
        const diffDays = (acceptedTime - sentTime) / (1000 * 60 * 60 * 24);
        if (diffDays >= 0) conversionTimes.push(diffDays);
      }
    });

  const avgConversionTime = conversionTimes.length > 0
    ? conversionTimes.reduce((sum, time) => sum + time, 0) / conversionTimes.length
    : null;

  // Calculate most profitable work type
  const workTypeMap = new Map<string, { count: number; value: number }>();
  quotes
    .filter(q => ['accepted', 'completed'].includes(q.status))
    .forEach(quote => {
      const quoteData = quote.edited_quote || quote.generated_quote;
      if (!quoteData) return;

      const desc = quote.description?.toLowerCase() || '';
      let workType = 'Övrigt';
      
      if (desc.includes('badrum')) workType = 'Badrum';
      else if (desc.includes('kök')) workType = 'Kök';
      else if (desc.includes('målning') || desc.includes('måla')) workType = 'Målning';
      else if (desc.includes('städ')) workType = 'Städning';
      else if (desc.includes('trädgård')) workType = 'Trädgård';
      else if (desc.includes('el')) workType = 'El';
      
      const value = quoteData.summary?.customerPays || 0;
      
      if (!workTypeMap.has(workType)) {
        workTypeMap.set(workType, { count: 0, value: 0 });
      }
      
      const stats = workTypeMap.get(workType)!;
      stats.count += 1;
      stats.value += value;
    });

  let mostProfitable = { type: 'N/A', value: 0, count: 0 };
  workTypeMap.forEach((stats, type) => {
    if (stats.value > mostProfitable.value) {
      mostProfitable = { type, value: stats.value, count: stats.count };
    }
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Acceptance Rate */}
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Acceptansgrad</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {conversionRate.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {statistics.accepted_count || 0} av {statistics.sent_count || 0} skickade
          </p>
          <div className="mt-4 h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${Math.min(conversionRate, 100)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Average Response Time */}
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Genomsnittlig svarstid</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {avgResponseTime !== null ? (
            <>
              <div className="text-3xl font-bold">
                {avgResponseTime < 48 
                  ? `${avgResponseTime.toFixed(0)}h`
                  : `${(avgResponseTime / 24).toFixed(1)} dagar`
                }
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Från skickad till svar
              </p>
              <div className="mt-4">
                <Badge variant={avgResponseTime < 48 ? "default" : avgResponseTime < 120 ? "secondary" : "outline"}>
                  {avgResponseTime < 48 ? "Snabbt" : avgResponseTime < 120 ? "Normalt" : "Långsamt"}
                </Badge>
              </div>
            </>
          ) : (
            <>
              <div className="text-3xl font-bold text-muted-foreground">-</div>
              <p className="text-xs text-muted-foreground mt-2">Ingen data</p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Average Conversion Time */}
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Försäljningscykel</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {avgConversionTime !== null ? (
            <>
              <div className="text-3xl font-bold">
                {avgConversionTime.toFixed(1)} dagar
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Från skickad till accepterad
              </p>
              <div className="mt-4">
                <Badge variant={avgConversionTime < 3 ? "default" : avgConversionTime < 7 ? "secondary" : "outline"}>
                  {avgConversionTime < 3 ? "Mycket snabbt" : avgConversionTime < 7 ? "Bra" : "Tar tid"}
                </Badge>
              </div>
            </>
          ) : (
            <>
              <div className="text-3xl font-bold text-muted-foreground">-</div>
              <p className="text-xs text-muted-foreground mt-2">Ingen data</p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Most Profitable Work Type */}
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Mest lönsamt</CardTitle>
          <Award className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{mostProfitable.type}</div>
          <p className="text-xs text-muted-foreground mt-2">
            {mostProfitable.count} jobb • {formatCurrency(mostProfitable.value)}
          </p>
          {mostProfitable.count > 0 && (
            <div className="mt-4">
              <p className="text-xs text-muted-foreground">
                Snitt: {formatCurrency(mostProfitable.value / mostProfitable.count)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
