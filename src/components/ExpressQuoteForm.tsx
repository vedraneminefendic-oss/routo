import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Sparkles } from "lucide-react";

interface ExpressQuoteFormProps {
  onGenerate: (data: {
    projectType: string;
    description: string;
    measurements: string;
    deductionType: string;
  }) => void;
  isGenerating: boolean;
}

export const ExpressQuoteForm = ({ onGenerate, isGenerating }: ExpressQuoteFormProps) => {
  const [projectType, setProjectType] = useState("");
  const [description, setDescription] = useState("");
  const [measurements, setMeasurements] = useState("");
  const [deductionType, setDeductionType] = useState("none");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Build complete description with measurements
    const completeDescription = `${projectType}: ${description}. Storlek: ${measurements}`;
    
    onGenerate({
      projectType,
      description: completeDescription,
      measurements,
      deductionType
    });
  };

  const isValid = projectType && description && measurements;

  return (
    <Card className="border-2">
      <CardHeader className="p-4 md:p-6">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <CardTitle className="text-base md:text-lg">Snabbläge</CardTitle>
        </div>
        <CardDescription className="text-sm">
          För erfarna användare - generera offert direkt utan AI-samtal
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="projectType" className="text-sm md:text-base">Projekttyp *</Label>
            <Select value={projectType} onValueChange={setProjectType}>
              <SelectTrigger id="projectType" className="min-h-[48px] touch-manipulation">
                <SelectValue placeholder="Välj projekttyp" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Badrumsrenovering">Badrumsrenovering</SelectItem>
                <SelectItem value="Köksrenovering">Köksrenovering</SelectItem>
                <SelectItem value="Målning">Målning</SelectItem>
                <SelectItem value="Trädgårdsarbete">Trädgårdsarbete</SelectItem>
                <SelectItem value="Trädfällning">Trädfällning</SelectItem>
                <SelectItem value="VVS-arbete">VVS-arbete</SelectItem>
                <SelectItem value="El-arbete">El-arbete</SelectItem>
                <SelectItem value="Snickeri">Snickeri</SelectItem>
                <SelectItem value="Städning">Städning</SelectItem>
                <SelectItem value="Övrig">Övrig</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm md:text-base">Beskrivning *</Label>
            <Textarea
              id="description"
              placeholder="Beskriv kort vad som ska göras..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={200}
              className="min-h-[80px] touch-manipulation"
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/200 tecken
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="measurements" className="text-sm md:text-base">Storlek/Mått *</Label>
            <Input
              id="measurements"
              placeholder="Ex: 8 kvm, 3 träd, 2 rum..."
              value={measurements}
              onChange={(e) => setMeasurements(e.target.value)}
              className="min-h-[48px] touch-manipulation"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deductionType" className="text-sm md:text-base">ROT/RUT-avdrag</Label>
            <Select value={deductionType} onValueChange={setDeductionType}>
              <SelectTrigger id="deductionType" className="min-h-[48px] touch-manipulation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Inget avdrag</SelectItem>
                <SelectItem value="rot">ROT-avdrag</SelectItem>
                <SelectItem value="rut">RUT-avdrag</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            type="submit" 
            size="lg"
            disabled={!isValid || isGenerating}
            className="w-full min-h-[48px] touch-manipulation"
          >
            {isGenerating ? (
              <>
                <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                Genererar...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Generera direkt
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            💡 Tips: AI-assisterad läge ställer frågor för mer exakta offerter
          </p>
        </form>
      </CardContent>
    </Card>
  );
};
