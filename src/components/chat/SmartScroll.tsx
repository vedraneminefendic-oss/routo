import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";

interface SmartScrollProps {
  messages: any[];
  isTyping: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
}

export const SmartScroll = ({ messages, isTyping, containerRef }: SmartScrollProps) => {
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const near = distanceFromBottom < 100;
      
      setIsNearBottom(near);
      setShowScrollButton(!near && messages.length > 3);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [containerRef, messages.length]);

  useEffect(() => {
    // Auto-scroll only if user is near bottom or if it's a new AI message
    if (isNearBottom && containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isTyping, isNearBottom, containerRef]);

  const scrollToBottom = () => {
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: "smooth",
    });
  };

  if (!showScrollButton) return null;

  return (
    <Button
      onClick={scrollToBottom}
      size="icon"
      className="fixed bottom-24 right-8 rounded-full shadow-lg z-20 animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
      variant="secondary"
    >
      <ArrowDown className="h-5 w-5" />
    </Button>
  );
};
