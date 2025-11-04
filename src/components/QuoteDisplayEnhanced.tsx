import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Hammer, Sparkles, Info, AlertCircle, Package, Wrench } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { normalizeDeduction } from "@/lib/utils";

interface WorkItem {
  name: string;
  description: string;
  hours: number;
  hourlyRate: number;
  subtotal: number;
  reasoning?: string;
  confidence?: number;
  sourceOfTruth?: 'user_patterns' | 'industry_benchmarks' | 'live_search' | 'assumption';
}

interface Material {
  name: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  subtotal: number;
  reasoning?: string;
  confidence?: number;
  sourceOfTruth?: 'user_patterns' | 'industry_benchmarks' | 'live_search' | 'assumption';
}

interface Equipment {
  name: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  subtotal: number;
  reasoning?: string;
  confidence?: number;
  sourceOfTruth?: 'user_patterns' | 'industry_benchmarks' | 'live_search' | 'assumption';
}

interface Summary {
  workCost: number;
  materialCost: number;
  equipmentCost?: number;
  totalBeforeVAT: number;
  vat: number;
  vatAmount?: number; // FAS 1: New field for backward compatibility
  totalWithVAT: number;
  rotDeduction?: number;
  rutDeduction?: number;
  deductionAmount?: number;
  deductionType?: 'rot' | 'rut' | 'none';
  customerPays: number;
}

interface Deductions {
  type: 'rot' | 'rut' | 'none';
  percentage: number;
  amount: number;
  reasoning: string;
}

interface Quote {
  title: string;
  workItems: WorkItem[];
  materials: Material[];
  equipment?: Equipment[];
  summary: Summary;
  notes?: string;
  deductionType?: 'rot' | 'rut' | 'none';
  deductions?: Deductions;
  assumptions?: string[];
}

interface QuoteDisplayEnhancedProps {
  quote: Quote;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
  }).format(amount);
};

const formatSourceOfTruth = (source?: string): string => {
  const map: Record<string, string> = {
    'user_patterns': 'Din historik',
    'industry_benchmarks': 'Branschdata',
    'live_search': 'Webbsökning',
    'assumption': 'Antagande'
  };
  return map[source || ''] || 'Okänd källa';
};

// FAS 5: Source badge component with color-coding
const SourceBadge = ({ source }: { source?: string }) => {
  if (!source) return null;
  
  const config: Record<string, { label: string; variant: string; icon: any }> = {
    'user_patterns': { label: 'Dina priser', variant: 'default', icon: '👤' },
    'industry_benchmarks': { label: 'Bransch', variant: 'secondary', icon: '📊' },
    'live_search': { label: 'Webb', variant: 'outline', icon: '🌐' },
    'assumption': { label: 'Uppskattat', variant: 'outline', icon: '⚠️' }
  };
  
  const { label, variant, icon } = config[source] || { label: 'Okänd', variant: 'outline', icon: '?' };
  
  return (
    <Badge variant={variant as any} className="text-xs">
      <span className="mr-1">{icon}</span>
      {label}
    </Badge>
  );
};

