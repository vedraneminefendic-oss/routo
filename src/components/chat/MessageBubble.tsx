import { cn } from "@/lib/utils";
import { Bot, User, Info } from "lucide-react";
import { Message } from "./ChatInterface";
import { QuickReplies } from "./QuickReplies";
import { ContextualHelp } from "@/components/ContextualHelp";
import { MessageReactions } from "./MessageReactions";

interface MessageBubbleProps {
  message: Message;
  onSendMessage?: (content: string, images?: string[], intent?: string) => void;
  isTyping?: boolean;
  onFeedback?: (messageId: string, helpful: boolean) => void;
}

export const MessageBubble = ({ message, onSendMessage, isTyping, onFeedback }: MessageBubbleProps) => {
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
      {/* P2: Enhanced Avatar with better visual hierarchy */}
      <div className={cn(
        "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110",
        isUser 
          ? "bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground shadow-lg shadow-primary/30 ring-2 ring-primary/20" 
          : "bg-gradient-to-br from-accent via-accent/90 to-accent/80 text-accent-foreground shadow-lg shadow-accent/30 ring-2 ring-accent/20 group-hover:shadow-accent/40"
      )}>
        {isUser ? (
          <User className="h-5 w-5" />
        ) : (
          <Bot className="h-5 w-5" />
        )}
      </div>

      {/* P2: Enhanced Message Content with better hierarchy */}
      <div className={cn(
        "flex flex-col gap-2 max-w-[80%]",
        isUser ? "items-end" : "items-start"
      )}>
        <div className="flex items-start gap-2 w-full">
          <div className={cn(
            "rounded-2xl px-5 py-3.5 text-sm leading-relaxed transition-all duration-300 flex-1 relative",
            isUser 
              ? "bg-gradient-to-br from-primary via-primary/95 to-primary/90 text-primary-foreground rounded-tr-sm shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:shadow-xl" 
              : "bg-gradient-to-br from-card via-card/98 to-card/95 text-foreground rounded-tl-sm border border-border/60 shadow-md hover:shadow-lg hover:border-border/80"
          )}>
            <div 
              className={cn(
                "prose prose-sm max-w-none dark:prose-invert",
                isUser ? "prose-invert" : ""
              )}
              dangerouslySetInnerHTML={{
                __html: message.content
                  .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
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
        
        {/* P2: Enhanced metadata row with reactions */}
        <div className="flex items-center justify-between w-full px-2 gap-2">
          <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {message.timestamp.toLocaleTimeString('sv-SE', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
          
          {/* P3: Message Reactions (only for AI messages) */}
          {!isUser && (
            <MessageReactions
              messageId={message.id}
              content={message.content}
              onFeedback={onFeedback}
            />
          )}
        </div>
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
