import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface TimeSeriesData {
  period_label: string;
  sent_count: number;
  accepted_count: number;
  rejected_count: number;
  viewed_count: number;
  total_quotes: number;
}

interface AcceptanceRateChartProps {
  data: TimeSeriesData[] | null;
  loading: boolean;
}

export const AcceptanceRateChart = ({ data, loading }: AcceptanceRateChartProps) => {
  if (loading) {
    return (
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Acceptansgrad per period</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Acceptansgrad per period</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground">Ingen data att visa</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map(item => ({
    period: item.period_label,
    accepted: item.accepted_count,
    rejected: item.rejected_count,
    viewed: item.viewed_count,
    pending: item.sent_count - item.accepted_count - item.rejected_count - item.viewed_count,
  }));

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Acceptansgrad per period</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="period" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                const label = name === 'accepted' ? 'Accepterade' : 
                             name === 'rejected' ? 'Avvisade' : 
                             name === 'viewed' ? 'Visade' : 'Väntande';
                return [value, label];
              }}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend 
              formatter={(value) => {
                return value === 'accepted' ? 'Accepterade' : 
                       value === 'rejected' ? 'Avvisade' : 
                       value === 'viewed' ? 'Visade' : 'Väntande';
              }}
            />
            <Bar dataKey="accepted" stackId="a" fill="hsl(var(--success))" />
            <Bar dataKey="rejected" stackId="a" fill="hsl(var(--destructive))" />
            <Bar dataKey="viewed" stackId="a" fill="hsl(var(--info))" />
            <Bar dataKey="pending" stackId="a" fill="hsl(var(--warning))" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
