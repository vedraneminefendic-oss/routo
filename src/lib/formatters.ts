/**
 * Standardized formatters for consistent display across all components
 */

/**
 * Format currency in Swedish Krona (SEK)
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format work item display (hours × hourly rate)
 * Standard format: "40 timmar × 744 kr/tim"
 */
export const formatWorkItem = (hours: number, hourlyRate: number): string => {
  return `${hours} timmar × ${formatCurrency(hourlyRate)}/tim`;
};

/**
 * Format work item display (compact version)
 * Compact format: "40h × 744 kr/h"
 */
export const formatWorkItemCompact = (hours: number, hourlyRate: number): string => {
  return `${hours}h × ${formatCurrency(hourlyRate)}/h`;
};
