import { useEffect, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SmartScrollProps {
  children: ReactNode;
  className?: string;
  scrollRef: React.RefObject<HTMLDivElement>;
}

export function SmartScroll({ children, className, scrollRef }: SmartScrollProps) {
  
  // Denna effekt körs varje gång 'children' ändras (dvs nytt meddelande)
  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;

    // Spara nuvarande scroll-position innan vi gör något
    const isAtBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 100;

    // Funktion för att scrolla till botten
    const scrollToBottom = () => {
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: "smooth",
      });
    };

    // Scrolla alltid till botten om det är nytt innehåll, eller om användaren redan var längst ner
    // Vi använder en liten timeout för att låta DOM:en uppdateras klart först
    const timeoutId = setTimeout(() => {
      scrollToBottom();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [children, scrollRef]); // Triggar när children (meddelanden) ändras

  return (
    <div 
      ref={scrollRef} 
      className={cn("overflow-y-auto custom-scrollbar scroll-smooth", className)}
    >
      {children}
    </div>
  );
}
