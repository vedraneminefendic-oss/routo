import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Calendar, Send, Eye, CheckCircle, XCircle, Check, Hammer, Sparkles, Droplet, CookingPot, Paintbrush, Scissors, Trees, Zap, Wrench, Home, MessageSquare, ChevronDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { sv } from "date-fns/locale";
import { QuoteStatus } from "@/hooks/useQuoteStatus";
import { EmptyState } from "@/components/EmptyState";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Quote {
  id: string;
  title: string;
  status: string;
  created_at: string;
  generated_quote: any;
  edited_quote?: any;
  project_type?: string;
  customer_id?: string;
  work_address?: string;
  customers?: {
    name: string;
    address?: string;
  };
}

interface QuoteListProps {
  quotes: Quote[];
  onQuoteClick?: (quote: Quote) => void;
}

const STATUS_CONFIG = {
  draft: {
    label: "Utkast",
    icon: FileText,
    color: "bg-accent text-white",
  },
  sent: {
    label: "Skickad",
    icon: Send,
    color: "bg-primary text-white",
  },
  viewed: {
    label: "Visad",
    icon: Eye,
    color: "bg-secondary/70 text-white",
  },
  accepted: {
    label: "Accepterad",
    icon: CheckCircle,
    color: "bg-secondary text-white",
  },
  rejected: {
    label: "Avvisad",
    icon: XCircle,
    color: "bg-destructive text-white",
  },
  completed: {
    label: "Slutförd",
    icon: Check,
    color: "bg-secondary/90 text-white",
  },
};

