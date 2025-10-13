import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, FileText } from "lucide-react";

interface Template {
  id: string;
  name: string;
  description: string;
  category: string | null;
  template_data: any;
  created_at: string;
}

interface TemplatesManagerProps {
  userId: string;
}

const CATEGORIES = [
  "Takarbeten",
  "Golvläggning",
  "ROT-renovering",
  "Badrumsrenovering",
  "Köksrenovering",
  "Målning",
  "Elbyte",
  "VVS",
  "Annat"
];

const TemplatesManager = ({ userId }: TemplatesManagerProps) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    loadTemplates();
  }, [userId]);

  const loadTemplates = async () => {
    const { data, error } = await supabase
      .from('quote_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "Fel",
        description: "Kunde inte ladda mallar",
        variant: "destructive"
      });
      return;
    }

    setTemplates(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.description.trim()) {
      toast({
        title: "Validation Error",
        description: "Namn och beskrivning krävs",
        variant: "destructive"
      });
      return;
    }

    const templateData = {
      user_id: userId,
      name: formData.name,
      description: formData.description,
      category: formData.category || null,
      template_data: { description: formData.description }
    };

    if (editingTemplate) {
      const { error } = await supabase
        .from('quote_templates')
        .update(templateData)
        .eq('id', editingTemplate.id);

      if (error) {
        toast({
          title: "Fel",
          description: "Kunde inte uppdatera mallen",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Mallen uppdaterad",
        description: `${formData.name} har uppdaterats`
      });
    } else {
      const { error } = await supabase
        .from('quote_templates')
        .insert([templateData]);

      if (error) {
        toast({
          title: "Fel",
          description: "Kunde inte skapa mallen",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Mall skapad",
        description: `${formData.name} har skapats`
      });
    }

    setIsDialogOpen(false);
    setEditingTemplate(null);
    setFormData({ name: "", description: "", category: "" });
    loadTemplates();
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description,
      category: template.category || ""
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingTemplateId) return;

    const { error } = await supabase
      .from('quote_templates')
      .delete()
      .eq('id', deletingTemplateId);

    if (error) {
      toast({
        title: "Fel",
        description: "Kunde inte ta bort mallen",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Mall borttagen",
      description: "Mallen har tagits bort"
    });

    setIsDeleteDialogOpen(false);
    setDeletingTemplateId(null);
    loadTemplates();
  };

  const openDeleteDialog = (id: string) => {
    setDeletingTemplateId(id);
    setIsDeleteDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingTemplate(null);
    setFormData({ name: "", description: "", category: "" });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Skapa återanvändbara mallar för vanliga typer av offerter
        </p>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Ny mall
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Inga mallar skapade ännu</p>
            <Button onClick={openCreateDialog} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Skapa din första mall
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    {template.category && (
                      <CardDescription className="mt-1">
                        {template.category}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(template)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeleteDialog(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {template.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Redigera mall" : "Skapa ny mall"}
            </DialogTitle>
            <DialogDescription>
              Mallar används för att snabbt skapa liknande offerter
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Mallnamn *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="T.ex. 'Standard badrumsrenovering'"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Kategori (valfritt)</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Välj kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Beskrivning *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Beskriv typ av arbete, omfattning, materialnivå..."
                  className="min-h-[120px]"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Denna beskrivning används som grund när AI:n genererar offerter från mallen
                </p>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Avbryt
              </Button>
              <Button type="submit">
                {editingTemplate ? "Uppdatera" : "Skapa mall"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort mall?</AlertDialogTitle>
            <AlertDialogDescription>
              Denna åtgärd kan inte ångras. Mallen kommer att tas bort permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TemplatesManager;
