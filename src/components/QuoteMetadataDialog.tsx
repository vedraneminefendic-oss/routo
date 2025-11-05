import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomerQuickSelect } from "@/components/CustomerQuickSelect";
import { MapPin, User, Briefcase } from "lucide-react";

interface QuoteMetadataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (metadata: {
    customerId: string | null;
    workAddress: string;
    projectType: string;
  }) => void;
  initialCustomerId?: string | null;
  initialWorkAddress?: string;
  initialProjectType?: string;
}

const PROJECT_TYPES = [
  { value: "badrum", label: "Badrum" },
  { value: "kök", label: "Kök" },
  { value: "målning", label: "Målning" },
  { value: "städning", label: "Städning" },
  { value: "trädgård", label: "Trädgård" },
  { value: "el", label: "El" },
  { value: "vvs", label: "VVS" },
  { value: "fönster", label: "Fönster" },
  { value: "övrigt", label: "Övrigt" },
];

export function QuoteMetadataDialog({
  open,
  onOpenChange,
  onSave,
  initialCustomerId = null,
  initialWorkAddress = "",
  initialProjectType = "",
}: QuoteMetadataDialogProps) {
  const [customerId, setCustomerId] = useState<string | null>(initialCustomerId);
  const [workAddress, setWorkAddress] = useState(initialWorkAddress);
  const [projectType, setProjectType] = useState(initialProjectType);

  useEffect(() => {
    if (open) {
      setCustomerId(initialCustomerId);
      setWorkAddress(initialWorkAddress);
      setProjectType(initialProjectType);
    }
  }, [open, initialCustomerId, initialWorkAddress, initialProjectType]);

  const handleSave = () => {
    if (!workAddress.trim()) {
      return; // Require work address
    }

    onSave({
      customerId,
      workAddress: workAddress.trim(),
      projectType: projectType || "övrigt",
    });

    onOpenChange(false);
  };

  const isValid = workAddress.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Komplettera uppgifter
          </DialogTitle>
          <DialogDescription>
            För att spara offerten behöver vi veta vem kunden är och var jobbet ska utföras
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Customer Selection */}
          <div className="space-y-2">
            <Label htmlFor="customer" className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Kund (valfritt)
            </Label>
            <CustomerQuickSelect
              onSelect={(customer) => setCustomerId(customer?.id || null)}
              selectedCustomerId={customerId}
            />
            <p className="text-xs text-muted-foreground">
              Välj en befintlig kund eller lämna tomt om du vill fylla i senare
            </p>
          </div>

          {/* Work Address */}
          <div className="space-y-2">
            <Label htmlFor="address" className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Adress för jobbet <span className="text-destructive">*</span>
            </Label>
            <Input
              id="address"
              value={workAddress}
              onChange={(e) => setWorkAddress(e.target.value)}
              placeholder="T.ex. Storgatan 15, Malmö"
              required
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Adressen där arbetet ska utföras
            </p>
          </div>

          {/* Project Type */}
          <div className="space-y-2">
            <Label htmlFor="project-type">Projekttyp</Label>
            <Select value={projectType} onValueChange={setProjectType}>
              <SelectTrigger id="project-type">
                <SelectValue placeholder="Välj projekttyp..." />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Hjälper dig att hitta offerter senare
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleSave} disabled={!isValid}>
            Spara offert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
