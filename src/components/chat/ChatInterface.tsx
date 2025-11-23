import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ChatInput } from "./ChatInput";
import { MessageBubble } from "./MessageBubble";
import { QuickReplies } from "./QuickReplies";
import { QuoteSheet } from "./QuoteSheet";
import { SmartScroll } from "./SmartScroll";
import { ConversationStarter } from "./ConversationStarter";
import { AgentThinking } from "./AgentThinking"; 
import { ActionRequest } from "./ActionRequest"; 
import { HelpCircle } from "lucide-react"; 

interface Message {
  role: 'user' | 'assistant';
  content: string;
  data?: any;
  isClarification?: boolean;
}

interface ChatInterfaceProps {
  onQuoteGenerated?: (quote: any) => void;
  initialMessage?: string;
}

export function ChatInterface({ onQuoteGenerated, initialMessage }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [isQuoteOpen, setIsQuoteOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [previousContext, setPreviousContext] = useState<any>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Starta konversation tyst i bakgrunden
  useEffect(() => {
    const initConversation = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        // Vi genererar alltid ett ID, även om vi inte är inloggade än, för att API:et kräver det
        if (!conversationId) {
            const tempId = crypto.randomUUID();
            setConversationId(tempId);
            
            if (user) {
                // Spara sessionen i DB om användaren finns
                await supabase
                  .from('conversation_sessions')
                  .insert({
                    id: tempId, // Använd samma ID
                    user_id: user.id,
                    status: 'active',
                    metadata: { source: 'chat_interface' }
                  });
            }
        }
      } catch (e) {
        console.warn("Kunde inte spara session, använder lokalt ID.", e);
        if (!conversationId) setConversationId(crypto.randomUUID());
      }
    };
    initConversation();
  }, []);

  // Hantera startmeddelande
  useEffect(() => {
    if (initialMessage && messages.length === 0) {
      handleSendMessage(initialMessage);
    }
  }, [initialMessage]);

  // Hjälpfunktion för ActionRequest
  const getQuestionType = (text: string) => {
    const t = (text || '').toLowerCase();
    if (t.includes('yta') || t.includes('kvm')) return 'area';
    if (t.includes('kvalitet') || t.includes('standard')) return 'quality';
    if (t.includes('komplex') || t.includes('svårt')) return 'complexity';
    return 'general';
  };

  const handleSendMessage = async (content: string) => {
    if (!content?.trim() && !quoteData) return;

    const newMessages = [...messages, { role: 'user' as const, content }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // GARANTERA att vi har ett sessionId (backend kraschar annars)
      const currentSessionId = conversationId || crypto.randomUUID();
      if (!conversationId) setConversationId(currentSessionId);

      // Anropa Edge Function med EXAKT den struktur backend förväntar sig
      const { data, error } = await supabase.functions.invoke('generate-quote', {
        body: { 
          message: content,
          description: content, // VIKTIGT: Backend validerar detta fält
          userId: user?.id,
          sessionId: currentSessionId, // VIKTIGT: Måste vara en sträng, får ej vara null
          previousContext: previousContext,
          conversationHistory: newMessages.map(m => ({ role: m.role, content: m.content })).slice(-6)
        }
      });

      if (error) throw error;

      // Hantera svaret
      if (data?.type === 'clarification_request') {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.message,
          isClarification: true
        }]);
        setPreviousContext(data.interpretation);
      } else if (data?.quote) {
        setQuoteData(data.quote);
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.message || "Här är din offert.",
          data: data 
        }]);
        if (onQuoteGenerated) onQuoteGenerated(data.quote);
        if (!quoteData) setIsQuoteOpen(true);
        setPreviousContext(null); 
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "Jag förstod inte riktigt. Kan du omformulera?" }]);
      }

    } catch (error) {
      console.error('Chat Error:', error);
      toast({
        title: "Ett tekniskt fel uppstod",
        description: "Kunde inte nå AI-tjänsten. Försök igen om en liten stund.",
        variant: "destructive",
      });
      setMessages(prev => [...prev, { role: 'assistant', content: "Ursäkta, något gick fel i kommunikationen. Försök skicka meddelandet igen." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] w-full max-w-4xl mx-auto bg-white rounded-xl border shadow-sm overflow-hidden relative">
      
      {/* Chatt-område */}
      <div className="flex-1 overflow-hidden relative bg-slate-50/50">
        <SmartScroll scrollRef={scrollRef} className="p-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center min-h-[400px]">
              <ConversationStarter onSelect={handleSendMessage} />
            </div>
          ) : (
            <div className="space-y-6 pb-4">
              {/* Status Badge */}
              {previousContext?.jobType && !quoteData && (
                <div className="w-full flex justify-center mb-4">
                   <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 border border-blue-100 animate-in fade-in">
                     <HelpCircle className="w-3 h-3" />
                     <span>Samlar information: {previousContext.jobType.toUpperCase()}</span>
                   </div>
                </div>
              )}

              {/* Meddelanden */}
              {messages.map((message, index) => (
                <div key={index} className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} gap-2`}>
                  <MessageBubble 
                    role={message.role} 
                    content={message.content}
                    isLatest={index === messages.length - 1}
                    className={message.isClarification ? "border-l-4 border-l-amber-400 bg-amber-50" : ""}
                  />
                  
                  {/* Action Cards (Slider/Knappar) */}
                  {message.isClarification && index === messages.length - 1 && (
                    <ActionRequest 
                      type={getQuestionType(message.content)}
                      context={previousContext?.jobType} 
                      onAnswer={handleSendMessage}
                    />
                  )}

                  {/* Offert-knapp */}
                  {message.role === 'assistant' && message.data?.quote && (
                    <div className="ml-2 mt-1">
                       <button 
                         onClick={() => { setQuoteData(message.data.quote); setIsQuoteOpen(true); }}
                         className="text-xs bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-1.5"
                       >
                         📄 Visa offert
                       </button>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Tänker-indikator */}
              {isLoading && (
                <div className="flex justify-start w-full">
                  <AgentThinking />
                </div>
              )}
            </div>
          )}
        </SmartScroll>
      </div>

      {/* Footer Input */}
      <div className="border-t bg-white p-4 space-y-3 z-10">
        {!isLoading && messages.length > 0 && !messages[messages.length-1]?.isClarification && (
          <QuickReplies onSelect={handleSendMessage} />
        )}
        
        <div className="relative">
          <ChatInput 
            onSend={handleSendMessage} 
            isLoading={isLoading}
            placeholder={previousContext ? "Svara på frågan..." : "Beskriv ditt projekt..."}
          />
        </div>
      </div>

      <QuoteSheet isOpen={isQuoteOpen} onOpenChange={setIsQuoteOpen} quote={quoteData} />
    </div>
  );
}
