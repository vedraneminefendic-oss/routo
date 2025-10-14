import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useState } from "react";

const companySchema = z.object({
  company_name: z.string().min(1, "Företagsnamn krävs").max(100, "Företagsnamn får max vara 100 tecken"),
  org_number: z.string().optional().refine(
    (val) => !val || /^\d{6}-?\d{4}$/.test(val),
    "Ogiltigt organisationsnummer (format: XXXXXX-XXXX)"
  ),
  address: z.string().optional(),
  phone: z.string().optional().refine(
    (val) => !val || /^[\d\s\-+()]+$/.test(val),
    "Ogiltigt telefonnummer"
  ),
  email: z.string().email("Ogiltig e-postadress").optional().or(z.literal("")),
});

type CompanyFormData = z.infer<typeof companySchema>;

interface CompanySettingsFormProps {
  userId: string;
  onSave: () => void;
  onSkip: () => void;
}

export function CompanySettingsForm({ userId, onSave, onSkip }: CompanySettingsFormProps) {
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      company_name: "",
      org_number: "",
      address: "",
      phone: "",
      email: "",
    },
  });

  const onSubmit = async (data: CompanyFormData) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('company_settings')
        .upsert({
          user_id: userId,
          company_name: data.company_name,
          org_number: data.org_number || null,
          address: data.address || null,
          phone: data.phone || null,
          email: data.email || null,
          has_f_skatt: true,
        }, { onConflict: 'user_id' });

      if (error) throw error;

      toast.success("Företagsinformation sparad!");
      onSave();
    } catch (error: any) {
      console.error('Error saving company settings:', error);
      toast.error("Kunde inte spara företagsinformation");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="bg-muted/30 p-3 rounded-lg text-sm text-muted-foreground">
        Denna information visas på dina offerter. Du kan hoppa över och fylla i senare via Inställningar.
      </div>

      <div className="space-y-2">
        <Label htmlFor="company_name">Företagsnamn *</Label>
        <Input id="company_name" placeholder="Ditt företag AB" {...register("company_name")} />
        {errors.company_name && (
          <p className="text-sm text-destructive">{errors.company_name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="org_number">Organisationsnummer</Label>
        <Input id="org_number" placeholder="XXXXXX-XXXX" {...register("org_number")} />
        {errors.org_number && (
          <p className="text-sm text-destructive">{errors.org_number.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Adress</Label>
        <Input id="address" placeholder="Gatan 1, 123 45 Stad" {...register("address")} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Telefonnummer</Label>
          <Input id="phone" type="tel" placeholder="070-123 45 67" {...register("phone")} />
          {errors.phone && (
            <p className="text-sm text-destructive">{errors.phone.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-post</Label>
          <Input id="email" type="email" placeholder="info@företag.se" {...register("email")} />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
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
