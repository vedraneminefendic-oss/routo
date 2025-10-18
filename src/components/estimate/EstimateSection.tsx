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
    <div className="border rounded-lg bg-card overflow-hidden">
      {/* Section Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )}
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <span className="text-sm text-muted-foreground">
            ({items.length} {items.length === 1 ? 'post' : 'poster'})
          </span>
        </div>
        <div className="text-lg font-semibold text-foreground">
          {sectionTotal.toLocaleString('sv-SE')} kr
        </div>
      </button>

      {/* Section Content */}
      <div
        className={cn(
          "grid transition-all duration-200",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t divide-y">
            {items.map((item, index) => (
              <LineItem
                key={index}
                item={item}
                onUpdate={(updatedItem) => onItemUpdate(index, updatedItem)}
                onDelete={() => onItemDelete(index)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
