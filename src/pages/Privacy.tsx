import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Tillbaka
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Integritetspolicy</CardTitle>
            <p className="text-sm text-muted-foreground">Senast uppdaterad: {new Date().toLocaleDateString('sv-SE')}</p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Inledning</h2>
              <p className="text-muted-foreground">
                Denna integritetspolicy beskriver hur vi samlar in, använder och skyddar dina personuppgifter när du använder Offertverktyget. Vi värnar om din integritet och är transparenta med hur vi hanterar dina uppgifter.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Personuppgiftsansvarig</h2>
              <p className="text-muted-foreground">
                [Ditt företagsnamn]<br />
                [Din adress]<br />
                [Din e-postadress]<br />
                [Ditt telefonnummer]
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Vilka personuppgifter vi samlar in</h2>
              <p className="text-muted-foreground mb-2">
                Vi samlar in följande kategorier av personuppgifter:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li><strong>Kontoinformation:</strong> E-postadress, lösenord (krypterat)</li>
                <li><strong>Företagsinformation:</strong> Företagsnamn, organisationsnummer, adress, telefonnummer, e-post, F-skattsedel status</li>
                <li><strong>Offertdata:</strong> Offertbeskrivningar, timpriser, utrustningspriser, kundinformation</li>
                <li><strong>Teknisk information:</strong> IP-adress, användaragent, loggfiler</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Ändamål med behandlingen</h2>
              <p className="text-muted-foreground mb-2">
                Vi behandlar dina personuppgifter för att:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Tillhandahålla och administrera tjänsten</li>
                <li>Skapa och hantera ditt användarkonto</li>
                <li>Generera och skicka offerter</li>
                <li>Lagra och visa din offerthistorik</li>
                <li>Kommunicera med dig om tjänsten</li>
                <li>Förbättra och utveckla tjänsten</li>
                <li>Uppfylla rättsliga skyldigheter</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Rättslig grund</h2>
              <p className="text-muted-foreground mb-2">
                Vi behandlar dina personuppgifter baserat på:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li><strong>Fullgörande av avtal:</strong> För att tillhandahålla tjänsten</li>
                <li><strong>Berättigat intresse:</strong> För att utveckla och förbättra tjänsten</li>
                <li><strong>Rättslig förpliktelse:</strong> För att uppfylla bokförings- och skattelagstiftning</li>
                <li><strong>Samtycke:</strong> För viss marknadsföring (där tillämpligt)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Delning av personuppgifter</h2>
              <p className="text-muted-foreground mb-2">
                Vi delar dina personuppgifter med:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li><strong>Leverantörer av IT-tjänster:</strong> För hosting och datalagring (Supabase, Lovable Cloud)</li>
                <li><strong>E-postleverantörer:</strong> För att skicka offerter via e-post (Resend)</li>
                <li><strong>AI-tjänster:</strong> För att generera offertinnehåll (anonymiserade förfrågningar)</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                Vi säljer eller hyr aldrig ut dina personuppgifter till tredje part.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Lagring och säkerhet</h2>
              <p className="text-muted-foreground mb-2">
                Vi lagrar dina personuppgifter så länge du har ett aktivt konto. Du kan när som helst begära att få dina uppgifter raderade.
              </p>
              <p className="text-muted-foreground">
                Vi använder branschstandarder för att skydda dina uppgifter, inklusive kryptering, säkra servrar och åtkomstkontroller.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Dina rättigheter</h2>
              <p className="text-muted-foreground mb-2">
                Du har rätt att:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li><strong>Få tillgång:</strong> Begära en kopia av dina personuppgifter</li>
                <li><strong>Rätta:</strong> Korrigera felaktiga eller ofullständiga uppgifter</li>
                <li><strong>Radera:</strong> Begära radering av dina personuppgifter</li>
                <li><strong>Begränsa:</strong> Begära begränsning av behandlingen</li>
                <li><strong>Dataportabilitet:</strong> Få dina uppgifter i ett strukturerat format</li>
                <li><strong>Invända:</strong> Invända mot viss behandling av dina uppgifter</li>
                <li><strong>Återkalla samtycke:</strong> När behandlingen baseras på samtycke</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                För att utöva dina rättigheter, kontakta oss på [din e-postadress].
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Cookies och spårning</h2>
              <p className="text-muted-foreground">
                Vi använder endast nödvändiga cookies för att tjänsten ska fungera (autentisering och sessionhantering). Vi använder inte cookies för marknadsföring eller spårning.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Ändringar i integritetspolicyn</h2>
              <p className="text-muted-foreground">
                Vi kan uppdatera denna integritetspolicy från tid till annan. Vi kommer att meddela dig om väsentliga ändringar via e-post eller genom ett meddelande i tjänsten.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Kontakt</h2>
              <p className="text-muted-foreground">
                Om du har frågor om denna integritetspolicy eller hur vi behandlar dina personuppgifter, kontakta oss på:
              </p>
              <p className="text-muted-foreground mt-2">
                E-post: [din e-postadress]<br />
                Telefon: [ditt telefonnummer]
              </p>
              <p className="text-muted-foreground mt-3">
                Du har också rätt att lämna in ett klagomål till Integritetsskyddsmyndigheten (IMY) om du anser att behandlingen av dina personuppgifter inte sker i enlighet med gällande lagstiftning.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Privacy;
