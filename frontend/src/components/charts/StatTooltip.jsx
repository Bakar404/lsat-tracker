/** Tooltip body for Recharts: a title plus one line per entry returned by `lines(datum)`. */
export default function StatTooltip({ active, payload, title, lines }) {
  if (!active || !payload?.length) return null;
  const datum = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-slate-900">{title(datum)}</p>
      {lines(datum).map((line) => (
        <p key={line} className="text-slate-600">
          {line}
        </p>
      ))}
    </div>
  );
}
