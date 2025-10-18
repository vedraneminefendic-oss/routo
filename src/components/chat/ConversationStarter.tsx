import { Button } from "@/components/ui/button";
import { Hammer, Home, Paintbrush, Wrench, Zap, Trees } from "lucide-react";

interface ConversationStarterProps {
  onStarterClick: (text: string) => void;
}

const starters = [
  {
    icon: Home,
    text: "Renovera ett badrum på 8 kvm med kakel och klinker",
    category: "Renovering"
  },
  {
    icon: Paintbrush,
    text: "Måla om 3 rum och hall, ca 120 kvm bostadsyta",
    category: "Målning"
  },
  {
    icon: Zap,
    text: "Byta ut el-installation i äldre villa",
    category: "Elarbete"
  },
  {
    icon: Trees,
    text: "Fälla 3 stora granar och stubbfräsa",
    category: "Trädvård"
  },
  {
    icon: Wrench,
    text: "Installera nytt kök med VVS-arbeten",
    category: "Kök & VVS"
  },
  {
    icon: Hammer,
    text: "Bygga altan 25 kvm med räcke och trappa",
    category: "Snickeri"
  }
];

export const ConversationStarter = ({ onStarterClick }: ConversationStarterProps) => {
  return (
    <div className="w-full max-w-2xl">
      <p className="text-sm text-muted-foreground text-center mb-4">
        Eller välj ett vanligt exempel:
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {starters.map((starter, index) => {
          const Icon = starter.icon;
          return (
            <Button
              key={index}
              variant="outline"
              className="h-auto py-4 px-4 justify-start text-left hover:bg-muted hover:border-primary transition-all"
              onClick={() => onStarterClick(starter.text)}
            >
              <div className="flex items-start gap-3 w-full">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground mb-1">
                    {starter.category}
                  </div>
                  <div className="text-sm font-medium text-foreground line-clamp-2">
                    {starter.text}
                  </div>
                </div>
              </div>
            </Button>
          );
        })}
      </div>
    </div>
  );
};
