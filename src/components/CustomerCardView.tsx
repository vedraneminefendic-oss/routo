import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Pencil, Trash2, FileText, MapPin, Mail, Phone } from "lucide-react";
import { Customer } from "@/pages/Customers";
import { useCustomerStats } from "@/hooks/useCustomerStats";
import { Skeleton } from "@/components/ui/skeleton";

interface CustomerCardViewProps {
  customers: Customer[];
  loading: boolean;
  onEdit: (customer: Customer) => void;
  onDelete: (customerId: string) => void;
  onViewDetails: (customer: Customer) => void;
}

const CustomerCard = ({
  customer,
  onEdit,
  onDelete,
  onViewDetails,
}: {
  customer: Customer;
  onEdit: (customer: Customer) => void;
  onDelete: (customerId: string) => void;
  onViewDetails: (customer: Customer) => void;
}) => {
  const navigate = useNavigate();
  const { stats, loading } = useCustomerStats(customer.id);

  const handleViewQuotes = () => {
    navigate(`/quotes?customer=${customer.id}`);
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <button
              onClick={() => onViewDetails(customer)}
              className="text-left hover:underline focus:outline-none focus:underline"
            >
              <h3 className="font-semibold text-lg">{customer.name}</h3>
            </button>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(customer)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(customer.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>

          {customer.address && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2">{customer.address}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {customer.email && (
              <a
                href={`mailto:${customer.email}`}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Mail className="h-4 w-4" />
                <span className="truncate max-w-[150px]">{customer.email}</span>
              </a>
            )}
            {customer.phone && (
              <a
                href={`tel:${customer.phone}`}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Phone className="h-4 w-4" />
                <span>{customer.phone}</span>
              </a>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              {loading ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                <>
                  <Badge variant="outline" className="font-mono">
                    {stats.totalQuotes} offerter
                  </Badge>
                  {stats.totalQuotes > 0 && (
                    <Badge
                      variant={stats.acceptanceRate >= 50 ? "default" : "secondary"}
                      className="font-mono text-xs"
                    >
                      {stats.acceptanceRate.toFixed(0)}%
                    </Badge>
                  )}
                </>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewQuotes}
              disabled={stats.totalQuotes === 0}
            >
              <FileText className="h-4 w-4 mr-1" />
              Visa offerter
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const CustomerCardView = ({
  customers,
  loading,
  onEdit,
  onDelete,
  onViewDetails,
}: CustomerCardViewProps) => {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {customers.map((customer) => (
        <CustomerCard
          key={customer.id}
          customer={customer}
          onEdit={onEdit}
          onDelete={onDelete}
          onViewDetails={onViewDetails}
        />
      ))}
    </div>
  );
};
