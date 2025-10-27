import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Send, Save, Edit3, Sparkles } from "lucide-react";
import { EstimateSection } from "@/components/estimate/EstimateSection";
import { EstimateSummary } from "@/components/estimate/EstimateSummary";
import { LineItemData } from "@/components/estimate/LineItem";

interface QuoteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: any;
  onSend: () => void;
  onSaveAsDraft: () => void;
  onEdit: () => void;
  isDraft?: boolean; // FAS 22
  onRefine?: () => void; // FAS 22
}

export const QuoteSheet = ({ 
  open, 
  onOpenChange, 
  quote, 
  onSend, 
  onSaveAsDraft, 
  onEdit,
  isDraft = false, // FAS 22
  onRefine // FAS 22
}: QuoteSheetProps) => {
  if (!quote) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg animate-in zoom-in-50 duration-500">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <SheetTitle className="text-2xl">🎉 Din offert är klar!</SheetTitle>
              <SheetDescription>
                Granska och skicka till kund
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Quote Display */}
          <div className="space-y-4">
            <div className="bg-card border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">{quote.title || "Offert"}</h3>
              {quote.description && (
                <p className="text-sm text-muted-foreground mb-4">{quote.description}</p>
              )}
              
              {quote.sections?.map((section: any, index: number) => (
                <EstimateSection
                  key={index}
                  title={section.title}
                  items={section.items}
                  onItemUpdate={() => {}}
                  onItemDelete={() => {}}
                  defaultOpen={true}
                />
              ))}
              
              <EstimateSummary
                subtotal={quote.summary?.totalBeforeVAT || 0}
                workCost={quote.summary?.workCost || 0}
                materialCost={quote.summary?.materialCost || 0}
                vat={quote.summary?.vatAmount || quote.summary?.vat || 0}
                totalWithVAT={quote.summary?.totalWithVAT || 0}
                rotRutDeduction={quote.summary?.deduction ? {
                  type: quote.summary.deduction.type,
                  laborCost: quote.summary.deduction.workCostWithVAT || quote.summary.deduction.laborCost || 0,
                  deductionAmount: quote.summary.deduction.deductionAmount || 0,
                  priceAfterDeduction: quote.summary.deduction.priceAfterDeduction || quote.summary?.customerPays || 0,
                  deductionRate: quote.summary.deduction.deductionRate || 0.5,
                } : undefined}
                total={quote.summary?.customerPays || quote.summary?.totalWithVAT || 0}
              />
            </div>

            {quote.notes && quote.notes.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-2">Anteckningar</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  {quote.notes.map((note: string, i: number) => (
                    <li key={i}>• {note}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-4 border-t sticky bottom-0 bg-background pb-4">
            {/* FAS 22: Show "Förfina offerten" button for draft quotes */}
            {isDraft && onRefine && (
              <Button 
                onClick={onRefine}
                className="w-full gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
                size="lg"
              >
                <Sparkles className="h-4 w-4" />
                Förfina offerten (2-3 fler frågor)
              </Button>
            )}
            
            <Button 
              onClick={onSend}
              className="w-full gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
              size="lg"
            >
              <Send className="h-4 w-4" />
              Spara och gå till skicka
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline"
                onClick={onSaveAsDraft}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                Spara som utkast
              </Button>
              <Button 
                variant="outline"
                onClick={onEdit}
                className="gap-2"
              >
                <Edit3 className="h-4 w-4" />
                Redigera
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
