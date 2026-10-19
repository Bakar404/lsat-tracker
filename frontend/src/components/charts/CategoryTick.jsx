/** Y-axis label that truncates long category names; the full name is kept as a tooltip. */
export default function CategoryTick({ x, y, payload, maxChars }) {
  const text = String(payload.value);
  const label = text.length > maxChars ? `${text.slice(0, maxChars - 1).trimEnd()}\u2026` : text;
  return (
    <text x={x} y={y} dx={-6} dy={4} textAnchor="end" fontSize={12} fill="#475569">
      <title>{text}</title>
      {label}
    </text>
  );
}
