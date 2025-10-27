import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

export const TypingIndicator = () => {
  return (
    <div className="flex gap-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      {/* Avatar */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-accent to-accent/80 text-accent-foreground ring-2 ring-accent/20 shadow-lg">
        <Bot className="h-5 w-5 animate-pulse" />
      </div>

      {/* Typing Animation */}
      <div className="flex flex-col gap-2 max-w-[80%]">
        <div className="rounded-2xl px-5 py-3 bg-gradient-to-br from-card via-card/95 to-card/90 border border-border/50 rounded-tl-sm shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground font-medium">AI tänker</span>
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
