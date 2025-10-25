import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, MicOff, Send, Camera, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ChatInputProps {
  onSendMessage: (message: string, images?: string[], intent?: string) => void;
  disabled?: boolean;
}

export const ChatInput = ({ onSendMessage, disabled }: ChatInputProps) => {
  const [message, setMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if ((!message.trim() && images.length === 0) || disabled) return;
    
    onSendMessage(message.trim() || "Analysera dessa bilder", images);
    setMessage("");
    setImages([]);
    
    // Återställ textarea höjd
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          // Max 1600px dimension, maintain aspect ratio
          const MAX_DIM = 1600;
          let width = img.width;
          let height = img.height;
          
          if (width > height && width > MAX_DIM) {
            height = (height * MAX_DIM) / width;
            width = MAX_DIM;
          } else if (height > MAX_DIM) {
            width = (width * MAX_DIM) / height;
            height = MAX_DIM;
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to JPEG with 0.65 quality
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.65);
          
          // Check size (target <1.5MB)
          const sizeInMB = (compressedBase64.length * 0.75) / (1024 * 1024);
          console.log(`📸 Compressed image: ${sizeInMB.toFixed(2)} MB`);
          
          resolve(compressedBase64);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const maxImages = 3; // Reduced from 5
    const maxSizeBeforeCompress = 15 * 1024 * 1024; // 15MB before compression

    const filesToProcess = Array.from(files).slice(0, maxImages);
    
    for (const file of filesToProcess) {
      if (file.size > maxSizeBeforeCompress) {
        toast.error(`${file.name} är för stor (>15MB). Välj en mindre bild.`);
        continue;
      }

      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} är inte en giltig bild.`);
        continue;
      }

      try {
        toast(`Komprimerar ${file.name}...`, { duration: 1500 });
        const compressedBase64 = await compressImage(file);
        
        const sizeInMB = (compressedBase64.length * 0.75) / (1024 * 1024);
        if (sizeInMB > 2) {
          toast.error(`${file.name} är fortfarande för stor efter komprimering. Prova en mindre bild.`);
          continue;
        }
        
        setImages(prev => [...prev, compressedBase64]);
        toast.success(`${file.name} uppladdad (${sizeInMB.toFixed(1)}MB)`);
      } catch (error) {
        console.error('Image compression error:', error);
        toast.error(`Kunde inte bearbeta ${file.name}. Bildanalys hoppas över.`);
      }
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
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
      {/* Image previews */}
      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap p-2 bg-muted/30 rounded-md">
          {images.map((img, idx) => (
            <div key={idx} className="relative group">
              <img 
                src={img} 
                alt={`Upload ${idx + 1}`}
                className="h-20 w-20 object-cover rounded-md border-2 border-primary/20"
              />
              <Button
                size="icon"
                variant="destructive"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeImage(idx)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

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
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
          className="hidden"
        />
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Talar..." : images.length > 0 ? "Beskriv bilderna (valfritt)..." : "Skriv din projektbeskrivning här 📝"}
            disabled={disabled}
            className="min-h-[52px] max-h-[200px] resize-none pr-20"
            rows={1}
          />
          <div className="absolute right-2 bottom-2 flex gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || images.length >= 3}
              title="Ladda upp bilder (max 3)"
            >
              <Camera className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant={isListening ? "default" : "ghost"}
              className={cn(
                "h-8 w-8 transition-all",
                isListening && "bg-destructive hover:bg-destructive/90 text-destructive-foreground animate-pulse shadow-lg"
              )}
              onClick={toggleListening}
              disabled={disabled}
              title={isListening ? "Stoppa inspelning" : "Starta röstinspelning"}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <Button
          onClick={handleSend}
          disabled={(!message.trim() && images.length === 0) || disabled}
          size="icon"
          className="h-[52px] w-[52px] flex-shrink-0 touch-manipulation"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};
