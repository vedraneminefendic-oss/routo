import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PlayCircle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface TestResult {
  test: string;
  jobType: string;
  passed: boolean;
  expected?: string;
  actual?: string;
  deviation?: string;
  error?: string;
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}

export function RegressionTestRunner() {
  const [isRunning, setIsRunning] = useState(false);
  const [summary, setSummary] = useState<TestSummary | null>(null);
  const { toast } = useToast();

  const runTests = async () => {
    setIsRunning(true);
    setSummary(null);

    try {
      toast({
        title: '🧪 Startar regressionstester',
        description: 'Detta kan ta flera minuter...',
      });

      const { data, error } = await supabase.functions.invoke('run-regression-tests', {
        body: {}
      });

      if (error) throw error;

      setSummary(data);

      if (data.failed === 0) {
        toast({
          title: '✅ Alla tester godkända!',
          description: `${data.passed}/${data.total} tester passerade`,
        });
      } else {
        toast({
          title: '⚠️ Vissa tester misslyckades',
          description: `${data.passed}/${data.total} tester passerade`,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Test error:', error);
      toast({
        title: '❌ Fel vid körning av tester',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const passRate = summary ? (summary.passed / summary.total) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlayCircle className="h-5 w-5" />
          FAS 6: Regressionstester
        </CardTitle>
        <CardDescription>
          Kör alla golden tests för att verifiera systemets precision (125 tester över 5 jobbtyper)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runTests} 
          disabled={isRunning}
          size="lg"
          className="w-full"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Kör tester...
            </>
          ) : (
            <>
              <PlayCircle className="mr-2 h-4 w-4" />
              Kör alla regressionstester
            </>
          )}
        </Button>

        {summary && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-center">{summary.total}</div>
                  <div className="text-sm text-muted-foreground text-center">Totalt</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-center text-green-600">{summary.passed}</div>
                  <div className="text-sm text-muted-foreground text-center">Godkända</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-center text-red-600">{summary.failed}</div>
                  <div className="text-sm text-muted-foreground text-center">Misslyckade</div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Pass rate:</span>
                <span className="font-medium">{passRate.toFixed(1)}%</span>
              </div>
              <Progress value={passRate} className="h-2" />
            </div>

            <div className="max-h-[600px] overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Status</TableHead>
                    <TableHead>Test</TableHead>
                    <TableHead>Jobbtyp</TableHead>
                    <TableHead>Förväntat</TableHead>
                    <TableHead>Faktiskt</TableHead>
                    <TableHead className="text-right">Avvikelse</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.results.map((result, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {result.passed ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{result.test}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{result.jobType}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{result.expected}</TableCell>
                      <TableCell className="text-sm">{result.actual}</TableCell>
                      <TableCell className="text-right">
                        {result.deviation && (
                          <Badge variant={result.passed ? 'default' : 'destructive'}>
                            {result.deviation}
                          </Badge>
                        )}
                        {result.error && (
                          <Badge variant="destructive" className="text-xs">
                            Error
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}