import { useEffect, useRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SmartScrollProps {
  children: ReactNode;
  className?: string;
  scrollRef: React.RefObject<HTMLDivElement>;
}

export function SmartScroll({ children, className, scrollRef }: SmartScrollProps) {
  const isFirstRender = useRef(true);

  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;

    const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: behavior,
        });
      }
    };

    // Scrolla direkt vid första laddning
    if (isFirstRender.current) {
      scrollToBottom("auto");
      isFirstRender.current = false;
      return;
    }

    // Smart scroll: Scrolla bara om vi är nära botten ELLER om det är nytt innehåll
    const isAtBottom = 
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 150;

    if (isAtBottom) {
      const timeoutId = setTimeout(() => {
        scrollToBottom("smooth");
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [children, scrollRef]); 

  return (
    <div 
      ref={scrollRef} 
      className={cn(
        "flex-1 overflow-y-auto pr-4 pl-4", // Standard padding och scroll
        "scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent", // Försök till snygg scrollbar via Tailwind
        className
      )}
    >
      {children}
    </div>
  );
}
