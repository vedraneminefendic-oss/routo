import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, CheckCircle2, ArrowLeft, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Install() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);
    
    // Detect Android
    const android = /Android/.test(navigator.userAgent);
    setIsAndroid(android);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Capture the install prompt event (Android/Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <header className="border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container mx-auto px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Tillbaka
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex p-4 bg-primary/10 rounded-full mb-4">
            <Smartphone className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Installera Routo på din enhet</h1>
          <p className="text-muted-foreground">
            Få snabb åtkomst och bättre prestanda med vår app
          </p>
        </div>

        {isInstalled ? (
          <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-900 dark:text-green-100">
                <CheckCircle2 className="h-5 w-5" />
                App installerad!
              </CardTitle>
              <CardDescription className="text-green-700 dark:text-green-300">
                Routo finns nu på din hemskärm
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/dashboard')} className="w-full">
                Öppna Routo
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Android/Desktop - PWA Install */}
            {deferredPrompt && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-primary" />
                    Snabbinstallation
                  </CardTitle>
                  <CardDescription>
                    Klicka nedan för att installera Routo som en app
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleInstallClick} className="w-full" size="lg">
                    Installera nu
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* iOS Instructions */}
            {isIOS && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-primary" />
                    Instruktioner för iPhone/iPad
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="flex-shrink-0">1</Badge>
                      <p className="text-sm">
                        Tryck på delningsikonen <strong>⬆️</strong> längst ner i Safari
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="flex-shrink-0">2</Badge>
                      <p className="text-sm">
                        Scrolla ner och välj <strong>"Lägg till på hemskärmen"</strong>
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="flex-shrink-0">3</Badge>
                      <p className="text-sm">
                        Tryck på <strong>"Lägg till"</strong> i övre högra hörnet
                      </p>
                    </div>
                  </div>
                  
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      OBS: Detta fungerar endast i Safari-webbläsaren på iOS
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}

            {/* Android Manual Instructions */}
            {isAndroid && !deferredPrompt && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-primary" />
                    Manuell installation (Android)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="flex-shrink-0">1</Badge>
                      <p className="text-sm">
                        Tryck på menyikonen <strong>⋮</strong> i Chrome
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="flex-shrink-0">2</Badge>
                      <p className="text-sm">
                        Välj <strong>"Installera app"</strong> eller <strong>"Lägg till på startskärmen"</strong>
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="flex-shrink-0">3</Badge>
                      <p className="text-sm">
                        Bekräfta installationen
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Benefits */}
            <Card>
              <CardHeader>
                <CardTitle>Fördelar med appen</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Snabb åtkomst från hemskärmen
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Fungerar offline när den installerats
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Snabbare laddningstider
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Helskärmsläge utan webbläsargränssnitt
                  </li>
                </ul>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}