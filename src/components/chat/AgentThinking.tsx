import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2, BrainCircuit } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STEPS = [
  { id: 'analyze', label: 'Analyserar projektbeskrivning...' },
  { id: 'identify', label: 'Identifierar arbetsmoment...' },
  { id: 'registry', label: 'Hämtar branschstandarder & priser...' },
  { id: 'rot_rut', label: 'Beräknar skattereduktion (ROT/RUT)...' },
];

export function AgentThinking() {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Simulera tankeprocessen
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < STEPS.length ? prev + 1 : prev));
    }, 1200); // Byt steg var 1.2 sekund

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white border rounded-xl p-4 max-w-sm shadow-sm my-2 ml-2">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
        <BrainCircuit className="w-4 h-4 text-indigo-500 animate-pulse" />
        <span className="text-xs font-semibold text-indigo-900">AI Agent arbetar...</span>
      </div>
      <div className="space-y-3">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center gap-3">
            {index < currentStep ? (
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
            ) : index === currentStep ? (
              <Loader2 className="w-4 h-4 text-indigo-500 animate-spin flex-shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-slate-200 flex-shrink-0" />
            )}
            <span className={`text-xs transition-colors duration-300 ${
              index === currentStep ? 'font-medium text-slate-800' : 
              index < currentStep ? 'text-slate-500 line-through opacity-70' : 'text-slate-300'
            }`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
