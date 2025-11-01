import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Check, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LineItemData {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  description?: string; // Optional description for work items
  workerType?: string; // Optional worker type (e.g., "Elektriker", "Rörmokare")
  rotEligible?: boolean; // Optional ROT/RUT eligibility flag
  rotAmount?: number; // Optional ROT/RUT eligible amount
}

interface LineItemProps {
  item: LineItemData;
  onUpdate: (updatedItem: LineItemData) => void;
  onDelete: () => void;
}

export const LineItem = ({ item, onUpdate, onDelete }: LineItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedItem, setEditedItem] = useState(item);

  const total = item.quantity * item.unitPrice;

  const handleSave = () => {
    onUpdate(editedItem);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedItem(item);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="p-4 bg-muted/30">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">
              Beskrivning
            </label>
            <Input
              value={editedItem.name}
              onChange={(e) => setEditedItem({ ...editedItem, name: e.target.value })}
              className="h-9"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Antal
            </label>
            <Input
              type="number"
              value={editedItem.quantity}
              onChange={(e) => setEditedItem({ ...editedItem, quantity: parseFloat(e.target.value) || 0 })}
              className="h-9"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Pris/enhet
            </label>
            <Input
              type="number"
              value={editedItem.unitPrice}
              onChange={(e) => setEditedItem({ ...editedItem, unitPrice: parseFloat(e.target.value) || 0 })}
              className="h-9"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              size="sm"
              variant="default"
              onClick={handleSave}
              className="flex-1"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              className="flex-1"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group p-4 hover:bg-muted/30 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground mb-1">
            {item.name}
          </div>
          <div className="text-sm text-muted-foreground">
            {item.quantity} {item.unit} × {item.unitPrice.toLocaleString('sv-SE')} kr
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="font-semibold text-foreground">
              {total.toLocaleString('sv-SE')} kr
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
