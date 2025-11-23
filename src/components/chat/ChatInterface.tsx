import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ChatInput } from "./ChatInput";
import { MessageBubble } from "./MessageBubble";
import { QuickReplies } from "./QuickReplies";
import { QuoteSheet } from "./QuoteSheet";
import { SmartScroll } from "./SmartScroll";
import { ConversationStarter } from "./ConversationStarter";
import { AgentThinking } from "./AgentThinking"; // NY
import { ActionRequest } from "./ActionRequest"; // NY
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

  // ... (Behåll useEffect för initConversation och initialMessage)

  // Helper to guess the question type for UI
  const getQuestionType = (text: string) => {
    const t = text.toLowerCase();
    if (t.includes('yta') || t.includes('kvm') || t.includes('stor')) return 'area';
    if (t.includes('kvalitet') || t.includes('standard') || t.includes('lyx')) return 'quality';
    return 'general';
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim() && !quoteData) return;

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

      if (data.type === 'clarification_request') {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.message,
          isClarification: true
        }]);
        setPreviousContext(data.interpretation);
      } else if (data.quote) {
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
      console.error('Error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Något gick fel. Försök igen." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] w-full max-w-4xl mx-auto bg-background rounded-xl border shadow-sm overflow-hidden relative">
      <div className="flex-1 overflow-hidden relative bg-slate-50/50">
        <SmartScroll className="h-full px-4 py-4" scrollRef={scrollRef}>
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <ConversationStarter onSelect={(text) => handleSendMessage(text)} />
            </div>
          ) : (
            <div className="space-y-6 pb-4">
              {previousContext && !quoteData && (
                <div className="w-full flex justify-center mb-4">
                   <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 border border-blue-100">
                     <HelpCircle className="w-3 h-3" />
                     Samlar in information: {previousContext.jobType?.toUpperCase() || 'NYTT PROJEKT'}
                   </div>
                </div>
              )}

              {messages.map((message, index) => (
                <div key={index} className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} gap-2`}>
                  <MessageBubble 
                    role={message.role} 
                    content={message.content}
                    isLatest={index === messages.length - 1}
                  />
                  
                  {/* RENDERA SMARTA SVARSKORT OM DET ÄR EN FRÅGA */}
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
              
              {/* VISA TÄNKANDE AGENT ISTÄLLET FÖR SPINNER */}
              {isLoading && (
                <div className="flex justify-start w-full">
                  <AgentThinking />
                </div>
              )}
            </div>
          )}
        </SmartScroll>
      </div>

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
      </div>

      <QuoteSheet isOpen={isQuoteOpen} onOpenChange={setIsQuoteOpen} quote={quoteData} />
    </div>
  );
}
