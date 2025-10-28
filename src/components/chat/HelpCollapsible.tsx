import { useState } from "react";
import { HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface HelpCollapsibleProps {
  autoHideAfterMessages?: number;
  currentMessageCount: number;
}

export const HelpCollapsible = ({ 
  autoHideAfterMessages = 3, 
  currentMessageCount 
}: HelpCollapsibleProps) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Auto-hide after X messages
  if (currentMessageCount > autoHideAfterMessages) {
    return null;
  }
  
  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 py-2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full hover:opacity-80 transition-opacity">
          <Badge variant="outline" className="gap-1.5 py-1 cursor-pointer">
            <HelpCircle className="h-3 w-3" />
            <span className="text-xs">Tips: Klicka för att lära dig inkludera/exkludera</span>
            {isOpen ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </Badge>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-2 space-y-1 text-xs">
          <p className="text-muted-foreground">✅ "Vi tar hand om X" = X läggs till i offerten</p>
          <p className="text-muted-foreground">❌ "Kunden tar hand om X" = X tas bort från offerten</p>
          <p className="text-muted-foreground">✏️ "X ska finnas med" = X läggs till</p>
          <p className="text-muted-foreground">🗑️ "X ska inte ingå" = X tas bort</p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
