const button =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export const buttonPrimary = `${button} bg-slate-900 text-white hover:bg-slate-800 focus-visible:outline-slate-900`;
export const buttonSecondary = `${button} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-slate-900`;
export const buttonDanger = `${button} bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600`;

export const card = "rounded-3xl border border-slate-200/50 bg-white shadow-lg";

export const input =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-transparent focus:ring-2 focus:ring-slate-900 focus:outline-none";

export const label = "mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700";

/** Section type colours, shared by every chart so a colour always means the same thing. */
export const SECTION_TYPE_COLORS = {
  "Logical Reasoning": "#0ea5e9",
  "Reading Comprehension": "#a78bfa",
  Unknown: "#64748b",
};

export const DIFFICULTY_COLORS = ["#10b981", "#14b8a6", "#eab308", "#f97316", "#f43f5e"];
