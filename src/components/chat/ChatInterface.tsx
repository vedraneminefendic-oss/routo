import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { ConversationStarter } from "./ConversationStarter";
import { Loader2, RotateCcw } from "lucide-react";
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

      // Bygg conversation_history från messages
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));
      conversationHistory.push({ role: 'user', content });

      // Anropa generate-quote med conversation_history
      const { data, error } = await supabase.functions.invoke('generate-quote', {
        body: {
          description: content,
          conversation_history: conversationHistory,
          detailLevel: 'standard',
          deductionType: 'auto'
        }
      });

      if (error) throw error;

      // Hantera olika response-typer
      if (data.type === 'clarification') {
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
        
      } else if (data.type === 'complete_quote') {
        // Komplett offert genererad
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Jag har genererat en komplett offert baserat på dina svar. Du kan se den nedan.',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMessage]);
        setNeedsClarification(false);
        setClarificationQuestions([]);
        
        // Spara AI-svar
        await supabase.functions.invoke('manage-conversation', {
          body: {
            action: 'save_message',
            sessionId,
            message: { role: 'assistant', content: aiMessage.content }
          }
        });
        
        // Anropa callback för att visa offerten
        onQuoteGenerated(data.quote);
        
        toast({
          title: "Offert genererad!",
          description: "Din offert är klar att granskas."
        });
      }
      
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Fel",
        description: "Något gick fel. Försök igen.",
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

  const handleStarterClick = (text: string) => {
    handleSendMessage(text);
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

        {/* Input Area */}
        <div className="border-t bg-muted/30 p-4">
          <ChatInput 
            onSendMessage={handleSendMessage}
            disabled={isGenerating || isTyping}
          />
        </div>
      </div>
    </Card>
  );
};
