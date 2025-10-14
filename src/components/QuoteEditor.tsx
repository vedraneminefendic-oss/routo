import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Edit, Save, X, Plus, Trash2, Hammer, Sparkles, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface WorkItem {
  name: string;
  description: string;
  hours: number;
  hourlyRate: number;
  subtotal: number;
}

interface Material {
  name: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  subtotal: number;
}

interface Summary {
  workCost: number;
  materialCost: number;
  totalBeforeVAT: number;
  vat: number;
  totalWithVAT: number;
  deductionAmount: number;
  deductionType?: 'rot' | 'rut' | 'none';
  customerPays: number;
  rotDeduction?: number;
  rutDeduction?: number;
}

interface Quote {
  title: string;
  deductionType?: 'rot' | 'rut' | 'none';
  workItems: WorkItem[];
  materials: Material[];
  summary: Summary;
  notes?: string;
}

interface QuoteEditorProps {
  quote: Quote;
  onSave: (editedQuote: Quote) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

const QuoteEditor = ({ quote, onSave, onCancel, isSaving }: QuoteEditorProps) => {
  const [editedQuote, setEditedQuote] = useState<Quote>(JSON.parse(JSON.stringify(quote)));

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const recalculate = (updated: Quote) => {
    const workItems = updated.workItems.map(item => ({
      ...item,
      subtotal: item.hours * item.hourlyRate,
    }));

    const materials = updated.materials.map(material => ({
      ...material,
      subtotal: material.quantity * material.pricePerUnit,
    }));

    const workCost = workItems.reduce((sum, item) => sum + item.subtotal, 0);
    const materialCost = materials.reduce((sum, material) => sum + material.subtotal, 0);
    const totalBeforeVAT = workCost + materialCost;
    const vat = totalBeforeVAT * 0.25;
    const totalWithVAT = totalBeforeVAT + vat;
    
    const deductionType = updated.deductionType ?? 
      (updated.summary?.rotDeduction ? 'rot' : 
       updated.summary?.rutDeduction ? 'rut' : 'none');
    const deductionPercentage = (deductionType === 'rot' || deductionType === 'rut') ? 0.5 : 0;
    const deductionAmount = workCost * deductionPercentage;
    const customerPays = totalWithVAT - deductionAmount;

    return {
      ...updated,
      deductionType,
      workItems,
      materials,
      summary: {
        workCost,
        materialCost,
        totalBeforeVAT,
        vat,
        totalWithVAT,
        deductionAmount,
        deductionType,
        customerPays,
      },
    };
  };

  const updateWorkItem = (index: number, field: keyof WorkItem, value: any) => {
    const updated = { ...editedQuote };
    updated.workItems[index] = { ...updated.workItems[index], [field]: value };
    setEditedQuote(recalculate(updated));
  };

  const updateMaterial = (index: number, field: keyof Material, value: any) => {
    const updated = { ...editedQuote };
    updated.materials[index] = { ...updated.materials[index], [field]: value };
    setEditedQuote(recalculate(updated));
  };

  const removeWorkItem = (index: number) => {
    const updated = { ...editedQuote };
    updated.workItems.splice(index, 1);
    setEditedQuote(recalculate(updated));
    toast.success("Arbetsmoment borttaget");
  };

  const removeMaterial = (index: number) => {
    const updated = { ...editedQuote };
    updated.materials.splice(index, 1);
    setEditedQuote(recalculate(updated));
    toast.success("Material borttaget");
  };

  const addWorkItem = () => {
    const updated = { ...editedQuote };
    updated.workItems.push({
      name: "",
      description: "",
      hours: 0,
      hourlyRate: 0,
      subtotal: 0,
    });
    setEditedQuote(recalculate(updated));
    toast.success("Nytt arbetsmoment tillagt");
  };

  const addMaterial = () => {
    const updated = { ...editedQuote };
    updated.materials.push({
      name: "",
      quantity: 0,
      unit: "st",
      pricePerUnit: 0,
      subtotal: 0,
    });
    setEditedQuote(recalculate(updated));
    toast.success("Nytt material tillagt");
  };

  const handleSave = () => {
    if (editedQuote.workItems.length === 0 && editedQuote.materials.length === 0) {
      toast.error("Du måste ha minst ett arbetsmoment eller material");
      return;
    }
    onSave(editedQuote);
    toast.success("Ändringar sparade!");
  };

  const deductionAmount = editedQuote.summary.deductionAmount ?? 
    editedQuote.summary.rotDeduction ?? 
    editedQuote.summary.rutDeduction ?? 0;
  const effectiveDeductionType = editedQuote.deductionType ?? 
    (editedQuote.summary.rotDeduction ? 'rot' : 
     editedQuote.summary.rutDeduction ? 'rut' : 'none');

  return (
    <Card className="border-2 border-border bg-card shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-secondary">
              <Edit className="h-5 w-5 text-primary" />
              Redigera offert
            </CardTitle>
            <CardDescription className="mt-1">
              Ändringar uppdateras automatiskt i realtid
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onCancel}>
              <X className="h-4 w-4 mr-1" />
              Avbryt
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? "Sparar..." : "Spara"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="title">Titel</Label>
          <Input
            id="title"
            value={editedQuote.title}
            onChange={(e) => setEditedQuote({ ...editedQuote, title: e.target.value })}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="deductionType">Skatteavdrag</Label>
          <Select 
            value={effectiveDeductionType}
            onValueChange={(value: 'rot' | 'rut' | 'none') => {
              const updated = { ...editedQuote, deductionType: value };
              setEditedQuote(recalculate(updated));
            }}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rot">
                <div className="flex items-center gap-2">
                  <Hammer className="h-4 w-4" />
                  <span>ROT-avdrag (Renovering)</span>
                </div>
              </SelectItem>
              <SelectItem value="rut">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  <span>RUT-avdrag (Städning/Underhåll)</span>
                </div>
              </SelectItem>
              <SelectItem value="none">
                <div className="flex items-center gap-2">
                  <X className="h-4 w-4" />
                  <span>Inget avdrag</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <Tabs defaultValue="work" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="work">
              Arbetsmoment ({editedQuote.workItems?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="materials">
              Material ({editedQuote.materials?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="work" className="space-y-4">
            {editedQuote.workItems.length === 0 ? (
              <div className="p-6 text-center border border-dashed rounded-lg bg-muted/20">
                <p className="text-muted-foreground mb-3">Inga arbetsmoment ännu. Lägg till ett!</p>
                <Button variant="outline" onClick={addWorkItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Lägg till arbetsmoment
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {editedQuote.workItems.map((item, index) => (
                  <Collapsible key={index} defaultOpen={index === 0}>
                    <div className="p-4 rounded-lg border bg-muted/30 space-y-3 relative group">
                      <div className="flex items-center justify-between">
                        <CollapsibleTrigger className="flex items-center gap-2 hover:text-primary transition-colors flex-1 text-left">
                          <ChevronDown className="h-4 w-4 transition-transform ui-expanded:rotate-180" />
                          <span className="font-medium">
                            {item.name || `Arbetsmoment ${index + 1}`}
                          </span>
                          {item.hours > 0 && (
                            <span className="text-sm text-muted-foreground ml-auto mr-2">
                              {item.hours}h × {formatCurrency(item.hourlyRate)}/h = {formatCurrency(item.subtotal)}
                            </span>
                          )}
                        </CollapsibleTrigger>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Ta bort {item.name || "arbetsmoment"}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Detta kommer permanent ta bort arbetsmomentet ({formatCurrency(item.subtotal)}).
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Avbryt</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removeWorkItem(index)}>
                                Ta bort
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                      
                      <CollapsibleContent className="space-y-3 mt-3">
                        <div>
                          <Label className="text-xs">Namn</Label>
                          <Input
                            value={item.name}
                            onChange={(e) => updateWorkItem(index, 'name', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Beskrivning</Label>
                          <Textarea
                            value={item.description}
                            onChange={(e) => updateWorkItem(index, 'description', e.target.value)}
                            className="mt-1"
                            rows={2}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">Timmar</Label>
                            <Input
                              type="number"
                              value={item.hours}
                              onChange={(e) => updateWorkItem(index, 'hours', parseFloat(e.target.value) || 0)}
                              className="mt-1"
                              step="0.5"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Timpris (kr)</Label>
                            <Input
                              type="number"
                              value={item.hourlyRate}
                              onChange={(e) => updateWorkItem(index, 'hourlyRate', parseFloat(e.target.value) || 0)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Summa</Label>
                            <div className="mt-1 h-10 flex items-center px-3 rounded-md bg-muted font-semibold">
                              {formatCurrency(item.subtotal)}
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
                <Button
                  variant="outline"
                  onClick={addWorkItem}
                  className="w-full border-dashed hover:border-primary/50"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Lägg till arbetsmoment
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="materials" className="space-y-4">
            {editedQuote.materials.length === 0 ? (
              <div className="p-6 text-center border border-dashed rounded-lg bg-muted/20">
                <p className="text-muted-foreground mb-3">Inga material ännu. Lägg till ett!</p>
                <Button variant="outline" onClick={addMaterial}>
                  <Plus className="h-4 w-4 mr-2" />
                  Lägg till material
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {editedQuote.materials.map((material, index) => (
                  <Collapsible key={index} defaultOpen={index === 0}>
                    <div className="p-4 rounded-lg border bg-muted/30 space-y-3 relative group">
                      <div className="flex items-center justify-between">
                        <CollapsibleTrigger className="flex items-center gap-2 hover:text-primary transition-colors flex-1 text-left">
                          <ChevronDown className="h-4 w-4 transition-transform ui-expanded:rotate-180" />
                          <span className="font-medium">
                            {material.name || `Material ${index + 1}`}
                          </span>
                          {material.quantity > 0 && (
                            <span className="text-sm text-muted-foreground ml-auto mr-2">
                              {material.quantity} {material.unit} × {formatCurrency(material.pricePerUnit)} = {formatCurrency(material.subtotal)}
                            </span>
                          )}
                        </CollapsibleTrigger>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Ta bort {material.name || "material"}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Detta kommer permanent ta bort materialet ({formatCurrency(material.subtotal)}).
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Avbryt</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removeMaterial(index)}>
                                Ta bort
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                      
                      <CollapsibleContent className="space-y-3 mt-3">
                        <div>
                          <Label className="text-xs">Namn</Label>
                          <Input
                            value={material.name}
                            onChange={(e) => updateMaterial(index, 'name', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                          <div>
                            <Label className="text-xs">Antal</Label>
                            <Input
                              type="number"
                              value={material.quantity}
                              onChange={(e) => updateMaterial(index, 'quantity', parseFloat(e.target.value) || 0)}
                              className="mt-1"
                              step="0.1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Enhet</Label>
                            <Select
                              value={material.unit}
                              onValueChange={(value) => updateMaterial(index, 'unit', value)}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="st">st</SelectItem>
                                <SelectItem value="m">m</SelectItem>
                                <SelectItem value="m²">m²</SelectItem>
                                <SelectItem value="m³">m³</SelectItem>
                                <SelectItem value="kg">kg</SelectItem>
                                <SelectItem value="l">l</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Pris/enhet (kr)</Label>
                            <Input
                              type="number"
                              value={material.pricePerUnit}
                              onChange={(e) => updateMaterial(index, 'pricePerUnit', parseFloat(e.target.value) || 0)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Summa</Label>
                            <div className="mt-1 h-10 flex items-center px-3 rounded-md bg-muted font-semibold">
                              {formatCurrency(material.subtotal)}
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
                <Button
                  variant="outline"
                  onClick={addMaterial}
                  className="w-full border-dashed hover:border-primary/50"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Lägg till material
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Separator />

        <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
          <h3 className="font-semibold text-lg mb-3 text-secondary">Sammanfattning</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Arbetskostnad:</span>
              <span className="font-medium">{formatCurrency(editedQuote.summary.workCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Materialkostnad:</span>
              <span className="font-medium">{formatCurrency(editedQuote.summary.materialCost)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="text-muted-foreground">Summa före moms:</span>
              <span className="font-medium">{formatCurrency(editedQuote.summary.totalBeforeVAT)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Moms (25%):</span>
              <span className="font-medium">{formatCurrency(editedQuote.summary.vat)}</span>
            </div>
            <div className="flex justify-between font-semibold pt-2 border-t">
              <span>Totalt inkl. moms:</span>
              <span className="text-primary">{formatCurrency(editedQuote.summary.totalWithVAT)}</span>
            </div>
            {deductionAmount > 0 && (
              <>
                <div className="flex justify-between text-secondary">
                  <span>
                    {effectiveDeductionType === 'rot' ? 'ROT-avdrag' : 'RUT-avdrag'} (50%):
                  </span>
                  <span className="font-medium">-{formatCurrency(deductionAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-primary/30">
                  <span>Kund betalar:</span>
                  <span className="text-primary">{formatCurrency(editedQuote.summary.customerPays)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="notes">Anteckningar (valfritt)</Label>
          <Textarea
            id="notes"
            value={editedQuote.notes || ""}
            onChange={(e) => setEditedQuote({ ...editedQuote, notes: e.target.value })}
            className="mt-1"
            rows={3}
            placeholder="Lägg till eventuella anteckningar..."
          />
        </div>

        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            <X className="h-4 w-4 mr-2" />
            Avbryt
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Sparar..." : "Spara ändringar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default QuoteEditor;
