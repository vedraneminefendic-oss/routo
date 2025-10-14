import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Edit, Save, X, Plus, Trash2, Hammer, Sparkles } from "lucide-react";
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
    // Recalculate work items subtotals
    const workItems = updated.workItems.map(item => ({
      ...item,
      subtotal: item.hours * item.hourlyRate,
    }));

    // Recalculate materials subtotals
    const materials = updated.materials.map(material => ({
      ...material,
      subtotal: material.quantity * material.pricePerUnit,
    }));

    // Calculate summary
    const workCost = workItems.reduce((sum, item) => sum + item.subtotal, 0);
    const materialCost = materials.reduce((sum, material) => sum + material.subtotal, 0);
    const totalBeforeVAT = workCost + materialCost;
    const vat = totalBeforeVAT * 0.25;
    const totalWithVAT = totalBeforeVAT + vat;
    
    // Handle different deduction types
    const deductionType = updated.deductionType || 'rot';
    const deductionPercentage = (deductionType === 'rot' || deductionType === 'rut') ? 0.5 : 0;
    const deductionAmount = workCost * deductionPercentage;
    const customerPays = totalWithVAT - deductionAmount;

    return {
      ...updated,
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
        {/* Title */}
        <div>
          <Label htmlFor="title">Titel</Label>
          <Input
            id="title"
            value={editedQuote.title}
            onChange={(e) => setEditedQuote({ ...editedQuote, title: e.target.value })}
            className="mt-1"
          />
        </div>

        {/* Deduction Type Selector */}
        <div>
          <Label htmlFor="deductionType">Skatteavdrag</Label>
          <Select 
            value={editedQuote.deductionType || 'rot'} 
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

        {/* Work Items */}
        <div>
          <h3 className="font-semibold text-lg mb-3 text-secondary">Arbetsmoment</h3>
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
                <div key={index} className="p-4 rounded-lg border bg-muted/30 space-y-3 relative group">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
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
                </div>
              ))}
              <Button
                variant="outline"
                onClick={addWorkItem}
                className="w-full border-dashed"
              >
                <Plus className="h-4 w-4 mr-2" />
                Lägg till arbetsmoment
              </Button>
            </div>
          )}
        </div>

        <Separator />

        {/* Materials */}
        <div>
          <h3 className="font-semibold text-lg mb-3 text-secondary">Material</h3>
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
                <div key={index} className="p-4 rounded-lg border bg-muted/30 space-y-3 relative group">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
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
                      <Input
                        value={material.unit}
                        onChange={(e) => updateMaterial(index, 'unit', e.target.value)}
                        className="mt-1"
                      />
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
                </div>
              ))}
              <Button
                variant="outline"
                onClick={addMaterial}
                className="w-full border-dashed"
              >
                <Plus className="h-4 w-4 mr-2" />
                Lägg till material
              </Button>
            </div>
          )}
        </div>

        <Separator />

        {/* Summary (Read-only, auto-calculated) */}
        <div className="bg-secondary/5 border border-secondary/10 rounded-lg p-6">
          <h3 className="font-semibold text-lg mb-4 text-secondary">Sammanfattning</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Arbetskostnad</span>
              <span className="font-medium">{formatCurrency(editedQuote.summary.workCost)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Materialkostnad</span>
              <span className="font-medium">{formatCurrency(editedQuote.summary.materialCost)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between text-sm">
              <span>Summa exkl. moms</span>
              <span className="font-medium">{formatCurrency(editedQuote.summary.totalBeforeVAT)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Moms (25%)</span>
              <span className="font-medium">{formatCurrency(editedQuote.summary.vat)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Totalt inkl. moms</span>
              <span>{formatCurrency(editedQuote.summary.totalWithVAT)}</span>
            </div>
            {editedQuote.summary.deductionAmount > 0 && (
              <>
                <Separator className="my-2" />
                <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                  <span className="flex items-center gap-1">
                    {editedQuote.deductionType === 'rot' ? (
                      <>
                        <Hammer className="h-3 w-3" />
                        ROT-avdrag (50% av arbetskostnad)
                      </>
                    ) : editedQuote.deductionType === 'rut' ? (
                      <>
                        <Sparkles className="h-3 w-3" />
                        RUT-avdrag (50% av arbetskostnad)
                      </>
                    ) : (
                      'Skatteavdrag'
                    )}
                  </span>
                  <span className="font-medium">
                    -{formatCurrency(editedQuote.summary.deductionAmount)}
                  </span>
                </div>
              </>
            )}
            <Separator className="my-3" />
            <div className="flex justify-between text-lg font-bold text-primary">
              <span>Kund betalar</span>
              <span>{formatCurrency(editedQuote.summary.customerPays)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <Label htmlFor="notes">Anteckningar</Label>
          <Textarea
            id="notes"
            value={editedQuote.notes || ""}
            onChange={(e) => setEditedQuote({ ...editedQuote, notes: e.target.value })}
            className="mt-1"
            rows={3}
            placeholder="Lägg till anteckningar..."
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default QuoteEditor;
