import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileText, Download, Save, Edit } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

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
  rotDeduction: number;
  customerPays: number;
}

interface Quote {
  title: string;
  workItems: WorkItem[];
  materials: Material[];
  summary: Summary;
  notes?: string;
}

interface QuoteDisplayProps {
  quote: Quote;
  onSave: () => void;
  onEdit?: () => void;
  isSaving: boolean;
}

const QuoteDisplay = ({ quote, onSave, onEdit, isSaving }: QuoteDisplayProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleExport = () => {
    const doc = new jsPDF();
    const lineHeight = 7;
    let y = 20;

    // Title
    doc.setFontSize(18);
    doc.text(quote.title, 20, y);
    y += lineHeight * 2;

    // Work Items
    doc.setFontSize(14);
    doc.text("Arbetsmoment", 20, y);
    y += lineHeight;
    doc.setFontSize(10);
    
    quote.workItems.forEach((item) => {
      doc.text(item.name, 20, y);
      doc.text(formatCurrency(item.subtotal), 180, y, { align: "right" });
      y += lineHeight * 0.8;
      doc.setFontSize(9);
      doc.text(item.description, 25, y);
      y += lineHeight * 0.8;
      doc.text(`${item.hours} timmar × ${formatCurrency(item.hourlyRate)}/tim`, 25, y);
      y += lineHeight * 1.5;
      doc.setFontSize(10);
    });

    y += lineHeight;

    // Materials
    doc.setFontSize(14);
    doc.text("Material", 20, y);
    y += lineHeight;
    doc.setFontSize(10);
    
    quote.materials.forEach((material) => {
      doc.text(material.name, 20, y);
      doc.text(formatCurrency(material.subtotal), 180, y, { align: "right" });
      y += lineHeight * 0.8;
      doc.setFontSize(9);
      doc.text(`${material.quantity} ${material.unit} × ${formatCurrency(material.pricePerUnit)}/${material.unit}`, 25, y);
      y += lineHeight * 1.5;
      doc.setFontSize(10);
    });

    y += lineHeight * 2;

    // Summary
    doc.setFontSize(14);
    doc.text("Sammanfattning", 20, y);
    y += lineHeight;
    doc.setFontSize(10);
    
    doc.text("Arbetskostnad", 20, y);
    doc.text(formatCurrency(quote.summary.workCost), 180, y, { align: "right" });
    y += lineHeight;
    
    doc.text("Materialkostnad", 20, y);
    doc.text(formatCurrency(quote.summary.materialCost), 180, y, { align: "right" });
    y += lineHeight * 1.5;
    
    doc.text("Summa exkl. moms", 20, y);
    doc.text(formatCurrency(quote.summary.totalBeforeVAT), 180, y, { align: "right" });
    y += lineHeight;
    
    doc.text("Moms (25%)", 20, y);
    doc.text(formatCurrency(quote.summary.vat), 180, y, { align: "right" });
    y += lineHeight;
    
    doc.setFontSize(12);
    doc.text("Totalt inkl. moms", 20, y);
    doc.text(formatCurrency(quote.summary.totalWithVAT), 180, y, { align: "right" });
    y += lineHeight * 1.5;
    
    doc.setFontSize(10);
    doc.text("ROT-avdrag (50%)", 20, y);
    doc.text(`-${formatCurrency(quote.summary.rotDeduction)}`, 180, y, { align: "right" });
    y += lineHeight * 1.5;
    
    doc.setFontSize(14);
    doc.text("Kund betalar", 20, y);
    doc.text(formatCurrency(quote.summary.customerPays), 180, y, { align: "right" });

    // Notes
    if (quote.notes) {
      y += lineHeight * 2;
      doc.setFontSize(12);
      doc.text("Anteckningar", 20, y);
      y += lineHeight;
      doc.setFontSize(9);
      const splitNotes = doc.splitTextToSize(quote.notes, 170);
      doc.text(splitNotes, 20, y);
    }

    doc.save(`${quote.title}.pdf`);
    toast.success("PDF exporterad!");
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {quote.title}
            </CardTitle>
            <CardDescription className="mt-1">
              Genererad offert - granska och spara
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" />
              PDF
            </Button>
            {onEdit && (
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-1" />
                Redigera
              </Button>
            )}
            <Button size="sm" onClick={onSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? "Sparar..." : "Spara"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Work Items */}
        <div>
          <h3 className="font-semibold text-lg mb-3">Arbetsmoment</h3>
          <div className="space-y-3">
            {quote.workItems.map((item, index) => (
              <div key={index} className="bg-muted/50 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium">{item.name}</h4>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <span className="font-semibold whitespace-nowrap ml-4">
                    {formatCurrency(item.subtotal)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {item.hours} timmar × {formatCurrency(item.hourlyRate)}/tim
                </p>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Materials */}
        <div>
          <h3 className="font-semibold text-lg mb-3">Material</h3>
          <div className="space-y-3">
            {quote.materials.map((material, index) => (
              <div key={index} className="bg-muted/50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">{material.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {material.quantity} {material.unit} × {formatCurrency(material.pricePerUnit)}/{material.unit}
                    </p>
                  </div>
                  <span className="font-semibold whitespace-nowrap ml-4">
                    {formatCurrency(material.subtotal)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Summary */}
        <div className="bg-primary/5 rounded-lg p-6">
          <h3 className="font-semibold text-lg mb-4">Sammanfattning</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Arbetskostnad</span>
              <span className="font-medium">{formatCurrency(quote.summary.workCost)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Materialkostnad</span>
              <span className="font-medium">{formatCurrency(quote.summary.materialCost)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between text-sm">
              <span>Summa exkl. moms</span>
              <span className="font-medium">{formatCurrency(quote.summary.totalBeforeVAT)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Moms (25%)</span>
              <span className="font-medium">{formatCurrency(quote.summary.vat)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Totalt inkl. moms</span>
              <span>{formatCurrency(quote.summary.totalWithVAT)}</span>
            </div>
            <Separator className="my-3" />
            <div className="flex justify-between text-accent">
              <span className="font-medium">ROT-avdrag (50%)</span>
              <span className="font-semibold">-{formatCurrency(quote.summary.rotDeduction)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-primary">
              <span>Kund betalar</span>
              <span>{formatCurrency(quote.summary.customerPays)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {quote.notes && (
          <>
            <Separator />
            <div>
              <h3 className="font-semibold text-sm mb-2">Anteckningar</h3>
              <p className="text-sm text-muted-foreground">{quote.notes}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default QuoteDisplay;