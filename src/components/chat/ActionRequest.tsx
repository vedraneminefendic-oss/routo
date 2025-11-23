import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";
import { Check, Ruler, Star } from "lucide-react";

interface ActionRequestProps {
  type?: 'area' | 'quality' | 'complexity' | 'general';
  context?: string; // T.ex. "målning", "badrum"
  onAnswer: (answer: string) => void;
}

export function ActionRequest({ type = 'general', context, onAnswer }: ActionRequestProps) {
  const [area, setArea] = useState([20]);

  // 1. Yta / Kvantitet (Slider)
  if (type === 'area' || (context && ['målning', 'golv', 'tak', 'flyttstädning'].some(k => context.includes(k)))) {
    return (
      <div className="bg-slate-50 p-4 rounded-xl mt-2 border border-slate-200 shadow-sm max-w-sm">
        <div className="flex items-center gap-2 mb-4">
          <Ruler className="w-4 h-4 text-blue-500" />
          <p className="text-sm font-medium text-slate-700">Uppskatta ytan</p>
        </div>
        
        <div className="mb-6 px-2">
          <div className="flex justify-between mb-2">
            <span className="text-xs text-slate-400">5 kvm</span>
            <span className="text-2xl font-bold text-blue-600">{area} <span className="text-sm font-normal text-slate-500">kvm</span></span>
            <span className="text-xs text-slate-400">150+ kvm</span>
          </div>
          <Slider 
            defaultValue={[20]} 
            max={150} 
            min={5}
            step={5} 
            onValueChange={setArea} 
            className="py-4"
          />
        </div>
        
        <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => onAnswer(`${area} kvm`)}>
          <Check className="w-4 h-4 mr-2" /> Bekräfta {area} kvm
        </Button>
      </div>
    );
  }

  // 2. Kvalitet / Standard (Knappar)
  if (type === 'quality' || type === 'complexity') {
    const options = [
      { label: 'Budget / Enkelt', desc: 'Lägsta pris', value: 'budget' },
      { label: 'Standard', desc: 'Vanligast', value: 'standard' },
      { label: 'Premium / Lyx', desc: 'Bästa finish', value: 'premium' },
    ];

    return (
      <div className="bg-slate-50 p-3 rounded-xl mt-2 border border-slate-200 max-w-sm">
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-4 h-4 text-amber-500" />
          <p className="text-sm font-medium text-slate-700">Välj standard</p>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onAnswer(opt.value)}
              className="flex items-center justify-between p-3 bg-white border rounded-lg hover:border-blue-500 hover:shadow-sm transition-all text-left group"
            >
              <div>
                <div className="text-sm font-medium text-slate-800 group-hover:text-blue-700">{opt.label}</div>
                <div className="text-xs text-slate-500">{opt.desc}</div>
              </div>
              <div className="w-4 h-4 rounded-full border border-slate-300 group-hover:border-blue-500 group-hover:bg-blue-50" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
