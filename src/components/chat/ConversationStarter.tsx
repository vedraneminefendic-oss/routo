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
    <div className="w-full max-w-2xl space-y-3">
      <p className="text-sm text-muted-foreground text-center">
        Beskriv ditt projekt – jag hjälper dig skapa en offert!
      </p>
      
      {/* Berätta själv - Primary CTA */}
      <Button
        size="lg"
        className="w-full gap-2 py-3"
        onClick={() => {
          const input = document.querySelector('textarea');
          if (input) {
            input.focus();
          }
        }}
      >
        <MessageSquare className="h-5 w-5" />
        <span>Berätta själv om ditt projekt</span>
      </Button>

      {/* Category Quick Starts - Horizontal Scroll */}
      <div className="relative">
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2 -mx-4 px-4">
          {starters.map((starter, index) => {
            const Icon = starter.icon;
            return (
              <Button
                key={index}
                variant="outline"
                className="flex-shrink-0 snap-start h-auto py-3 px-4 min-w-[140px] hover:bg-gradient-to-br hover:from-primary/10 hover:to-blue-500/10 hover:border-primary transition-all duration-200 group"
                onClick={() => onStarterClick(starter.text)}
              >
                <div className="flex flex-col items-center gap-2 w-full">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center group-hover:from-primary/30 group-hover:to-blue-500/30 transition-all">
                    <Icon className="h-6 w-6 text-primary group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-semibold text-foreground">
                      {starter.text}
                    </div>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
        {/* Scroll indicator */}
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />
      </div>
    </div>
  );
};
