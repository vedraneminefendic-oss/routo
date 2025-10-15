import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

export interface Recipient {
  id: string;
  customer_name: string;
  customer_personnummer: string;
  ownership_share: number; // decimal 0-1
}

interface RecipientsManagerProps {
  recipients: Recipient[];
  onChange: (recipients: Recipient[]) => void;
  deductionType: 'rot' | 'rut' | 'none';
  mode?: 'required' | 'optional';
}

const RecipientsManager = ({ recipients, onChange, deductionType, mode = 'optional' }: RecipientsManagerProps) => {
  const maxDeduction = deductionType === 'rut' ? 75000 : 50000;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const validatePersonnummer = (personnummer: string): boolean => {
    // Accept formats: YYYYMMDD-XXXX, YYMMDD-XXXX, YYYYMMDDXXXX, YYMMDDXXXX
    const pattern = /^(\d{6}|\d{8})-?\d{4}$/;
    return pattern.test(personnummer);
  };

  const addRecipient = () => {
    const newRecipient: Recipient = {
      id: crypto.randomUUID(),
      customer_name: "",
      customer_personnummer: "",
      ownership_share: 0,
    };

    const newRecipients = [...recipients, newRecipient];
    
    // Auto-distribute ownership shares equally
    const equalShare = 1 / newRecipients.length;
    const updatedRecipients = newRecipients.map(r => ({
      ...r,
      ownership_share: equalShare
    }));

    onChange(updatedRecipients);
    toast.success("Mottagare tillagd");
  };

  const removeRecipient = (id: string) => {
    if (recipients.length <= 1) {
      toast.error("Du måste ha minst en mottagare");
      return;
    }

    const newRecipients = recipients.filter(r => r.id !== id);
    
    // Redistribute ownership shares equally
    const equalShare = 1 / newRecipients.length;
    const updatedRecipients = newRecipients.map(r => ({
      ...r,
      ownership_share: equalShare
    }));

    onChange(updatedRecipients);
    toast.success("Mottagare borttagen");
  };

  const updateRecipient = (id: string, field: keyof Recipient, value: any) => {
    const updated = recipients.map(r => 
      r.id === id ? { ...r, [field]: value } : r
    );
    onChange(updated);
  };

  const totalShare = recipients.reduce((sum, r) => sum + r.ownership_share, 0);
  const isValidTotal = Math.abs(totalShare - 1) < 0.01; // Allow small floating point errors

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mottagare för {deductionType.toUpperCase()}-avdrag</CardTitle>
        <CardDescription>
          {mode === 'optional' 
            ? "Personnummer kan läggas till senare, men krävs vid signering av offerten."
            : "Lägg till alla personer som ska dela på avdraget. Skatteverket fördelar automatiskt baserat på ägarandel."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {recipients.map((recipient, index) => (
          <Card key={recipient.id} className="border-2">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm">Mottagare {index + 1}</h4>
                {recipients.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRecipient(recipient.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`name-${recipient.id}`}>
                    Namn{mode === 'required' ? ' *' : ''}
                  </Label>
                  <Input
                    id={`name-${recipient.id}`}
                    value={recipient.customer_name}
                    onChange={(e) => updateRecipient(recipient.id, 'customer_name', e.target.value)}
                    placeholder="Anna Andersson"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor={`personnummer-${recipient.id}`}>
                    Personnummer{mode === 'required' ? ' *' : ''}
                    {recipient.customer_personnummer && (
                      validatePersonnummer(recipient.customer_personnummer) ? (
                        <CheckCircle2 className="inline-block h-4 w-4 ml-2 text-green-600" />
                      ) : (
                        <AlertCircle className="inline-block h-4 w-4 ml-2 text-destructive" />
                      )
                    )}
                  </Label>
                  <Input
                    id={`personnummer-${recipient.id}`}
                    value={recipient.customer_personnummer}
                    onChange={(e) => updateRecipient(recipient.id, 'customer_personnummer', e.target.value)}
                    placeholder="ÅÅÅÅMMDD-XXXX"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor={`share-${recipient.id}`}>
                  Ägarandel (%)
                </Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    id={`share-${recipient.id}`}
                    type="number"
                    value={Math.round(recipient.ownership_share * 100)}
                    onChange={(e) => {
                      const percentage = parseFloat(e.target.value) || 0;
                      updateRecipient(recipient.id, 'ownership_share', Math.min(100, Math.max(0, percentage)) / 100);
                    }}
                    min="0"
                    max="100"
                    step="1"
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">
                    Max {deductionType.toUpperCase()}: {formatCurrency(maxDeduction * recipient.ownership_share)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            onClick={addRecipient}
            className="border-dashed"
          >
            <Plus className="h-4 w-4 mr-2" />
            Lägg till mottagare
          </Button>

          <div className={`flex items-center gap-2 text-sm font-medium ${isValidTotal ? 'text-green-600' : 'text-destructive'}`}>
            {isValidTotal ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Total: {Math.round(totalShare * 100)}%
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4" />
                Total: {Math.round(totalShare * 100)}% (måste vara 100%)
              </>
            )}
          </div>
        </div>

        {mode === 'optional' && (
          <Alert className="bg-muted/50">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Personnummer krävs vid signering</AlertTitle>
            <AlertDescription>
              Du kan lämna personnummer tomt nu och fylla i det senare. 
              Personnummer måste finnas innan kunden kan signera offerten.
            </AlertDescription>
          </Alert>
        )}

        {!isValidTotal && mode === 'required' && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <p className="text-sm text-destructive">
              <AlertCircle className="inline-block h-4 w-4 mr-1" />
              Ägarandelarna måste summera till 100%
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecipientsManager;
