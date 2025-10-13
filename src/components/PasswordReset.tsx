import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const PasswordReset = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Återställningslänk skickad! Kolla din e-post.");
      setSent(true);
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          Vi har skickat en återställningslänk till <strong>{email}</strong>.
          Kolla din inkorg och följ instruktionerna.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleReset} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reset-email">E-postadress</Label>
        <Input
          id="reset-email"
          type="email"
          placeholder="din@epost.se"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Skickar..." : "Skicka återställningslänk"}
      </Button>
    </form>
  );
};
