import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { ConversationStarter } from "./ConversationStarter";
import { ContextPills } from "./ContextPills";
import { Loader2, RotateCcw, Send, Save, Edit3 } from "lucide-react";
import { EstimateSection } from "@/components/estimate/EstimateSection";
import { EstimateSummary } from "@/components/estimate/EstimateSummary";
import { LineItemData } from "@/components/estimate/LineItem";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  onQuoteGenerated: (quote: any) => void;
  isGenerating: boolean;
}

export const ChatInterface = ({ onQuoteGenerated, isGenerating }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [needsClarification, setNeedsClarification] = useState(false);
  const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([]);
  const [generatedQuote, setGeneratedQuote] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
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

  const handleSendMessage = async (content: string) => {
    if (!sessionId) {
      toast({
        title: "Fel",
        description: "Session ej redo. Vänta ett ögonblick.",
        variant: "destructive"
      });
      return;
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
      // Spara användarmeddelande i databasen
      await supabase.functions.invoke('manage-conversation', {
        body: {
          action: 'save_message',
          sessionId,
          message: { role: 'user', content }
        }
      });

      // Bygg conversation_history från messages (INTE inklusive det nya meddelandet)
      // Backend kommer att läsa description som det nya meddelandet
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));
      // OBS: Vi lägger INTE till det nya meddelandet här eftersom backend läser description

      // Anropa generate-quote med conversation_history
      const { data, error } = await supabase.functions.invoke('generate-quote', {
        body: {
          description: content,
          conversation_history: conversationHistory,
          detailLevel: 'standard',
          deductionType: 'auto',
          numberOfRecipients: 1 // Default to 1 recipient
        }
      });

      if (error) {
        console.error('Generate quote error:', error);
        throw error;
      }

      console.log('Generate quote response:', data);

      // Hantera olika response-typer
      if (data?.type === 'clarification') {
        // AI:n behöver mer info
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.questions.join('\n\n'),
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMessage]);
        setNeedsClarification(true);
        setClarificationQuestions(data.questions);
        
        // Spara AI-svar i DB
        await supabase.functions.invoke('manage-conversation', {
          body: {
            action: 'save_message',
            sessionId,
            message: { role: 'assistant', content: aiMessage.content }
          }
        });
        
      } else if (data?.type === 'complete_quote') {
        // Komplett offert genererad - visa inline
        setNeedsClarification(false);
        setClarificationQuestions([]);
        setGeneratedQuote(data.quote);
        
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
        
        toast({
          title: "Offert genererad!",
          description: "Din offert är klar att granskas."
        });
      } else {
        // Okänd response-typ eller fel struktur
        console.error('Unexpected response format:', data);
        throw new Error('Oväntat response-format från server');
      }
      
    } catch (error) {
      console.error('Error:', error);
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
        setNeedsClarification(false);
        setClarificationQuestions([]);
        setGeneratedQuote(null);
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
    onQuoteGenerated(generatedQuote);
    toast({
      title: "Öppnar offert",
      description: "Nu kan du skicka offerten till kunden."
    });
  };

  const handleSaveAsDraft = async () => {
    if (!generatedQuote) return;
    onQuoteGenerated(generatedQuote);
    toast({
      title: "Sparar offert",
      description: "Offerten sparas och kan skickas senare."
    });
  };

  const handleEditQuote = () => {
    if (!generatedQuote) return;
    onQuoteGenerated(generatedQuote);
  };

  const handleStarterClick = (text: string) => {
    handleSendMessage(text);
  };

  // Smart Suggestions based on quote
  const getSmartSuggestions = () => {
    if (!generatedQuote) return [];
    
    const projectType = generatedQuote.title?.toLowerCase() || '';
    const suggestions = [];

    if (projectType.includes('badrum')) {
      suggestions.push({ text: '➕ Lägg till golvvärme (+4500 kr)', estimate: 4500 });
      suggestions.push({ text: '➕ Lägg till handdukstork (+2800 kr)', estimate: 2800 });
    } else if (projectType.includes('altan') || projectType.includes('däck')) {
      suggestions.push({ text: '➕ Lägg till belysning (+3200 kr)', estimate: 3200 });
      suggestions.push({ text: '➕ Lägg till inglasning (+15000 kr)', estimate: 15000 });
    } else if (projectType.includes('målning')) {
      suggestions.push({ text: '➕ Inkludera spackling (+1500 kr)', estimate: 1500 });
      suggestions.push({ text: '➕ Lägg till grundmålning (+2000 kr)', estimate: 2000 });
    }

    return suggestions;
  };

  return (
    <Card className="overflow-hidden">
      <div 
        ref={chatContainerRef}
        className="flex flex-col h-[600px] bg-background"
      >
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
              {isTyping && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">AI:n tänker...</span>
                </div>
              )}

              {/* Visa genererad offert inline */}
              {generatedQuote && (
                <div className="animate-in fade-in-50 slide-in-from-bottom-4">
                  <div className="bg-card border-2 border-primary/20 rounded-lg p-6 space-y-6">
                    {/* Offert Header */}
                    <div className="flex items-center justify-between border-b pb-4">
                      <div>
                        <h3 className="text-xl font-semibold text-foreground">Offert</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Giltig till: {generatedQuote.validUntil ? new Date(generatedQuote.validUntil).toLocaleDateString('sv-SE') : 'Ej angivet'}
                        </p>
                      </div>
                    </div>

                    {/* Sections (Arbete, Material, etc.) */}
                    <div className="space-y-4">
                      {generatedQuote.sections && generatedQuote.sections.map((section: any, index: number) => (
                        <EstimateSection
                          key={index}
                          title={section.title}
                          items={section.items.map((item: any) => ({
                            name: item.name || item.description || 'Post',
                            quantity: item.quantity || 1,
                            unit: item.unit || 'st',
                            unitPrice: item.unitPrice || item.rate || 0
                          }))}
                          onItemUpdate={() => {}}
                          onItemDelete={() => {}}
                          defaultOpen={true}
                        />
                      ))}
                    </div>

                    {/* Summary */}
                    {generatedQuote.summary && (
                      <EstimateSummary
                        subtotal={generatedQuote.summary.totalBeforeVAT || 0}
                        workCost={generatedQuote.summary.workCost}
                        materialCost={generatedQuote.summary.materialCost}
                        vat={generatedQuote.summary.vat}
                        totalWithVAT={generatedQuote.summary.totalWithVAT}
                        rotRutDeduction={generatedQuote.summary.deductionType !== 'none' ? {
                          type: generatedQuote.summary.deductionType?.toUpperCase() as 'ROT' | 'RUT',
                          laborCost: generatedQuote.summary.workCost || 0,
                          deductionAmount: generatedQuote.summary.deductionAmount || 0,
                          priceAfterDeduction: generatedQuote.summary.customerPays || 0,
                          deductionRate: generatedQuote.summary.deductionRate || 0.50
                        } : undefined}
                        total={generatedQuote.summary.customerPays || generatedQuote.summary.totalWithVAT || 0}
                      />
                    )}

                    {/* Notes */}
                    {generatedQuote.notes && (
                      <div className="bg-muted/50 rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">{generatedQuote.notes}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3 pt-4 border-t">
                      <Button 
                        onClick={handleSendQuote}
                        className="flex items-center gap-2"
                      >
                        <Send className="h-4 w-4" />
                        Skicka till kund
                      </Button>
                      <Button 
                        onClick={handleSaveAsDraft}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <Save className="h-4 w-4" />
                        Spara som utkast
                      </Button>
                      <Button 
                        onClick={handleEditQuote}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <Edit3 className="h-4 w-4" />
                        Redigera
                      </Button>
                    </div>

                    {/* Smart Suggestions (Fas 6E) */}
                    {getSmartSuggestions().length > 0 && (
                      <div className="border-t pt-4">
                        <p className="text-sm font-medium text-muted-foreground mb-3">
                          💡 Kanske intressant att lägga till?
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {getSmartSuggestions().map((suggestion, idx) => (
                            <Button
                              key={idx}
                              variant="outline"
                              size="sm"
                              onClick={() => handleSendMessage(suggestion.text)}
                              className="text-xs"
                            >
                              {suggestion.text}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Quick Replies för motfrågor */}
        {needsClarification && clarificationQuestions.length > 0 && (
          <div className="border-t bg-muted/20 px-4 py-3">
            <p className="text-sm text-muted-foreground mb-2">Snabba svar:</p>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleSendMessage("Budget-nivå material")}
              >
                💰 Budget
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleSendMessage("Mellan-nivå material")}
              >
                ⭐ Mellan
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleSendMessage("Premium material")}
              >
                💎 Premium
              </Button>
            </div>
          </div>
        )}

        {/* Context Pills - visar vad AI:n förstått */}
        <ContextPills 
          messages={messages}
        />

        {/* Input Area */}
        <div className="bg-muted/30 p-4">
          <ChatInput 
            onSendMessage={handleSendMessage}
            disabled={isGenerating || isTyping}
          />
        </div>
      </div>
    </Card>
  );
};
