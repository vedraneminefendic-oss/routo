import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface VoiceWaveformProps {
  isActive: boolean;
  interimText?: string;
}

export const VoiceWaveform = ({ isActive, interimText }: VoiceWaveformProps) => {
  const [bars, setBars] = useState<number[]>(Array(20).fill(0.3));

  useEffect(() => {
    if (!isActive) {
      setBars(Array(20).fill(0.3));
      return;
    }

    const interval = setInterval(() => {
      setBars(prev => prev.map(() => 0.2 + Math.random() * 0.8));
    }, 100);

    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-primary/20 via-background/95 to-accent/20 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in-0 duration-300">
      <div className="text-center space-y-8 max-w-2xl px-6">
        {/* Waveform Animation */}
        <div className="flex items-center justify-center gap-1 h-32">
          {bars.map((height, i) => (
            <div
              key={i}
              className="w-2 bg-gradient-to-t from-primary to-primary/60 rounded-full transition-all duration-100 ease-out"
              style={{
                height: `${height * 100}%`,
                animationDelay: `${i * 50}ms`,
              }}
            />
          ))}
        </div>

        {/* Status Text */}
        <div className="space-y-4">
          <div className="relative flex items-center justify-center gap-3">
            <span className="relative flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-destructive"></span>
            </span>
            <h2 className="text-2xl font-bold text-foreground">
              Lyssnar...
            </h2>
          </div>

          {interimText && (
            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
              <p className="text-lg text-foreground/90 italic min-h-[2rem]">
                "{interimText}"
              </p>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Tala nu... Tryck på mikrofonen igen för att avsluta
          </p>
        </div>
      </div>
    </div>
  );
};
