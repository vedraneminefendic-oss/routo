import { cn } from "@/lib/utils";

interface RoutoShapeProps {
  className?: string;
  color?: "primary" | "secondary" | "accent";
}

// Small decorative circles for dashboard hero and sections
export const RoutoOrganicCircle = ({ className = "", color = "primary" }: RoutoShapeProps) => {
  const colorClasses = {
    primary: "bg-primary/15",
    secondary: "bg-secondary/15",
    accent: "bg-accent/15",
  };

  return (
    <div 
      className={cn(
        "absolute rounded-full blur-3xl pointer-events-none animate-pulse",
        colorClasses[color],
        className
      )}
    />
  );
};

// Semi-circle shapes for corners
export const RoutoSemiCircle = ({ 
  className = "", 
  color = "secondary",
  position = "top-right" 
}: RoutoShapeProps & { position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" }) => {
  const colorClasses = {
    primary: "bg-primary/20",
    secondary: "bg-secondary/20",
    accent: "bg-accent/20",
  };

  const clipPaths = {
    "top-right": "inset(0 0 50% 50%)",
    "top-left": "inset(0 50% 50% 0)",
    "bottom-right": "inset(50% 0 0 50%)",
    "bottom-left": "inset(50% 50% 0 0)",
  };

  return (
    <div 
      className={cn(
        "absolute rounded-full blur-2xl pointer-events-none",
        colorClasses[color],
        className
      )}
      style={{ 
        clipPath: clipPaths[position]
      }}
    />
  );
};

// Small accent shape for cards
export const RoutoAccentDot = ({ 
  className = "", 
  color = "primary"
}: RoutoShapeProps) => {
  const colorClasses = {
    primary: "bg-primary/30",
    secondary: "bg-secondary/30",
    accent: "bg-accent/30",
  };

  return (
    <div 
      className={cn(
        "absolute rounded-full blur-xl pointer-events-none",
        colorClasses[color],
        className
      )}
    />
  );
};
