import { cn } from "@/lib/utils";

interface ShapeProps {
  className?: string;
}

export const RoutoLandingShapes = ({ className = "" }: ShapeProps) => {
  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      {/* Top right semi-circle - Deep Blue */}
      <div 
        className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-accent opacity-90 rounded-full"
        style={{ 
          clipPath: 'circle(50% at 100% 0)',
          animation: 'float 8s ease-in-out infinite'
        }}
      />
      
      {/* Bottom left quarter circle - Sage Green */}
      <div 
        className="absolute -bottom-32 -left-32 w-[400px] h-[400px] bg-secondary opacity-80 rounded-full"
        style={{ 
          clipPath: 'circle(50% at 0 100%)',
          animation: 'float 10s ease-in-out infinite reverse'
        }}
      />
      
      {/* Center organic blob - Terracotta */}
      <div 
        className="absolute right-[15%] top-[25%] w-[350px] h-[350px] bg-primary opacity-60 rounded-full blur-3xl"
        style={{ 
          animation: 'pulse 6s ease-in-out infinite'
        }}
      />
      
      {/* Small accent circle - Top left */}
      <div 
        className="absolute top-20 left-[20%] w-24 h-24 bg-secondary opacity-40 rounded-full"
        style={{ 
          animation: 'float 7s ease-in-out infinite'
        }}
      />
      
      {/* Medium circle - Bottom right */}
      <div 
        className="absolute bottom-[15%] right-[25%] w-48 h-48 bg-accent opacity-30 rounded-full blur-2xl"
        style={{ 
          animation: 'pulse 9s ease-in-out infinite'
        }}
      />
    </div>
  );
};

export const RoutoFeatureShapes = ({ className = "" }: ShapeProps) => {
  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none opacity-50", className)}>
      {/* Smaller decorative shapes for feature section */}
      <div 
        className="absolute top-10 right-[10%] w-32 h-32 bg-primary opacity-30 rounded-full"
        style={{ animation: 'float 6s ease-in-out infinite' }}
      />
      <div 
        className="absolute bottom-20 left-[15%] w-40 h-40 bg-secondary opacity-25 rounded-full blur-2xl"
        style={{ animation: 'pulse 8s ease-in-out infinite' }}
      />
    </div>
  );
};

// Add animations to index.css if not already there
