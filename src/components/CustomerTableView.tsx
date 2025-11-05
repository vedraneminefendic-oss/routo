import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, Trash2, FileText, ArrowUpDown, Mail, Phone } from "lucide-react";
import { Customer } from "@/pages/Customers";
import { useCustomerStats } from "@/hooks/useCustomerStats";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CustomerTableViewProps {
  customers: Customer[];
  loading: boolean;
  onEdit: (customer: Customer) => void;
  onDelete: (customerId: string) => void;
  onViewDetails: (customer: Customer) => void;
}

type SortField = "name" | "address" | "email" | "created_at";
type SortDirection = "asc" | "desc";

const CustomerRow = ({
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
    <TableRow className="hover:bg-muted/50 transition-colors">
      <TableCell className="font-medium">
        <button
          onClick={() => onViewDetails(customer)}
          className="text-left hover:underline focus:outline-none focus:underline"
        >
          {customer.name}
        </button>
      </TableCell>
      <TableCell className="text-muted-foreground max-w-xs truncate">
        {customer.address || "—"}
      </TableCell>
      <TableCell>
        <TooltipProvider>
          <div className="flex gap-2">
            {customer.email && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={`mailto:${customer.email}`}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Mail className="h-4 w-4" />
                  </a>
                </TooltipTrigger>
                <TooltipContent>{customer.email}</TooltipContent>
              </Tooltip>
            )}
            {customer.phone && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={`tel:${customer.phone}`}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                </TooltipTrigger>
                <TooltipContent>{customer.phone}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
      </TableCell>
      <TableCell>
        {loading ? (
          <Skeleton className="h-6 w-16" />
        ) : (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {stats.totalQuotes}
            </Badge>
            {stats.totalQuotes > 0 && (
              <Badge
                variant={stats.acceptanceRate >= 50 ? "default" : "secondary"}
                className="font-mono text-xs"
              >
                {stats.acceptanceRate.toFixed(0)}%
              </Badge>
            )}
          </div>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleViewQuotes}
            disabled={stats.totalQuotes === 0}
          >
            <FileText className="h-4 w-4 mr-1" />
            Offerter
          </Button>
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
      </TableCell>
    </TableRow>
  );
};

export const CustomerTableView = ({
  customers,
  loading,
  onEdit,
  onDelete,
  onViewDetails,
}: CustomerTableViewProps) => {
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedCustomers = [...customers].sort((a, b) => {
    const multiplier = sortDirection === "asc" ? 1 : -1;

    switch (sortField) {
      case "name":
        return multiplier * a.name.localeCompare(b.name);
      case "address":
        return multiplier * (a.address || "").localeCompare(b.address || "");
      case "email":
        return multiplier * (a.email || "").localeCompare(b.email || "");
      case "created_at":
        return multiplier * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      default:
        return 0;
    }
  });

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
      </div>
    </TableHead>
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <SortableHeader field="name">Namn</SortableHeader>
            <SortableHeader field="address">Adress</SortableHeader>
            <TableHead>Kontakt</TableHead>
            <TableHead>Offerter</TableHead>
            <TableHead className="text-right">Åtgärder</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedCustomers.map((customer) => (
            <CustomerRow
              key={customer.id}
              customer={customer}
              onEdit={onEdit}
              onDelete={onDelete}
              onViewDetails={onViewDetails}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
