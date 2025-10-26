import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LineItem, LineItemData } from "./LineItem";

interface EstimateSectionProps {
  title: string;
  items: LineItemData[];
  onItemUpdate: (index: number, updatedItem: LineItemData) => void;
  onItemDelete: (index: number) => void;
  defaultOpen?: boolean;
}

export const EstimateSection = ({ 
  title, 
  items, 
  onItemUpdate, 
  onItemDelete,
  defaultOpen = true 
}: EstimateSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const sectionTotal = items.reduce((sum, item) => {
    return sum + (item.quantity * item.unitPrice);
  }, 0);

  return (
    <div className="border-2 rounded-xl bg-gradient-to-br from-card via-card to-card/95 overflow-hidden shadow-lg hover:shadow-xl transition-all duration-500 hover:border-primary/30">
      {/* Section Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 hover:bg-gradient-to-r hover:from-muted/30 hover:to-transparent transition-all duration-300 group"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors duration-300">
            {isOpen ? (
              <ChevronDown className="h-5 w-5 text-primary transition-transform duration-300" />
            ) : (
              <ChevronRight className="h-5 w-5 text-primary transition-transform duration-300" />
            )}
          </div>
          <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors duration-300">
            {title}
          </h3>
          <span className="text-sm text-muted-foreground px-2.5 py-1 rounded-full bg-muted/50 group-hover:bg-primary/10 transition-colors duration-300">
            {items.length} {items.length === 1 ? 'post' : 'poster'}
          </span>
        </div>
        <div className="text-lg font-bold text-primary group-hover:scale-105 transition-transform duration-300">
          {sectionTotal.toLocaleString('sv-SE')} kr
        </div>
      </button>

      {/* Section Content */}
      <div
        className={cn(
          "grid transition-all duration-500 ease-in-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/50 divide-y divide-border/50">
            {items.map((item, index) => (
              <div 
                key={index}
                className="animate-in fade-in-0 slide-in-from-top-2"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <LineItem
                  item={item}
                  onUpdate={(updatedItem) => onItemUpdate(index, updatedItem)}
                  onDelete={() => onItemDelete(index)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
