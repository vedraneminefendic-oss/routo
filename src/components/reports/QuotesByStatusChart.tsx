import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Statistics {
  draft_count: number;
  sent_count: number;
  viewed_count: number;
  accepted_count: number;
  rejected_count: number;
  completed_count: number;
}

interface QuotesByStatusChartProps {
  statistics: Statistics | null;
  loading: boolean;
}

const STATUS_COLORS = {
  draft: 'hsl(var(--muted))',
  sent: 'hsl(var(--primary))',
  viewed: 'hsl(var(--accent))',
  accepted: 'hsl(var(--success))',
  rejected: 'hsl(var(--destructive))',
  completed: 'hsl(var(--success-dark))',
};

export const QuotesByStatusChart = ({ statistics, loading }: QuotesByStatusChartProps) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fördelning per status</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!statistics) return null;

  const data = [
    { name: 'Utkast', value: statistics.draft_count, color: STATUS_COLORS.draft },
    { name: 'Skickad', value: statistics.sent_count, color: STATUS_COLORS.sent },
    { name: 'Visad', value: statistics.viewed_count, color: STATUS_COLORS.viewed },
    { name: 'Accepterad', value: statistics.accepted_count, color: STATUS_COLORS.accepted },
    { name: 'Avvisad', value: statistics.rejected_count, color: STATUS_COLORS.rejected },
    { name: 'Slutförd', value: statistics.completed_count, color: STATUS_COLORS.completed },
  ].filter(item => item.value > 0);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fördelning per status</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground">Ingen data att visa</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fördelning per status</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [value, 'Antal']}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value, entry: any) => {
                const item = data.find(d => d.name === value);
                return `${value}: ${item?.value || 0}`;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
