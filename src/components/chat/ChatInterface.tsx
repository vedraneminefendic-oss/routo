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

  useEffect(() => {
    const initConversation = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Skapa session, men misslyckas tyst om det blir fel för att inte blockera UI
        const { data, error } = await supabase
          .from('conversation_sessions')
          .insert({
            user_id: user.id,
            status: 'active',
            metadata: { source: 'chat_interface' }
          })
          .select()
          .single();

        if (!error && data) {
          setConversationId(data.id);
        }
      } catch (error) {
        console.warn('Kunde inte initiera konversation, fortsätter ändå:', error);
      }
    };
    initConversation();
  }, []);

  useEffect(() => {
    if (initialMessage) {
      handleSendMessage(initialMessage);
    }
  }, [initialMessage]);

  const getQuestionType = (text: string) => {
    const t = (text || '').toLowerCase();
    if (t.includes('yta') || t.includes('kvm') || t.includes('stor')) return 'area';
    if (t.includes('kvalitet') || t.includes('standard') || t.includes('lyx')) return 'quality';
    if (t.includes('komplex') || t.includes('svårt') || t.includes('enkelt')) return 'complexity';
    return 'general';
  };

  const handleSendMessage = async (content: string) => {
    if (!content?.trim() && !quoteData) return;

    const newMessages = [...messages, { role: 'user' as const, content }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const conversationHistory = newMessages.slice(-6).map(m => ({
        role: m.role,
        content: m.content
      }));

      const { data, error } = await supabase.functions.invoke('generate-quote', {
        body: { 
          message: content,
          userId: user?.id,
          sessionId: conversationId,
          previousContext: previousContext,
          conversationHistory: conversationHistory
        }
      });

      if (error) throw error;

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
        setMessages(prev => [...prev, { role: 'assistant', content: "Jag förstod inte riktigt. Kan du förtydliga?" }]);
      }

    } catch (error) {
      console.error('Chat Error:', error);
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte nå AI-tjänsten. Kontrollera din internetanslutning.",
        variant: "destructive",
      });
      setMessages(prev => [...prev, { role: 'assistant', content: "Något gick fel vid kommunikationen. Försök igen." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] w-full max-w-4xl mx-auto bg-white rounded-xl border shadow-sm overflow-hidden relative">
      
      {/* Chat Area */}
      <div className="flex-1 overflow-hidden relative bg-slate-50/50">
        <SmartScroll className="h-full" scrollRef={scrollRef}>
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center p-4">
              <ConversationStarter onSelect={(text) => handleSendMessage(text)} />
            </div>
          ) : (
            <div className="space-y-6 py-6">
              {previousContext && !quoteData && (
                <div className="w-full flex justify-center mb-4 px-4">
                   <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 border border-blue-100 animate-in fade-in">
                     <HelpCircle className="w-3 h-3" />
                     <span>Samlar information: {previousContext.jobType?.toUpperCase() || 'PROJEKT'}</span>
                   </div>
                </div>
              )}

              {messages.map((message, index) => (
                <div key={index} className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} gap-2 px-4`}>
                  <MessageBubble 
                    role={message.role} 
                    content={message.content}
                    isLatest={index === messages.length - 1}
                    className={message.isClarification ? "border-l-4 border-l-amber-400 bg-amber-50" : ""}
                  />
                  
                  {message.isClarification && index === messages.length - 1 && (
                    <ActionRequest 
                      type={getQuestionType(message.content)}
                      context={previousContext?.jobType} 
                      onAnswer={handleSendMessage}
                    />
                  )}

                  {message.role === 'assistant' && message.data?.quote && (
                    <div className="ml-2 mt-1">
                       <button 
                         onClick={() => { setQuoteData(message.data.quote); setIsQuoteOpen(true); }}
                         className="text-xs bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-1.5"
                       >
                         📄 Visa detaljerad offert
                       </button>
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start w-full px-4">
                  <AgentThinking />
                </div>
              )}
            </div>
          )}
        </SmartScroll>
      </div>

      {/* Footer / Input Area */}
      <div className="border-t bg-white p-4 space-y-3">
        {!isLoading && messages.length > 0 && !messages[messages.length-1]?.isClarification && (
          <QuickReplies onSelect={handleSendMessage} />
        )}
        
        <div className="relative">
          <ChatInput 
            onSend={handleSendMessage} 
            isLoading={isLoading}
            placeholder={previousContext ? "Svara på frågan..." : "Beskriv vad du behöver hjälp med..."}
          />
        </div>
        
        <div className="flex justify-between items-center pt-1 px-1">
           <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
             <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
             AI-driven kalkylator
           </div>
           {quoteData && (
             <button 
               onClick={() => setIsQuoteOpen(true)}
               className="text-xs font-medium text-primary hover:underline"
             >
               Visa offert
             </button>
           )}
        </div>
      </div>

      <QuoteSheet isOpen={isQuoteOpen} onOpenChange={setIsQuoteOpen} quote={quoteData} />
    </div>
  );
}
