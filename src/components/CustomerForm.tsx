import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Customer } from "@/pages/Customers";

interface CustomerFormProps {
  customer?: Customer | null;
  onSave: (customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
}

const CustomerForm = ({ customer, onSave, onCancel }: CustomerFormProps) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    personnummer: "",
    property_designation: "",
    notes: "",
  });

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || "",
        email: customer.email || "",
        phone: customer.phone || "",
        address: customer.address || "",
        personnummer: customer.personnummer || "",
        property_designation: customer.property_designation || "",
        notes: customer.notes || "",
      });
    }
  }, [customer]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="name">Namn *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        
        <div>
          <Label htmlFor="email">E-post</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
        
        <div>
          <Label htmlFor="phone">Telefon</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>
        
        <div className="col-span-2">
          <Label htmlFor="address">Adress</Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />
        </div>
        
        <div>
          <Label htmlFor="personnummer">Personnummer</Label>
          <Input
            id="personnummer"
            value={formData.personnummer}
            onChange={(e) => setFormData({ ...formData, personnummer: e.target.value })}
          />
        </div>
        
        <div>
          <Label htmlFor="property_designation">Fastighetsbeteckning</Label>
          <Input
            id="property_designation"
            value={formData.property_designation}
            onChange={(e) => setFormData({ ...formData, property_designation: e.target.value })}
          />
        </div>
        
        <div className="col-span-2">
          <Label htmlFor="notes">Anteckningar</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="min-h-[100px]"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Avbryt
        </Button>
        <Button type="submit">
          Spara
        </Button>
      </div>
    </form>
  );
};

export default CustomerForm;
