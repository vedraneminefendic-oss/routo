import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Customer } from "@/pages/Customers";

interface QuoteFormProps {
  onGenerate: (description: string, customerId?: string, detailLevel?: string, deductionType?: string) => Promise<void>;
  isGenerating: boolean;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string | null;
}

const QuoteForm = ({ onGenerate, isGenerating }: QuoteFormProps) => {
  const [description, setDescription] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [detailLevel, setDetailLevel] = useState<string>("standard");
  const [deductionType, setDeductionType] = useState<string>("auto");

  useEffect(() => {
    loadCustomers();
    loadTemplates();
  }, []);

  const loadCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('name');
    
    if (data) {
      setCustomers(data);
    }
  };

  const loadTemplates = async () => {
    const { data } = await supabase
      .from('quote_templates')
      .select('id, name, description, category')
      .order('name');
    
    if (data) {
      setTemplates(data);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    
    if (templateId === "none") {
      setDescription("");
      return;
    }

    const template = templates.find(t => t.id === templateId);
    if (template) {
      setDescription(template.description);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim()) {
      await onGenerate(description, selectedCustomerId || undefined, detailLevel, deductionType);
    }
  };

  const exampleText = "Renovering av badrum, cirka 8 kvadratmeter med nytt kakel, golvvärme och mellanprisnivå på material.";

  return (
    <Card className="border-2 border-border bg-card shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-secondary">
          <Sparkles className="h-5 w-5 text-primary" />
          Skapa ny offert
        </CardTitle>
        <CardDescription>
          Beskriv uppdraget så genererar AI:n en komplett offert åt dig
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customer">Kund (valfritt)</Label>
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Välj kund eller lämna tom" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ingen kund</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template">Mall (valfritt)</Label>
            <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
              <SelectTrigger>
                <SelectValue placeholder="Välj mall eller skapa från grunden" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ingen mall</SelectItem>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                    {template.category && ` (${template.category})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {templates.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Inga mallar skapade. Gå till Inställningar → Mallar för att skapa din första mall.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="detailLevel">Detaljnivå</Label>
            <Select value={detailLevel} onValueChange={setDetailLevel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quick">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">⚡ Snabboffert</span>
                    <span className="text-xs text-muted-foreground">Grundläggande - perfekt för enkla uppdrag</span>
                  </div>
                </SelectItem>
                <SelectItem value="standard">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">📋 Standard</span>
                    <span className="text-xs text-muted-foreground">Normal detaljnivå - rekommenderas för de flesta uppdrag</span>
                  </div>
                </SelectItem>
                <SelectItem value="detailed">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">📊 Detaljerad</span>
                    <span className="text-xs text-muted-foreground">Utförlig - bra för större projekt</span>
                  </div>
                </SelectItem>
                <SelectItem value="construction">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">🏗️ Byggprojekt</span>
                    <span className="text-xs text-muted-foreground">Mycket detaljerad - för stora byggprojekt</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Välj hur detaljerad offerten ska vara
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deductionType">Skatteavdrag</Label>
            <Select value={deductionType} onValueChange={setDeductionType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  <div className="flex items-center gap-2">
                    <span>🤖 Automatisk detektering</span>
                  </div>
                </SelectItem>
                <SelectItem value="rot">
                  <div className="flex items-center gap-2">
                    <span>🔨 ROT-avdrag (Renovering)</span>
                  </div>
                </SelectItem>
                <SelectItem value="rut">
                  <div className="flex items-center gap-2">
                    <span>✨ RUT-avdrag (Städning/Hemservice)</span>
                  </div>
                </SelectItem>
                <SelectItem value="none">
                  <div className="flex items-center gap-2">
                    <span>❌ Inget avdrag</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              AI:n kan automatiskt avgöra om arbetet klassas som ROT eller RUT
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Uppdragsbeskrivning</Label>
            <Textarea
              id="description"
              placeholder={exampleText}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[150px] resize-none"
              disabled={isGenerating}
            />
            <p className="text-sm text-muted-foreground">
              Inkludera information om: typ av arbete, storlek/omfattning, materialnivå
            </p>
          </div>
          <Button 
            type="submit" 
            className="w-full bg-primary hover:bg-primary/90" 
            size="lg"
            disabled={isGenerating || !description.trim()}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Genererar offert...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generera offert
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default QuoteForm;