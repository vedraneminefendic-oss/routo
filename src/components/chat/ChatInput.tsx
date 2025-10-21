import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, MicOff, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

export const ChatInput = ({ onSendMessage, disabled }: ChatInputProps) => {
  const [message, setMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Initiera Web Speech API om tillgängligt
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'sv-SE';
      recognitionRef.current.continuous = true; // Tillåt längre inspelningar
      recognitionRef.current.interimResults = true; // Visa transkription i realtid

      recognitionRef.current.onresult = (event: any) => {
        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalText += transcript + ' ';
          } else {
            interimText += transcript;
          }
        }

        // Uppdatera interim transcript för visuell feedback
        setInterimTranscript(interimText);

        // Lägg till final text i meddelandet
        if (finalText) {
          setMessage(prev => {
            const newMessage = prev + finalText;
            setInterimTranscript(''); // Rensa interim när final text läggs till
            return newMessage;
          });
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setInterimTranscript('');
        
        if (event.error === 'no-speech') {
          toast.error("Ingen röst detekterad. Försök igen.");
        } else if (event.error === 'not-allowed') {
          toast.error("Mikrofon-åtkomst nekad. Kontrollera dina webbläsarinställningar.");
        } else {
          toast.error("Kunde inte använda mikrofonen");
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };

      recognitionRef.current.onstart = () => {
        toast.success("🎤 Lyssnar... Tala nu!", {
          duration: 2000,
        });
      };
    }
  }, []);

  const handleSend = () => {
    if (!message.trim() || disabled) return;
    
    onSendMessage(message.trim());
    setMessage("");
    
    // Återställ textarea höjd
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleListening = async () => {
    if (!recognitionRef.current) {
      toast.error("Din webbläsare stöder inte röstinspelning");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setInterimTranscript('');
    } else {
      try {
        // Begär mikrofon-åtkomst först
        await navigator.mediaDevices.getUserMedia({ audio: true });
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error('Microphone access error:', error);
        toast.error("Kunde inte få åtkomst till mikrofonen. Kontrollera behörigheter.");
      }
    }
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Real-time transcript preview */}
      {interimTranscript && (
        <div className="px-3 py-2 bg-primary/10 rounded-md border border-primary/20 animate-in fade-in slide-in-from-bottom-2">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-destructive animate-pulse" />
            <span className="italic">{interimTranscript}</span>
          </p>
        </div>
      )}

      <div className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Talar... (Klicka på mikrofonen för att stoppa)" : "Skriv din projektbeskrivning här, eller använd mikrofonen 🎤"}
            disabled={disabled}
            className="min-h-[52px] max-h-[200px] resize-none pr-12"
            rows={1}
          />
          <Button
            type="button"
            size="icon"
            variant={isListening ? "default" : "ghost"}
            className={cn(
              "absolute right-2 bottom-2 h-8 w-8 transition-all",
              isListening && "bg-destructive hover:bg-destructive/90 text-destructive-foreground animate-pulse shadow-lg"
            )}
            onClick={toggleListening}
            disabled={disabled}
            title={isListening ? "Stoppa inspelning" : "Starta röstinspelning"}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        </div>
        <Button
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          size="icon"
          className="h-[52px] w-[52px] flex-shrink-0"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};
