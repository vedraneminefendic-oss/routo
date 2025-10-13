import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
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
  title: string;
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
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

  // Calculate acceptance rate
  const conversionRate = statistics.sent_count > 0
    ? ((statistics.accepted_count / statistics.sent_count) * 100).toFixed(1)
    : '0.0';

  // Calculate average response time
  const respondedQuotes = quotes.filter(
    q => q.sent_at && q.responded_at && (q.status === 'accepted' || q.status === 'rejected')
  );

  let avgResponseTime = 0;
  if (respondedQuotes.length > 0) {
    const totalDays = respondedQuotes.reduce((sum, quote) => {
      const sent = new Date(quote.sent_at!);
      const responded = new Date(quote.responded_at!);
      const days = (responded.getTime() - sent.getTime()) / (1000 * 60 * 60 * 24);
      return sum + days;
    }, 0);
    avgResponseTime = totalDays / respondedQuotes.length;
  }

  // Find most profitable work type (based on title keywords)
  const workTypes: { [key: string]: { total: number; count: number } } = {};
  
  quotes.forEach(quote => {
    if (quote.status === 'accepted' || quote.status === 'completed') {
      const value = quote.edited_quote?.summary?.customerPays || 
                    quote.generated_quote?.summary?.customerPays || 0;
      
      // Extract work type from title (simplified)
      const title = quote.title.toLowerCase();
      let workType = 'Övrigt';
      
      if (title.includes('badrum')) workType = 'Badrumsrenovering';
      else if (title.includes('kök')) workType = 'Köksrenovering';
      else if (title.includes('målning') || title.includes('måla')) workType = 'Målning';
      else if (title.includes('golv')) workType = 'Golvläggning';
      else if (title.includes('el')) workType = 'Elarbeten';
      else if (title.includes('vvs') || title.includes('rör')) workType = 'VVS-arbeten';
      
      if (!workTypes[workType]) {
        workTypes[workType] = { total: 0, count: 0 };
      }
      
      workTypes[workType].total += value;
      workTypes[workType].count += 1;
    }
  });

  const mostProfitable = Object.entries(workTypes)
    .map(([type, data]) => ({
      type,
      avgValue: data.total / data.count,
      count: data.count,
    }))
    .sort((a, b) => b.avgValue - a.avgValue)[0];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Acceptansgrad</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-success">
            {conversionRate}%
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {statistics.accepted_count} av {statistics.sent_count} skickade
          </p>
          <div className="mt-3">
            <Progress value={parseFloat(conversionRate)} className="h-2" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Genomsnittlig responstid</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">
            {avgResponseTime > 0 ? avgResponseTime.toFixed(1) : '—'} {avgResponseTime > 0 && 'dagar'}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {respondedQuotes.length > 0 
              ? `Baserat på ${respondedQuotes.length} svar`
              : 'Ingen data tillgänglig'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Mest lönsamma arbetstyp</CardTitle>
          <Award className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold text-accent">
            {mostProfitable ? mostProfitable.type : 'Ingen data'}
          </div>
          {mostProfitable && (
            <p className="text-xs text-muted-foreground mt-1">
              Snitt: {new Intl.NumberFormat('sv-SE', {
                style: 'currency',
                currency: 'SEK',
                maximumFractionDigits: 0,
              }).format(mostProfitable.avgValue)} ({mostProfitable.count} st)
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
