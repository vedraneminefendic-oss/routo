import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { FileText, Building2, Mail, Phone, MapPin, CheckCircle2, XCircle, Loader2, Download, AlertCircle, Pen } from "lucide-react";
import jsPDF from "jspdf";
import { z } from "zod";
import { SignatureCanvas } from "@/components/SignatureCanvas";

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
  rotDeduction?: number;
  rutDeduction?: number;
  deductionAmount?: number;
  deductionType?: 'rot' | 'rut' | 'none';
  customerPays: number;
}

interface QuoteData {
  title: string;
  workItems: WorkItem[];
  materials: Material[];
  summary: Summary;
  notes?: string;
}

interface QuoteInfo {
  id: string;
  title: string;
  description: string;
  generated_quote: QuoteData;
  edited_quote: QuoteData | null;
  is_edited: boolean;
  status: string;
  created_at: string;
  company_name: string;
  company_email: string;
  company_phone: string;
  company_address: string;
  company_logo_url: string;
  customer_id: string | null;
  customer_name: string | null;
  // PII fields removed for security - customers must enter their own details
  customer_property_designation: string | null;
}

const PublicQuote = () => {
  const { token } = useParams<{ token: string }>();
  const [quote, setQuote] = useState<QuoteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasViewed, setHasViewed] = useState(false);
  
  // Form state
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signerPersonnummer, setSignerPersonnummer] = useState("");
  const [propertyDesignation, setPropertyDesignation] = useState("");
  const [message, setMessage] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [response, setResponse] = useState<"accepted" | "rejected" | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);

  // Input validation schema
  const quoteResponseSchema = z.object({
    signerName: z.string().trim().min(1, "Namn krävs").max(100, "Namn får vara max 100 tecken"),
    signerEmail: z.string().trim().email("Ogiltig e-postadress").max(255, "E-post får vara max 255 tecken"),
    signerPersonnummer: z.string().regex(/^\d{6,8}-?\d{4}$/, "Ogiltigt personnummer (ÅÅÅÅMMDD-XXXX)").optional().or(z.literal('')),
    propertyDesignation: z.string().max(100, "Fastighetsbeteckning får vara max 100 tecken").optional().or(z.literal('')),
    message: z.string().max(1000, "Meddelande får vara max 1000 tecken").optional().or(z.literal(''))
  });

  useEffect(() => {
    if (token) {
      loadQuote();
    }
  }, [token]);

  const loadQuote = async () => {
    try {
      setLoading(true);

      // Use the public function to get quote by token
      const { data, error } = await supabase.rpc("get_quote_by_token", {
        token_param: token,
      });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error("Offerten kunde inte hittas");
        return;
      }

      const quoteInfo = data[0] as unknown as QuoteInfo;
      setQuote(quoteInfo);

      // Pre-fill customer information if available
      if (quoteInfo.customer_name) {
        setSignerName(quoteInfo.customer_name);
      }

      // Log view if not already viewed
      if (!hasViewed) {
        await logView(quoteInfo.id);
        setHasViewed(true);
      }
    } catch (error: any) {
      console.error("Error loading quote:", error);
      toast.error("Kunde inte ladda offerten");
    } finally {
      setLoading(false);
    }
  };

  const logView = async (quoteId: string) => {
    try {
      const userAgent = navigator.userAgent;
      const clientIP = "unknown"; // Browser can't access real IP for security reasons
      
      // Check if this IP/user-agent combo has viewed this quote in the last hour
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      
      const { data: recentView } = await supabase
        .from("quote_views")
        .select("id")
        .eq("quote_id", quoteId)
        .eq("ip_address", clientIP)
        .eq("user_agent", userAgent)
        .gte("viewed_at", oneHourAgo)
        .single();
      
      // Only log if no recent view from same IP/user-agent
      if (!recentView) {
        await supabase.from("quote_views").insert({
          quote_id: quoteId,
          ip_address: clientIP,
          user_agent: userAgent,
        });
      }
    } catch (error) {
      // Ignore errors for deduplication check (single() throws if no match)
      if (error && typeof error === 'object' && 'code' in error && error.code === 'PGRST116') {
        // No recent view found, insert new view
        try {
          await supabase.from("quote_views").insert({
            quote_id: quoteId,
            ip_address: "unknown",
            user_agent: navigator.userAgent,
          });
        } catch (insertError) {
          console.error("Error logging view:", insertError);
        }
      } else {
        console.error("Error checking recent views:", error);
      }
    }
  };

  const handleSubmit = async () => {
    if (!quote) return;

    // Detect if quote has ROT/RUT deduction
    const quoteData = quote.edited_quote || quote.generated_quote;
    const hasRotRutDeduction = (quoteData.summary?.rotDeduction && quoteData.summary.rotDeduction > 0) || 
                                (quoteData.summary?.rutDeduction && quoteData.summary.rutDeduction > 0) ||
                                (quoteData.summary?.deductionAmount && quoteData.summary.deductionAmount > 0);

    // Customers must now enter their own details for security
    const finalSignerName = signerName || quote.customer_name || "";
    const finalSignerEmail = signerEmail || "";
    const finalPersonnummer = signerPersonnummer || "";
    const finalPropertyDesignation = propertyDesignation || quote.customer_property_designation || "";

    // Enhanced validation schema for ROT/RUT
    const rotRutSchema = z.object({
      signerName: z.string().trim().min(1, "Namn krävs").max(100, "Namn får vara max 100 tecken"),
      signerEmail: z.string().trim().email("Ogiltig e-postadress").max(255, "E-post får vara max 255 tecken"),
      signerPersonnummer: z.string().regex(/^\d{6,8}-?\d{4}$/, "Ogiltigt personnummer (ÅÅÅÅMMDD-XXXX)"),
      propertyDesignation: z.string().max(100, "Fastighetsbeteckning får vara max 100 tecken").optional().or(z.literal('')),
      message: z.string().max(1000, "Meddelande får vara max 1000 tecken").optional().or(z.literal(''))
    });

    // Validate inputs with zod - require personnummer for ROT/RUT
    const validation = hasRotRutDeduction 
      ? rotRutSchema.safeParse({
          signerName: finalSignerName,
          signerEmail: finalSignerEmail,
          signerPersonnummer: finalPersonnummer,
          propertyDesignation: finalPropertyDesignation,
          message
        })
      : quoteResponseSchema.safeParse({
          signerName: finalSignerName,
          signerEmail: finalSignerEmail,
          signerPersonnummer: finalPersonnummer,
          propertyDesignation: finalPropertyDesignation,
          message
        });

    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return;
    }

    if (!response) {
      toast.error("Vänligen välj om du accepterar eller avvisar offerten");
      return;
    }

    if (response === "accepted" && !acceptTerms) {
      toast.error("Du måste acceptera villkoren för att fortsätta");
      return;
    }

    if (response === "accepted" && !signatureData) {
      toast.error("Du måste signera offerten");
      return;
    }

    setSubmitting(true);

    try {
      // Insert signature using final values
      const { error: signatureError } = await supabase.from("quote_signatures").insert({
        quote_id: quote.id,
        signer_name: finalSignerName,
        signer_email: finalSignerEmail,
        signer_personnummer: finalPersonnummer || null,
        property_designation: finalPropertyDesignation || null,
        response: response,
        ip_address: "unknown",
        user_agent: navigator.userAgent,
        message: message || null,
        signature_data: signatureData || null,
      });

      if (signatureError) throw signatureError;

      // Update quote status via edge function
      const { error: processError } = await supabase.functions.invoke("process-quote-signature", {
        body: {
          quoteId: quote.id,
          response: response,
        },
      });

      if (processError) {
        console.error("Error processing signature:", processError);
        // Don't fail the whole operation if status update fails
      }

      toast.success(
        response === "accepted"
          ? "Tack! Du har accepterat offerten"
          : "Tack för ditt svar. Vi hör av oss inom kort."
      );

      // Clear form
      setSignerName("");
      setSignerEmail("");
      setSignerPersonnummer("");
      setPropertyDesignation("");
      setMessage("");
      setAcceptTerms(false);
      setResponse(null);
      setSignatureData(null);
      setShowSignature(false);
    } catch (error: any) {
      console.error("Error submitting signature:", error);
      toast.error("Kunde inte spara ditt svar. Försök igen.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("sv-SE", {
      style: "currency",
      currency: "SEK",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleDownloadPDF = () => {
    if (!quote) return;

    const quoteData = quote.edited_quote || quote.generated_quote;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let y = 20;

    // Company header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(quote.company_name || "Offert", 20, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    if (quote.company_address) {
      doc.text(quote.company_address, 20, y);
      y += 5;
    }
    if (quote.company_phone) {
      doc.text(`Tel: ${quote.company_phone}`, 20, y);
      y += 5;
    }
    if (quote.company_email) {
      doc.text(`E-post: ${quote.company_email}`, 20, y);
      y += 5;
    }

    y += 10;

    // Quote title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(quoteData.title, 20, y);
    y += 15;

    // Work items
    doc.setFontSize(14);
    doc.text("Arbetsmoment", 20, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    quoteData.workItems.forEach((item) => {
      doc.setFont("helvetica", "bold");
      doc.text(item.name, 20, y);
      doc.text(formatCurrency(item.subtotal), pageWidth - 40, y, { align: "right" });
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const descLines = doc.splitTextToSize(item.description, pageWidth - 50);
      doc.text(descLines, 20, y);
      y += descLines.length * 4;

      doc.text(`${item.hours} timmar × ${formatCurrency(item.hourlyRate)}/tim`, 20, y);
      y += 8;
      doc.setFontSize(10);
    });

    y += 5;

    // Materials
    if (quoteData.materials && quoteData.materials.length > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Material", 20, y);
      y += 10;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      quoteData.materials.forEach((material) => {
        doc.setFont("helvetica", "bold");
        doc.text(material.name, 20, y);
        doc.text(formatCurrency(material.subtotal), pageWidth - 40, y, { align: "right" });
        y += 5;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(
          `${material.quantity} ${material.unit} × ${formatCurrency(material.pricePerUnit)}/${material.unit}`,
          20,
          y
        );
        y += 8;
        doc.setFontSize(10);
      });

      y += 5;
    }

    // Summary
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Sammanfattning", 20, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Arbetskostnad", 20, y);
    doc.text(formatCurrency(quoteData.summary.workCost), pageWidth - 40, y, { align: "right" });
    y += 6;

    doc.text("Materialkostnad", 20, y);
    doc.text(formatCurrency(quoteData.summary.materialCost), pageWidth - 40, y, { align: "right" });
    y += 6;

    doc.text("Summa exkl. moms", 20, y);
    doc.text(formatCurrency(quoteData.summary.totalBeforeVAT), pageWidth - 40, y, { align: "right" });
    y += 6;

    doc.text("Moms (25%)", 20, y);
    doc.text(formatCurrency(quoteData.summary.vat), pageWidth - 40, y, { align: "right" });
    y += 6;

    doc.setFont("helvetica", "bold");
    doc.text("Totalt inkl. moms", 20, y);
    doc.text(formatCurrency(quoteData.summary.totalWithVAT), pageWidth - 40, y, { align: "right" });
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(34, 139, 34);
    doc.text("ROT-avdrag (50%)", 20, y);
    doc.text(`-${formatCurrency(quoteData.summary.rotDeduction)}`, pageWidth - 40, y, { align: "right" });
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Kund betalar", 20, y);
    doc.text(formatCurrency(quoteData.summary.customerPays), pageWidth - 40, y, { align: "right" });

    doc.save(`${quoteData.title}.pdf`);
    toast.success("PDF nedladdad!");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Laddar offert...</p>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Offert hittades inte</CardTitle>
            <CardDescription>
              Den här offerten finns inte eller har tagits bort.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const quoteData = quote.edited_quote || quote.generated_quote;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Company Header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {quote.company_logo_url && (
                  <img
                    src={quote.company_logo_url}
                    alt="Company logo"
                    className="h-16 mb-4"
                  />
                )}
                <CardTitle className="text-2xl text-secondary">{quote.company_name}</CardTitle>
                <CardDescription className="mt-2 space-y-1">
                  {quote.company_address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {quote.company_address}
                    </div>
                  )}
                  {quote.company_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {quote.company_phone}
                    </div>
                  )}
                  {quote.company_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {quote.company_email}
                    </div>
                  )}
                </CardDescription>
              </div>
              <Button onClick={handleDownloadPDF} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Ladda ner PDF
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Customer Information */}
        {quote.customer_name && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-secondary">Kundinformation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quote.customer_name && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Namn</p>
                    <p className="text-base">{quote.customer_name}</p>
                  </div>
                )}
                {quote.customer_property_designation && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Fastighetsbeteckning</p>
                    <p className="text-base">{quote.customer_property_designation}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quote Details */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-secondary">
                  <FileText className="h-5 w-5 text-primary" />
                  {quoteData.title}
                </CardTitle>
                <CardDescription className="mt-1">
                  Skapad {new Date(quote.created_at).toLocaleDateString("sv-SE")}
                </CardDescription>
              </div>
              <Badge variant={quote.status === "sent" ? "default" : "secondary"}>
                {quote.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Work Items */}
            <div>
              <h3 className="font-semibold text-lg mb-3 text-secondary">Arbetsmoment</h3>
              <div className="space-y-3">
                {quoteData.workItems.map((item, index) => (
                  <div key={index} className="bg-muted/30 border border-border rounded-lg p-4">
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
            {quoteData.materials && quoteData.materials.length > 0 && (
              <>
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-secondary">Material</h3>
                  <div className="space-y-3">
                    {quoteData.materials.map((material, index) => (
                      <div key={index} className="bg-muted/30 border border-border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{material.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {material.quantity} {material.unit} ×{" "}
                              {formatCurrency(material.pricePerUnit)}/{material.unit}
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
              </>
            )}

            {/* Summary */}
            <div className="bg-secondary/5 rounded-lg p-6 border border-secondary/10">
              <h3 className="font-semibold text-lg mb-4 text-secondary">Sammanfattning</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Arbetskostnad</span>
                  <span className="font-medium">{formatCurrency(quoteData.summary.workCost)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Materialkostnad</span>
                  <span className="font-medium">{formatCurrency(quoteData.summary.materialCost)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between text-sm">
                  <span>Summa exkl. moms</span>
                  <span className="font-medium">{formatCurrency(quoteData.summary.totalBeforeVAT)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Moms (25%)</span>
                  <span className="font-medium">{formatCurrency(quoteData.summary.vat)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Totalt inkl. moms</span>
                  <span>{formatCurrency(quoteData.summary.totalWithVAT)}</span>
                </div>
                <Separator className="my-3" />
                <div className="flex justify-between text-accent">
                  <span className="font-medium">ROT-avdrag (50%)</span>
                  <span className="font-semibold">-{formatCurrency(quoteData.summary.rotDeduction)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-primary">
                  <span>Kund betalar</span>
                  <span>{formatCurrency(quoteData.summary.customerPays)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {quoteData.notes && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold text-sm mb-2">Anteckningar</h3>
                  <p className="text-sm text-muted-foreground">{quoteData.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Response Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-secondary">Svara på offerten</CardTitle>
            <CardDescription>
              Fyll i dina uppgifter och välj om du accepterar eller avvisar offerten
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const quoteData = quote.edited_quote || quote.generated_quote;
              const hasRotRut = (quoteData.summary?.rotDeduction && quoteData.summary.rotDeduction > 0) || 
                               (quoteData.summary?.rutDeduction && quoteData.summary.rutDeduction > 0) ||
                               (quoteData.summary?.deductionAmount && quoteData.summary.deductionAmount > 0);
              return hasRotRut ? (
                <Alert className="bg-muted/50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>ROT/RUT-avdrag kräver personnummer</AlertTitle>
                  <AlertDescription>
                    Denna offert innehåller skatteavdrag. För att kunna godkänna offerten måste du ange ditt personnummer så att avdraget kan rapporteras till Skatteverket.
                  </AlertDescription>
                </Alert>
              ) : null;
            })()}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="signerName">Namn *</Label>
                <Input
                  id="signerName"
                  placeholder="För- och efternamn"
                  value={signerName || quote.customer_name || ""}
                  onChange={(e) => setSignerName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signerEmail">E-postadress *</Label>
                <Input
                  id="signerEmail"
                  type="email"
                  placeholder="din@email.com"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="signerPersonnummer">
                  Personnummer{(() => {
                    const quoteData = quote.edited_quote || quote.generated_quote;
                    const hasRotRut = (quoteData.summary?.rotDeduction && quoteData.summary.rotDeduction > 0) || 
                                     (quoteData.summary?.rutDeduction && quoteData.summary.rutDeduction > 0) ||
                                     (quoteData.summary?.deductionAmount && quoteData.summary.deductionAmount > 0);
                    return hasRotRut ? ' *' : ' (valfritt)';
                  })()}
                </Label>
                <Input
                  id="signerPersonnummer"
                  placeholder="ÅÅÅÅMMDD-XXXX"
                  value={signerPersonnummer}
                  onChange={(e) => setSignerPersonnummer(e.target.value)}
                />
                {(() => {
                  const quoteData = quote.edited_quote || quote.generated_quote;
                  const hasRotRut = (quoteData.summary?.rotDeduction && quoteData.summary.rotDeduction > 0) || 
                                   (quoteData.summary?.rutDeduction && quoteData.summary.rutDeduction > 0) ||
                                   (quoteData.summary?.deductionAmount && quoteData.summary.deductionAmount > 0);
                  return hasRotRut ? (
                    <p className="text-xs text-muted-foreground">
                      Personnummer krävs för ROT/RUT-avdrag
                    </p>
                  ) : null;
                })()}
              </div>
              <div className="space-y-2">
                <Label htmlFor="propertyDesignation">Fastighetsbeteckning (valfritt)</Label>
                <Input
                  id="propertyDesignation"
                  placeholder="T.ex. Uppsala 1:1"
                  value={propertyDesignation || quote.customer_property_designation || ""}
                  onChange={(e) => setPropertyDesignation(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Meddelande (valfritt)</Label>
              <Textarea
                id="message"
                placeholder="Eventuella kommentarer eller frågor..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
            </div>

            <Separator />

            {/* Response Selection */}
            <div className="space-y-4">
              <Label className="text-base">Ditt svar</Label>
              <div className="space-y-3">
                <div
                  className={`flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    response === "accepted"
                      ? "border-secondary/20 bg-secondary/10"
                      : "border-muted hover:border-secondary/40"
                  }`}
                  onClick={() => setResponse("accepted")}
                >
                  <Checkbox
                    checked={response === "accepted"}
                    onCheckedChange={(checked) => setResponse(checked ? "accepted" : null)}
                    className="data-[state=checked]:bg-secondary data-[state=checked]:border-secondary"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-secondary" />
                      <span className="font-semibold">Jag accepterar offerten</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Jag godkänner villkoren och vill gå vidare med projektet
                    </p>
                  </div>
                </div>

                <div
                  className={`flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    response === "rejected"
                      ? "border-red-500 bg-red-50 dark:bg-red-950"
                      : "border-muted hover:border-red-300"
                  }`}
                  onClick={() => setResponse("rejected")}
                >
                  <Checkbox
                    checked={response === "rejected"}
                    onCheckedChange={(checked) => setResponse(checked ? "rejected" : null)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="font-semibold">Jag avvisar offerten</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Jag är inte intresserad av att gå vidare just nu
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms acceptance and signature */}
            {response === "accepted" && (
              <>
                <div className="flex items-start space-x-3 p-4 bg-muted/50 rounded-lg">
                  <Checkbox
                    id="acceptTerms"
                    checked={acceptTerms}
                    onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="acceptTerms"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Jag accepterar villkoren
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Genom att acceptera bekräftar jag att jag har läst och förstått offerten
                      och är överens om priset och villkoren.
                    </p>
                  </div>
                </div>

                {/* Digital Signature */}
                <div className="space-y-2">
                  <Label className="text-base">Digital signatur *</Label>
                  {!showSignature && !signatureData && (
                    <Button
                      variant="outline"
                      onClick={() => setShowSignature(true)}
                      className="w-full"
                    >
                      <Pen className="h-4 w-4 mr-2" />
                      Signera offerten
                    </Button>
                  )}
                  
                  {showSignature && !signatureData && (
                    <SignatureCanvas
                      onSave={(signature) => {
                        setSignatureData(signature);
                        setShowSignature(false);
                        toast.success("Signatur sparad");
                      }}
                      onCancel={() => setShowSignature(false)}
                    />
                  )}

                  {signatureData && !showSignature && (
                    <div className="space-y-2">
                      <div className="border-2 border-border rounded-md p-2 bg-background">
                        <img 
                          src={signatureData} 
                          alt="Din signatur" 
                          className="h-24 mx-auto"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSignatureData(null);
                          setShowSignature(true);
                        }}
                        className="w-full"
                      >
                        Signera om
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}

            <Button
              onClick={handleSubmit}
              disabled={submitting || !response}
              className="w-full"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Skickar svar...
                </>
              ) : (
                <>
                  {response === "accepted" ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Acceptera offert
                    </>
                  ) : response === "rejected" ? (
                    <>
                      <XCircle className="mr-2 h-4 w-4" />
                      Avvisa offert
                    </>
                  ) : (
                    "Välj ett alternativ ovan"
                  )}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PublicQuote;
