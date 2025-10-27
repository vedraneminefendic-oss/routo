import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

interface BenchmarkData {
  work_category: string;
  metric_type: string;
  median_value: number;
  min_value: number;
  max_value: number;
  sample_size: number;
  last_updated: string;
}

export const MarketDataDashboard = () => {
  const [benchmarks, setBenchmarks] = useState<BenchmarkData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const loadBenchmarks = async () => {
    try {
      const { data, error } = await supabase
        .from('industry_benchmarks')
        .select('*')
        .order('last_updated', { ascending: false });

      if (error) throw error;
      setBenchmarks(data || []);
    } catch (error) {
      console.error('Error loading benchmarks:', error);
      toast({
        title: "Fel",
        description: "Kunde inte ladda marknadsdata",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBenchmarks();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-market-data', {
        body: { source: 'manual-refresh' }
      });

      if (error) throw error;

      toast({
        title: "✅ Uppdaterat",
        description: `Marknadsdata uppdaterades framgångsrikt`,
      });

      await loadBenchmarks();
    } catch (error) {
      console.error('Error refreshing market data:', error);
      toast({
        title: "Fel",
        description: "Kunde inte uppdatera marknadsdata",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const getMostRecentUpdate = () => {
    if (benchmarks.length === 0) return null;
    return new Date(benchmarks[0].last_updated);
  };

  const isDataOutdated = () => {
    const lastUpdate = getMostRecentUpdate();
    if (!lastUpdate) return true;
    
    const daysSinceUpdate = Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceUpdate > 30;
  };

  const formatCategory = (category: string) => {
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatMetricType = (type: string) => {
    const types: Record<string, string> = {
      'price_per_sqm': 'Pris per kvm',
      'material_to_work_ratio': 'Material/Arbete-ratio',
      'hourly_rate': 'Timpris',
    };
    return types[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const lastUpdate = getMostRecentUpdate();
  const outdated = isDataOutdated();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Marknadspriser</h2>
          <p className="text-sm text-muted-foreground">
            Automatiskt uppdaterade referenspriser från branschdata
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
        >
          {refreshing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uppdaterar...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Uppdatera nu
            </>
          )}
        </Button>
      </div>

      {outdated && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            ⚠️ Marknadspriser uppdaterades senast för{' '}
            {lastUpdate ? Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)) : '?'}{' '}
            dagar sedan. Klicka på "Uppdatera nu" för att få senaste priserna.
          </AlertDescription>
        </Alert>
      )}

      {lastUpdate && !outdated && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700 dark:text-green-300">
            ✅ Marknadsdata är uppdaterad. Senaste uppdatering:{' '}
            {format(lastUpdate, 'PPP', { locale: sv })}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {benchmarks.map((benchmark, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="text-lg">
                {formatCategory(benchmark.work_category)}
              </CardTitle>
              <CardDescription>
                {formatMetricType(benchmark.metric_type)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Medianpris:</span>
                  <span className="font-bold text-lg">
                    {Math.round(benchmark.median_value).toLocaleString('sv-SE')} kr
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Intervall:</span>
                  <span>
                    {Math.round(benchmark.min_value).toLocaleString('sv-SE')} -{' '}
                    {Math.round(benchmark.max_value).toLocaleString('sv-SE')} kr
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground mt-3 pt-3 border-t">
                  <span>Baserat på {benchmark.sample_size} offerter</span>
                  <span>
                    {format(new Date(benchmark.last_updated), 'dd MMM yyyy', { locale: sv })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {benchmarks.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Ingen marknadsdata tillgänglig</p>
            <p className="text-sm text-muted-foreground mb-4">
              Klicka på "Uppdatera nu" för att hämta senaste priserna
            </p>
            <Button onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Hämtar data...
                </>
              ) : (
                'Hämta marknadsdata'
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
