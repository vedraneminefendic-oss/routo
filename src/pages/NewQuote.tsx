import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, LogOut, Settings as SettingsIcon, BarChart3, Users, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import QuoteForm from "@/components/QuoteForm";
import QuoteDisplay from "@/components/QuoteDisplay";
import QuoteEditor from "@/components/QuoteEditor";
import { QuoteTemplates, QuoteTemplate } from "@/components/QuoteTemplates";
import { ContextualHelp } from "@/components/ContextualHelp";
import { AIProgressIndicator } from "@/components/AIProgressIndicator";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const NewQuote = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const showTemplates = searchParams.get('templates') === 'true';
  
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentQuote, setCurrentQuote] = useState<any>(null);
  const [currentDescription, setCurrentDescription] = useState("");
  const [currentCustomerId, setCurrentCustomerId] = useState<string | undefined>(undefined);
  const [showTemplatesSection, setShowTemplatesSection] = useState(showTemplates);
  const [hasCustomRates, setHasCustomRates] = useState(false);
  const [hourlyRate, setHourlyRate] = useState<number>(650);
  const [useChatInterface, setUseChatInterface] = useState(false);
  const [chatGeneratedQuote, setChatGeneratedQuote] = useState<any>(null);
  
  // Quality/validation state
  const [qualityWarning, setQualityWarning] = useState<string | undefined>(undefined);
  const [warningMessage, setWarningMessage] = useState<string | undefined>(undefined);
  const [realismWarnings, setRealismWarnings] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // Reference metadata
  const [usedReference, setUsedReference] = useState<boolean | undefined>(undefined);
  const [referenceTitle, setReferenceTitle] = useState<string | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleGenerateQuote = async (description: string, customerId?: string, detailLevel?: string, deductionType?: string, referenceQuoteId?: string) => {
    setIsGenerating(true);
    setCurrentDescription(description);
    setCurrentCustomerId(customerId);
    
    // Reset quality warnings
    setQualityWarning(undefined);
    setWarningMessage(undefined);
    setRealismWarnings([]);
    setValidationErrors([]);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-quote', {
        body: { 
          description,
          user_id: user?.id,
          customer_id: customerId,
          detailLevel: detailLevel || 'standard',
          deductionType: deductionType || 'auto',
          referenceQuoteId: referenceQuoteId
        }
      });

      if (error) throw error;
      
      // Ensure deductionType is set on the quote object
      const quoteWithDeduction = {
        ...data.quote,
        deductionType: data.deductionType || data.quote.deductionType || 'none'
      };
      setCurrentQuote(quoteWithDeduction);
      
      // Store quality warnings
      if (data.qualityWarning) {
        setQualityWarning(data.qualityWarning);
      }
      if (data.warningMessage) {
        setWarningMessage(data.warningMessage);
      }
      if (data.realismWarnings) {
        setRealismWarnings(data.realismWarnings);
      }
      if (data.validationErrors) {
        setValidationErrors(data.validationErrors);
      }
      
      setHasCustomRates(data.hasCustomRates || false);
      if (data.quote?.workItems?.[0]?.hourlyRate) {
        setHourlyRate(data.quote.workItems[0].hourlyRate);
      }
      
      // Store reference metadata
      if (data.usedReference) {
        setUsedReference(true);
        setReferenceTitle(data.referenceTitle);
      } else {
        setUsedReference(false);
        setReferenceTitle(undefined);
      }
      
      if (!data.hasCustomRates) {
        toast.warning("Du har inte lagt in några timpriser i inställningarna. Använder standardpris 650 kr/h.", {
          duration: 5000
        });
      }
      
      // Show quality warnings as toasts
      if (data.qualityWarning === 'auto_corrected') {
        toast.warning(data.warningMessage || 'Offerten har korrigerats automatiskt', {
          duration: 8000
        });
      }
      
      if (data.realismWarnings && data.realismWarnings.length > 0) {
        toast.info('Branschvalidering: Vissa estimat kan behöva justeras', {
          duration: 6000
        });
      }
      
      toast.success("Offert genererad!");
    } catch (error: any) {
      console.error('Error generating quote:', error);
      toast.error(error.message || "Kunde inte generera offert");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveQuote = async () => {
    if (!currentQuote || !user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('quotes')
        .insert({
          user_id: user.id,
          title: currentQuote.title,
          description: currentDescription,
          generated_quote: currentQuote,
          status: 'draft',
          customer_id: currentCustomerId || null
        });

      if (error) throw error;

      toast.success("Offert sparad!");
      navigate('/quotes');
    } catch (error: any) {
      console.error('Error saving quote:', error);
      toast.error(error.message || "Kunde inte spara offert");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditQuote = () => {
    setIsEditing(true);
  };

  const handleSaveEdit = async (editedQuote: any) => {
    if (!currentQuote || !user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('quotes')
        .insert({
          user_id: user.id,
          title: editedQuote.title,
          description: currentDescription,
          generated_quote: currentQuote,
          edited_quote: editedQuote,
          is_edited: true,
          status: 'draft',
          customer_id: currentCustomerId || null
        });

      if (error) throw error;

      toast.success("Redigerad offert sparad!");
      navigate('/quotes');
    } catch (error: any) {
      console.error('Error saving edited quote:', error);
      toast.error(error.message || "Kunde inte spara redigerad offert");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleChatGenerateQuote = (quote: any) => {
    // Denna kallas när chat-interfacet får en komplett offert från backend
    setChatGeneratedQuote(quote);
    setCurrentQuote(quote);
    setIsGenerating(false);
    toast.success("Offert genererad och klar att granskas!");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleSelectTemplate = (template: QuoteTemplate) => {
    setShowTemplatesSection(false);
    const description = template.exampleText;
    handleGenerateQuote(description, undefined, 'standard', template.category.toLowerCase());
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Laddar...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="p-2 bg-primary rounded-lg shadow-md">
                <Wrench className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl md:text-2xl font-bold text-secondary">Skapa ny offert</h1>
                <p className="text-xs md:text-sm text-muted-foreground hidden md:block">Generera en professionell offert med AI</p>
              </div>
            </div>
            <nav className="flex gap-1 md:gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/customers")} className="hidden md:flex">
                <Users className="h-4 w-4 md:mr-2" />
                <span className="hidden lg:inline">Kunder</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/settings")} className="hidden md:flex">
                <SettingsIcon className="h-4 w-4 md:mr-2" />
                <span className="hidden lg:inline">Inställningar</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/reports")} className="hidden md:flex">
                <BarChart3 className="h-4 w-4 md:mr-2" />
                <span className="hidden lg:inline">Rapporter</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 md:mr-2" />
                <span className="hidden lg:inline">Logga ut</span>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Interface Toggle */}
          {!currentQuote && (
            <Card className="bg-accent/10 border-accent/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="chat-mode" className="text-base font-medium">
                      Chat-läge (Beta)
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Prata med AI:n istället för att fylla i formulär
                    </p>
                  </div>
                  <Switch
                    id="chat-mode"
                    checked={useChatInterface}
                    onCheckedChange={setUseChatInterface}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Templates Section */}
          {!currentQuote && !useChatInterface && (
            <Card className="border-2 border-dashed border-primary/20 bg-primary/5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">Snabbmallar</CardTitle>
                    <ContextualHelp content="Välj en färdig mall för vanliga ROT/RUT-jobb för att snabbt komma igång. Mallen förfyller beskrivningen och AI:n genererar offerten automatiskt." />
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowTemplatesSection(!showTemplatesSection)}
                  >
                    {showTemplatesSection ? 'Dölj' : 'Visa alla'}
                  </Button>
                </div>
                <CardDescription>
                  Börja snabbt med färdiga mallar för vanliga jobb
                </CardDescription>
              </CardHeader>
              {showTemplatesSection && (
                <CardContent>
                  <QuoteTemplates onSelectTemplate={handleSelectTemplate} />
                </CardContent>
              )}
            </Card>
          )}

          {/* AI Progress Indicator */}
          {isGenerating && <AIProgressIndicator isGenerating={isGenerating} />}

          {/* Quote Interface - Chat or Form */}
            {useChatInterface ? (
              <ChatInterface 
                onQuoteGenerated={handleChatGenerateQuote}
                isGenerating={isGenerating} 
              />
            ) : (
              <QuoteForm onGenerate={handleGenerateQuote} isGenerating={isGenerating} />
            )}
          
          {/* Generated Quote Display */}
          {currentQuote && !isEditing && (
            <QuoteDisplay 
              quote={currentQuote} 
              onSave={handleSaveQuote}
              onEdit={handleEditQuote}
              isSaving={isSaving}
              hasCustomRates={hasCustomRates}
              hourlyRate={hourlyRate}
              qualityWarning={qualityWarning}
              warningMessage={warningMessage}
              realismWarnings={realismWarnings}
              validationErrors={validationErrors}
              usedReference={usedReference}
              referenceTitle={referenceTitle}
            />
          )}

          {/* Quote Editor */}
          {currentQuote && isEditing && (
            <QuoteEditor
              quote={currentQuote}
              onSave={handleSaveEdit}
              onCancel={handleCancelEdit}
              isSaving={isSaving}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default NewQuote;
