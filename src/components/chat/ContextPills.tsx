import { Home, Ruler, Gem, Hammer, HelpCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ContextData {
  projectType?: string;
  area?: string;
  materialLevel?: string;
  workType?: string;
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
      color: 'text-blue-600 dark:text-blue-400'
    },
    {
      key: 'area' as keyof ContextData,
      icon: Ruler,
      label: 'Storlek',
      value: context.area,
      color: 'text-purple-600 dark:text-purple-400'
    },
    {
      key: 'materialLevel' as keyof ContextData,
      icon: Gem,
      label: 'Material',
      value: context.materialLevel,
      color: 'text-amber-600 dark:text-amber-400'
    },
    {
      key: 'workType' as keyof ContextData,
      icon: Hammer,
      label: 'Arbetstyp',
      value: context.workType,
      color: 'text-green-600 dark:text-green-400'
    }
  ];

  // Om minst en pill har värde, visa komponenten
  const hasAnyValue = pills.some(p => p.value);
  if (!hasAnyValue) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-t">
      <Sparkles className="h-4 w-4 text-primary shrink-0" />
      <div className="flex flex-wrap items-center gap-2">
        {pills.map(pill => {
          const Icon = pill.icon;
          const hasMissingValue = !pill.value;

          return (
            <Button
              key={pill.key}
              variant="outline"
              size="sm"
              onClick={() => onPillClick?.(pill.key)}
              className={cn(
                "h-7 px-2.5 gap-1.5 text-xs transition-all",
                hasMissingValue && "border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary"
              )}
            >
              {hasMissingValue ? (
                <>
                  <HelpCircle className="h-3.5 w-3.5" />
                  <span>{pill.label}</span>
                </>
              ) : (
                <>
                  <Icon className={cn("h-3.5 w-3.5", pill.color)} />
                  <span className="font-medium">{pill.value}</span>
                </>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
};
