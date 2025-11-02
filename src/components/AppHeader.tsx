import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Home, Users, Settings, BarChart3, LogOut, Menu, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AppHeaderProps {
  currentPage?: 'dashboard' | 'customers' | 'settings' | 'reports' | 'quotes';
}

export const AppHeader = ({ currentPage = 'dashboard' }: AppHeaderProps) => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard' },
    { id: 'customers', label: 'Kunder', icon: Users, path: '/customers' },
    { id: 'settings', label: 'Inställningar', icon: Settings, path: '/settings' },
    { id: 'reports', label: 'Rapporter', icon: BarChart3, path: '/reports' },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-primary/10 bg-[hsl(36,33%,95%)]/95 backdrop-blur supports-[backdrop-filter]:bg-[hsl(36,33%,95%)]/90 shadow-routo">
      <div className="container mx-auto px-4 py-3">
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Logo */}
            <div 
              onClick={() => navigate('/dashboard')} 
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-all duration-300"
            >
              <img src="/routo-logo.jpeg" alt="Routo" className="h-10 w-10 rounded-xl object-cover shadow-routo" />
              <span className="font-heading font-bold text-2xl text-primary">routo</span>
            </div>

            {/* Navigation Links */}
            <nav className="flex gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <Button
                    key={item.id}
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => navigate(item.path)}
                    className={isActive ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm" : "hover:bg-primary/10 hover:text-primary"}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </Button>
                );
              })}
            </nav>
          </div>

          {/* Logout Button */}
          <Button variant="outline" size="sm" onClick={handleLogout} className="border-primary/20 hover:bg-primary/10 hover:text-primary">
            <LogOut className="h-4 w-4 mr-2" />
            Logga ut
          </Button>
        </div>

        {/* Mobile Navigation - Improved */}
        <div className="flex md:hidden items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <img 
              src="/routo-logo.jpeg" 
              alt="Routo" 
              className="h-8 w-8 rounded-lg object-cover shadow-routo flex-shrink-0" 
              onClick={() => navigate('/dashboard')}
            />
            <span className="font-heading font-bold text-base text-primary truncate">routo</span>
          </div>
          
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="hover:bg-primary/10 flex-shrink-0">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-[hsl(36,33%,95%)] w-64">
              <div className="flex flex-col gap-3 mt-8">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;
                  return (
                    <Button
                      key={item.id}
                      variant={isActive ? "default" : "ghost"}
                      onClick={() => {
                        navigate(item.path);
                        setMobileMenuOpen(false);
                      }}
                      className={`justify-start h-12 ${isActive ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-primary/10 hover:text-primary"}`}
                    >
                      <Icon className="h-5 w-5 mr-3" />
                      <span className="text-base">{item.label}</span>
                    </Button>
                  );
                })}
                <div className="border-t border-primary/10 my-2" />
                <Button 
                  variant="outline" 
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="justify-start h-12 border-primary/20 hover:bg-primary/10"
                >
                  <LogOut className="h-5 w-5 mr-3" />
                  <span className="text-base">Logga ut</span>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};
