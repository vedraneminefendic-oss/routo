import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CustomerList from "@/components/CustomerList";
import CustomerForm from "@/components/CustomerForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  personnummer?: string;
  property_designation?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

const Customers = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
      } else {
        loadCustomers();
      }
    };
    checkAuth();
  }, [navigate]);

  const loadCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error("Kunde inte ladda kunder");
      console.error(error);
    } else {
      setCustomers(data || []);
    }
    setLoading(false);
  };

  const handleSaveCustomer = async (customerData: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingCustomer) {
      const { error } = await supabase
        .from('customers')
        .update(customerData)
        .eq('id', editingCustomer.id);

      if (error) {
        toast.error("Kunde inte uppdatera kund");
        console.error(error);
      } else {
        toast.success("Kund uppdaterad!");
        setIsFormOpen(false);
        setEditingCustomer(null);
        loadCustomers();
      }
    } else {
      const { error } = await supabase
        .from('customers')
        .insert([{ ...customerData, user_id: user.id }]);

      if (error) {
        toast.error("Kunde inte skapa kund");
        console.error(error);
      } else {
        toast.success("Kund skapad!");
        setIsFormOpen(false);
        loadCustomers();
      }
    }
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsFormOpen(true);
  };

  const handleDeleteCustomer = async (customerId: string) => {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', customerId);

    if (error) {
      toast.error("Kunde inte radera kund");
      console.error(error);
    } else {
      toast.success("Kund raderad");
      loadCustomers();
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingCustomer(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Tillbaka
              </Button>
              <h1 className="text-2xl font-bold">Kunder</h1>
            </div>
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Ny kund
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <CustomerList 
          customers={customers} 
          loading={loading}
          onEdit={handleEditCustomer}
          onDelete={handleDeleteCustomer}
        />
      </main>

      <Dialog open={isFormOpen} onOpenChange={handleCloseForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? 'Redigera kund' : 'Ny kund'}
            </DialogTitle>
          </DialogHeader>
          <CustomerForm 
            customer={editingCustomer}
            onSave={handleSaveCustomer}
            onCancel={handleCloseForm}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Customers;
