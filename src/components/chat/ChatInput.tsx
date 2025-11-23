import { useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SendHorizontal, Loader2 } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, isLoading, placeholder }: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSend(input);
      setInput("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-2 items-end bg-white rounded-lg border border-slate-200 p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || "Beskriv vad du behöver hjälp med..."}
        className="min-h-[20px] max-h-[120px] border-0 focus-visible:ring-0 p-2 resize-none bg-transparent text-slate-800 placeholder:text-slate-400"
        disabled={isLoading}
        rows={1}
        style={{ height: 'auto', minHeight: '44px' }}
      />
      <Button 
        onClick={handleSend} 
        disabled={isLoading || !input.trim()}
        size="icon"
        className={`h-10 w-10 shrink-0 transition-all ${
          input.trim() ? 'bg-primary hover:bg-primary/90' : 'bg-slate-200 text-slate-400'
        }`}
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <SendHorizontal className="h-5 w-5" />
        )}
      </Button>
    </div>
  );
}
