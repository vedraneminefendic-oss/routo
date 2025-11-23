import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";
import { Ruler, Star, Check, Briefcase } from "lucide-react";

interface ActionRequestProps {
  type: 'area' | 'quality' | 'complexity' | 'general';
  context?: string; // t.ex. "målning"
  onAnswer: (answer: string) => void;
}

export function ActionRequest({ type, context, onAnswer }: ActionRequestProps) {
  const [val, setVal] = useState([20]);

  // Om frågan handlar om Yta/Kvantitet
  if (type === 'area' || context?.includes('kvm')) {
    return (
      <div className="bg-slate-50 p-4 rounded-xl mt-2 border border-slate-200 shadow-sm max-w-sm animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-2 mb-4">
          <Ruler className="w-4 h-4 text-blue-500" />
          <p className="text-sm font-medium text-slate-700">Uppskatta ytan</p>
        </div>
        <div className="mb-6 px-2">
          <div className="flex justify-between mb-2">
            <span className="text-xs text-slate-400">5 kvm</span>
            <span className="text-2xl font-bold text-blue-600">{val} <span className="text-sm font-normal text-slate-500">kvm</span></span>
            <span className="text-xs text-slate-400">150+</span>
          </div>
          <Slider defaultValue={[20]} max={150} min={5} step={5} onValueChange={setVal} className="py-4" />
        </div>
        <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={() => onAnswer(`${val} kvm`)}>
          <Check className="w-4 h-4 mr-2" /> Bekräfta {val} kvm
        </Button>
      </div>
    );
  }

  // Om frågan handlar om Kvalitet
  if (type === 'quality') {
    return (
      <div className="bg-slate-50 p-3 rounded-xl mt-2 border border-slate-200 max-w-sm animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-4 h-4 text-amber-500" />
          <p className="text-sm font-medium text-slate-700">Välj standard</p>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {['Budget / Enkelt', 'Standard', 'Premium / Lyx'].map((opt) => (
            <Button 
              key={opt} 
              variant="outline" 
              className="justify-start bg-white hover:bg-blue-50 hover:border-blue-200 transition-all" 
              onClick={() => onAnswer(opt)}
            >
              {opt}
            </Button>
          ))}
        </div>
      </div>
    );
  }
  
  // Om frågan handlar om Komplexitet
  if (type === 'complexity') {
    return (
      <div className="bg-slate-50 p-3 rounded-xl mt-2 border border-slate-200 max-w-sm animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-2 mb-3">
          <Briefcase className="w-4 h-4 text-purple-500" />
          <p className="text-sm font-medium text-slate-700">Hur omfattande är arbetet?</p>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {[
            { label: 'Enkelt', desc: 'Inga hinder, standard' },
            { label: 'Normalt', desc: 'Vissa anpassningar' },
            { label: 'Komplext', desc: 'Många hinder/detaljer' }
          ].map((opt) => (
            <button
              key={opt.label}
              onClick={() => onAnswer(opt.label)}
              className="flex items-center justify-between p-3 bg-white border rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-all text-left group"
            >
              <div>
                <div className="text-sm font-medium text-slate-800">{opt.label}</div>
                <div className="text-xs text-slate-500">{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
