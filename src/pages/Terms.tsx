import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Terms = () => {
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
            <CardTitle className="text-3xl">Användarvillkor</CardTitle>
            <p className="text-sm text-muted-foreground">Senast uppdaterad: {new Date().toLocaleDateString('sv-SE')}</p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Allmänt</h2>
              <p className="text-muted-foreground">
                Dessa användarvillkor ("Villkoren") reglerar din användning av Offertverktyget ("Tjänsten") som tillhandahålls av [Ditt företagsnamn] ("vi", "oss", "vår"). Genom att använda Tjänsten accepterar du dessa Villkor i sin helhet.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Användarkonto</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Du måste skapa ett konto för att använda Tjänsten</li>
                <li>Du ansvarar för att hålla dina inloggningsuppgifter säkra</li>
                <li>Du måste vara minst 18 år gammal för att skapa ett konto</li>
                <li>Du ansvarar för all aktivitet som sker under ditt konto</li>
                <li>Du måste meddela oss omedelbart om obehörig användning av ditt konto</li>
                <li>Ett konto får endast användas av en person</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Tjänstens syfte</h2>
              <p className="text-muted-foreground">
                Tjänsten tillhandahåller verktyg för att skapa, hantera och skicka offerter. Du kan:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Generera offerter baserat på beskrivningar</li>
                <li>Redigera och anpassa offerter</li>
                <li>Skicka offerter via e-post till kunder</li>
                <li>Spara och hantera din offerthistorik</li>
                <li>Konfigurera företagsinformation och priser</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Användarens skyldigheter</h2>
              <p className="text-muted-foreground mb-2">
                Du förbinder dig att:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Endast använda Tjänsten för lagliga ändamål</li>
                <li>Inte missbruka eller störa Tjänsten</li>
                <li>Inte försöka få obehörig åtkomst till Tjänsten</li>
                <li>Inte dela ditt konto med andra</li>
                <li>Ange korrekt och sanningsenlig information</li>
                <li>Följa svensk lag och dessa Villkor</li>
                <li>Respektera tredje parts rättigheter</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Äganderätt och licens</h2>
              <p className="text-muted-foreground mb-3">
                <strong>Tjänsten:</strong> Vi äger all rätt, titel och intresse i Tjänsten, inklusive alla immateriella rättigheter. Du får en begränsad, icke-exklusiv och återkallelig licens att använda Tjänsten enligt dessa Villkor.
              </p>
              <p className="text-muted-foreground">
                <strong>Ditt innehåll:</strong> Du behåller alla rättigheter till innehållet du skapar med Tjänsten (offerter, kundinformation, etc.). Genom att använda Tjänsten ger du oss rätt att lagra och behandla ditt innehåll i syfte att tillhandahålla Tjänsten.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Betalning och prissättning</h2>
              <p className="text-muted-foreground">
                [Anpassa detta avsnitt baserat på din prismodell]
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Priser och betalningsvillkor anges på vår webbplats</li>
                <li>Alla priser anges exklusive moms om inte annat anges</li>
                <li>Vi förbehåller oss rätten att ändra priser med 30 dagars varsel</li>
                <li>Betalning sker i förskott via angivna betalningsmetoder</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Tjänstens tillgänglighet</h2>
              <p className="text-muted-foreground">
                Vi strävar efter att hålla Tjänsten tillgänglig dygnet runt, men kan inte garantera 100% drifttid. Vi förbehåller oss rätten att:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Utföra planerat underhåll (med förvarning)</li>
                <li>Tillfälligt stänga av Tjänsten för akuta åtgärder</li>
                <li>Modifiera eller uppdatera Tjänsten</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Ansvarsbegränsning</h2>
              <p className="text-muted-foreground mb-2">
                Tjänsten tillhandahålls "som den är" utan garantier av något slag. Vi ansvarar inte för:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Fel eller brister i genererade offerter</li>
                <li>Förlust av data eller affärsmöjligheter</li>
                <li>Indirekta skador eller följdskador</li>
                <li>Avbrott i tjänsten</li>
                <li>Innehåll som du skapar eller skickar</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                <strong>Viktigt:</strong> Du ansvarar för att granska och verifiera alla offerter innan de skickas till kunder. Vi ansvarar inte för eventuella fel i prissättning, beräkningar eller innehåll.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Uppsägning</h2>
              <p className="text-muted-foreground mb-2">
                <strong>Din rätt att säga upp:</strong> Du kan när som helst avsluta ditt konto genom att kontakta vår support.
              </p>
              <p className="text-muted-foreground">
                <strong>Vår rätt att säga upp:</strong> Vi kan stänga av eller radera ditt konto omedelbart om du bryter mot dessa Villkor, utan föregående meddelande eller återbetalning.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Personuppgifter</h2>
              <p className="text-muted-foreground">
                Din användning av Tjänsten regleras även av vår Integritetspolicy, som beskriver hur vi behandlar dina personuppgifter. Genom att använda Tjänsten accepterar du behandlingen enligt Integritetspolicyn.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Ändringar av villkoren</h2>
              <p className="text-muted-foreground">
                Vi förbehåller oss rätten att ändra dessa Villkor när som helst. Väsentliga ändringar meddelas via e-post eller genom ett meddelande i Tjänsten. Din fortsatta användning efter ändringar innebär att du accepterar de nya Villkoren.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">12. Force majeure</h2>
              <p className="text-muted-foreground">
                Vi ansvarar inte för förseningar eller underlåtenhet att uppfylla våra åtaganden på grund av omständigheter utanför vår kontroll, såsom naturkatastrofer, krig, terrordåd, myndighetsbeslut, arbetskonflikt, eller fel i kommunikations- eller transportsystem.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">13. Tillämplig lag och tvister</h2>
              <p className="text-muted-foreground">
                Dessa Villkor regleras av svensk lag. Eventuella tvister ska i första hand lösas genom förhandling. Om parterna inte kan enas ska tvisten avgöras av svensk domstol.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">14. Kontaktinformation</h2>
              <p className="text-muted-foreground">
                För frågor om dessa Villkor, kontakta oss på:
              </p>
              <p className="text-muted-foreground mt-2">
                [Ditt företagsnamn]<br />
                E-post: [din e-postadress]<br />
                Telefon: [ditt telefonnummer]<br />
                Adress: [din adress]
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Terms;
