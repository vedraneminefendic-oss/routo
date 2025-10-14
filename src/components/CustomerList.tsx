import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Trash2, Search, ChevronDown, Mail, Phone, TrendingUp } from "lucide-react";
import { Customer } from "@/pages/Customers";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useCustomerStats } from "@/hooks/useCustomerStats";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

interface CustomerListProps {
  customers: Customer[];
  loading: boolean;
  onEdit: (customer: Customer) => void;
  onDelete: (customerId: string) => void;
}

const CustomerRow = ({ customer, onEdit, onDelete }: { 
  customer: Customer; 
  onEdit: (customer: Customer) => void;
  onDelete: (id: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { stats, loading } = useCustomerStats(customer.id);

  return (
    <Collapsible asChild open={isOpen} onOpenChange={setIsOpen}>
      <>
        <TableRow className="hover:bg-muted/50 transition-colors">
          <TableCell>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="p-0 h-auto hover:bg-transparent">
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
          </TableCell>
          <TableCell className="font-medium">{customer.name}</TableCell>
          <TableCell>
            {customer.email ? (
              <a href={`mailto:${customer.email}`} className="flex items-center gap-1 text-primary hover:underline">
                <Mail className="h-3 w-3" />
                {customer.email}
              </a>
            ) : (
              "-"
            )}
          </TableCell>
          <TableCell>
            {customer.phone ? (
              <a href={`tel:${customer.phone}`} className="flex items-center gap-1 text-primary hover:underline">
                <Phone className="h-3 w-3" />
                {customer.phone}
              </a>
            ) : (
              "-"
            )}
          </TableCell>
          <TableCell>
            {!loading && stats.totalQuotes > 0 && (
              <Badge variant="secondary" className="gap-1">
                <TrendingUp className="h-3 w-3" />
                {stats.totalQuotes} offerter
              </Badge>
            )}
          </TableCell>
          <TableCell className="text-right">
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(customer)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(customer.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell colSpan={6} className="p-0 border-0">
            <CollapsibleContent>
              <div className="bg-muted/30 p-4 space-y-3 border-t">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Totalt värde</p>
                    <p className="text-sm font-semibold">{loading ? "..." : `${stats.totalValue.toLocaleString("sv-SE")} kr`}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Acceptansgrad</p>
                    <p className="text-sm font-semibold">{loading ? "..." : `${stats.acceptanceRate.toFixed(0)}%`}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Accepterade offerter</p>
                    <p className="text-sm font-semibold">{loading ? "..." : `${stats.acceptedQuotes} / ${stats.totalQuotes}`}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Senaste offert</p>
                    <p className="text-sm font-semibold">
                      {loading ? "..." : stats.lastQuoteDate ? format(new Date(stats.lastQuoteDate), "d MMM yyyy", { locale: sv }) : "-"}
                    </p>
                  </div>
                </div>
                {customer.address && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Adress</p>
                    <p className="text-sm">{customer.address}</p>
                  </div>
                )}
                {customer.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Anteckningar</p>
                    <p className="text-sm italic text-muted-foreground">{customer.notes}</p>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </TableCell>
        </TableRow>
      </>
    </Collapsible>
  );
};

const CustomerList = ({ customers, loading, onEdit, onDelete }: CustomerListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteCustomerId, setDeleteCustomerId] = useState<string | null>(null);

  const filteredCustomers = customers.filter((customer) => {
    const search = searchTerm.toLowerCase();
    return (
      customer.name.toLowerCase().includes(search) ||
      customer.email?.toLowerCase().includes(search) ||
      customer.phone?.toLowerCase().includes(search) ||
      customer.address?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Kunder</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Kunder ({customers.length})</CardTitle>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Sök kunder..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "Inga kunder matchade sökningen" : "Inga kunder ännu"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Namn</TableHead>
                  <TableHead>E-post</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Åtgärder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <CustomerRow 
                    key={customer.id} 
                    customer={customer} 
                    onEdit={onEdit}
                    onDelete={setDeleteCustomerId}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteCustomerId} onOpenChange={() => setDeleteCustomerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Radera kund?</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill radera denna kund? Denna åtgärd kan inte ångras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteCustomerId) {
                  onDelete(deleteCustomerId);
                  setDeleteCustomerId(null);
                }
              }}
            >
              Radera
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CustomerList;
