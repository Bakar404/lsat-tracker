import { Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { usePrefersReducedMotion } from "../../hooks/useMediaQuery.js";
import { fmtPercent, plural } from "../../lib/format.js";
import ChartCard, { LegendDots } from "./ChartCard.jsx";
import StatTooltip from "./StatTooltip.jsx";
import { accuracyLine } from "./theme.js";

const FLAGGED_COLOR = "#f43f5e";
const UNFLAGGED_COLOR = "#14b8a6";

export default function FlaggedPie({ summary }) {
  const { flagged, unflagged } = summary;
  const animate = !usePrefersReducedMotion();
  const total = flagged.attempted + unflagged.attempted;
  const share = (count) => (total ? Math.round((100 * count) / total) : 0);
  const data = [
    { name: "Flagged", ...flagged, value: flagged.attempted, fill: FLAGGED_COLOR },
    { name: "Not flagged", ...unflagged, value: unflagged.attempted, fill: UNFLAGGED_COLOR },
  ];

  return (
    <ChartCard
      title="Flagged questions"
      subtitle="How often you flag, and how flagged questions turn out"
      legend={
        <LegendDots
          items={[
            { label: "Flagged", color: FLAGGED_COLOR },
            { label: "Not flagged", color: UNFLAGGED_COLOR },
          ]}
        />
      }
    >
      <div className="relative">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="64%"
              outerRadius="92%"
              paddingAngle={flagged.attempted && unflagged.attempted ? 2 : 0}
              stroke="none"
              isAnimationActive={animate}
            />
            <Tooltip
              content={(props) => (
                <StatTooltip
                  {...props}
                  title={(d) => d.name}
                  lines={(d) => [
                    `${plural(d.attempted, "question")} (${share(d.attempted)}%)`,
                    accuracyLine(d),
                  ]}
                />
              )}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-slate-900">{share(flagged.attempted)}%</span>
          <span className="text-xs text-slate-500">flagged</span>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-2xl bg-rose-50 px-3 py-3">
          <dt className="text-xs font-medium text-rose-700">Accuracy when flagged</dt>
          <dd className="mt-1 text-xl font-bold text-slate-900">{fmtPercent(flagged.accuracy)}</dd>
        </div>
        <div className="rounded-2xl bg-teal-50 px-3 py-3">
          <dt className="text-xs font-medium text-teal-700">Accuracy when not flagged</dt>
          <dd className="mt-1 text-xl font-bold text-slate-900">{fmtPercent(unflagged.accuracy)}</dd>
        </div>
      </dl>
    </ChartCard>
  );
}
