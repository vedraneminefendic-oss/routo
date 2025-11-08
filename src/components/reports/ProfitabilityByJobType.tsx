import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

interface Quote {
  id: string;
  status: string;
  project_type?: string;
  description: string;
  generated_quote?: any;
  edited_quote?: any;
}

interface ProfitabilityByJobTypeProps {
  quotes: Quote[];
  loading: boolean;
}

interface JobTypeStats {
  category: string;
  total_quotes: number;
  accepted_quotes: number;
  total_value: number;
  avg_value: number;
  acceptance_rate: number;
  material_cost: number;
  work_cost: number;
  material_ratio: number;
}

type SortColumn = 'category' | 'total_quotes' | 'total_value' | 'avg_value' | 'acceptance_rate' | 'material_ratio';
type SortDirection = 'asc' | 'desc';

export const ProfitabilityByJobType = ({ quotes, loading }: ProfitabilityByJobTypeProps) => {
  const [sortColumn, setSortColumn] = useState<SortColumn>('total_value');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  const detectJobCategory = (quote: Quote): string => {
    const desc = quote.description?.toLowerCase() || '';
    const projectType = quote.project_type?.toLowerCase() || '';
    
    if (desc.includes('badrum') || projectType.includes('badrum')) return 'Badrumsrenovering';
    if (desc.includes('kök') || projectType.includes('kök')) return 'Köksrenovering';
    if (desc.includes('målning') || desc.includes('måla') || projectType.includes('målning')) return 'Målning';
    if (desc.includes('städ') || projectType.includes('städning')) return 'Städning';
    if (desc.includes('trädgård') || projectType.includes('trädgård')) return 'Trädgård';
    if (desc.includes('el') || desc.includes('elektr') || projectType.includes('el')) return 'Elarbete';
    if (desc.includes('vvs') || desc.includes('rör') || projectType.includes('vvs')) return 'VVS';
    if (desc.includes('fönster') || projectType.includes('fönster')) return 'Fönster';
    
    return 'Övrigt';
  };

  // Calculate stats per job type
  const jobTypeStatsMap = new Map<string, JobTypeStats>();

  quotes.forEach(quote => {
    const category = detectJobCategory(quote);
    const quoteData = quote.edited_quote || quote.generated_quote;
    
    if (!quoteData) return;

    const value = quoteData.summary?.customerPays || 0;
    const materialCost = quoteData.summary?.materialCost || 0;
    const workCost = quoteData.summary?.workCost || 0;
    const isAccepted = ['accepted', 'completed'].includes(quote.status);

    if (!jobTypeStatsMap.has(category)) {
      jobTypeStatsMap.set(category, {
        category,
        total_quotes: 0,
        accepted_quotes: 0,
        total_value: 0,
        avg_value: 0,
        acceptance_rate: 0,
        material_cost: 0,
        work_cost: 0,
        material_ratio: 0
      });
    }

    const stats = jobTypeStatsMap.get(category)!;
    stats.total_quotes += 1;
    
    if (isAccepted) {
      stats.accepted_quotes += 1;
      stats.total_value += value;
      stats.material_cost += materialCost;
      stats.work_cost += workCost;
    }
  });

  // Calculate derived metrics and sort
  let jobTypeStats = Array.from(jobTypeStatsMap.values())
    .map(stats => ({
      ...stats,
      avg_value: stats.accepted_quotes > 0 ? stats.total_value / stats.accepted_quotes : 0,
      acceptance_rate: stats.total_quotes > 0 ? (stats.accepted_quotes / stats.total_quotes) * 100 : 0,
      material_ratio: stats.work_cost > 0 ? stats.material_cost / stats.work_cost : 0
    }))
    .filter(stats => stats.total_quotes > 0);

  // Apply sorting
  jobTypeStats.sort((a, b) => {
    const aVal = a[sortColumn];
    const bVal = b[sortColumn];
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return multiplier * aVal.localeCompare(bVal, 'sv-SE');
    }
    
    return multiplier * ((aVal as number) - (bVal as number));
  });

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <Minus className="h-3 w-3 opacity-30" />;
    return sortDirection === 'asc' ? 
      <TrendingUp className="h-3 w-3" /> : 
      <TrendingDown className="h-3 w-3" />;
  };

  const ThButton = ({ column, children }: { column: SortColumn; children: React.ReactNode }) => (
    <th 
      className="text-left p-3 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer select-none transition-colors"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        <SortIcon column={column} />
      </div>
    </th>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lönsamhet per Jobbtyp</CardTitle>
        <CardDescription>
          Analys av olika arbetskategorier - klicka på kolumnrubriker för att sortera
        </CardDescription>
      </CardHeader>
      <CardContent>
        {jobTypeStats.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <ThButton column="category">Kategori</ThButton>
                    <ThButton column="total_quotes">Offerter</ThButton>
                    <ThButton column="acceptance_rate">Acceptansgrad</ThButton>
                    <ThButton column="total_value">Totalt värde</ThButton>
                    <ThButton column="avg_value">Snitt värde</ThButton>
                    <ThButton column="material_ratio">Material/Arbete</ThButton>
                  </tr>
                </thead>
                <tbody>
                  {jobTypeStats.map((stats) => (
                    <tr key={stats.category} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium">{stats.category}</td>
                      <td className="p-3 text-sm">
                        <span className="font-medium">{stats.accepted_quotes}</span>
                        <span className="text-muted-foreground"> / {stats.total_quotes}</span>
                      </td>
                      <td className="p-3">
                        <Badge 
                          variant={
                            stats.acceptance_rate >= 70 ? "default" : 
                            stats.acceptance_rate >= 40 ? "secondary" : 
                            "outline"
                          }
                        >
                          {stats.acceptance_rate.toFixed(0)}%
                        </Badge>
                      </td>
                      <td className="p-3 font-semibold">
                        {formatCurrency(stats.total_value)}
                      </td>
                      <td className="p-3 text-sm">
                        {formatCurrency(stats.avg_value)}
                      </td>
                      <td className="p-3 text-sm">
                        {stats.material_ratio > 0 ? (
                          <Badge variant="outline">
                            {stats.material_ratio.toFixed(2)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>Ingen data tillgänglig</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
