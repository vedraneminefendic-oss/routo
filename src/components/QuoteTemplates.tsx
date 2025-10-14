import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Paintbrush, Wrench, TreePine, Hammer, Droplet } from "lucide-react";

export interface QuoteTemplate {
  id: string;
  name: string;
  description: string;
  category: "ROT" | "RUT";
  icon: any;
  exampleText: string;
}

export const QUOTE_TEMPLATES: QuoteTemplate[] = [
  {
    id: "bathroom",
    name: "Badrumsrenovering",
    description: "Komplett renovering av badrum",
    category: "ROT",
    icon: Droplet,
    exampleText: "Komplett renovering av badrum ca 6 kvm. Inkluderar rivning av befintligt kakel, ny kakel på golv och väggar, ny duschkabin, toalett, handfat och blandare. Även elarbete för spotlights och golvvärme.",
  },
  {
    id: "painting",
    name: "Målning",
    description: "In- eller utvändig målning",
    category: "ROT",
    icon: Paintbrush,
    exampleText: "Målning av vardagsrum och kök (ca 40 kvm golvyta). Inkluderar spackling, grundning och två lager färg på väggar och tak. Kunden står för material.",
  },
  {
    id: "tree",
    name: "Trädfällning",
    description: "Fällning och bortforsling av träd",
    category: "RUT",
    icon: TreePine,
    exampleText: "Fällning av 2 st stora granar (ca 15 meter höga) i trädgård. Inkluderar bortforsling av grenar och stammar samt stubbar.",
  },
  {
    id: "renovation",
    name: "Köksrenovering",
    description: "Renovering av kök",
    category: "ROT",
    icon: Wrench,
    exampleText: "Renovering av kök ca 12 kvm. Nya luckor, bänkskivor, diskho och blandare. Även el-arbete för nya spotlights och eventuell flyttning av eluttag.",
  },
  {
    id: "maintenance",
    name: "Underhåll & reparation",
    description: "Allmänt underhåll och reparationer",
    category: "ROT",
    icon: Hammer,
    exampleText: "Diverse underhållsarbeten: Byte av 3 st fönster, lagning av sprucken puts på fasad (ca 5 kvm), justering av ytterdörr som är svår att öppna.",
  },
  {
    id: "cleaning",
    name: "Städning",
    description: "Hemstädning",
    category: "RUT",
    icon: Paintbrush,
    exampleText: "Grundlig hemstädning av villa ca 150 kvm. Inkluderar dammsugning, våttorkning, badrum, kök och fönsterputs. Varannan vecka under 6 månader.",
  },
];

interface QuoteTemplatesProps {
  onSelectTemplate: (template: QuoteTemplate) => void;
}

export function QuoteTemplates({ onSelectTemplate }: QuoteTemplatesProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {QUOTE_TEMPLATES.map((template) => {
        const Icon = template.icon;
        return (
          <Card
            key={template.id}
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onSelectTemplate(template)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                </div>
                <Badge variant={template.category === "ROT" ? "default" : "secondary"}>
                  {template.category}
                </Badge>
              </div>
              <CardDescription>{template.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                Använd mall
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
