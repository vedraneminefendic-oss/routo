import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, TrendingUp, Target, DollarSign } from "lucide-react";

interface Statistics {
  total_quotes: number;
  total_value: number;
  avg_quote_value: number;
  sent_count: number;
  accepted_count: number;
}

interface StatisticsCardsProps {
  statistics: Statistics | null;
  loading: boolean;
}

export const StatisticsCards = ({ statistics, loading }: StatisticsCardsProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const conversionRate = statistics && statistics.sent_count > 0
    ? ((statistics.accepted_count / statistics.sent_count) * 100).toFixed(1)
    : '0';

  const cards = [
    {
      title: "Totalt antal offerter",
      value: statistics?.total_quotes || 0,
      icon: FileText,
      color: "text-blue-500",
    },
    {
      title: "Totalt värde",
      value: formatCurrency(statistics?.total_value || 0),
      icon: TrendingUp,
      color: "text-green-500",
    },
    {
      title: "Konverteringsgrad",
      value: `${conversionRate}%`,
      icon: Target,
      color: "text-purple-500",
    },
    {
      title: "Genomsnittlig offert",
      value: formatCurrency(statistics?.avg_quote_value || 0),
      icon: DollarSign,
      color: "text-orange-500",
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-[140px]" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[100px]" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <Icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
