import { Button } from "@/components/ui/button";

interface QuickReply {
  label: string;
  action: string;
}

interface QuickRepliesProps {
  replies: QuickReply[];
  onSelect: (action: string, label: string) => void;
  disabled?: boolean;
}

export const QuickReplies = ({ replies, onSelect, disabled }: QuickRepliesProps) => {
  // P0: Prioritize first reply as primary action
  const getPriority = (index: number) => {
    if (index === 0) return "default"; // Primary action
    return "outline"; // Secondary actions
  };

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {replies.map((reply, index) => (
        <Button
          key={index}
          variant={getPriority(index)}
          size="sm"
          onClick={() => onSelect(reply.action, reply.label)}
          disabled={disabled}
          className="text-sm transition-all duration-300 hover:scale-105 shadow-sm hover:shadow-md"
        >
          {reply.label}
        </Button>
      ))}
    </div>
  );
};
