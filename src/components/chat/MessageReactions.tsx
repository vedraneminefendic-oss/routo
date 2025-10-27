import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MessageReactionsProps {
  messageId: string;
  content: string;
  onFeedback?: (messageId: string, helpful: boolean) => void;
}

export const MessageReactions = ({ messageId, content, onFeedback }: MessageReactionsProps) => {
  const [feedback, setFeedback] = useState<'helpful' | 'unhelpful' | null>(null);
  const [copied, setCopied] = useState(false);

  const handleFeedback = (helpful: boolean) => {
    setFeedback(helpful ? 'helpful' : 'unhelpful');
    onFeedback?.(messageId, helpful);
    toast.success(helpful ? "Tack för din feedback! 👍" : "Tack för din feedback. Vi förbättrar oss! 👎");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Kopierat till urklipp!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Kunde inte kopiera");
    }
  };

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7 hover:bg-accent/50 transition-colors",
          feedback === 'helpful' && "bg-green-500/20 text-green-600 dark:text-green-400"
        )}
        onClick={() => handleFeedback(true)}
        disabled={feedback !== null}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7 hover:bg-accent/50 transition-colors",
          feedback === 'unhelpful' && "bg-red-500/20 text-red-600 dark:text-red-400"
        )}
        onClick={() => handleFeedback(false)}
        disabled={feedback !== null}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 hover:bg-accent/50 transition-colors"
        onClick={handleCopy}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
};