const QuoteList = ({ quotes, onQuoteClick }: QuoteListProps) => {
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status as QuoteStatus] || {
      label: status,
      icon: FileText,
      color: "bg-muted",
    };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getDeductionType = (quote: Quote): 'rot' | 'rut' | 'none' | null => {
    const quoteData = quote.edited_quote || quote.generated_quote;
    return quoteData?.deductionType || quoteData?.summary?.deductionType || null;
  };

  const getProjectTypeIcon = (projectType?: string) => {
    if (!projectType) return null;
    
    const iconMap: Record<string, any> = {
      'badrum': Droplet,
      'kök': CookingPot,
      'målning': Paintbrush,
      'städning': Scissors,
      'trädgård': Trees,
      'el': Zap,
      'vvs': Wrench,
      'fönster': Home,
    };
    
    return iconMap[projectType.toLowerCase()] || FileText;
  };

  const getProjectTypeLabel = (projectType?: string) => {
    if (!projectType) return null;
    
    const labelMap: Record<string, string> = {
      'badrum': 'Badrum',
      'kök': 'Kök',
      'målning': 'Målning',
      'städning': 'Städning',
      'trädgård': 'Trädgård',
      'el': 'El',
      'vvs': 'VVS',
      'fönster': 'Fönster',
      'övrigt': 'Övrigt',
    };
    
    return labelMap[projectType.toLowerCase()] || projectType;
  };

  if (quotes.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Inga offerter ännu"
        description="Börja med att skapa din första offert med AI-assistenten ovan. Beskriv uppdraget så genererar vi en komplett offert åt dig på några sekunder!"
      />
    );
  }

  return (
    <div className="space-y-3">
      {quotes.map((quote) => {
        const statusConfig = getStatusConfig(quote.status);
        const StatusIcon = statusConfig.icon;
        const ProjectIcon = getProjectTypeIcon(quote.project_type);
        const projectLabel = getProjectTypeLabel(quote.project_type);
        
        return (
          <Card 
            key={quote.id} 
            className="cursor-pointer hover:bg-muted/30 hover:border-primary/30 hover:shadow-sm transition-all duration-200 border-border focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
            onClick={() => onQuoteClick?.(quote)}
            role="button"
            tabIndex={0}
            aria-label={`Öppna offert: ${quote.title}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onQuoteClick?.(quote);
              }
            }}
          >
            <CardContent className="p-4">
              <div className="space-y-2">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-base text-foreground mb-1">{quote.title}</h3>
                    
                    {/* Customer info */}
                    {quote.customers && (
                      <div className="text-sm text-muted-foreground mb-1">
                        <span className="font-medium">{quote.customers.name}</span>
                      </div>
                    )}
                    
                    {/* Work address - show work_address if available, fallback to customer address */}
                    {(quote as any).work_address && (
                      <div className="text-sm text-muted-foreground mb-1 flex items-start gap-1">
                        <span className="text-primary mt-0.5">📍</span>
                        <span>{(quote as any).work_address}</span>
                      </div>
                    )}
                    
                    {/* Project type */}
                    {ProjectIcon && projectLabel && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
                        <ProjectIcon className="h-4 w-4 text-primary" />
                        <span>{projectLabel}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Status badges and actions */}
                  <div className="flex flex-col items-end gap-2">
                    {/* Quick improve button for non-completed/accepted quotes - FAS 2 */}
                    {quote.status !== 'completed' && quote.status !== 'accepted' && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="default"
                              className="h-9 w-9 p-0 hover:scale-110 transition-transform shadow-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onQuoteClick?.(quote);
                              }}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-medium">Förbättra offerten med AI</p>
                            <p className="text-xs text-muted-foreground">Lägg till/ta bort arbeten</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <Badge className={`${statusConfig.color} text-white flex items-center gap-1 text-xs px-2 py-0.5`}>
                      <StatusIcon className="h-3 w-3" />
                      {statusConfig.label}
                    </Badge>
                    
                    {(() => {
                      const deductionType = getDeductionType(quote);
                      if (deductionType === 'rot') {
                        return (
                          <Badge variant="outline" className="text-blue-600 border-blue-600 text-xs px-2 py-0.5">
                            <Hammer className="h-3 w-3 mr-1" />
                            ROT
                          </Badge>
                        );
                      }
                      if (deductionType === 'rut') {
                        return (
                          <Badge variant="outline" className="text-green-600 border-green-600 text-xs px-2 py-0.5">
                            <Sparkles className="h-3 w-3 mr-1" />
                            RUT
                          </Badge>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
                
                {/* Footer row with expandable preview - FAS 2 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDistanceToNow(new Date(quote.created_at), { 
                        addSuffix: true, 
                        locale: sv 
                      })}
                    </span>
                    <div className="flex items-center gap-2">
                      {quote.generated_quote?.summary && (
                        <span className="font-semibold text-sm text-primary">
                          {formatCurrency(quote.generated_quote.summary.customerPays)}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedQuoteId(expandedQuoteId === quote.id ? null : quote.id);
                        }}
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${expandedQuoteId === quote.id ? 'rotate-180' : ''}`} />
                      </Button>
                    </div>
                  </div>

                  {/* Expandable quick preview */}
                  {expandedQuoteId === quote.id && (
                    <div className="p-3 bg-muted/50 rounded-lg space-y-2 animate-in slide-in-from-top-2">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="font-medium">Arbeten:</span>
                          <span className="ml-1 text-muted-foreground">
                            {quote.generated_quote.workItems?.length || 0} st
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Material:</span>
                          <span className="ml-1 text-muted-foreground">
                            {quote.generated_quote.materials?.length || 0} st
                          </span>
                        </div>
                      </div>
                      
                      {(() => {
                        const deductionType = getDeductionType(quote);
                        const deduction = deductionType === 'rot' 
                          ? quote.generated_quote.summary.rotDeduction || quote.generated_quote.summary.deductionAmount
                          : deductionType === 'rut'
                          ? quote.generated_quote.summary.rutDeduction || quote.generated_quote.summary.deductionAmount
                          : null;
                        
                        if (deduction) {
                          return (
                            <div className="text-sm">
                              <span className="font-medium text-primary">
                                {deductionType?.toUpperCase()}-avdrag: 
                              </span>
                              <span className="ml-1">{formatCurrency(deduction)}</span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      
                      {quote.generated_quote.workItems && quote.generated_quote.workItems.length > 0 && (
                        <div className="text-xs text-muted-foreground pt-1 border-t border-border/50">
                          <span className="font-medium">Exempel arbeten: </span>
                          {quote.generated_quote.workItems
                            .slice(0, 2)
                            .map((w: any) => w.name)
                            .join(', ')}
                          {quote.generated_quote.workItems.length > 2 && '...'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default QuoteList;