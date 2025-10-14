import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Wrench } from "lucide-react";
import { PasswordReset } from "@/components/PasswordReset";
import Footer from "@/components/Footer";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get("mode") !== "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    // Update mode based on URL parameter
    const mode = searchParams.get("mode");
    if (mode === "signup") {
      setIsLogin(false);
    } else if (mode === "login") {
      setIsLogin(true);
    }
  }, [searchParams]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isLogin && !acceptedTerms) {
      toast.error("Du måste acceptera användarvillkoren för att skapa ett konto");
      return;
    }
    
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast.error("Fel e-post eller lösenord");
          } else {
            toast.error(error.message);
          }
          throw error;
        }
        toast.success("Inloggning lyckades!");
        navigate("/dashboard");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        
        if (error) {
          if (error.message.includes("User already registered")) {
            toast.error("En användare med denna e-post finns redan");
          } else {
            toast.error(error.message);
          }
          throw error;
        }
        toast.success("Konto skapat! Du kan nu logga in.");
        setIsLogin(true);
      }
    } catch (error: any) {
      toast.error(error.message || "Ett fel uppstod");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary rounded-xl">
              <Wrench className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            {isLogin ? "Logga in" : "Skapa konto"}
          </CardTitle>
          <CardDescription>
            {isLogin 
              ? "Logga in för att skapa smarta offerter" 
              : "Kom igång med ditt offertverktyg"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-post</Label>
              <Input
                id="email"
                type="email"
                placeholder="din@epost.se"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Lösenord</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            
            {!isLogin && (
              <div className="flex items-start space-x-2">
                <Checkbox 
                  id="terms" 
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)}
                />
                <label
                  htmlFor="terms"
                  className="text-sm text-muted-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Jag accepterar{" "}
                  <Link to="/terms" className="text-primary hover:underline" target="_blank">
                    användarvillkoren
                  </Link>
                  {" "}och{" "}
                  <Link to="/privacy" className="text-primary hover:underline" target="_blank">
                    integritetspolicyn
                  </Link>
                </label>
              </div>
            )}
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Laddar..." : isLogin ? "Logga in" : "Skapa konto"}
            </Button>
          </form>
          
          {isLogin && (
            <div className="mt-4 text-center">
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-primary hover:underline"
                  >
                    Glömt lösenord?
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Återställ lösenord</DialogTitle>
                    <DialogDescription>
                      Ange din e-postadress så skickar vi en återställningslänk.
                    </DialogDescription>
                  </DialogHeader>
                  <PasswordReset />
                </DialogContent>
              </Dialog>
            </div>
          )}
          
          <div className="mt-4 text-center text-sm space-y-2">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline block w-full"
            >
              {isLogin 
                ? "Har du inget konto? Skapa ett här" 
                : "Har du redan ett konto? Logga in"}
            </button>
            <Link 
              to="/"
              className="text-muted-foreground hover:text-primary hover:underline text-sm block"
            >
              Tillbaka till startsidan
            </Link>
          </div>
        </CardContent>
      </Card>
      </div>
      <Footer />
    </div>
  );
};

export default Auth;