// FAS 5: Confidence indicator component
const ConfidenceIndicator = ({ confidence }: { confidence?: number }) => {
  if (confidence === undefined) return null;
  
  const percent = confidence * 100;
  let color = 'text-red-500';
  let label = 'Låg säkerhet';
  
  if (percent >= 85) {
    color = 'text-green-500';
    label = 'Hög säkerhet';
  } else if (percent >= 60) {
    color = 'text-yellow-500';
    label = 'Medel säkerhet';
  }
  
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-block w-2 h-2 rounded-full ${color.replace('text-', 'bg-')} ml-2`} />
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{label}: {percent.toFixed(0)}%</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const ReasoningTooltip = ({ 
  reasoning, 
  confidence, 
  sourceOfTruth 
}: { 
  reasoning?: string; 
  confidence?: number; 
  sourceOfTruth?: string 
}) => {
  if (!reasoning && !confidence && !sourceOfTruth) return null;
  
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="text-muted-foreground hover:text-foreground ml-2">
            <Info className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-md">
          <div className="space-y-2">
            {reasoning && (
              <>
                <p className="text-sm font-semibold">Motivering:</p>
                <p className="text-sm">{reasoning}</p>
              </>
            )}
            
            {(confidence !== undefined || sourceOfTruth) && (
              <div className="pt-2 border-t">
                {confidence !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    <strong>Säkerhet:</strong> {(confidence * 100).toFixed(0)}%
                  </p>
                )}
                {sourceOfTruth && (
                  <p className="text-xs text-muted-foreground">
                    <strong>Källa:</strong> {formatSourceOfTruth(sourceOfTruth)}
                  </p>
                )}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export function QuoteDisplayEnhanced({ quote }: QuoteDisplayEnhancedProps) {
  // FAS 1: Use normalizeDeduction from utils for consistent ROT/RUT handling
  const { deductionType, deductionAmount, deductionPercentage } = normalizeDeduction(quote);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-4">
          <TabsTrigger value="summary">Sammanställning</TabsTrigger>
          <TabsTrigger value="work">
            Arbete ({quote.workItems?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="materials">
            Material ({quote.materials?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="equipment">
            Utrustning ({quote.equipment?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="deductions">ROT/RUT</TabsTrigger>
        </TabsList>
        
        {/* TAB 1: SAMMANSTÄLLNING */}
        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <CardTitle>Kostnadssammanställning</CardTitle>
              <CardDescription>Översikt av alla kostnader och avdrag</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Arbetskostnad</span>
                  <span className="font-medium">{formatCurrency(quote.summary.workCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Materialkostnad</span>
                  <span className="font-medium">{formatCurrency(quote.summary.materialCost)}</span>
                </div>
                {quote.summary.equipmentCost && quote.summary.equipmentCost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Utrustning</span>
                    <span className="font-medium">{formatCurrency(quote.summary.equipmentCost)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between">
                  <span>Totalt exkl. moms</span>
                  <span className="font-medium">{formatCurrency(quote.summary.totalBeforeVAT)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Moms (25%)</span>
                  <span>{formatCurrency(quote.summary.vatAmount || quote.summary.vat || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Totalt inkl. moms</span>
                  <span className="font-medium">{formatCurrency(quote.summary.totalWithVAT)}</span>
                </div>
                
                {deductionType !== 'none' && deductionAmount > 0 && (
                  <>
                    <Separator />
                    <div className="flex justify-between text-green-600">
                      <span className="flex items-center gap-2">
                        {deductionType === 'rot' ? <Hammer className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                        {deductionType.toUpperCase()}-avdrag ({deductionPercentage}%)
                      </span>
                      <span className="font-medium">–{formatCurrency(deductionAmount)}</span>
                    </div>
                  </>
                )}
                
                <Separator className="my-4" />
                <div className="flex justify-between text-xl font-bold">
                  <span>Att betala</span>
                  <span>{formatCurrency(quote.summary.customerPays)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* TAB 2: ARBETE */}
        <TabsContent value="work">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hammer className="w-5 h-5" />
                Arbetsmoment
              </CardTitle>
              <CardDescription>Alla arbetskostnader med timmar och priser</CardDescription>
            </CardHeader>
            <CardContent>
              {quote.workItems && quote.workItems.length > 0 ? (
                <div className="space-y-4">
                  {quote.workItems.map((item, index) => (
                    <div key={index} className="p-4 rounded-lg border bg-muted/30">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium">{item.name}</h4>
                            <ConfidenceIndicator confidence={item.confidence} />
                            <SourceBadge source={item.sourceOfTruth} />
                            <ReasoningTooltip 
                              reasoning={item.reasoning}
                              confidence={item.confidence}
                              sourceOfTruth={item.sourceOfTruth}
                            />
                          </div>
                          {item.description && (
                            <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span>{item.hours}h</span>
                            <span className="font-medium text-foreground">{formatCurrency(item.hourlyRate)}/h</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(item.subtotal)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between items-center pt-2">
                    <span className="font-medium">Total arbetskostnad</span>
                    <span className="text-xl font-bold">{formatCurrency(quote.summary.workCost)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">Inga arbetsmoment</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* TAB 3: MATERIAL */}
        <TabsContent value="materials">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Material
              </CardTitle>
              <CardDescription>Alla materialkostnader och produkter</CardDescription>
            </CardHeader>
            <CardContent>
              {quote.materials && quote.materials.length > 0 ? (
                <div className="space-y-4">
                  {quote.materials.map((material, index) => (
                    <div key={index} className="p-4 rounded-lg border bg-muted/30">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium">{material.name}</h4>
                            <ConfidenceIndicator confidence={material.confidence} />
                            <SourceBadge source={material.sourceOfTruth} />
                            <ReasoningTooltip 
                              reasoning={material.reasoning}
                              confidence={material.confidence}
                              sourceOfTruth={material.sourceOfTruth}
                            />
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span>{material.quantity} {material.unit}</span>
                            <span className="font-medium text-foreground">{formatCurrency(material.pricePerUnit)}/{material.unit}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(material.subtotal)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between items-center pt-2">
                    <span className="font-medium">Total materialkostnad</span>
                    <span className="text-xl font-bold">{formatCurrency(quote.summary.materialCost)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">Inga material</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* TAB 4: UTRUSTNING */}
        <TabsContent value="equipment">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                Utrustning
              </CardTitle>
              <CardDescription>Maskiner och verktyg</CardDescription>
            </CardHeader>
            <CardContent>
              {quote.equipment && quote.equipment.length > 0 ? (
                <div className="space-y-4">
                  {quote.equipment.map((equip, index) => (
                    <div key={index} className="p-4 rounded-lg border bg-muted/30">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium">{equip.name}</h4>
                            <ConfidenceIndicator confidence={equip.confidence} />
                            <SourceBadge source={equip.sourceOfTruth} />
                            <ReasoningTooltip 
                              reasoning={equip.reasoning}
                              confidence={equip.confidence}
                              sourceOfTruth={equip.sourceOfTruth}
                            />
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span>{equip.quantity} {equip.unit}</span>
                            <span className="font-medium text-foreground">{formatCurrency(equip.pricePerUnit)}/{equip.unit}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(equip.subtotal)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between items-center pt-2">
                    <span className="font-medium">Total utrustningskostnad</span>
                    <span className="text-xl font-bold">
                      {formatCurrency(quote.summary.equipmentCost || 0)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">Ingen utrustning</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* TAB 5: ROT/RUT */}
        <TabsContent value="deductions">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>ROT/RUT-avdrag</CardTitle>
                {deductionType !== 'none' && (
                  <Badge variant="default" className="ml-2">
                    {deductionType.toUpperCase()}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {deductionType !== 'none' ? (
                <div className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Avdragsberättigat arbete</AlertTitle>
                    <AlertDescription>
                      {quote.deductions?.reasoning || `Detta arbete klassas som ${deductionType.toUpperCase()} och ger rätt till skatteavdrag.`}
                    </AlertDescription>
                  </Alert>
                  
                  <div className="space-y-2">
                    <p><strong>Avdragstyp:</strong> {deductionType.toUpperCase()}</p>
                    <p><strong>Procentsats:</strong> {deductionPercentage}% på arbetskostnad</p>
                    <p><strong>Maxbelopp:</strong> {deductionType === 'rot' ? '50 000' : '75 000'} kr/år per person</p>
                    <p><strong>Beräknat avdrag:</strong> {formatCurrency(deductionAmount)}</p>
                  </div>
                  
                  <Alert variant="default">
                    <Info className="h-4 w-4" />
                    <AlertTitle>Så fungerar avdraget</AlertTitle>
                    <AlertDescription>
                      Avdraget dras direkt från din slutskattsedel. Du betalar full kostnad till oss,
                      och får sedan tillbaka {deductionPercentage}% via Skatteverket.
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Inget avdrag tillämpbart</AlertTitle>
                  <AlertDescription>
                    {quote.deductions?.reasoning || 'Detta arbete berättigar inte till ROT- eller RUT-avdrag.'}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* FAS 3: ANTAGANDELOGG */}
      {quote.assumptions && quote.assumptions.length > 0 && (
        <Card className="mt-6 border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <AlertCircle className="w-5 h-5" />
              Antaganden som gjorts
            </CardTitle>
            <CardDescription>
              Dessa antaganden gjordes vid beräkningen. Kontakta oss om något är felaktigt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-6 space-y-2">
              {quote.assumptions.map((assumption, index) => (
                <li key={index} className="text-sm text-amber-900">
                  {assumption}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
