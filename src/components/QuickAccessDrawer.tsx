import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, Users, FileText } from "lucide-react";
import { CustomerQuickSelect } from "./CustomerQuickSelect";
import { TemplateQuickAccess } from "./TemplateQuickAccess";

interface QuickAccessDrawerProps {
  description: string;
  userId: string;
  onSelectCustomer: (customer: any) => void;
  onSelectTemplate: (template: any) => void;
  selectedCustomerId?: string;
}

export function QuickAccessDrawer({
  description,
  userId,
  onSelectCustomer,
  onSelectTemplate,
  selectedCustomerId
}: QuickAccessDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="w-full sm:w-auto border-primary/20 hover:bg-primary/10 hover:border-primary/30"
        >
          <Zap className="h-4 w-4 mr-2" />
          Snabbval
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-96 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Snabbval
          </SheetTitle>
        </SheetHeader>
        
        <Tabs defaultValue="customers" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="customers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Kunder
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Mallar
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="customers" className="mt-4">
            <CustomerQuickSelect 
              onSelect={(customer) => {
                onSelectCustomer(customer);
                setOpen(false);
              }}
              selectedCustomerId={selectedCustomerId}
            />
          </TabsContent>
          
          <TabsContent value="templates" className="mt-4 space-y-3">
            <TemplateQuickAccess
              description={description}
              userId={userId}
              onSelectTemplate={(template) => {
                onSelectTemplate(template);
                setOpen(false);
              }}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
