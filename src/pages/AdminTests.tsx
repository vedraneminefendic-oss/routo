import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Play, Plus, Trash2 } from 'lucide-react';

export default function AdminTests() {
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [newTest, setNewTest] = useState({
    test_name: '',
    job_type: '',
    scenario_description: '',
    input_data: '{"description": "", "measurements": {}, "detailLevel": "standard"}',
    expected_price_min: 0,
    expected_price_max: 0,
    tags: ''
  });
  
  useEffect(() => {
    loadTests();
  }, []);
  
  const loadTests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('golden_tests')
      .select('*')
      .order('job_type');
    
    if (error) {
      toast.error('Kunde inte ladda tester');
      console.error(error);
    } else {
      setTests(data || []);
    }
    setLoading(false);
  };
  
  const addTest = async () => {
    try {
      const inputData = JSON.parse(newTest.input_data);
      const tagsArray = newTest.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
      
      const { error } = await supabase.from('golden_tests').insert({
        test_name: newTest.test_name,
        job_type: newTest.job_type,
        scenario_description: newTest.scenario_description,
        input_data: inputData,
        expected_price_min: newTest.expected_price_min,
        expected_price_max: newTest.expected_price_max,
        tags: tagsArray
      });
      
      if (error) throw error;
      
      toast.success('Test tillagt!');
      setNewTest({
        test_name: '',
        job_type: '',
        scenario_description: '',
        input_data: '{"description": "", "measurements": {}, "detailLevel": "standard"}',
        expected_price_min: 0,
        expected_price_max: 0,
        tags: ''
      });
      loadTests();
    } catch (e) {
      toast.error('Fel vid tillägg av test');
      console.error(e);
    }
  };
  
  const deleteTest = async (id: string) => {
    if (!confirm('Är du säker på att du vill ta bort detta test?')) return;
    
    const { error } = await supabase
      .from('golden_tests')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Kunde inte ta bort test');
      console.error(error);
    } else {
      toast.success('Test borttaget');
      loadTests();
    }
  };
  
  const runTests = async () => {
    setRunning(true);
    toast.info('Kör tester...', { duration: 2000 });
    
    try {
      const { data, error } = await supabase.functions.invoke('run-regression-tests');
      
      if (error) throw error;
      
      toast.success(`Testning klar: ${data.passed}/${data.total_tests} lyckades`);
    } catch (e) {
      toast.error('Testning misslyckades');
      console.error(e);
    } finally {
      setRunning(false);
      loadTests();
    }
  };
  
  const getPassRate = (test: any) => {
    if (test.run_count === 0) return 'Ej körd';
    const rate = (test.pass_count / test.run_count) * 100;
    return `${rate.toFixed(0)}% (${test.pass_count}/${test.run_count})`;
  };
  
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Golden Tests Admin</h1>
        <p className="text-muted-foreground">Hantera och kör regressionstester för offertgenerering</p>
      </div>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Lägg till nytt test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              placeholder="Test namn (t.ex. målning_lägenhet_50kvm)"
              value={newTest.test_name}
              onChange={e => setNewTest({...newTest, test_name: e.target.value})}
            />
            <Input
              placeholder="Jobbtyp (t.ex. målning)"
              value={newTest.job_type}
              onChange={e => setNewTest({...newTest, job_type: e.target.value})}
            />
          </div>
          
          <Textarea
            placeholder="Scenario beskrivning"
            value={newTest.scenario_description}
            onChange={e => setNewTest({...newTest, scenario_description: e.target.value})}
            rows={2}
          />
          
          <Textarea
            placeholder='Input data (JSON): {"description": "...", "measurements": {...}}'
            value={newTest.input_data}
            onChange={e => setNewTest({...newTest, input_data: e.target.value})}
            rows={4}
            className="font-mono text-sm"
          />
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="number"
              placeholder="Min pris (kr)"
              value={newTest.expected_price_min || ''}
              onChange={e => setNewTest({...newTest, expected_price_min: Number(e.target.value)})}
            />
            <Input
              type="number"
              placeholder="Max pris (kr)"
              value={newTest.expected_price_max || ''}
              onChange={e => setNewTest({...newTest, expected_price_max: Number(e.target.value)})}
            />
          </div>
          
          <Input
            placeholder="Tags (kommaseparerade, t.ex. regression,målning,premium)"
            value={newTest.tags}
            onChange={e => setNewTest({...newTest, tags: e.target.value})}
          />
          
          <Button onClick={addTest} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Lägg till test
          </Button>
        </CardContent>
      </Card>
      
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-semibold">Befintliga tester</h2>
          <p className="text-sm text-muted-foreground">{tests.length} tester konfigurerade</p>
        </div>
        <Button onClick={runTests} disabled={running || tests.length === 0} size="lg">
          <Play className="h-4 w-4 mr-2" />
          {running ? 'Kör tester...' : 'Kör alla tester'}
        </Button>
      </div>
      
      {loading ? (
        <p className="text-center py-8 text-muted-foreground">Laddar tester...</p>
      ) : tests.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Inga tester ännu. Lägg till ett test ovan.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tests.map(test => (
            <Card key={test.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1">{test.test_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{test.scenario_description}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteTest(test.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Jobbtyp:</span>{' '}
                    <Badge variant="secondary">{test.job_type}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Prisintervall:</span>{' '}
                    <span className="font-medium">{test.expected_price_min.toLocaleString()}-{test.expected_price_max.toLocaleString()} kr</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Genomförda tester:</span>{' '}
                    <span className="font-medium">{getPassRate(test)}</span>
                  </div>
                </div>
                {test.tags && test.tags.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    {test.tags.map((tag: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
