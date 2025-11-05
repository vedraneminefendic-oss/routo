import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, Users } from "lucide-react";
import { Customer } from "@/pages/Customers";
import { EmptyState } from "./EmptyState";
import { CustomerTableView } from "./CustomerTableView";
import { CustomerCardView } from "./CustomerCardView";
import { CustomerDetailSheet } from "./CustomerDetailSheet";
import { useIsMobile } from "@/hooks/use-mobile";
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

interface CustomerListProps {
  customers: Customer[];
  loading: boolean;
  onEdit: (customer: Customer) => void;
  onDelete: (customerId: string) => void;
}

const CustomerList = ({ customers, loading, onEdit, onDelete }: CustomerListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const isMobile = useIsMobile();

  const filteredCustomers = customers.filter((customer) =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (customers.length === 0 && !loading) {
    return (
      <EmptyState
        icon={Users}
        title="Inga kunder ännu"
        description="Skapa din första kund för att komma igång med offerter"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Search className="h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Sök kunder..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredCustomers.length === 0 && !loading ? (
        <EmptyState
          icon={Search}
          title="Inga matchande kunder"
          description="Försök med ett annat sökord"
        />
      ) : isMobile ? (
        <CustomerCardView
          customers={filteredCustomers}
          loading={loading}
          onEdit={onEdit}
          onDelete={(id) => setCustomerToDelete(id)}
          onViewDetails={setSelectedCustomer}
        />
      ) : (
        <CustomerTableView
          customers={filteredCustomers}
          loading={loading}
          onEdit={onEdit}
          onDelete={(id) => setCustomerToDelete(id)}
          onViewDetails={setSelectedCustomer}
        />
      )}

      <CustomerDetailSheet
        customer={selectedCustomer}
        open={!!selectedCustomer}
        onOpenChange={(open) => !open && setSelectedCustomer(null)}
        onEdit={(customer) => {
          setSelectedCustomer(null);
          onEdit(customer);
        }}
      />

      <AlertDialog open={!!customerToDelete} onOpenChange={() => setCustomerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bekräfta radering</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill radera denna kund? Detta går inte att ångra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (customerToDelete) {
                  onDelete(customerToDelete);
                  setCustomerToDelete(null);
                }
              }}
            >
              Radera
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CustomerList;
