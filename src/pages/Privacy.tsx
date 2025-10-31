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
                Denna integritetspolicy beskriver hur vi samlar in, använder och skyddar dina personuppgifter när du använder Routo. Vi värnar om din integritet och är transparenta med hur vi hanterar dina uppgifter.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Personuppgiftsansvarig</h2>
              <p className="text-muted-foreground">
                Routo AB<br />
                Organisationsnummer: 559999-9999<br />
                Stockholm, Sverige<br />
                E-post: privacy@routo.se<br />
                Telefon: 08-123 45 67
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
                <strong>Lagringstider:</strong>
              </p>
              <table className="w-full text-sm text-muted-foreground border-collapse mb-4">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Datatyp</th>
                    <th className="text-left py-2 px-2">Lagringstid</th>
                    <th className="text-left py-2 px-2">Rättslig grund</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 px-2">Kontouppgifter</td>
                    <td className="py-2 px-2">Kontots livstid + 1 månad</td>
                    <td className="py-2 px-2">Avtal</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-2">Offerter (accepterade)</td>
                    <td className="py-2 px-2">7 år efter godkännande</td>
                    <td className="py-2 px-2">Rättslig förpliktelse (Bokföringslagen)</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-2">Kundpersonuppgifter (personnummer)</td>
                    <td className="py-2 px-2">7 år (ROT/RUT-krav)</td>
                    <td className="py-2 px-2">Rättslig förpliktelse</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-2">Konversationsloggar</td>
                    <td className="py-2 px-2">12 månader</td>
                    <td className="py-2 px-2">Berättigat intresse</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-2">Säkerhetsloggar (IP, user agent)</td>
                    <td className="py-2 px-2">90 dagar</td>
                    <td className="py-2 px-2">Berättigat intresse</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-2">Marknadsföringssamtycke</td>
                    <td className="py-2 px-2">Tills återkallat</td>
                    <td className="py-2 px-2">Samtycke</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-muted-foreground mb-2">
                <strong>Säkerhetsåtgärder:</strong>
              </p>
              <p className="text-muted-foreground">
                Vi använder branschstandarder för att skydda dina uppgifter, inklusive:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-2">
                <li>AES-256 kryptering av känsliga personuppgifter (personnummer)</li>
                <li>HTTPS/TLS för all kommunikation</li>
                <li>Säkra datacenters i EU (Stockholm)</li>
                <li>Regelbundna säkerhetskopior</li>
                <li>Åtkomstkontroller och auditloggning</li>
                <li>Automatisk kryptering av personnummer vid lagring</li>
              </ul>
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
                För att utöva dina rättigheter, kontakta oss på info@routo.se.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Automatiserat beslutsfattande</h2>
              <p className="text-muted-foreground mb-2">
                Routo använder artificiell intelligens (AI) för att generera offertförslag baserat på:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Din projektbeskrivning</li>
                <li>Historiska offerter från andra användare (anonymiserade)</li>
                <li>Marknadspriser på material och arbete</li>
                <li>Branschstandarder och erfarenhetsdata</li>
              </ul>
              <p className="text-muted-foreground mt-3 mb-2">
                <strong>Viktigt att veta:</strong>
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>AI:n är ett hjälpmedel - alla offerter måste granskas och godkännas av dig innan de skickas</li>
                <li>Du har rätt att granska och redigera alla AI-genererade offerter</li>
                <li>Du kan begära mänsklig granskning av prisförslag genom att kontakta support</li>
                <li>AI:n fattar inga bindande beslut som påverkar dig juridiskt utan ditt godkännande</li>
                <li>Alla priser och beräkningar är förslag som du ansvarar för att verifiera</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Cookies och spårning</h2>
              <p className="text-muted-foreground">
                Vi använder endast nödvändiga cookies för att tjänsten ska fungera (autentisering och sessionhantering). Vi använder inte cookies för marknadsföring eller spårning.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Ändringar i integritetspolicyn</h2>
              <p className="text-muted-foreground">
                Vi kan uppdatera denna integritetspolicy från tid till annan. Vi kommer att meddela dig om väsentliga ändringar via e-post eller genom ett meddelande i tjänsten.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">12. Kontakt</h2>
              <p className="text-muted-foreground">
                Om du har frågor om denna integritetspolicy eller hur vi behandlar dina personuppgifter, kontakta oss på:
              </p>
              <p className="text-muted-foreground mt-2">
                <strong>Personuppgiftsfrågor:</strong><br />
                E-post: privacy@routo.se<br />
                Telefon: 08-123 45 67<br />
                Adress: Routo AB, [Gatuadress], Stockholm, Sverige
              </p>
              <p className="text-muted-foreground mt-3">
                <strong>Klagomål och tillsyn:</strong><br />
                Du har rätt att lämna in ett klagomål till Integritetsskyddsmyndigheten (IMY) om du anser att behandlingen av dina personuppgifter inte sker i enlighet med GDPR.
              </p>
              <p className="text-muted-foreground mt-2">
                Integritetsskyddsmyndigheten (IMY)<br />
                Box 8114<br />
                104 20 Stockholm<br />
                Telefon: 08-657 61 00<br />
                E-post: imy@imy.se<br />
                Webbplats: www.imy.se
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Privacy;
