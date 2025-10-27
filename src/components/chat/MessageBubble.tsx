import { cn } from "@/lib/utils";
import { Bot, User, Info } from "lucide-react";
import { Message } from "./ChatInterface";
import { QuickReplies } from "./QuickReplies";
import { ContextualHelp } from "@/components/ContextualHelp";

interface MessageBubbleProps {
  message: Message;
  onSendMessage?: (content: string, images?: string[], intent?: string) => void;
  isTyping?: boolean;
}

export const MessageBubble = ({ message, onSendMessage, isTyping }: MessageBubbleProps) => {
  const isUser = message.role === 'user';
  
  // P1: Detect if AI is asking a question and provide contextual help
  const getContextualHelp = (content: string): string | null => {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('storlek') || lowerContent.includes('yta') || lowerContent.includes('kvm')) {
      return 'Ange ytan i kvadratmeter (t.ex. "50 kvm") eller antal rum (t.ex. "3 rum")';
    }
    if (lowerContent.includes('material') || lowerContent.includes('kvalitet')) {
      return 'Beskriv materialkvalitet som "standard", "mellanklass" eller "premium"';
    }
    if (lowerContent.includes('budget') || lowerContent.includes('pris')) {
      return 'Ange din budget i SEK (t.ex. "150 000 kr") eller intervall (t.ex. "100-200 tkr")';
    }
    if (lowerContent.includes('tidplan') || lowerContent.includes('när')) {
      return 'Ange önskat startdatum eller tidsram (t.ex. "mars 2024" eller "inom 2 månader")';
    }
    if (lowerContent.includes('badrum') || lowerContent.includes('kök')) {
      return 'Beskriv omfattning: "totalrenovering", "delvis renovering" eller specifika delar';
    }
    
    return null;
  };
  
  const contextHelp = !isUser ? getContextualHelp(message.content) : null;
  
  const handleQuickReplySelect = (action: string, label: string) => {
    if (!onSendMessage) return;
    
    // Map action till faktiskt svar - undvik "Jag..." för att inte trigga bekräftelse-regex
    const responseMap: Record<string, string> = {
      'confirm': 'Ja, generera offert',
      'edit': 'Ändra något',
      'add_info': 'Lägg till mer information',
      'review': 'Granska sammanfattning',
      'generate': 'Generera direkt',
      'more_info': 'Lägg till mer info',
      'edit_measurements': 'Jag vill ändra mått och storlek',
      'edit_scope': 'Jag vill ändra omfattningen',
      'edit_materials': 'Jag vill ändra materialkvaliteten',
      'edit_inclusions': 'Jag vill ändra vad som ingår',
      'edit_exclusions': 'Jag vill ändra vad som inte ingår',
      'edit_budget': 'Jag vill ändra budgeten'
    };
    
    const response = responseMap[action] || label;
    onSendMessage(response, undefined, action); // Skicka action som intent
  };
  
  return (
    <div className={cn(
      "flex gap-3 group animate-in fade-in-0 slide-in-from-bottom-4 duration-500",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      {/* Avatar */}
      <div className={cn(
        "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 group-hover:scale-110",
        isUser 
          ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground ring-2 ring-primary/20" 
          : "bg-gradient-to-br from-accent to-accent/80 text-accent-foreground ring-2 ring-accent/20"
      )}>
        {isUser ? (
          <User className="h-5 w-5" />
        ) : (
          <Bot className="h-5 w-5 animate-pulse" />
        )}
      </div>

      {/* Message Content */}
      <div className={cn(
        "flex flex-col gap-2 max-w-[80%]",
        isUser ? "items-end" : "items-start"
      )}>
        <div className="flex items-start gap-2">
          <div className={cn(
            "rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02] flex-1",
            isUser 
              ? "bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground rounded-tr-sm backdrop-blur-sm" 
              : "bg-gradient-to-br from-card via-card/95 to-card/90 text-foreground rounded-tl-sm border border-border/50 backdrop-blur-sm"
          )}>
            <div 
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{
                __html: message.content
                  .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
                  .replace(/^- (.+)$/gm, '<span class="inline-block">• $1</span>')
                  .replace(/\n/g, '<br/>')
              }}
            />
          </div>
          {/* P1: Contextual Help */}
          {!isUser && contextHelp && (
            <div className="flex-shrink-0 mt-1">
              <ContextualHelp content={contextHelp} side="left" />
            </div>
          )}
        </div>
        <span className="text-xs text-muted-foreground px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {message.timestamp.toLocaleTimeString('sv-SE', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </span>
        {!isUser && message.quickReplies && message.quickReplies.length > 0 && (
          <QuickReplies
            replies={message.quickReplies}
            onSelect={handleQuickReplySelect}
            disabled={isTyping}
          />
        )}
      </div>
    </div>
  );
};
