import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MapPin, Mail, Phone, FileText, Plus, TrendingUp, CheckCircle, IdCard, Building, StickyNote } from "lucide-react";
import { Customer } from "@/pages/Customers";
import { useCustomerStats } from "@/hooks/useCustomerStats";
import { useCustomerQuotes } from "@/hooks/useCustomerQuotes";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

interface CustomerDetailSheetProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (customer: Customer) => void;
}

export const CustomerDetailSheet = ({
  customer,
  open,
  onOpenChange,
  onEdit,
}: CustomerDetailSheetProps) => {
  const navigate = useNavigate();
  const { stats, loading: statsLoading } = useCustomerStats(customer?.id || "");
  const { quotes, loading: quotesLoading } = useCustomerQuotes(customer?.id || null);

  if (!customer) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("sv-SE", {
      style: "currency",
      currency: "SEK",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleCreateQuote = () => {
    navigate(`/new-quote?customer=${customer.id}`);
    onOpenChange(false);
  };

  const handleViewAllQuotes = () => {
    navigate(`/quotes?customer=${customer.id}`);
    onOpenChange(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "accepted":
      case "completed":
        return "default";
      case "sent":
      case "viewed":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getSwedishStatus = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      'draft': 'Utkast',
      'sent': 'Skickad',
      'viewed': 'Visad',
      'accepted': 'Accepterad',
      'rejected': 'Avvisad',
      'completed': 'Slutförd',
      'pending': 'Väntande',
    };
    return statusMap[status] || status;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-2xl">{customer.name}</SheetTitle>
          <SheetDescription>Kundöversikt och offerter</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Contact Info */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              {customer.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Adress</p>
                    <p className="text-sm text-muted-foreground">{customer.address}</p>
                  </div>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">E-post</p>
                    <a
                      href={`mailto:${customer.email}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {customer.email}
                    </a>
                  </div>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Telefon</p>
                    <a
                      href={`tel:${customer.phone}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {customer.phone}
                    </a>
                  </div>
                </div>
              )}
              <div className="pt-3">
                <Button variant="outline" className="w-full" onClick={() => onEdit(customer)}>
                  Redigera kunduppgifter
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Additional Information */}
          {(customer.notes || customer.personnummer || customer.property_designation) && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                {customer.personnummer && (
                  <div className="flex items-center gap-3">
                    <IdCard className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Personnummer</p>
                      <p className="text-sm text-muted-foreground font-mono">{customer.personnummer}</p>
                    </div>
                  </div>
                )}
                {customer.property_designation && (
                  <div className="flex items-center gap-3">
                    <Building className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Fastighetsbeteckning</p>
                      <p className="text-sm text-muted-foreground">{customer.property_designation}</p>
                    </div>
                  </div>
                )}
                {customer.notes && (
                  <div className="flex items-start gap-3">
                    <StickyNote className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Anteckningar</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.notes}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          {statsLoading ? (
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="pt-4 text-center">
                  <FileText className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-2xl font-bold">{stats.totalQuotes}</p>
                  <p className="text-xs text-muted-foreground">Offerter</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <CheckCircle className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-2xl font-bold">{stats.acceptedQuotes}</p>
                  <p className="text-xs text-muted-foreground">Godkända</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <TrendingUp className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</p>
                  <p className="text-xs text-muted-foreground">Totalt värde</p>
                </CardContent>
              </Card>
            </div>
          )}

          <Separator />

          {/* Quotes */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Offerter</h3>
              <Button size="sm" onClick={handleCreateQuote}>
                <Plus className="h-4 w-4 mr-1" />
                Ny offert
              </Button>
            </div>

            {quotesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : quotes.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Inga offerter ännu</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {quotes.slice(0, 5).map((quote) => (
                  <Card
                    key={quote.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      navigate(`/quotes?id=${quote.id}`);
                      onOpenChange(false);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{quote.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(quote.created_at), "d MMM yyyy", { locale: sv })}
                          </p>
                          {quote.work_address && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              <MapPin className="h-3 w-3 inline mr-1" />
                              {quote.work_address}
                            </p>
                          )}
                        </div>
                        <Badge variant={getStatusColor(quote.status)} className="ml-2">
                          {getSwedishStatus(quote.status)}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {quotes.length > 5 && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleViewAllQuotes}
                  >
                    Visa alla {quotes.length} offerter
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
