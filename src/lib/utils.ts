import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalizes ROT/RUT deduction data from various quote formats
 * Handles backward compatibility with old and new field names
 */
export function normalizeDeduction(quote: any) {
  if (!quote) {
    return { deductionType: 'none', deductionAmount: 0, deductionPercentage: 0 };
  }

  // Try to get deductionType from multiple sources
  const deductionType = 
    quote.deductionType ?? 
    quote.summary?.deductionType ?? 
    (quote.summary?.rotDeduction ? 'rot' : 
     quote.summary?.rutDeduction ? 'rut' : 'none');
  
  // Try to get deductionAmount from multiple sources
  const deductionAmount = 
    quote.summary?.deductionAmount ?? 
    quote.summary?.rotDeduction ?? 
    quote.summary?.rutDeduction ?? 
    0;

  // Calculate percentage (typically 50% for ROT/RUT)
  const deductionPercentage = (deductionType === 'rot' || deductionType === 'rut') ? 50 : 0;

  return {
    deductionType: deductionType as 'rot' | 'rut' | 'none',
    deductionAmount,
    deductionPercentage,
  };
}
