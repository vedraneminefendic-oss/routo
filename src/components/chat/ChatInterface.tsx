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

// Robust ID-generator
function safeUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function ChatInterface({ onQuoteGenerated, initialMessage }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [isQuoteOpen, setIsQuoteOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string>("");
  const [previousContext, setPreviousContext] = useState<any>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Initiera sessions-ID direkt när komponenten laddas
  useEffect(() => {
    const id = safeUUID();
    setConversationId(id);
    console.log("Chat session initialized:", id);
  }, []);

  useEffect(() => {
    if (initialMessage && messages.length === 0) {
      handleSendMessage(initialMessage);
    }
  }, [initialMessage]);

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
      
      // SÄKERHET: Garantera att vi har ett ID
      const currentSessionId = conversationId || safeUUID();
      if (!conversationId) setConversationId(currentSessionId);

      // Konstruera payloaden noggrant
      const payload = {
        message: content,
        description: content, // Skicka med beskrivning som fallback
        userId: user?.id || "anonymous",
        sessionId: currentSessionId,
        previousContext: previousContext || {},
        conversationHistory: newMessages.slice(-6).map(m => ({
          role: m.role,
          content: m.content || ""
        }))
      };

      console.log("Sending to backend:", payload);

      const { data, error } = await supabase.functions.invoke('generate-quote', {
        body: payload
      });

      if (error) {
        console.error("Supabase Function Error:", error);
        throw new Error(error.message || "Kunde inte nå servern.");
      }

      if (!data) throw new Error("Tomt svar från servern.");

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
        setMessages(prev => [...prev, { role: 'assistant', content: "Jag förstod inte svaret. Kan du försöka igen?" }]);
      }

    } catch (error: any) {
      console.error('Chat Error Details:', error);
      
      let msg = "Ett fel uppstod. Försök igen.";
      if (error.message?.includes("500")) msg = "Serverfel (500). Backend kunde inte hantera förfrågan.";
      
      toast({
        title: "Något gick fel",
        description: msg,
        variant: "destructive",
      });
      setMessages(prev => [...prev, { role: 'assistant', content: "Ett tekniskt fel uppstod. Ladda om sidan och försök igen." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] w-full max-w-4xl mx-auto bg-white rounded-xl border shadow-sm overflow-hidden relative">
      
      <div className="flex-1 overflow-hidden relative bg-slate-50/50">
        <SmartScroll scrollRef={scrollRef} className="p-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center min-h-[400px]">
              <ConversationStarter onSelect={(text) => handleSendMessage(text)} />
            </div>
          ) : (
            <div className="space-y-6 pb-4">
              {previousContext?.jobType && !quoteData && (
                <div className="w-full flex justify-center mb-4">
                   <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 border border-blue-100 animate-in fade-in">
                     <HelpCircle className="w-3 h-3" />
                     <span>Samlar information: {previousContext.jobType.toUpperCase()}</span>
                   </div>
                </div>
              )}

              {messages.map((message, index) => (
                <div key={index} className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} gap-2`}>
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
                      onAnswer={(ans) => handleSendMessage(ans)}
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
                <div className="flex justify-start w-full">
                  <AgentThinking />
                </div>
              )}
            </div>
          )}
        </SmartScroll>
      </div>

      <div className="border-t bg-white p-4 space-y-3 z-10">
        {!isLoading && messages.length > 0 && !messages[messages.length-1]?.isClarification && (
          <QuickReplies onSelect={(text) => handleSendMessage(text)} />
        )}
        
        <div className="relative">
          <ChatInput 
            onSend={(text) => handleSendMessage(text)} 
            isLoading={isLoading}
            placeholder={previousContext ? "Svara på frågan..." : "Beskriv ditt projekt..."}
          />
        </div>
      </div>

      <QuoteSheet isOpen={isQuoteOpen} onOpenChange={setIsQuoteOpen} quote={quoteData} />
    </div>
  );
}
