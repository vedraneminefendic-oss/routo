import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const customerSchema = z.object({
  name: z.string().min(1, "Namn krävs").max(100, "Namn får max vara 100 tecken"),
  email: z.string().email("Ogiltig e-postadress").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

interface CustomerFormSimpleProps {
  userId: string;
  onSave: () => void;
  onSkip: () => void;
}

export function CustomerFormSimple({ userId, onSave, onSkip }: CustomerFormSimpleProps) {
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
    },
  });

  const onSubmit = async (data: CustomerFormData) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('customers')
        .insert({
          user_id: userId,
          name: data.name,
          email: data.email || null,
          phone: data.phone || null,
          address: data.address || null,
        });

      if (error) throw error;

      toast.success("Kund sparad!");
      onSave();
    } catch (error: any) {
      console.error('Error saving customer:', error);
      toast.error("Kunde inte spara kund");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="bg-muted/30 p-3 rounded-lg text-sm text-muted-foreground">
        Spara din första kund för att snabbare kunna skapa offerter. Du kan hoppa över och lägga till senare.
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Namn *</Label>
        <Input id="name" placeholder="Anders Andersson" {...register("name")} />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-post</Label>
        <Input id="email" type="email" placeholder="anders@example.com" {...register("email")} />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Telefon</Label>
          <Input id="phone" type="tel" placeholder="070-123 45 67" {...register("phone")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Adress</Label>
          <Input id="address" placeholder="Gatan 1, Stad" {...register("address")} />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onSkip} className="flex-1">
          Hoppa över
        </Button>
        <Button type="submit" disabled={saving} className="flex-1">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Spara och fortsätt
        </Button>
      </div>
    </form>
  );
}
