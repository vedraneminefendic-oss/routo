import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, Package, Wrench } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface LiveQuotePreviewProps {
  quote?: any;
  isGenerating?: boolean;
  conversationSummary?: {
    projectType?: string;
    estimatedArea?: number;
    estimatedCost?: number;
    mentionedItems?: string[];
  };
  liveExtraction?: {
    projectType?: string;
    area?: string;
    rooms?: string;
    materials?: string[];
    timeline?: string;
  };
}

export const LiveQuotePreview = ({ 
  quote, 
  isGenerating,
  conversationSummary,
  liveExtraction 
}: LiveQuotePreviewProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // P1: Show live extraction during conversation
  if (liveExtraction && Object.keys(liveExtraction).length > 0) {
    return (
      <Card className="sticky top-4 animate-in fade-in-0 slide-in-from-right-4 duration-500 border-primary/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            <CardTitle className="text-lg">Extraherar data...</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {liveExtraction.projectType && (
            <div className="flex items-center gap-2 text-sm animate-in fade-in-0 slide-in-from-left-2 duration-300">
              <Package className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Projekttyp:</span>
              <Badge variant="secondary">{liveExtraction.projectType}</Badge>
            </div>
          )}
          {liveExtraction.area && (
            <div className="flex items-center gap-2 text-sm animate-in fade-in-0 slide-in-from-left-2 duration-300" style={{ animationDelay: "100ms" }}>
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Yta:</span>
              <span className="font-medium">{liveExtraction.area}</span>
            </div>
          )}
          {liveExtraction.rooms && (
            <div className="flex items-center gap-2 text-sm animate-in fade-in-0 slide-in-from-left-2 duration-300" style={{ animationDelay: "200ms" }}>
              <Package className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Rum:</span>
              <span className="font-medium">{liveExtraction.rooms}</span>
            </div>
          )}
          {liveExtraction.materials && liveExtraction.materials.length > 0 && (
            <div className="space-y-1 animate-in fade-in-0 slide-in-from-left-2 duration-300" style={{ animationDelay: "300ms" }}>
              <p className="text-sm text-muted-foreground">Material:</p>
              <div className="flex flex-wrap gap-1">
                {liveExtraction.materials.map((mat, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{mat}</Badge>
                ))}
              </div>
            </div>
          )}
          {liveExtraction.timeline && (
            <div className="flex items-center gap-2 text-sm animate-in fade-in-0 slide-in-from-left-2 duration-300" style={{ animationDelay: "400ms" }}>
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Tidplan:</span>
              <span className="font-medium">{liveExtraction.timeline}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Show skeleton during initial generation
  if (isGenerating && !quote && !conversationSummary) {
    return (
      <Card className="sticky top-4 animate-in fade-in-0 slide-in-from-right-4 duration-500">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            <CardTitle className="text-lg">Förhandsgranskning</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show conversation summary before quote is ready
  if (!quote && conversationSummary) {
    return (
      <Card className="sticky top-4 animate-in fade-in-0 slide-in-from-right-4 duration-500 border-dashed border-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg text-muted-foreground">Samlar information...</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {conversationSummary.projectType && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Projekttyp</p>
              <Badge variant="secondary" className="text-sm">
                {conversationSummary.projectType}
              </Badge>
            </div>
          )}
          
          {conversationSummary.estimatedArea && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Uppskattad yta</p>
              <p className="text-lg font-semibold">{conversationSummary.estimatedArea} m²</p>
            </div>
          )}
          
          {conversationSummary.estimatedCost && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm text-muted-foreground mb-1">Preliminärt prisintervall</p>
              <p className="text-xl font-bold text-secondary">
                {formatCurrency(conversationSummary.estimatedCost * 0.8)} - {formatCurrency(conversationSummary.estimatedCost * 1.2)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Priset kan ändras baserat på materialval
              </p>
            </div>
          )}

          {conversationSummary.mentionedItems && conversationSummary.mentionedItems.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Nämnda detaljer</p>
              <div className="flex flex-wrap gap-1">
                {conversationSummary.mentionedItems.slice(0, 5).map((item, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Show full quote preview when available
  if (quote) {
    const totalCost = quote.summary?.customerPays || quote.summary?.totalWithVAT || 0;
    const hasDeduction = quote.summary?.deduction?.deductionAmount > 0;
    
    return (
      <Card className="sticky top-4 animate-in fade-in-0 slide-in-from-right-4 duration-500">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-green-500" />
            <CardTitle className="text-lg">Offert klar!</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold text-lg mb-1">{quote.title || "Offert"}</h3>
            {quote.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {quote.description}
              </p>
            )}
          </div>

          {/* Price Summary */}
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-4 space-y-2">
            {hasDeduction && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pris före avdrag</span>
                  <span className="line-through">
                    {formatCurrency(quote.summary.totalWithVAT)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    {quote.summary.deduction.type.toUpperCase()}-avdrag
                    <Badge variant="secondary" className="text-xs">
                      -{Math.round(quote.summary.deduction.deductionRate * 100)}%
                    </Badge>
                  </span>
                  <span className="text-green-600 font-medium">
                    -{formatCurrency(quote.summary.deduction.deductionAmount)}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between items-baseline pt-2 border-t">
              <span className="font-semibold">Totalt</span>
              <span className="text-2xl font-bold text-secondary">
                {formatCurrency(totalCost)}
              </span>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Arbetskostnad</span>
              </div>
              <p className="text-sm font-semibold">
                {formatCurrency(quote.summary?.workCost || 0)}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Materialkostnad</span>
              </div>
              <p className="text-sm font-semibold">
                {formatCurrency(quote.summary?.materialCost || 0)}
              </p>
            </div>
          </div>

          {/* Sections Count */}
          {quote.sections && quote.sections.length > 0 && (
            <div className="text-sm text-muted-foreground">
              <p>{quote.sections.length} sektioner med totalt {
                quote.sections.reduce((acc: number, section: any) => 
                  acc + (section.items?.length || 0), 0
                )
              } poster</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Empty state
  return (
    <Card className="sticky top-4 border-dashed border-2">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <Sparkles className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-sm text-muted-foreground mb-1">
          Förhandsgranskning av offert
        </p>
        <p className="text-xs text-muted-foreground">
          Svar på frågor för att se preliminära beräkningar
        </p>
      </CardContent>
    </Card>
  );
};
