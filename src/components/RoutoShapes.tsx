import { cn } from "@/lib/utils";

interface RoutoShapeProps {
  className?: string;
  color?: "primary" | "secondary" | "accent";
}

export const RoutoCircle = ({ className = "", color = "primary" }: RoutoShapeProps) => {
  const colorClasses = {
    primary: "bg-primary/15",
    secondary: "bg-secondary/15",
    accent: "bg-accent/15",
  };

  return (
    <div 
      className={cn(
        "absolute rounded-full blur-3xl pointer-events-none",
        colorClasses[color],
        className
      )}
    />
  );
};

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

export const RoutoOrganicBlob = ({ 
  className = "", 
  color = "primary",
  variant = 1
}: RoutoShapeProps & { variant?: 1 | 2 | 3 }) => {
  const colorClasses = {
    primary: "bg-gradient-to-br from-primary/20 to-primary/5",
    secondary: "bg-gradient-to-br from-secondary/20 to-secondary/5",
    accent: "bg-gradient-to-br from-accent/20 to-accent/5",
  };

  const borderRadius = {
    1: "rounded-[40%_60%_70%_30%/60%_30%_70%_40%]",
    2: "rounded-[60%_40%_30%_70%/60%_30%_70%_40%]",
    3: "rounded-[30%_60%_70%_40%/50%_60%_30%_60%]",
  };

  return (
    <div 
      className={cn(
        "absolute blur-2xl pointer-events-none animate-pulse",
        colorClasses[color],
        borderRadius[variant],
        className
      )}
    />
  );
};
