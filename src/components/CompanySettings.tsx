import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Upload, X } from "lucide-react";

const companySchema = z.object({
  company_name: z.string().min(1, "Företagsnamn krävs"),
  org_number: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Ogiltig e-postadress").optional().or(z.literal("")),
  vat_number: z.string().optional(),
  has_f_skatt: z.boolean(),
});

type CompanyFormData = z.infer<typeof companySchema>;

interface CompanySettingsProps {
  userId: string;
}

const CompanySettings = ({ userId }: CompanySettingsProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      has_f_skatt: true,
    },
  });

  useEffect(() => {
    loadSettings();
  }, [userId]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Befintlig användare
        reset({
          company_name: data.company_name || "",
          org_number: data.org_number || "",
          address: data.address || "",
          phone: data.phone || "",
          email: data.email || "",
          vat_number: data.vat_number || "",
          has_f_skatt: data.has_f_skatt ?? true,
        });
        setLogoUrl(data.logo_url);
      } else {
        // NY ANVÄNDARE - Hämta uppgifter från auth.users
        setIsNewUser(true);
        setShowWelcome(true);
        
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          reset({
            company_name: user.user_metadata?.full_name || "",
            email: user.email || "",
            has_f_skatt: true,
          });
        }
      }
    } catch (error: any) {
      console.error('Error loading settings:', error);
      toast.error("Kunde inte ladda inställningar");
    } finally {
      setLoading(false);
    }
  };

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
          vat_number: data.vat_number || null,
          has_f_skatt: data.has_f_skatt,
          logo_url: logoUrl,
        }, { onConflict: 'user_id' });

      if (error) throw error;

      // Dölj välkomstmeddelande efter första sparningen
      if (isNewUser) {
        setIsNewUser(false);
        setShowWelcome(false);
      }

      toast.success("Inställningar sparade!");
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error("Kunde inte spara inställningar");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Vänligen välj en bildfil");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      setLogoUrl(publicUrl);
      toast.success("Logotyp uppladdad!");
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast.error("Kunde inte ladda upp logotyp");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!logoUrl) return;

    try {
      const path = logoUrl.split('/company-logos/')[1];
      if (path) {
        await supabase.storage.from('company-logos').remove([path]);
      }
      setLogoUrl(null);
      toast.success("Logotyp borttagen");
    } catch (error: any) {
      console.error('Error removing logo:', error);
      toast.error("Kunde inte ta bort logotyp");
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {showWelcome && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">
                Välkommen till ditt offertverktyg! 👋
              </h3>
              <p className="text-sm text-blue-700">
                Vi har förfyllt dina uppgifter från ditt konto. Komplettera med företagsinformation 
                som visas på dina offerter, och spara sedan för att komma igång.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowWelcome(false)}
              className="text-blue-600 hover:text-blue-800"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      
      {/* Logo Upload */}
      <div className="space-y-2">
        <Label>Logotyp</Label>
        {logoUrl ? (
          <div className="relative inline-block">
            <img src={logoUrl} alt="Company logo" className="h-24 w-auto rounded-lg border" />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6"
              onClick={handleRemoveLogo}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              id="logo-upload"
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              disabled={uploading}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById('logo-upload')?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Ladda upp logotyp
            </Button>
          </div>
        )}
      </div>

      {/* Company Name */}
      <div className="space-y-2">
        <Label htmlFor="company_name">Företagsnamn *</Label>
        <Input id="company_name" {...register("company_name")} />
        {errors.company_name && (
          <p className="text-sm text-destructive">{errors.company_name.message}</p>
        )}
      </div>

      {/* Organization Number */}
      <div className="space-y-2">
        <Label htmlFor="org_number">Organisationsnummer</Label>
        <Input id="org_number" placeholder="XXXXXX-XXXX" {...register("org_number")} />
      </div>

      {/* Address */}
      <div className="space-y-2">
        <Label htmlFor="address">Adress</Label>
        <Input id="address" {...register("address")} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone">Telefonnummer</Label>
          <Input id="phone" type="tel" {...register("phone")} />
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">E-post</Label>
          <Input id="email" type="email" {...register("email")} />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>
      </div>

      {/* VAT Number */}
      <div className="space-y-2">
        <Label htmlFor="vat_number">Momsregistreringsnummer (VAT-nr)</Label>
        <Input id="vat_number" placeholder="SE..." {...register("vat_number")} />
      </div>

      {/* F-skatt */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="has_f_skatt" className="text-base cursor-pointer">
            Innehar F-skattsedel
          </Label>
          <p className="text-sm text-muted-foreground">
            Visas på offerten om aktiverad
          </p>
        </div>
        <Switch id="has_f_skatt" {...register("has_f_skatt")} className="data-[state=checked]:bg-secondary" />
      </div>

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        Spara inställningar
      </Button>
    </form>
  );
};

export default CompanySettings;
