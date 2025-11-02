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
    <div className="space-y-3">
      {/* AI-suggested templates */}
      {suggestions.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2 px-3 py-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
              <CardTitle className="text-sm">AI föreslår</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 px-3 pb-3">
            {suggestions.slice(0, 2).map((suggestion) => (
              <Button
                key={suggestion.templateId}
                variant="outline"
                className="w-full justify-start h-auto py-2 text-left"
                onClick={() => handleSelectTemplate(suggestion.template)}
              >
                <div className="flex items-start gap-2 w-full min-w-0">
                  <FileText className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                      <span className="truncate">{suggestion.template.name}</span>
                      <Badge variant="secondary" className="text-xs whitespace-nowrap">
                        {Math.round(suggestion.relevanceScore * 100)}%
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
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
          <CardHeader className="pb-2 px-3 py-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <CardTitle className="text-sm">Senaste mallar</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 px-3 pb-3">
            {popularTemplates.slice(0, 3).map((template) => (
              <Button
                key={template.id}
                variant="ghost"
                className="w-full justify-start h-auto py-2 text-left"
                onClick={() => handleSelectTemplate(template)}
              >
                <div className="flex items-start gap-2 w-full min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {template.name}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
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