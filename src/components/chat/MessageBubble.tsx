import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";
import { Message } from "./ChatInterface";
import { QuickReplies } from "./QuickReplies";

interface MessageBubbleProps {
  message: Message;
  onSendMessage?: (content: string, images?: string[], intent?: string) => void;
  isTyping?: boolean;
}

export const MessageBubble = ({ message, onSendMessage, isTyping }: MessageBubbleProps) => {
  const isUser = message.role === 'user';
  
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
      "flex gap-3 animate-in fade-in-50 slide-in-from-bottom-2",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      {/* Avatar */}
      <div className={cn(
        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
        isUser 
          ? "bg-primary text-primary-foreground" 
          : "bg-accent text-accent-foreground"
      )}>
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      {/* Message Content */}
      <div className={cn(
        "flex flex-col gap-1 max-w-[80%]",
        isUser ? "items-end" : "items-start"
      )}>
        <div className={cn(
          "rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm transition-all hover:shadow-md",
          isUser 
            ? "bg-primary text-primary-foreground rounded-tr-sm" 
            : "bg-gradient-to-br from-muted via-muted/90 to-muted/80 text-foreground rounded-tl-sm border border-border/50"
        )}>
          <div 
            dangerouslySetInnerHTML={{
              __html: message.content
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/^- (.+)$/gm, '• $1')
                .replace(/\n/g, '<br/>')
            }}
          />
        </div>
        <span className="text-xs text-muted-foreground px-2">
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
