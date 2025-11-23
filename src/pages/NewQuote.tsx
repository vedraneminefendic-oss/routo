import { AppHeader } from "@/components/AppHeader";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

export default function NewQuote() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const initialMessage = location.state?.initialMessage;

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      
      <main className="container max-w-5xl mx-auto pt-24 pb-12 px-4">
        <div className="mb-6 flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/dashboard")}
            className="gap-2 hover:bg-white/50"
          >
            <ArrowLeft className="w-4 h-4" />
            Tillbaka till översikt
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Skapa ny offert</h1>
            <p className="text-slate-500">Beskriv jobbet för AI-assistenten</p>
          </div>
        </div>

        {/* Huvudcontainer för chatten */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px]">
          <ChatInterface 
            onQuoteGenerated={(quote) => console.log("Quote generated:", quote)} 
            initialMessage={initialMessage}
          />
        </div>
      </main>
    </div>
  );
}
