import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileText, Download, Save, Edit, Send, ChevronDown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { QuoteStatusManager } from "@/components/QuoteStatusManager";
import { QuoteStatusTimeline } from "@/components/QuoteStatusTimeline";
import { QuoteStatus } from "@/hooks/useQuoteStatus";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  onSave?: () => void;
  onEdit?: () => void;
  onClose?: () => void;
  onDelete?: () => void;
  isSaving: boolean;
  quoteId?: string;
  currentStatus?: QuoteStatus;
  onStatusChanged?: () => void;
}

const QuoteDisplay = ({ 
  quote, 
  onSave, 
  onEdit, 
  onClose, 
  onDelete,
  isSaving, 
  quoteId, 
  currentStatus,
  onStatusChanged 
}: QuoteDisplayProps) => {
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadCompanySettings();
  }, []);

  const loadCompanySettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      
      setCompanySettings(data);

      // Load logo if exists
      if (data?.logo_url) {
        try {
          // logo_url is already a full public URL, use it directly
          const response = await fetch(data.logo_url);
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            setLogoImage(reader.result as string);
          };
          reader.readAsDataURL(blob);
        } catch (error) {
          console.error('Error loading logo:', error);
        }
      }
    } catch (error) {
      console.error('Error loading company settings:', error);
    }
  };

  const handleSendEmail = async () => {
    if (!recipientEmail || !recipientName) {
      toast.error("Vänligen fyll i både namn och e-postadress");
      return;
    }

    if (!quoteId) {
      toast.error("Offerten måste sparas innan den kan skickas");
      return;
    }

    setIsSendingEmail(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-quote-email", {
        body: {
          quoteId,
          recipientEmail,
          recipientName,
        },
      });

      if (error) throw error;

      toast.success(`E-post skickad till ${recipientEmail}!`);
      
      setShowEmailDialog(false);
      setRecipientEmail("");
      setRecipientName("");
      
      if (onStatusChanged) {
        onStatusChanged();
      }
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error(error.message || "Kunde inte skicka e-post. Försök igen.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleDeleteQuote = async () => {
    if (!quoteId) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', quoteId);

      if (error) throw error;

      toast.success("Offert raderad!");
      if (onDelete) {
        onDelete();
      }
    } catch (error: any) {
      console.error('Error deleting quote:', error);
      toast.error("Kunde inte radera offert");
    } finally {
      setIsDeleting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const checkPageBreak = (doc: jsPDF, currentY: number, requiredSpace: number): number => {
    const pageHeight = doc.internal.pageSize.height;
    const bottomMargin = 25; // Reserve space for footer
    
    if (currentY + requiredSpace > pageHeight - bottomMargin) {
      doc.addPage();
      return 20; // Reset to top margin
    }
    return currentY;
  };

  const handleExport = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const leftMargin = 20;
    const rightMargin = 20;
    const contentWidth = pageWidth - leftMargin - rightMargin;
    let y = 20;

    // Definiera färger i RGB (konverterade från HSL)
    const PRIMARY_BLUE = [58, 68, 204] as const; // #3A44CC
    const SECONDARY_GREEN = [74, 113, 81] as const; // #4A7151
    const ACCENT_GOLD = [210, 153, 78] as const; // #D2994E
    const BG_WARM = [246, 240, 230] as const; // #F6F0E6
    const TEXT_DARK = [27, 27, 27] as const; // #1B1B1B
    const LIGHT_GRAY = [227, 227, 227] as const; // Kanter

    // Sätt bakgrundsfärg för sidan
    doc.setFillColor(BG_WARM[0], BG_WARM[1], BG_WARM[2]);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Company information header with logo
    if (companySettings) {
      // Add logo if available
      if (logoImage) {
        try {
          doc.addImage(logoImage, 'PNG', leftMargin, y, 30, 30);
        } catch (error) {
          console.error('Error adding logo to PDF:', error);
        }
      }

      // Company info next to logo
      const companyX = logoImage ? 55 : leftMargin;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(companySettings.company_name || '', companyX, y + 5);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      let infoY = y + 10;
      
      if (companySettings.address) {
        doc.text(companySettings.address, companyX, infoY);
        infoY += 4;
      }
      if (companySettings.phone) {
        doc.text(`Tel: ${companySettings.phone}`, companyX, infoY);
        infoY += 4;
      }
      if (companySettings.email) {
        doc.text(`E-post: ${companySettings.email}`, companyX, infoY);
        infoY += 4;
      }
      if (companySettings.org_number) {
        doc.text(`Org.nr: ${companySettings.org_number}`, companyX, infoY);
        infoY += 4;
      }
      if (companySettings.vat_number) {
        doc.text(`Momsreg.nr: ${companySettings.vat_number}`, companyX, infoY);
        infoY += 4;
      }
      if (companySettings.has_f_skatt) {
        doc.text('F-skattsedel finns', companyX, infoY);
        infoY += 4;
      }

      y = Math.max(y + 35, infoY + 5);
      
      // Separator line
      doc.setDrawColor(200, 200, 200);
      doc.line(leftMargin, y, pageWidth - rightMargin, y);
      y += 12;
    }

    // Title
    y = checkPageBreak(doc, y, 15);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(SECONDARY_GREEN[0], SECONDARY_GREEN[1], SECONDARY_GREEN[2]); // Grön rubrik
    doc.text(quote.title, leftMargin, y);
    y += 15;

    // Work Items Section
    y = checkPageBreak(doc, y, 20);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(SECONDARY_GREEN[0], SECONDARY_GREEN[1], SECONDARY_GREEN[2]); // Grön rubrik
    doc.text('Arbetsmoment', leftMargin, y);
    y += 10;

    doc.setFontSize(10);
    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]); // Återgå till mörk text
    quote.workItems.forEach((item, index) => {
      // Check if we need a new page for this item (name + description + hours = ~25mm)
      y = checkPageBreak(doc, y, 25);
      
      // Light background for alternating items
      if (index % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(leftMargin, y - 4, contentWidth, 22, 'F');
      }
      
      // Item name and price
      doc.setFont('helvetica', 'bold');
      doc.text(item.name, leftMargin + 3, y);
      doc.text(formatCurrency(item.subtotal), pageWidth - rightMargin - 3, y, { align: 'right' });
      y += 5;
      
      // Description
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const splitDesc = doc.splitTextToSize(item.description, contentWidth - 10);
      doc.text(splitDesc, leftMargin + 3, y);
      y += Math.min(splitDesc.length * 4, 8);
      
      // Hours and rate
      doc.text(`${item.hours} timmar × ${formatCurrency(item.hourlyRate)}/tim`, leftMargin + 3, y);
      y += 12;
      
      doc.setFontSize(10);
    });

    y += 5;

    // Materials Section
    if (quote.materials && quote.materials.length > 0) {
      y = checkPageBreak(doc, y, 20);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(SECONDARY_GREEN[0], SECONDARY_GREEN[1], SECONDARY_GREEN[2]); // Grön rubrik
      doc.text('Material', leftMargin, y);
      y += 10;

      doc.setFontSize(10);
      doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
      quote.materials.forEach((item, index) => {
        y = checkPageBreak(doc, y, 18);
        
        if (index % 2 === 0) {
          doc.setFillColor(245, 245, 245);
          doc.rect(leftMargin, y - 4, contentWidth, 16, 'F');
        }
        
        // Material name and price
        doc.setFont('helvetica', 'bold');
        doc.text(item.name, leftMargin + 3, y);
        doc.text(formatCurrency(item.subtotal), pageWidth - rightMargin - 3, y, { align: 'right' });
        y += 5;
        
        // Quantity and unit price
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`${item.quantity} ${item.unit} × ${formatCurrency(item.pricePerUnit)}/${item.unit}`, leftMargin + 3, y);
        y += 10;
        
        doc.setFontSize(10);
      });

      y += 5;
    }

    // Summary Section
    y = checkPageBreak(doc, y, 65);
    y += 5;
    
    // Summary box
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(250, 250, 250);
    doc.setLineWidth(0.5);
    doc.roundedRect(leftMargin, y - 5, contentWidth, 60, 2, 2, 'FD');
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Sammanfattning', leftMargin + 5, y + 2);
    y += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Arbetskostnad', leftMargin + 5, y);
    doc.text(formatCurrency(quote.summary.workCost), pageWidth - rightMargin - 5, y, { align: 'right' });
    y += 6;
    
    doc.text('Materialkostnad', leftMargin + 5, y);
    doc.text(formatCurrency(quote.summary.materialCost), pageWidth - rightMargin - 5, y, { align: 'right' });
    y += 6;
    
    doc.setDrawColor(220, 220, 220);
    doc.line(leftMargin + 5, y, pageWidth - rightMargin - 5, y);
    y += 5;
    
    doc.text('Summa exkl. moms', leftMargin + 5, y);
    doc.text(formatCurrency(quote.summary.totalBeforeVAT), pageWidth - rightMargin - 5, y, { align: 'right' });
    y += 6;
    
    doc.text('Moms (25%)', leftMargin + 5, y);
    doc.text(formatCurrency(quote.summary.vat), pageWidth - rightMargin - 5, y, { align: 'right' });
    y += 6;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Totalt inkl. moms', leftMargin + 5, y);
    doc.text(formatCurrency(quote.summary.totalWithVAT), pageWidth - rightMargin - 5, y, { align: 'right' });
    y += 8;
    
    doc.setDrawColor(220, 220, 220);
    doc.line(leftMargin + 5, y, pageWidth - rightMargin - 5, y);
    y += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(34, 139, 34);
    doc.text('ROT-avdrag (50%)', leftMargin + 5, y);
    doc.text(`-${formatCurrency(quote.summary.rotDeduction)}`, pageWidth - rightMargin - 5, y, { align: 'right' });
    y += 8;
    
    // Highlight final amount
    doc.setFillColor(34, 197, 94, 20);
    doc.roundedRect(leftMargin + 3, y - 5, contentWidth - 6, 10, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('Kund betalar', leftMargin + 5, y);
    doc.text(formatCurrency(quote.summary.customerPays), pageWidth - rightMargin - 5, y, { align: 'right' });
    y += 15;

    // Reset text color
    doc.setTextColor(0, 0, 0);

    // Notes Section
    if (quote.notes) {
      const notesLines = doc.splitTextToSize(quote.notes, contentWidth - 10);
      const notesHeight = notesLines.length * 4 + 15;
      y = checkPageBreak(doc, y, notesHeight);
      y += 5;
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Anteckningar', leftMargin, y);
      y += 8;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(notesLines, leftMargin + 3, y);
    }

    // Add footer to all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Sida ${i} av ${totalPages} | Genererad: ${new Date().toLocaleDateString('sv-SE')}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    doc.save(`${quote.title}.pdf`);
    toast.success("PDF exporterad!");
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {quote.title}
            </CardTitle>
            <CardDescription className="mt-1">
              Genererad offert - granska och spara
            </CardDescription>
            
            {/* Status Manager - only show if we have quoteId and currentStatus */}
            {quoteId && currentStatus && (
              <div className="mt-4">
                <QuoteStatusManager
                  quoteId={quoteId}
                  currentStatus={currentStatus}
                  onStatusChanged={onStatusChanged}
                />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {quoteId && currentStatus && currentStatus !== "accepted" && currentStatus !== "rejected" && currentStatus !== "completed" && (
              <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
                <DialogTrigger asChild>
                  <Button variant="default" size="sm">
                    <Send className="h-4 w-4 mr-1" />
                    Skicka
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Skicka offert via e-post</DialogTitle>
                    <DialogDescription>
                      Ange mottagarens uppgifter för att skicka offerten.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="recipientName">Mottagarens namn</Label>
                      <Input
                        id="recipientName"
                        placeholder="Johan Andersson"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="recipientEmail">E-postadress</Label>
                      <Input
                        id="recipientEmail"
                        type="email"
                        placeholder="johan@example.com"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                      />
                    </div>
                    <Button 
                      onClick={handleSendEmail} 
                      className="w-full"
                      disabled={isSendingEmail}
                    >
                      {isSendingEmail ? "Skickar..." : "Skicka e-post"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
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
            {onSave && (
              <Button size="sm" onClick={onSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-1" />
                {isSaving ? "Sparar..." : "Spara"}
              </Button>
            )}
            {onClose && (
              <Button variant="outline" size="sm" onClick={onClose}>
                Stäng
              </Button>
            )}
            {quoteId && onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Radera
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Är du säker?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Detta kommer att permanent radera offerten "{quote.title}". 
                      Denna åtgärd kan inte ångras.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Avbryt</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDeleteQuote}
                      disabled={isDeleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? "Raderar..." : "Radera offert"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
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

      {/* Status Timeline - only show if we have quoteId */}
      {quoteId && (
        <div className="px-6 pb-6">
          <Collapsible open={showTimeline} onOpenChange={setShowTimeline}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
              <ChevronDown className={`h-4 w-4 transition-transform ${showTimeline ? 'rotate-180' : ''}`} />
              Visa statushistorik
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4">
              <QuoteStatusTimeline quoteId={quoteId} />
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </Card>
  );
};

export default QuoteDisplay;