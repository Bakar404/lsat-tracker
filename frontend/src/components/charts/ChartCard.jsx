import { card } from "../ui/styles.js";

export default function ChartCard({ title, subtitle, legend, children }) {
  return (
    <section className={`${card} min-w-0 p-5 sm:p-6`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {legend}
      </div>
      {children}
    </section>
  );
}

export function LegendDots({ items }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {items.map(({ label, color }) => (
        <li key={label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          {label}
        </li>
      ))}
    </ul>
  );
}
