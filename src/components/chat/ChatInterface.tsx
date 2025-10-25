import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { ConversationStarter } from "./ConversationStarter";
import { QuoteSheet } from "./QuoteSheet";
import { Loader2, RotateCcw, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  conversationFeedback?: any;
  readiness?: any;
}

interface ChatInterfaceProps {
  onQuoteGenerated: (quote: any) => void;
  isGenerating: boolean;
}

export const ChatInterface = ({ onQuoteGenerated, isGenerating }: ChatInterfaceProps) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [generatedQuote, setGeneratedQuote] = useState<any>(null);
  const [conversationFeedback, setConversationFeedback] = useState<any>(null);
  const [readiness, setReadiness] = useState<any>(null);
  const [showProactivePrompt, setShowProactivePrompt] = useState(false);
  const [showQuoteSheet, setShowQuoteSheet] = useState(false);
  const [feedbackExpanded, setFeedbackExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const askedQuestions = useRef<Set<string>>(new Set());
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    const createSession = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('manage-conversation', {
          body: { action: 'create_session' }
        });
        if (error) throw error;
        if (data?.session?.id) {
          setSessionId(data.session.id);
        }
      } catch (error) {
        console.error('Error creating session:', error);
        toast({
          title: "Fel",
          description: "Kunde inte starta konversation. Försök igen.",
          variant: "destructive"
        });
      }
    };
    createSession();
  }, [toast]);

  const handleSendMessage = async (content: string, images?: string[], retryCount = 0) => {
    if (!sessionId) {
      // Try to recreate session
      try {
        const { data, error } = await supabase.functions.invoke('manage-conversation', {
          body: { action: 'create_session' }
        });
        if (error) throw error;
        if (data?.session?.id) {
          setSessionId(data.session.id);
          toast({
            title: "Session återställd",
            description: "Försöker igen..."
          });
          // Retry the message send
          return handleSendMessage(content, images, retryCount);
        }
      } catch (error) {
        toast({
          title: "Fel",
          description: "Kunde inte skapa session. Ladda om sidan.",
          variant: "destructive"
        });
        return;
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const startTime = Date.now();
      
      // Step 1: Analyze images (if present)
      let imageAnalysis = null;
      if (images && images.length > 0) {
        toast({
          title: "📸 Steg 1/3: Analyserar bilder...",
          description: "Extraherar mått och detaljer"
        });

        try {
          const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-images', {
            body: { images, description: content }
          });

          if (analysisError) {
            console.error('Image analysis error:', analysisError);
            toast({
              title: "⚠️ Bildanalys hoppades över",
              description: "Fortsätter med textbeskrivning",
              variant: "default"
            });
          } else {
            imageAnalysis = analysisData;
            console.log('Image analysis:', imageAnalysis);
            
            if (imageAnalysis?.confidence === 'low') {
              toast({
                title: "⚠️ Osäker bildanalys",
                description: "Lägg gärna till mer detaljer",
                variant: "default"
              });
            } else {
              toast({
                title: "✅ Bildanalys klar",
                description: "Bilder analyserade"
              });
            }
          }
        } catch (error) {
          console.error('Image analysis exception:', error);
          toast({
            title: "⚠️ Bildanalys hoppades över",
            description: "Fortsätter med textbeskrivning"
          });
        }
      }

      // Step 2: Save user message
      await supabase.functions.invoke('manage-conversation', {
        body: {
          action: 'save_message',
          sessionId,
          message: { role: 'user', content }
        }
      });

      // Step 3: Generate quote
      toast({
        title: imageAnalysis ? "🧮 Steg 2/3: Beräknar..." : "🧮 Steg 1/2: Beräknar...",
        description: "Analyserar projekt och kostnader"
      });

      // ÅTGÄRD 1: Inkludera senaste user-meddelandet direkt i conversation_history
      const conversationHistory = [...messages, userMessage].map(m => ({
        role: m.role,
        content: m.content
      }));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      try {
        const { data, error } = await supabase.functions.invoke('generate-quote', {
          body: {
            description: content,
            conversation_history: conversationHistory,
            sessionId: sessionId,
            detailLevel: 'standard',
            deductionType: 'auto',
            numberOfRecipients: 1,
            imageAnalysis: imageAnalysis
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (error) {
          console.error('Generate quote error:', error);
          
          // Check for rate limit or payment errors (402/429)
          if (error.message?.includes('429') || error.message?.toLowerCase().includes('rate limit')) {
            throw new Error('För många förfrågningar. Vänta en stund och försök igen.');
          }
          if (error.message?.includes('402') || error.message?.toLowerCase().includes('payment')) {
            throw new Error('AI-krediter är slut. Fyll på krediter i Settings → Workspace → Usage.');
          }
          
          // Check for specific error types
          if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
            throw new Error('NETWORK_ERROR');
          }
          throw error;
        }

        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ Quote generated in ${elapsedTime}s`);

        console.log('Generate quote response:', data);

        // Hantera olika response-typer
        if (data?.type === 'clarification') {
          // ÅTGÄRD 2: Filtrera bort dubblettfrågor innan visning
          const normalizeQuestion = (q: string) => 
            q.trim().toLowerCase().replace(/[.!?]+$/, '');
          
          const newQuestions = data.questions.filter((q: string) => {
            const normalized = normalizeQuestion(q);
            return !askedQuestions.current.has(normalized);
          });
          
          // Lägg till nya frågor i set
          newQuestions.forEach((q: string) => {
            askedQuestions.current.add(normalizeQuestion(q));
          });
          
          // Om inga nya frågor, hoppa över detta steg
          if (newQuestions.length === 0) {
            console.log('⚠️ Alla frågor redan ställda, hoppar över');
            setIsTyping(false);
            return;
          }
          
          // AI:n behöver mer info
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: newQuestions.join('\n\n'),
            timestamp: new Date(),
            conversationFeedback: data.conversationFeedback,
            readiness: data.readiness
          };
          setMessages(prev => [...prev, aiMessage]);
          setConversationFeedback(data.conversationFeedback);
          setReadiness(data.readiness);
          
          // Spara AI-svar i DB
          await supabase.functions.invoke('manage-conversation', {
            body: {
              action: 'save_message',
              sessionId,
              message: { role: 'assistant', content: aiMessage.content }
            }
          });
          
        } else if (data?.type === 'context_confirmation') {
          // ÅTGÄRD 1: Visa sammanfattning och be om bekräftelse
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: data.message,
            timestamp: new Date(),
            conversationFeedback: data.conversationFeedback,
            readiness: data.readiness
          };
          setMessages(prev => [...prev, aiMessage]);
          setConversationFeedback(data.conversationFeedback);
          setReadiness(data.readiness);
          
          // Spara AI-svar
          await supabase.functions.invoke('manage-conversation', {
            body: {
              action: 'save_message',
              sessionId,
              message: { role: 'assistant', content: aiMessage.content }
            }
          });
          
        } else if (data?.type === 'conversation_review') {
          // ÅTGÄRD 4: Visa tre valmöjligheter för användaren
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: data.message,
            timestamp: new Date(),
            conversationFeedback: data.conversationFeedback,
            readiness: data.readiness
          };
          setMessages(prev => [...prev, aiMessage]);
          setConversationFeedback(data.conversationFeedback);
          setReadiness(data.readiness);
          
          // Spara AI-svar
          await supabase.functions.invoke('manage-conversation', {
            body: {
              action: 'save_message',
              sessionId,
              message: { role: 'assistant', content: aiMessage.content }
            }
          });
          
        } else if (data?.type === 'proactive_ready') {
          // PROBLEM #6: PROACTIVE SIGNALING
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: data.message,
            timestamp: new Date(),
            conversationFeedback: data.conversationFeedback,
            readiness: data.readiness
          };
          setMessages(prev => [...prev, aiMessage]);
          setShowProactivePrompt(true);
          setConversationFeedback(data.conversationFeedback);
          setReadiness(data.readiness);
          
          // Spara AI-svar
          await supabase.functions.invoke('manage-conversation', {
            body: {
              action: 'save_message',
              sessionId,
              message: { role: 'assistant', content: aiMessage.content }
            }
          });
          
        } else if (data?.type === 'complete_quote') {
          // ÅTGÄRD 3: Validera att offerten är giltig innan vi visar den
          if (!data.quote || !data.quote.summary) {
            console.error('❌ Invalid quote received:', data);
            toast({
              title: "Fel i offerten",
              description: "Offerten kunde inte genereras korrekt. Försök igen eller kontakta support.",
              variant: "destructive"
            });
            return;
          }

          // Validera att alla kritiska fält finns och är giltiga nummer
          const hasValidSummary = 
            typeof data.quote.summary.totalBeforeVAT === 'number' &&
            typeof data.quote.summary.totalWithVAT === 'number' &&
            !isNaN(data.quote.summary.totalBeforeVAT) &&
            !isNaN(data.quote.summary.totalWithVAT) &&
            data.quote.summary.totalBeforeVAT >= 0 &&
            data.quote.summary.totalWithVAT >= 0;

          if (!hasValidSummary) {
            console.error('❌ Quote summary has invalid values:', data.quote.summary);
            toast({
              title: "Fel i beräkningar",
              description: "Offerten innehåller felaktiga beräkningar. Försök igen.",
              variant: "destructive"
            });
            return;
          }

          const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
          
          // SPRINT 1: Visa antaganden om de finns
          if (data.assumptions && data.assumptions.length > 0) {
            console.log('🧠 AI gjorde följande antaganden:', data.assumptions);
            toast({
              title: "⚠️ Antaganden gjorda",
              description: `AI:n gjorde ${data.assumptions.length} antagande${data.assumptions.length > 1 ? 'n' : ''} i offerten. Se offerten för detaljer.`,
              variant: "default"
            });
          }
          
          // Show success with timing
          toast({
            title: "✅ Offert genererad!",
            description: `Klar på ${elapsedTime} sekunder${data.usedFallback ? ' (snabbt läge)' : ''}`
          });

          // Komplett offert genererad - visa i sheet
          setShowProactivePrompt(false);
          setGeneratedQuote(data.quote);
          setConversationFeedback(data.conversationFeedback);
          setReadiness(data.readiness);
          setShowQuoteSheet(true); // Öppna sheet automatiskt
          
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: 'Här är din offert! Du kan skicka den till kunden, spara som utkast eller redigera den.',
            timestamp: new Date()
          };
          setMessages(prev => [...prev, aiMessage]);
          
          // Spara AI-svar
          await supabase.functions.invoke('manage-conversation', {
            body: {
              action: 'save_message',
              sessionId,
              message: { role: 'assistant', content: aiMessage.content }
            }
          });
        } else {
          // Okänd response-typ eller fel struktur
          console.error('Unexpected response format:', data);
          throw new Error('Oväntat response-format från server');
        }
      } catch (invokeError: any) {
        clearTimeout(timeoutId);
        
        if (invokeError.name === 'AbortError') {
          throw new Error('Offertgenereringen tog för lång tid (>120s). Försök igen.');
        }
        throw invokeError;
      }
      
    } catch (error: any) {
      console.error('Error:', error);
      
      // Retry logic for network errors
      if (error.message === 'NETWORK_ERROR' && retryCount < 2) {
        const backoffTime = retryCount === 0 ? 1500 : 3000;
        toast({
          title: "⏳ Nätverksfel",
          description: `Försöker igen om ${backoffTime/1000}s...`
        });
        
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        return handleSendMessage(content, images, retryCount + 1);
      }
      
      toast({
        title: "Fel",
        description: error instanceof Error ? error.message : "Något gick fel. Försök igen.",
        variant: "destructive"
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleNewConversation = async () => {
    if (sessionId) {
      try {
        await supabase.functions.invoke('manage-conversation', {
          body: { action: 'update_status', sessionId, status: 'completed' }
        });
      } catch (error) {
        console.error('Error updating session status:', error);
      }
    }
    
    // Skapa ny session
    try {
      const { data, error } = await supabase.functions.invoke('manage-conversation', {
        body: { action: 'create_session' }
      });
      
      if (error) throw error;
      
      if (data?.session?.id) {
        setSessionId(data.session.id);
        setMessages([]);
        setGeneratedQuote(null);
        setConversationFeedback(null);
        setReadiness(null);
        setShowProactivePrompt(false);
        askedQuestions.current.clear(); // Rensa frågehistorik
        toast({
          title: "Ny konversation",
          description: "Börja om med en ny offertförfrågan."
        });
      }
    } catch (error) {
      console.error('Error creating new session:', error);
      toast({
        title: "Fel",
        description: "Kunde inte starta ny konversation.",
        variant: "destructive"
      });
    }
  };

  const handleSendQuote = async () => {
    if (!generatedQuote) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Användaren är inte inloggad');
      
      const { data: savedQuote, error } = await supabase
        .from('quotes')
        .insert({
          user_id: user.id,
          title: generatedQuote.title || 'Offert',
          description: messages.find(m => m.role === 'user')?.content || '',
          generated_quote: generatedQuote,
          status: 'draft',
          customer_id: null
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setShowQuoteSheet(false);
      
      toast({
        title: "✅ Offert sparad!",
        description: "Nu kan du välja mottagare och skicka."
      });
      
      navigate('/quotes');
      
    } catch (error: any) {
      console.error('Error saving quote:', error);
      toast({
        title: "Fel",
        description: error.message || "Kunde inte spara offert",
        variant: "destructive"
      });
    }
  };

  const handleSaveAsDraft = async () => {
    if (!generatedQuote) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Användaren är inte inloggad');
      
      const { error } = await supabase
        .from('quotes')
        .insert({
          user_id: user.id,
          title: generatedQuote.title || 'Offert',
          description: messages.find(m => m.role === 'user')?.content || '',
          generated_quote: generatedQuote,
          status: 'draft',
          customer_id: null
        });
      
      if (error) throw error;
      
      toast({
        title: "✅ Offert sparad!",
        description: "Offerten finns nu i dina utkast."
      });
      
      setShowQuoteSheet(false);
      
    } catch (error: any) {
      console.error('Error saving quote:', error);
      toast({
        title: "Fel",
        description: error.message || "Kunde inte spara offert",
        variant: "destructive"
      });
    }
  };

  const handleEditQuote = () => {
    if (!generatedQuote) return;
    setShowQuoteSheet(false);
    onQuoteGenerated(generatedQuote);
  };

  const handleStarterClick = (text: string) => {
    handleSendMessage(text);
  };

  const handleGenerateQuote = () => {
    handleSendMessage("Generera en offert baserat på vår konversation");
    setShowProactivePrompt(false);
  };

  return (
    <>
      <Card className="overflow-hidden">
        <div 
          ref={chatContainerRef}
          className="flex flex-col h-[600px] bg-background relative"
        >
          {/* AI Processing Banner - ÅTG 5 */}
          {isTyping && (
            <div className="sticky top-0 z-10 bg-gradient-to-r from-primary/10 via-blue-500/10 to-purple-500/10 border-b border-primary/20 px-4 py-2.5 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <p className="text-sm font-medium text-foreground">
                  AI:n analyserar ditt projekt...
                </p>
              </div>
            </div>
          )}

          {/* Proactive Ready Banner - Sticky at top */}
          {showProactivePrompt && readiness && readiness.readiness_score >= 85 && (
            <div className="sticky top-0 z-10 bg-gradient-to-r from-green-500/10 via-primary/10 to-blue-500/10 border-b border-primary/20 px-4 py-3 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex-shrink-0">
                    <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      🎉 Redo att generera offert!
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Jag har tillräckligt med information ({readiness.readiness_score}% beredskap)
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => setShowProactivePrompt(false)}
                    className="flex-shrink-0"
                  >
                    Fortsätt konversation
                  </Button>
                  <Button 
                    size="sm"
                    onClick={handleGenerateQuote}
                    className="flex-shrink-0 gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    Generera offert
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Progress Bar - ÅTG 1 */}
          {readiness && readiness.readiness_score < 85 && !generatedQuote && messages.length > 0 && (
            <div className="sticky top-0 z-10 bg-gradient-to-b from-background via-background to-transparent border-b px-4 py-3">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">
                    {readiness.readiness_score < 30 && "🔍 Samlar information..."}
                    {readiness.readiness_score >= 30 && readiness.readiness_score < 60 && "📝 Förstår projektet..."}
                    {readiness.readiness_score >= 60 && readiness.readiness_score < 85 && "✨ Nästan klar!"}
                  </p>
                </div>
                <span className="text-sm font-bold tabular-nums">
                  {readiness.readiness_score}%
                </span>
              </div>
              
              {/* Gradient Progress med milestones */}
              <div className="relative">
                <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
                  <div 
                    className="h-full transition-all duration-500 ease-out"
                    style={{
                      width: `${readiness.readiness_score}%`,
                      background: readiness.readiness_score < 30 
                        ? 'linear-gradient(to right, #ef4444, #f59e0b)'
                        : readiness.readiness_score < 60
                        ? 'linear-gradient(to right, #f59e0b, #eab308)'
                        : 'linear-gradient(to right, #eab308, #22c55e)'
                    }}
                  />
                </div>
                
                {/* Milestones */}
                {[25, 50, 75, 85].map((milestone) => (
                  <div 
                    key={milestone}
                    className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-bold transition-all duration-300"
                    style={{ 
                      left: `${milestone}%`,
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: readiness.readiness_score >= milestone ? '#22c55e' : 'hsl(var(--secondary))',
                      color: readiness.readiness_score >= milestone ? '#fff' : 'hsl(var(--muted-foreground))'
                    }}
                  >
                    {readiness.readiness_score >= milestone ? '✓' : milestone === 85 ? '🎯' : ''}
                  </div>
                ))}
              </div>
              
              {/* Nästa steg-indikator */}
              {conversationFeedback?.missing?.[0] && (
                <p className="text-xs text-muted-foreground mt-2">
                  Nästa: {conversationFeedback.missing[0]}
                </p>
              )}
            </div>
          )}

          {/* Header med "Ny konversation"-knapp */}
          {messages.length > 0 && (
            <div className="border-b bg-muted/30 px-4 py-2 flex justify-end">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleNewConversation}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Ny konversation
              </Button>
            </div>
          )}
          
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-semibold text-foreground">
                  Beskriv ditt projekt
                </h2>
                <p className="text-muted-foreground max-w-md">
                  Berätta vad du vill få hjälp med, så genererar jag en professionell offert åt dig.
                </p>
              </div>
              <ConversationStarter onStarterClick={handleStarterClick} />
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              
              {/* Quote generated - show button to open sheet */}
              {generatedQuote && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 animate-in fade-in-50">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-semibold">Offert genererad!</p>
                        <p className="text-xs text-muted-foreground">
                          Klicka för att granska och skicka
                        </p>
                      </div>
                    </div>
                    <Button 
                      size="sm"
                      onClick={() => setShowQuoteSheet(true)}
                      className="gap-2"
                    >
                      Visa offert
                    </Button>
                  </div>
                </div>
              )}

              {isTyping && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                  <div className="bg-gradient-to-br from-muted to-muted/80 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-border/50">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
        
        {/* Input Area - Sticky Bottom */}
        <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur-sm px-4 py-4 z-10">
          <ChatInput onSendMessage={handleSendMessage} disabled={isTyping} />
        </div>
      </div>
    </Card>

    {/* Quote Sheet Modal */}
    <QuoteSheet
      open={showQuoteSheet}
      onOpenChange={setShowQuoteSheet}
      quote={generatedQuote}
      onSend={handleSendQuote}
      onSaveAsDraft={handleSaveAsDraft}
      onEdit={handleEditQuote}
    />
  </>
  );
};
