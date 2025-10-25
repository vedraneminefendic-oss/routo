import { Button } from "@/components/ui/button";
import { Home, Paintbrush, Wrench, Trees, Hammer, MessageSquare } from "lucide-react";

interface ConversationStarterProps {
  onStarterClick: (text: string) => void;
}

const starters = [
  {
    icon: Home,
    text: "Renovering av rum",
    category: "Renovering"
  },
  {
    icon: Paintbrush,
    text: "Målningsarbete",
    category: "Målning"
  },
  {
    icon: Wrench,
    text: "VVS & El-arbete",
    category: "Installation"
  },
  {
    icon: Trees,
    text: "Trädgårdsarbete",
    category: "Trädgård"
  },
  {
    icon: Hammer,
    text: "Snickeri & byggarbete",
    category: "Bygg"
  }
];

export const ConversationStarter = ({ onStarterClick }: ConversationStarterProps) => {
  return (
    <div className="w-full max-w-2xl space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        Välj en kategori eller beskriv ditt projekt själv:
      </p>
      
      {/* Berätta själv - Primary CTA */}
      <Button
        size="lg"
        className="w-full gap-2 h-auto py-4"
        onClick={() => {
          const input = document.querySelector('textarea');
          if (input) {
            input.focus();
          }
        }}
      >
        <MessageSquare className="h-5 w-5" />
        <span className="text-base">Berätta själv om ditt projekt</span>
      </Button>

      {/* Category Quick Starts */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {starters.map((starter, index) => {
          const Icon = starter.icon;
          return (
            <Button
              key={index}
              variant="outline"
              className="h-auto py-3 px-3 justify-start text-left hover:bg-muted hover:border-primary transition-all"
              onClick={() => onStarterClick(starter.text)}
            >
              <div className="flex flex-col items-center gap-2 w-full">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="text-xs font-medium text-foreground text-center">
                  {starter.text}
                </div>
              </div>
            </Button>
          );
        })}
      </div>
    </div>
  );
};
