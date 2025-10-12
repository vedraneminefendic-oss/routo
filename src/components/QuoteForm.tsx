import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2 } from "lucide-react";

interface QuoteFormProps {
  onGenerate: (description: string) => Promise<void>;
  isGenerating: boolean;
}

const QuoteForm = ({ onGenerate, isGenerating }: QuoteFormProps) => {
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim()) {
      await onGenerate(description);
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