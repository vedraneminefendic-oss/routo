import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { MessageBubble } from "./MessageBubble";

interface ConversationHistoryProps {
  messages: any[];
  currentMessageIndex: number;
  onSendMessage?: (content: string, images?: string[], intent?: string) => void;
  isTyping?: boolean;
}

export const ConversationHistory = ({
  messages,
  currentMessageIndex,
  onSendMessage,
  isTyping,
}: ConversationHistoryProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Only show if there are more than 10 messages
  if (messages.length <= 10) return null;
  
  const oldMessages = messages.slice(0, currentMessageIndex - 5);
  const recentMessages = messages.slice(currentMessageIndex - 5);

  if (oldMessages.length === 0) return null;

  return (
    <div className="border-b border-border/50 pb-4 mb-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {isCollapsed ? "Visa" : "Dölj"} tidigare meddelanden ({oldMessages.length})
          </span>
        </div>
        {isCollapsed ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>

      <div
        className={cn(
          "space-y-4 mt-4 overflow-hidden transition-all duration-300",
          isCollapsed ? "max-h-0" : "max-h-[1000px]"
        )}
      >
        {oldMessages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onSendMessage={onSendMessage}
            isTyping={isTyping}
          />
        ))}
      </div>
    </div>
  );
};
