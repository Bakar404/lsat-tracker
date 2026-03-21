/**
 * Shared UI styles and constants for consistent styling across the app
 */

export const BUTTON_STYLES = {
  primary:
    "bg-slate-900 hover:bg-slate-800 active:scale-95 text-white shadow-lg",
  secondary: "bg-slate-100 hover:bg-slate-200 text-slate-900",
  danger: "bg-red-100 hover:bg-red-200 text-red-900",
  success: "bg-emerald-100 hover:bg-emerald-200 text-emerald-900",
  outline: "border-2 border-slate-300 hover:bg-slate-50 text-slate-900",
  disabled: "bg-slate-300 cursor-not-allowed text-slate-600",
};

export const INPUT_STYLES = {
  base: "w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all",
  error: "border-red-300 focus:ring-red-500",
};

export const CARD_STYLES = {
  default: "bg-white rounded-2xl shadow-lg border border-slate-200/50",
  compact: "bg-white rounded-xl shadow-sm border border-slate-200",
};

export const BADGE_STYLES = {
  success:
    "inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-800 text-xs rounded-full",
  error:
    "inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full",
  warning:
    "inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full",
  info: "inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full",
};

export const SPACING = {
  xs: "2px",
  sm: "4px",
  md: "8px",
  lg: "16px",
  xl: "24px",
  "2xl": "32px",
};

export const Z_INDEX = {
  dropdown: 40,
  modal: 50,
  tooltip: 30,
};

export const COLORS = {
  primary: "#0f172a", // slate-900
  success: "#10b981", // emerald-500
  error: "#ef4444", // red-500
  warning: "#f59e0b", // amber-500
  info: "#3b82f6", // blue-500
};
