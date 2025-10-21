import { Home, Ruler, Gem, Hammer, HelpCircle, Sparkles, Edit, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ContextData {
  projectType?: string;
  area?: string;
  materialLevel?: string;
  workType?: string;
  deadline?: string;
}

interface ContextPillsProps {
  messages: Array<{ role: string; content: string }>;
  onPillClick?: (key: keyof ContextData) => void;
}

export const ContextPills = ({ messages, onPillClick }: ContextPillsProps) => {
  const extractContext = (): ContextData => {
    const allContent = messages
      .filter(m => m.role === 'user')
      .map(m => m.content.toLowerCase())
      .join(' ');

    const context: ContextData = {};

    // Extrahera projekttyp
    if (allContent.includes('badrum')) context.projectType = 'Badrum';
    else if (allContent.includes('kök')) context.projectType = 'Kök';
    else if (allContent.includes('altandäck') || allContent.includes('altan')) context.projectType = 'Altandäck';
    else if (allContent.includes('målning') || allContent.includes('måla')) context.projectType = 'Målning';
    else if (allContent.includes('golvläggning') || allContent.includes('golv')) context.projectType = 'Golvläggning';
    else if (allContent.includes('el')) context.projectType = 'Elarbete';
    else if (allContent.includes('vvs') || allContent.includes('rör')) context.projectType = 'VVS';

    // Extrahera area/storlek
    const areaMatch = allContent.match(/(\d+)\s*(kvm|kvadratmeter|m2|m²)/i);
    if (areaMatch) {
      context.area = `${areaMatch[1]} kvm`;
    }

    // Extrahera material-nivå
    if (allContent.includes('premium') || allContent.includes('lyxig') || allContent.includes('exklusiv')) {
      context.materialLevel = 'Premium';
    } else if (allContent.includes('budget') || allContent.includes('billig') || allContent.includes('ekonomisk')) {
      context.materialLevel = 'Budget';
    } else if (allContent.includes('mellan') || allContent.includes('standard') || allContent.includes('normal')) {
      context.materialLevel = 'Mellan';
    }

    // Extrahera arbetstyp (ROT/RUT)
    if (allContent.includes('rot')) context.workType = 'ROT-arbete';
    else if (allContent.includes('rut')) context.workType = 'RUT-arbete';
    else if (context.projectType) {
      // Auto-detektera baserat på projekttyp
      if (['Badrum', 'Kök', 'Målning', 'Golvläggning', 'Elarbete', 'VVS'].includes(context.projectType)) {
        context.workType = 'ROT-arbete';
      } else if (['Städning', 'Trädgård'].includes(context.projectType)) {
        context.workType = 'RUT-arbete';
      }
    }

    // Extrahera deadline
    const deadlineMatch = allContent.match(/deadline|färdig|klar|slutdatum/i);
    if (deadlineMatch) {
      const dateMatch = allContent.match(/(\d{1,2})[\s\-\/]?([a-zå]{3,}|\d{1,2})[\s\-\/]?(\d{2,4})?/i);
      if (dateMatch) {
        context.deadline = 'Deadline angiven';
      }
    }

    return context;
  };

  const context = extractContext();

  // Om inga meddelanden finns, visa ingenting
  if (messages.length === 0) return null;

  const pills = [
    {
      key: 'projectType' as keyof ContextData,
      icon: Home,
      label: 'Projekt',
      value: context.projectType,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
      borderColor: 'border-blue-200 dark:border-blue-800'
    },
    {
      key: 'area' as keyof ContextData,
      icon: Ruler,
      label: 'Storlek',
      value: context.area,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-950/30',
      borderColor: 'border-purple-200 dark:border-purple-800'
    },
    {
      key: 'materialLevel' as keyof ContextData,
      icon: Gem,
      label: 'Material',
      value: context.materialLevel,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
      borderColor: 'border-amber-200 dark:border-amber-800'
    },
    {
      key: 'workType' as keyof ContextData,
      icon: Hammer,
      label: 'Arbetstyp',
      value: context.workType,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950/30',
      borderColor: 'border-green-200 dark:border-green-800'
    },
    {
      key: 'deadline' as keyof ContextData,
      icon: Calendar,
      label: 'Deadline',
      value: context.deadline,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950/30',
      borderColor: 'border-red-200 dark:border-red-800'
    }
  ];

  // Om minst en pill har värde, visa komponenten
  const hasAnyValue = pills.some(p => p.value);
  if (!hasAnyValue) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-primary/5 to-transparent border-t">
      <Sparkles className="h-4 w-4 text-primary shrink-0 animate-pulse" />
      <span className="text-xs font-medium text-muted-foreground mr-2">AI förstod:</span>
      <div className="flex flex-wrap items-center gap-2">
        {pills.map(pill => {
          const Icon = pill.icon;
          const hasMissingValue = !pill.value;

          return (
            <Button
              key={pill.key}
              variant="ghost"
              size="sm"
              onClick={() => onPillClick?.(pill.key)}
              className={cn(
                "h-8 px-3 gap-1.5 text-xs font-medium transition-all rounded-full border",
                hasMissingValue 
                  ? "border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5" 
                  : cn(pill.bgColor, pill.borderColor, pill.color, "hover:scale-105")
              )}
            >
              {hasMissingValue ? (
                <>
                  <HelpCircle className="h-3.5 w-3.5" />
                  <span>{pill.label} saknas</span>
                </>
              ) : (
                <>
                  <Icon className="h-3.5 w-3.5" />
                  <span>{pill.value}</span>
                  <Edit className="h-3 w-3 opacity-50" />
                </>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
};
