import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ChatInput } from "./ChatInput";
import { MessageBubble } from "./MessageBubble";
import { QuickReplies } from "./QuickReplies";
import { QuoteSheet } from "./QuoteSheet";
import { SmartScroll } from "./SmartScroll";
import { TypingIndicator } from "./TypingIndicator";
import { InlineProgressCard } from "./InlineProgressCard";
import { LiveQuotePreview } from "./LiveQuotePreview";
import { HelpCollapsible } from "./HelpCollapsible";
import { ConversationStarter } from "./ConversationStarter";
import { Loader2, AlertCircle, HelpCircle } from "lucide-react";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  data?: any;
  isClarification?: boolean; // Ny property för att markera frågor
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

        const { data, error } = await supabase
          .from('conversation_sessions')
          .insert({
            user_id: user.id,
            status: 'active',
            metadata: { source: 'chat_interface' }
          })
          .select()
          .single();

        if (error) throw error;
        setConversationId(data.id);
      } catch (error) {
        console.error('Error initializing conversation:', error);
      }
    };

    initConversation();
  }, []);

  useEffect(() => {
    if (initialMessage) {
      handleSendMessage(initialMessage);
    }
  }, [initialMessage]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim() && !quoteData) return;

    const newMessages = [
      ...messages,
      { role: 'user' as const, content }
    ];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Förbered historik för AI-kontext
      const conversationHistory = newMessages.slice(-6).map(m => ({
        role: m.role,
        content: m.content
      }));

      const { data, error } = await supabase.functions.invoke('generate-quote', {
        body: { 
          message: content,
          userId: user?.id,
          sessionId: conversationId,
          previousContext: previousContext, // Skicka med tidigare tolkning
          conversationHistory: conversationHistory
        }
      });

      if (error) throw error;

      // HANTERA HANDOFF (FRÅGE-LÄGE)
      if (data.type === 'clarification_request') {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.message,
          isClarification: true // Markera som fråga
        }]);
        
        // Spara kontexten så vi minns vad vi redan vet (t.ex. jobbtyp)
        setPreviousContext(data.interpretation);
        
        // Visa snabb feedback till användaren
        toast({
          title: "Mer information behövs",
          description: "Svara på frågan för att få ett exakt pris.",
          variant: "default",
        });

      } 
      // HANTERA FÄRDIG OFFERT
      else if (data.quote) {
        setQuoteData(data.quote);
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.message || "Här är din offert baserad på dina önskemål.",
          data: data 
        }]);
        
        if (onQuoteGenerated) {
          onQuoteGenerated(data.quote);
        }
        
        // Öppna offerten automatiskt om det är första gången
        if (!quoteData) {
          setIsQuoteOpen(true);
        }
        
        // Rensa kontext eftersom vi är klara
        setPreviousContext(null); 
      } 
      // FALLBACK
      else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: "Jag kunde inte tolka det. Kan du förtydliga?" 
        }]);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte generera svar. Försök igen.",
        variant: "destructive",
      });
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Ursäkta, något gick fel. Kan du försöka igen?" 
      }]);
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
              {/* Visa live-indikator om vi har delvis data */}
              {previousContext && !quoteData && (
                <div className="w-full flex justify-center mb-4">
                   <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 border border-blue-100">
                     <HelpCircle className="w-3 h-3" />
                     Samlar in information: {previousContext.jobType ? previousContext.jobType.toUpperCase() : 'NYTT PROJEKT'}
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
                  
                  {/* Visa knapp för att se offert om den finns i meddelandet */}
                  {message.role === 'assistant' && message.data?.quote && (
                    <div className="ml-2 mt-1">
                       <button 
                         onClick={() => {
                           setQuoteData(message.data.quote);
                           setIsQuoteOpen(true);
                         }}
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
                  <TypingIndicator />
                </div>
              )}
            </div>
          )}
        </SmartScroll>
      </div>

      {/* Bottom Section */}
      <div className="border-t bg-white p-4 space-y-3">
        {!isLoading && messages.length > 0 && (
          <QuickReplies 
            onSelect={handleSendMessage} 
            // Context-aware quick replies kan läggas till här
            suggestions={
              messages[messages.length-1]?.isClarification 
              ? ["Vet inte exakt", "Ca 10 kvm", "Ca 20 kvm", "Ca 50 kvm"] 
              : undefined
            }
          />
        )}
        
        <div className="relative">
          <ChatInput 
            onSend={handleSendMessage} 
            isLoading={isLoading}
            placeholder={previousContext ? "Svara på frågan..." : "Beskriv vad du behöver hjälp med..."}
          />
        </div>

        <div className="flex justify-between items-center pt-1">
           <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
             <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
             AI-driven kalkylator (Svensk ROT/RUT)
           </div>
           {quoteData && (
             <button 
               onClick={() => setIsQuoteOpen(true)}
               className="text-xs font-medium text-primary hover:underline"
             >
               {isQuoteOpen ? 'Dölj offert' : 'Visa senaste offert'}
             </button>
           )}
        </div>
      </div>

      {/* Quote Sheet Overlay */}
      <QuoteSheet 
        isOpen={isQuoteOpen} 
        onOpenChange={setIsQuoteOpen}
        quote={quoteData}
      />
    </div>
  );
}
