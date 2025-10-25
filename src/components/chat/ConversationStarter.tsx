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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {starters.map((starter, index) => {
          const Icon = starter.icon;
          return (
            <Button
              key={index}
              variant="outline"
              className="h-auto py-4 px-4 justify-start text-left hover:bg-gradient-to-br hover:from-primary/10 hover:to-blue-500/10 hover:border-primary hover:scale-[1.02] transition-all duration-200 group"
              onClick={() => onStarterClick(starter.text)}
            >
              <div className="flex flex-col items-center gap-2.5 w-full">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center group-hover:from-primary/30 group-hover:to-blue-500/30 transition-all shadow-sm">
                  <Icon className="h-7 w-7 text-primary group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <div className="text-sm font-semibold text-foreground">
                    {starter.text}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {starter.category}
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
