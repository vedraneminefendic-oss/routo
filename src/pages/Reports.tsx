import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatisticsCards } from "@/components/reports/StatisticsCards";
import { QuotesTable } from "@/components/reports/QuotesTable";
import { TimeFilter } from "@/components/reports/TimeFilter";
import { startOfWeek, startOfMonth, startOfQuarter, startOfYear, endOfDay } from "date-fns";
import { toast } from "sonner";

export type TimeFilterType = 'week' | 'month' | 'quarter' | 'year' | 'custom';

interface Statistics {
  total_quotes: number;
  total_value: number;
  avg_quote_value: number;
  draft_count: number;
  sent_count: number;
  viewed_count: number;
  accepted_count: number;
  rejected_count: number;
  completed_count: number;
}

const Reports = () => {
  const navigate = useNavigate();
  const [timeFilter, setTimeFilter] = useState<TimeFilterType>('month');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>();
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const getDateRangeFromFilter = (filter: TimeFilterType, customRange?: { from: Date; to: Date }) => {
    const now = new Date();
    
    if (filter === 'custom' && customRange) {
      return { from: customRange.from, to: endOfDay(customRange.to) };
    }
    
    switch (filter) {
      case 'week':
        return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) };
      case 'month':
        return { from: startOfMonth(now), to: endOfDay(now) };
      case 'quarter':
        return { from: startOfQuarter(now), to: endOfDay(now) };
      case 'year':
        return { from: startOfYear(now), to: endOfDay(now) };
      default:
        return { from: startOfMonth(now), to: endOfDay(now) };
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
      }
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const { from, to } = getDateRangeFromFilter(timeFilter, dateRange);
      
      // Load statistics
      const { data: statsData, error: statsError } = await supabase.rpc('get_quote_statistics', {
        start_date: from.toISOString(),
        end_date: to.toISOString()
      });
      
      if (!statsError && statsData && statsData.length > 0) {
        setStatistics(statsData[0]);
      }
      
      // Load quotes for table
      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select('*')
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
        .order('created_at', { ascending: false });
      
      if (!quotesError) {
        setQuotes(quotesData || []);
      }
      
      setLoading(false);
    };
    
    loadData();
  }, [timeFilter, dateRange]);

  const exportToCSV = () => {
    const headers = ["Titel", "Status", "Skapad", "Skickad", "Värde"];
    const rows = quotes.map(q => [
      q.title,
      q.status,
      new Date(q.created_at).toLocaleDateString('sv-SE'),
      q.sent_at ? new Date(q.sent_at).toLocaleDateString('sv-SE') : '-',
      (q.generated_quote?.summary?.customerPays || q.edited_quote?.summary?.customerPays || 0).toString()
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `offerter_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success("CSV exporterad!");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Tillbaka
              </Button>
              <h1 className="text-2xl font-bold">Rapporter</h1>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                Exportera CSV
              </Button>
              <TimeFilter
              value={timeFilter} 
              onChange={setTimeFilter}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          <StatisticsCards statistics={statistics} loading={loading} />
          <QuotesTable quotes={quotes} loading={loading} />
        </div>
      </main>
    </div>
  );
};

export default Reports;
