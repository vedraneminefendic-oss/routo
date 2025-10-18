import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { ConversationStarter } from "./ConversationStarter";
import { Loader2 } from "lucide-react";

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  onGenerateQuote: (description: string, customerId?: string, detailLevel?: string, deductionType?: string) => Promise<void>;
  isGenerating: boolean;
}

export const ChatInterface = ({ onGenerateQuote, isGenerating }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async (content: string) => {
    // Lägg till användarmeddelande
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      // Här kommer vi senare integrera med backend för att få AI-svar
      // För nu, generera offerten direkt
      await onGenerateQuote(content);
      
      // Simulera AI-svar (detta kommer senare ersättas med riktig konversationslogik)
      setTimeout(() => {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Jag har genererat en offert baserat på din beskrivning. Du kan se den nedan.',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMessage]);
        setIsTyping(false);
      }, 1000);
    } catch (error) {
      setIsTyping(false);
      console.error('Error:', error);
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
