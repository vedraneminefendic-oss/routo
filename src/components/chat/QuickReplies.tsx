import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface QuickRepliesProps {
  onSelect: (message: string) => void;
}

export function QuickReplies({ onSelect }: QuickRepliesProps) {
  const replies = [
    "Måla om vardagsrummet (25 kvm)",
    "Renovera badrum (5 kvm)",
    "Bygga altan (trall)",
    "Flyttstädning (70 kvm)"
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
      {replies.map((reply, index) => (
        <Button
          key={index}
          variant="outline"
          size="sm"
          onClick={() => onSelect(reply)}
          className="whitespace-nowrap bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 text-xs h-8 rounded-full px-4"
        >
          <Sparkles className="w-3 h-3 mr-1.5 text-purple-500" />
          {reply}
        </Button>
      ))}
    </div>
  );
}
