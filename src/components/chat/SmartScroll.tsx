import { useEffect, useRef, ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface SmartScrollProps {
  children: ReactNode;
  className?: string;
  scrollRef: React.RefObject<HTMLDivElement>;
}

export function SmartScroll({ children, className, scrollRef }: SmartScrollProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scrolla till botten varje gång children (meddelanden) ändras
  useEffect(() => {
    // En liten timeout ger DOM:en tid att rita upp det nya meddelandet
    const timeoutId = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [children]);

  return (
    <ScrollArea className={cn("h-full pr-4", className)}>
      <div ref={scrollRef} className="flex flex-col justify-end min-h-full">
        {children}
        {/* En osynlig div i botten som vi scrollar till */}
        <div ref={bottomRef} className="h-px w-full" />
      </div>
    </ScrollArea>
  );
}
