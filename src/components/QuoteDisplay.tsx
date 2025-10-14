import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileText, Download, Save, Edit, Send, ChevronDown, Trash2, Copy, Hammer, Sparkles } from "lucide-react";
import { AIInsightBadge } from "@/components/AIInsightBadge";
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
import { AIProgressIndicator } from "./AIProgressIndicator";

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
  rotDeduction?: number; // Legacy field
  rutDeduction?: number; // Legacy field
  deductionAmount?: number; // New field
  deductionType?: 'rot' | 'rut' | 'none'; // New field
  customerPays: number;
}

interface Quote {
  title: string;
  workItems: WorkItem[];
  materials: Material[];
  summary: Summary;
  notes?: string;
  deductionType?: 'rot' | 'rut' | 'none';
}

interface QuoteDisplayProps {
  quote: Quote;
  onSave?: () => void;
  onEdit?: () => void;
  onClose?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  isSaving: boolean;
  quoteId?: string;
  currentStatus?: QuoteStatus;
  onStatusChanged?: () => void;
  hasCustomRates?: boolean;
  hourlyRate?: number;
}

const QuoteDisplay = ({ 
  quote, 
  onSave, 
  onEdit, 
  onClose, 
  onDelete,
  onDuplicate,
  isSaving, 
  quoteId, 
  currentStatus,
  onStatusChanged,
  hasCustomRates,
  hourlyRate
}: QuoteDisplayProps) => {
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<any>(null);

  useEffect(() => {
    loadCompanySettings();
  }, []);

  useEffect(() => {
    if (quoteId) {
      loadCustomerInfo();
    }
  }, [quoteId]);

  const loadCustomerInfo = async () => {
    if (!quoteId) return;

    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          customer_id,
          customers (
            name,
            email,
            phone,
            address,
            personnummer,
            property_designation
          )
        `)
        .eq('id', quoteId)
        .single();

      if (error) throw error;

      if (data?.customers) {
        setCustomerInfo(data.customers);
        // Auto-fill email dialog with customer info
        setRecipientName(data.customers.name || "");
        setRecipientEmail(data.customers.email || "");
      }
    } catch (error) {
      console.error('Error loading customer info:', error);
    }
  };

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

  // Support both old and new deduction field names
  const deductionAmount = quote.summary.deductionAmount ?? quote.summary.rotDeduction ?? quote.summary.rutDeduction ?? 0;
  const deductionType = quote.summary.deductionType || quote.deductionType || 'rot';
  const maxDeduction = deductionType === 'rut' ? 75000 : 50000;

  const checkPageBreak = (doc: jsPDF, currentY: number, requiredSpace: number): number => {
    const pageHeight = doc.internal.pageSize.height;
    const bottomMargin = 25;
    
    if (currentY + requiredSpace > pageHeight - bottomMargin) {
      doc.addPage();
      return 20;
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

    const PRIMARY_BLUE = [58, 68, 204] as const;
    const SECONDARY_GREEN = [74, 113, 81] as const;
    const ACCENT_GOLD = [210, 153, 78] as const;
    const BG_WARM = [246, 240, 230] as const;
    const TEXT_DARK = [27, 27, 27] as const;
    const LIGHT_GRAY = [227, 227, 227] as const;

    doc.setFillColor(BG_WARM[0], BG_WARM[1], BG_WARM[2]);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    if (companySettings) {
      if (logoImage) {
        try {
          doc.addImage(logoImage, 'PNG', leftMargin, y, 30, 30);
        } catch (error) {
          console.error('Error adding logo to PDF:', error);
        }
      }

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
      
      doc.setDrawColor(200, 200, 200);
      doc.line(leftMargin, y, pageWidth - rightMargin, y);
      y += 12;
    }

    if (customerInfo) {
      y = checkPageBreak(doc, y, 30);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(PRIMARY_BLUE[0], PRIMARY_BLUE[1], PRIMARY_BLUE[2]);
      doc.text('Kund', leftMargin, y);
      y += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
      
      if (customerInfo.name) {
        doc.setFont('helvetica', 'bold');
        doc.text(customerInfo.name, leftMargin, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
      }
      if (customerInfo.address) {
        doc.text(customerInfo.address, leftMargin, y);
        y += 5;
      }
      if (customerInfo.phone) {
        doc.text(`Tel: ${customerInfo.phone}`, leftMargin, y);
        y += 5;
      }
      if (customerInfo.email) {
        doc.text(`E-post: ${customerInfo.email}`, leftMargin, y);
        y += 5;
      }
      if (customerInfo.personnummer) {
        doc.text(`Personnummer: ${customerInfo.personnummer}`, leftMargin, y);
        y += 5;
      }
      if (customerInfo.property_designation) {
        doc.text(`Fastighetsbeteckning: ${customerInfo.property_designation}`, leftMargin, y);
        y += 5;
      }
      
      y += 5;
      doc.setDrawColor(200, 200, 200);
      doc.line(leftMargin, y, pageWidth - rightMargin, y);
      y += 12;
    }

    y = checkPageBreak(doc, y, 15);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(SECONDARY_GREEN[0], SECONDARY_GREEN[1], SECONDARY_GREEN[2]);
    doc.text(quote.title, leftMargin, y);
    y += 15;

    y = checkPageBreak(doc, y, 20);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(SECONDARY_GREEN[0], SECONDARY_GREEN[1], SECONDARY_GREEN[2]);
    doc.text('Arbetsmoment', leftMargin, y);
    y += 10;

    doc.setFontSize(10);
    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    quote.workItems.forEach((item, index) => {
      y = checkPageBreak(doc, y, 25);
      
      if (index % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(leftMargin, y - 4, contentWidth, 22, 'F');
      }
      
      doc.setFont('helvetica', 'bold');
      doc.text(item.name, leftMargin + 3, y);
      doc.text(formatCurrency(item.subtotal), pageWidth - rightMargin - 3, y, { align: 'right' });
      y += 5;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const splitDesc = doc.splitTextToSize(item.description, contentWidth - 10);
      doc.text(splitDesc, leftMargin + 3, y);
      y += Math.min(splitDesc.length * 4, 8);
      
      doc.text(`${item.hours} timmar × ${formatCurrency(item.hourlyRate)}/tim`, leftMargin + 3, y);
      y += 12;
      
      doc.setFontSize(10);
    });

    y += 5;

    if (quote.materials && quote.materials.length > 0) {
      y = checkPageBreak(doc, y, 20);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(SECONDARY_GREEN[0], SECONDARY_GREEN[1], SECONDARY_GREEN[2]);
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
        
        doc.setFont('helvetica', 'bold');
        doc.text(item.name, leftMargin + 3, y);
        doc.text(formatCurrency(item.subtotal), pageWidth - rightMargin - 3, y, { align: 'right' });
        y += 5;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`${item.quantity} ${item.unit} × ${formatCurrency(item.pricePerUnit)}/${item.unit}`, leftMargin + 3, y);
        y += 10;
        
        doc.setFontSize(10);
      });

      y += 5;
    }

    y = checkPageBreak(doc, y, 65);
    y += 5;
    
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
    
    const summaryX = pageWidth - rightMargin - 5;
    doc.text('Arbetskostnad:', leftMargin + 5, y);
    doc.text(formatCurrency(quote.summary.workCost), summaryX, y, { align: 'right' });
    y += 6;

    doc.text('Materialkostnad:', leftMargin + 5, y);
    doc.text(formatCurrency(quote.summary.materialCost), summaryX, y, { align: 'right' });
    y += 6;

    doc.setDrawColor(200, 200, 200);
    doc.line(leftMargin + 5, y, pageWidth - rightMargin - 5, y);
    y += 6;

    doc.text('Summa före moms:', leftMargin + 5, y);
    doc.text(formatCurrency(quote.summary.totalBeforeVAT), summaryX, y, { align: 'right' });
    y += 6;

    doc.text('Moms (25%):', leftMargin + 5, y);
    doc.text(formatCurrency(quote.summary.vat), summaryX, y, { align: 'right' });
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.text('Totalt inkl. moms:', leftMargin + 5, y);
    doc.text(formatCurrency(quote.summary.totalWithVAT), summaryX, y, { align: 'right' });
    y += 8;

    if (deductionAmount > 0) {
      doc.setFont('helvetica', 'normal');
      const deductionLabel = deductionType === 'rut' ? 'RUT-avdrag (50%)' : 'ROT-avdrag (50%)';
      doc.text(`${deductionLabel}:`, leftMargin + 5, y);
      doc.text(`-${formatCurrency(deductionAmount)}`, summaryX, y, { align: 'right' });
      y += 6;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Att betala:', leftMargin + 5, y);
      doc.text(formatCurrency(quote.summary.customerPays), summaryX, y, { align: 'right' });
    }

    if (quote.notes) {
      const notesY = y + 15;
      const finalY = checkPageBreak(doc, notesY, 30);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Anteckningar', leftMargin, finalY);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const splitNotes = doc.splitTextToSize(quote.notes, contentWidth);
      doc.text(splitNotes, leftMargin, finalY + 7);
    }

    const addFooter = (pageNum: number, totalPages: number) => {
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      const footerY = pageHeight - 15;
      doc.text(
        `Sida ${pageNum} av ${totalPages}`,
        pageWidth / 2,
        footerY,
        { align: 'center' }
      );
      doc.text(
        `Genererad: ${new Date().toLocaleDateString('sv-SE')}`,
        pageWidth - rightMargin,
        footerY,
        { align: 'right' }
      );
    };

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addFooter(i, totalPages);
    }

    doc.save(`offert-${quote.title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
    toast.success("PDF-fil har laddats ner!");
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
            
            <div className="mt-3">
              <AIInsightBadge 
                deductionType={quote.deductionType} 
                hasCustomRates={hasCustomRates}
                hourlyRate={hourlyRate}
              />
            </div>
            
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

        {/* Materials */}
        {quote.materials && quote.materials.length > 0 && (
          <div>
            <h3 className="font-semibold text-lg mb-3">Material</h3>
            <div className="space-y-3">
              {quote.materials.map((item, index) => (
                <div key={index} className="bg-muted/50 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium">{item.name}</h4>
                    <span className="font-semibold whitespace-nowrap ml-4">
                      {formatCurrency(item.subtotal)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.quantity} {item.unit} × {formatCurrency(item.pricePerUnit)}/{item.unit}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Summary */}
        <div className="bg-muted/30 rounded-lg p-6">
          <h3 className="font-semibold text-lg mb-4">Sammanfattning</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Arbetskostnad:</span>
              <span>{formatCurrency(quote.summary.workCost)}</span>
            </div>
            <div className="flex justify-between">
              <span>Materialkostnad:</span>
              <span>{formatCurrency(quote.summary.materialCost)}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span>Summa före moms:</span>
              <span>{formatCurrency(quote.summary.totalBeforeVAT)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Moms (25%):</span>
              <span>{formatCurrency(quote.summary.vat)}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg">
              <span>Totalt inkl. moms:</span>
              <span>{formatCurrency(quote.summary.totalWithVAT)}</span>
            </div>
            {deductionAmount > 0 && (
              <>
                <Separator />
                <div className="flex justify-between text-primary">
                  <span>{deductionType === 'rut' ? 'RUT' : 'ROT'}-avdrag (50%):</span>
                  <span>-{formatCurrency(deductionAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-xl text-primary">
                  <span>Att betala:</span>
                  <span>{formatCurrency(quote.summary.customerPays)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Max {deductionType === 'rut' ? 'RUT' : 'ROT'}-avdrag: {formatCurrency(maxDeduction)} per person och år
                </p>
              </>
            )}
          </div>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div className="bg-muted/30 rounded-lg p-6">
            <h3 className="font-semibold text-lg mb-3">Anteckningar</h3>
            <p className="text-sm whitespace-pre-wrap">{quote.notes}</p>
          </div>
        )}

        {/* Status Timeline */}
        {quoteId && (
          <div>
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
      </CardContent>

      {/* Sticky Action Footer */}
      <div className="sticky bottom-0 z-10 bg-card/95 backdrop-blur-sm border-t shadow-lg p-4">
        <div className="flex flex-wrap gap-2">
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
                  {customerInfo && (
                    <div className="bg-muted/50 rounded-lg p-4 mb-4">
                      <p className="text-sm font-medium mb-2">Kundinformation (auto-ifylld)</p>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p><strong>Namn:</strong> {customerInfo.name}</p>
                        <p><strong>E-post:</strong> {customerInfo.email}</p>
                        {customerInfo.phone && <p><strong>Telefon:</strong> {customerInfo.phone}</p>}
                        {customerInfo.address && <p><strong>Adress:</strong> {customerInfo.address}</p>}
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="recipientName">Mottagarens namn</Label>
                    <Input
                      id="recipientName"
                      placeholder="Johan Andersson"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      disabled={!!customerInfo}
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
                      disabled={!!customerInfo}
                    />
                  </div>
                  {!customerInfo && (
                    <p className="text-sm text-muted-foreground">
                      Tips: Om du kopplar en kund till offerten fylls uppgifterna i automatiskt.
                    </p>
                  )}
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
          {onDuplicate && (
            <Button variant="outline" size="sm" onClick={onDuplicate}>
              <Copy className="h-4 w-4 mr-1" />
              Duplicera
            </Button>
          )}
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
    </Card>
  );
};

export default QuoteDisplay;
