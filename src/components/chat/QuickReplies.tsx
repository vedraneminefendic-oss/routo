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
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {replies.map((reply, index) => (
        <Button
          key={index}
          variant="outline"
          size="sm"
          onClick={() => onSelect(reply.action, reply.label)}
          disabled={disabled}
          className="text-sm hover:bg-accent/50 transition-colors"
        >
          {reply.label}
        </Button>
      ))}
    </div>
  );
};
