import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

interface EquipmentRate {
  id: string;
  name: string;
  equipment_type: string;
  price_per_day: number | null;
  price_per_hour: number | null;
  is_rented: boolean;
  default_quantity: number;
}

interface EquipmentRatesManagerProps {
  userId: string;
}

const EquipmentRatesManager = ({ userId }: EquipmentRatesManagerProps) => {
  const [rates, setRates] = useState<EquipmentRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newIsRented, setNewIsRented] = useState(false);
  const [newPriceType, setNewPriceType] = useState<"day" | "hour">("day");
  const [newQuantity, setNewQuantity] = useState("1");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadRates();
  }, [userId]);

  const loadRates = async () => {
    try {
      const { data, error } = await supabase
        .from("equipment_rates")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRates(data || []);
    } catch (error) {
      console.error("Error loading equipment rates:", error);
      toast.error("Kunde inte ladda maskiner");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newType.trim() || !newPrice) {
      toast.error("Fyll i maskinnamn, typ och pris");
      return;
    }

    setAdding(true);
    try {
      const priceValue = parseInt(newPrice);
      if (isNaN(priceValue) || priceValue < 0) {
        toast.error("Priset måste vara ett giltigt nummer");
        return;
      }

      const quantityValue = parseInt(newQuantity);
      if (isNaN(quantityValue) || quantityValue < 1) {
        toast.error("Antal måste vara minst 1");
        return;
      }

      const { error } = await supabase.from("equipment_rates").insert({
        user_id: userId,
        name: newName.trim(),
        equipment_type: newType.trim(),
        price_per_day: newPriceType === "day" ? priceValue : null,
        price_per_hour: newPriceType === "hour" ? priceValue : null,
        is_rented: newIsRented,
        default_quantity: quantityValue,
      });

      if (error) throw error;

      toast.success("Maskin tillagd!");
      setNewName("");
      setNewType("");
      setNewPrice("");
      setNewIsRented(false);
      setNewPriceType("day");
      setNewQuantity("1");
      loadRates();
    } catch (error) {
      console.error("Error adding equipment:", error);
      toast.error("Kunde inte lägga till maskin");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("equipment_rates")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Maskin borttagen");
      loadRates();
    } catch (error) {
      console.error("Error deleting equipment:", error);
      toast.error("Kunde inte ta bort maskin");
    }
  };

  const handleUpdate = async (id: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from("equipment_rates")
        .update({ [field]: value })
        .eq("id", id);

      if (error) throw error;

      setRates(
        rates.map((rate) => (rate.id === id ? { ...rate, [field]: value } : rate))
      );
      toast.success("Uppdaterad!");
    } catch (error) {
      console.error("Error updating equipment:", error);
      toast.error("Kunde inte uppdatera");
    }
  };

  if (loading) {
    return <div className="animate-pulse">Laddar maskiner...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Existing equipment */}
      {rates.length > 0 ? (
        <div className="space-y-4">
          {rates.map((rate) => (
            <div
              key={rate.id}
              className="p-4 rounded-lg border bg-muted/30 space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Maskinnamn</Label>
                      <Input
                        value={rate.name}
                        onChange={(e) =>
                          handleUpdate(rate.id, "name", e.target.value)
                        }
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Typ</Label>
                      <Input
                        value={rate.equipment_type}
                        onChange={(e) =>
                          handleUpdate(rate.id, "equipment_type", e.target.value)
                        }
                        className="h-9"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">
                        Pris ({rate.price_per_day ? "kr/dag" : "kr/timme"})
                      </Label>
                      <Input
                        type="number"
                        value={rate.price_per_day || rate.price_per_hour || 0}
                        onChange={(e) => {
                          const field = rate.price_per_day
                            ? "price_per_day"
                            : "price_per_hour";
                          handleUpdate(
                            rate.id,
                            field,
                            parseInt(e.target.value) || 0
                          );
                        }}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Antal</Label>
                      <Input
                        type="number"
                        value={rate.default_quantity}
                        onChange={(e) =>
                          handleUpdate(
                            rate.id,
                            "default_quantity",
                            parseInt(e.target.value) || 1
                          )
                        }
                        className="h-9"
                      />
                    </div>
                    <div className="flex items-end">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={rate.is_rented}
                          onCheckedChange={(checked) =>
                            handleUpdate(rate.id, "is_rented", checked)
                          }
                        />
                        <Label className="text-xs">
                          {rate.is_rented ? "Hyrd" : "Ägd"}
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(rate.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">
          Inga maskiner eller utrustning tillagd ännu
        </p>
      )}

      {/* Add new equipment */}
      <div className="p-4 rounded-lg border border-dashed space-y-4">
        <h3 className="font-medium">Lägg till maskin/utrustning</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Maskinnamn</Label>
              <Input
                placeholder="t.ex. Grävskopa CAT 320"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <Label>Typ</Label>
              <Input
                placeholder="t.ex. Grävmaskin"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Pris</Label>
              <Input
                type="number"
                placeholder="1200"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
              />
            </div>
            <div>
              <Label>Per</Label>
              <RadioGroup
                value={newPriceType}
                onValueChange={(value: "day" | "hour") => setNewPriceType(value)}
                className="flex gap-4 pt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="day" id="day" />
                  <Label htmlFor="day" className="font-normal">
                    Dag
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="hour" id="hour" />
                  <Label htmlFor="hour" className="font-normal">
                    Timme
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label>Antal</Label>
              <Input
                type="number"
                placeholder="1"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={newIsRented}
              onCheckedChange={setNewIsRented}
            />
            <Label>{newIsRented ? "Hyrd" : "Ägd"}</Label>
          </div>

          <Button
            onClick={handleAdd}
            disabled={adding}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            {adding ? "Lägger till..." : "Lägg till maskin"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EquipmentRatesManager;
