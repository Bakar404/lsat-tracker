const TONES = {
  blue: "bg-blue-100 text-blue-600",
  green: "bg-green-100 text-green-600",
  purple: "bg-purple-100 text-purple-600",
  orange: "bg-orange-100 text-orange-600",
  red: "bg-red-100 text-red-600",
  indigo: "bg-indigo-100 text-indigo-600",
};

export default function KpiCard({ label, value, detail, icon: Icon, tone }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200/50 bg-white p-4 shadow-lg sm:gap-4 sm:p-5">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${TONES[tone]}`}
      >
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-900 tabular-nums sm:text-2xl">{value}</p>
        {detail && <p className="text-xs leading-snug text-slate-500">{detail}</p>}
      </div>
    </div>
  );
}
