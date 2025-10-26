import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Bell, Clock, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FollowupSettingsProps {
  quoteId?: string;
  currentSettings?: {
    autoFollowupEnabled: boolean;
    followupInterval?: number;
  };
  onSettingsChanged?: () => void;
}

export const FollowupSettings = ({ 
  quoteId, 
  currentSettings,
  onSettingsChanged 
}: FollowupSettingsProps) => {
  const [autoFollowup, setAutoFollowup] = useState(currentSettings?.autoFollowupEnabled ?? true);
  const [followupInterval, setFollowupInterval] = useState(
    currentSettings?.followupInterval?.toString() || '3'
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveSettings = async () => {
    if (!quoteId) {
      toast.error("Inget offert-ID tillgängligt");
      return;
    }

    setIsSaving(true);
    try {
      // Beräkna nästa followup-tid
      const nextFollowup = new Date();
      nextFollowup.setDate(nextFollowup.getDate() + parseInt(followupInterval));

      const { error } = await supabase
        .from('quotes')
        .update({
          auto_followup_enabled: autoFollowup,
          next_followup_at: autoFollowup ? nextFollowup.toISOString() : null,
        })
        .eq('id', quoteId);

      if (error) throw error;

      toast.success("Uppföljningsinställningar sparade!");
      if (onSettingsChanged) {
        onSettingsChanged();
      }
    } catch (error: any) {
      console.error('Error saving followup settings:', error);
      toast.error("Kunde inte spara inställningar");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-2 border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Automatisk uppföljning
        </CardTitle>
        <CardDescription>
          Få automatiska påminnelser om offerter som behöver följas upp
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-followup" className="text-base">
              Aktivera automatisk uppföljning
            </Label>
            <p className="text-sm text-muted-foreground">
              Skicka påminnelser till kunder som inte svarat
            </p>
          </div>
          <Switch
            id="auto-followup"
            checked={autoFollowup}
            onCheckedChange={setAutoFollowup}
          />
        </div>

        {autoFollowup && (
          <div className="space-y-2">
            <Label htmlFor="interval" className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Påminnelseintervall
            </Label>
            <Select value={followupInterval} onValueChange={setFollowupInterval}>
              <SelectTrigger id="interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 dagar</SelectItem>
                <SelectItem value="7">7 dagar (1 vecka)</SelectItem>
                <SelectItem value="14">14 dagar (2 veckor)</SelectItem>
                <SelectItem value="21">21 dagar (3 veckor)</SelectItem>
                <SelectItem value="30">30 dagar (1 månad)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Påminnelse skickas om kunden inte har svarat inom vald tid
            </p>
          </div>
        )}

        {quoteId && (
          <Button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="w-full bg-gradient-to-r from-primary to-primary/80"
          >
            <Mail className="h-4 w-4 mr-2" />
            {isSaving ? 'Sparar...' : 'Spara inställningar'}
          </Button>
        )}

        {!quoteId && (
          <p className="text-sm text-muted-foreground text-center">
            Spara offerten först för att aktivera automatisk uppföljning
          </p>
        )}
      </CardContent>
    </Card>
  );
};