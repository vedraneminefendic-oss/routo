import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, MapPin, Ruler, Package } from "lucide-react";

interface InlineProgressCardProps {
  data: {
    projectType?: string;
    area?: string;
    rooms?: string;
    materials?: string[];
    location?: string;
  };
}

export const InlineProgressCard = ({ data }: InlineProgressCardProps) => {
  const hasData = Object.values(data).some(val => val !== undefined && val !== null);
  
  if (!hasData) return null;

  return (
    <Card className="border-l-4 border-l-green-500 bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/20 animate-in fade-in-0 slide-in-from-left-4 duration-500">
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-semibold text-sm">Förstått:</span>
        </div>
        
        <div className="grid gap-2 text-sm">
          {data.projectType && (
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Projekttyp:</span>
              <Badge variant="secondary" className="text-xs">{data.projectType}</Badge>
            </div>
          )}
          
          {data.area && (
            <div className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Yta:</span>
              <span className="font-medium">{data.area}</span>
            </div>
          )}
          
          {data.rooms && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Rum:</span>
              <span className="font-medium">{data.rooms}</span>
            </div>
          )}
          
          {data.materials && data.materials.length > 0 && (
            <div className="flex items-start gap-2">
              <Package className="h-4 w-4 text-muted-foreground mt-0.5" />
              <span className="text-muted-foreground">Material:</span>
              <div className="flex flex-wrap gap-1">
                {data.materials.map((mat, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{mat}</Badge>
                ))}
              </div>
            </div>
          )}
          
          {data.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Plats:</span>
              <span className="font-medium">{data.location}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
