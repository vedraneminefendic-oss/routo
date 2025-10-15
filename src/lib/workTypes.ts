import { Hammer, Wrench, PaintBucket, Zap, TreePine, Sparkles, Scissors, Droplets, Pickaxe, Shield } from "lucide-react";

export interface WorkType {
  value: string;
  label: string;
  icon: any;
  defaultRate: number;
}

export const WORK_TYPES: WorkType[] = [
  { value: "Snickare", label: "Snickare", icon: Hammer, defaultRate: 700 },
  { value: "Elektriker", label: "Elektriker", icon: Zap, defaultRate: 850 },
  { value: "VVS", label: "VVS", icon: Droplets, defaultRate: 900 },
  { value: "Målare", label: "Målare", icon: PaintBucket, defaultRate: 650 },
  { value: "Murare", label: "Murare", icon: Pickaxe, defaultRate: 750 },
  { value: "Städare", label: "Städare", icon: Sparkles, defaultRate: 500 },
  { value: "Trädgårdsskötare", label: "Trädgårdsskötare", icon: TreePine, defaultRate: 550 },
  { value: "Arborist", label: "Arborist", icon: TreePine, defaultRate: 1000 },
  { value: "Fönsterputsare", label: "Fönsterputsare", icon: Sparkles, defaultRate: 450 },
  { value: "Takläggare", label: "Takläggare", icon: Shield, defaultRate: 800 },
  { value: "Hantverkare", label: "Hantverkare (Allmän)", icon: Wrench, defaultRate: 650 },
];
