import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { WORK_TYPES } from "@/lib/workTypes";

interface HourlyRate {
  id: string;
  work_type: string;
  rate: number;
}

interface HourlyRatesManagerProps {
  userId: string;
}

const HourlyRatesManager = ({ userId }: HourlyRatesManagerProps) => {
  const [rates, setRates] = useState<HourlyRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWorkType, setNewWorkType] = useState("");
  const [newRate, setNewRate] = useState("");
  const [adding, setAdding] = useState(false);
  const [customWorkType, setCustomWorkType] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  useEffect(() => {
    loadRates();
  }, [userId]);

  const loadRates = async () => {
    try {
      const { data, error } = await supabase
        .from('hourly_rates')
        .select('*')
        .eq('user_id', userId)
        .order('work_type');

      if (error) throw error;
      setRates(data || []);
    } catch (error: any) {
      console.error('Error loading rates:', error);
      toast.error("Kunde inte ladda timpriser");
    } finally {
      setLoading(false);
    }
  };

  const handleWorkTypeChange = (value: string) => {
    if (value === "custom") {
      setShowCustomInput(true);
      setNewWorkType("");
      setCustomWorkType("");
    } else {
      setShowCustomInput(false);
      setNewWorkType(value);
      setCustomWorkType("");
      
      // Set suggested default rate
      const workType = WORK_TYPES.find(wt => wt.value === value);
      if (workType && !newRate) {
        setNewRate(workType.defaultRate.toString());
      }
    }
  };

  const handleAdd = async () => {
    const finalWorkType = showCustomInput ? customWorkType : newWorkType;
    
    if (!finalWorkType.trim() || !newRate) {
      toast.error("Fyll i både arbetstyp och timpris");
      return;
    }

    const rateNum = parseInt(newRate);
    if (isNaN(rateNum) || rateNum <= 0) {
      toast.error("Ange ett giltigt pris");
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase
        .from('hourly_rates')
        .insert({
          user_id: userId,
          work_type: finalWorkType.trim(),
          rate: rateNum,
        });

      if (error) throw error;

      toast.success("Timpris tillagt!");
      setNewWorkType("");
      setNewRate("");
      setCustomWorkType("");
      setShowCustomInput(false);
      await loadRates();
    } catch (error: any) {
      console.error('Error adding rate:', error);
      toast.error(error.message || "Kunde inte lägga till timpris");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('hourly_rates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success("Timpris borttaget!");
      await loadRates();
    } catch (error: any) {
      console.error('Error deleting rate:', error);
      toast.error("Kunde inte ta bort timpris");
    }
  };

  const handleUpdate = async (id: string, field: 'work_type' | 'rate', value: string | number) => {
    try {
      const { error } = await supabase
        .from('hourly_rates')
        .update({ [field]: value })
        .eq('id', id);

      if (error) throw error;

      setRates(rates.map(r => r.id === id ? { ...r, [field]: value } : r));
      toast.success("Timpris uppdaterat!");
    } catch (error: any) {
      console.error('Error updating rate:', error);
      toast.error("Kunde inte uppdatera timpris");
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Existing Rates */}
      <div className="space-y-3">
        {rates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Inga timpriser tillagda ännu
          </p>
        ) : (
          rates.map((rate) => (
            <div key={rate.id} className="flex items-center gap-3 p-4 rounded-lg border bg-card">
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Arbetstyp</Label>
                  <Input
                    value={rate.work_type}
                    onChange={(e) => handleUpdate(rate.id, 'work_type', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Timpris (kr)</Label>
                  <Input
                    type="number"
                    value={rate.rate}
                    onChange={(e) => handleUpdate(rate.id, 'rate', parseInt(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(rate.id)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Add New Rate */}
      <div className="space-y-3 p-4 rounded-lg border-2 border-dashed">
        <Label className="text-sm font-semibold">Lägg till nytt timpris</Label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="work_type" className="text-xs">Arbetstyp</Label>
            <Select value={showCustomInput ? "custom" : newWorkType} onValueChange={handleWorkTypeChange}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Välj arbetstyp" />
              </SelectTrigger>
              <SelectContent>
                {WORK_TYPES.map((workType) => {
                  const Icon = workType.icon;
                  return (
                    <SelectItem key={workType.value} value={workType.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{workType.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
                <SelectItem value="custom">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    <span>Anpassad arbetstyp...</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            
            {showCustomInput && (
              <Input
                placeholder="Skriv din arbetstyp"
                value={customWorkType}
                onChange={(e) => setCustomWorkType(e.target.value)}
                className="mt-2"
              />
            )}
          </div>
          <div>
            <Label htmlFor="rate" className="text-xs">Timpris (kr)</Label>
            <Input
              id="rate"
              type="number"
              placeholder="t.ex. 700"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <Button onClick={handleAdd} disabled={adding} className="w-full">
          {adding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          Lägg till
        </Button>
      </div>
    </div>
  );
};

export default HourlyRatesManager;
