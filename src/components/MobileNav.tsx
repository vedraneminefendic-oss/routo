import { useNavigate, useLocation } from "react-router-dom";
import { Home, FileText, Plus, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const MobileNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { id: 'dashboard', label: 'Hem', icon: Home, path: '/dashboard' },
    { id: 'quotes', label: 'Offerter', icon: FileText, path: '/quotes' },
    { id: 'new', label: 'Ny', icon: Plus, path: '/quotes/new', isPrimary: true },
    { id: 'reports', label: 'Rapporter', icon: BarChart3, path: '/reports' },
    { id: 'settings', label: 'Mer', icon: Settings, path: '/settings' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50 safe-area-pb">
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          if (item.isPrimary) {
            return (
              <Button
                key={item.id}
                size="icon"
                onClick={() => navigate(item.path)}
                className="h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 -mt-6"
              >
                <Icon className="h-6 w-6" />
              </Button>
            );
          }
          
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 min-w-[60px] h-full touch-manipulation transition-colors",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "scale-110")} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
