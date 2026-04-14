import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;

// ─── FORMATTING HELPERS ───────────────────────────────────────────────────
export function formatCurrency(value, decimals = 2) {
  return (parseFloat(value) || 0).toLocaleString('fr-FR', { minimumFractionDigits: decimals });
}

export function formatNum(value) {
  return (value || 0).toLocaleString('fr-FR');
}
