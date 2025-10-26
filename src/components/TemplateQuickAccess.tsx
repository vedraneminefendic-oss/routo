import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Sparkles, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  template_data: any;
  usage_count: number;
}

interface Suggestion {
  templateId: string;
  relevanceScore: number;
  reason: string;
  template: Template;
}

interface TemplateQuickAccessProps {
  description: string;
  userId: string;
  onSelectTemplate: (template: Template) => void;
}

export function TemplateQuickAccess({ description, userId, onSelectTemplate }: TemplateQuickAccessProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [popularTemplates, setPopularTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (description.length > 20) {
      getSuggestions();
    }
    loadPopularTemplates();
  }, [description]);

  const getSuggestions = async () => {
    if (!description || description.length < 20) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-templates", {
        body: { description, userId },
      });

      if (error) throw error;
      setSuggestions(data?.suggestions || []);
    } catch (error) {
      console.error("Error getting template suggestions:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadPopularTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("quote_templates")
        .select("id, name, description, category, template_data, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) throw error;
      
      const templates: Template[] = (data || []).map(t => ({
        id: t.id,
        name: t.name,
        description: t.description || "",
        category: t.category,
        template_data: t.template_data,
        usage_count: 0 // Placeholder since column doesn't exist yet
      }));
      
      setPopularTemplates(templates);
    } catch (error) {
      console.error("Error loading popular templates:", error);
    }
  };

  const handleSelectTemplate = async (template: Template) => {
    try {
      // Increment usage count - no explicit update needed as it will be handled internally
      onSelectTemplate(template);
      toast.success(`Mall "${template.name}" använd!`);
      
      // Reload templates to get updated counts
      await loadPopularTemplates();
    } catch (error) {
      console.error("Error updating template usage:", error);
    }
  };

  if (suggestions.length === 0 && popularTemplates.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* AI-suggested templates */}
      {suggestions.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">AI föreslår mallar</CardTitle>
            </div>
            <CardDescription>Baserat på din beskrivning</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {suggestions.map((suggestion) => (
              <Button
                key={suggestion.templateId}
                variant="outline"
                className="w-full justify-start h-auto py-3"
                onClick={() => handleSelectTemplate(suggestion.template)}
              >
                <div className="flex items-start gap-3 w-full">
                  <FileText className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="font-semibold flex items-center gap-2">
                      {suggestion.template.name}
                      <Badge variant="secondary" className="text-xs">
                        {Math.round(suggestion.relevanceScore * 100)}% match
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {suggestion.reason}
                    </p>
                  </div>
                </div>
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Popular templates */}
      {popularTemplates.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Populära mallar</CardTitle>
            </div>
            <CardDescription>Dina mest använda mallar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {popularTemplates.map((template) => (
              <Button
                key={template.id}
                variant="ghost"
                className="w-full justify-start h-auto py-3"
                onClick={() => handleSelectTemplate(template)}
              >
                <div className="flex items-start gap-3 w-full">
                  <FileText className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="font-semibold flex items-center gap-2">
                      {template.name}
                      <Badge variant="outline" className="text-xs">
                        Senaste
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {template.description}
                    </p>
                  </div>
                </div>
              </Button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}