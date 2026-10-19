import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePrefersReducedMotion } from "../../hooks/useMediaQuery.js";
import { fmtDate } from "../../lib/format.js";
import ChartCard from "./ChartCard.jsx";
import StatTooltip from "./StatTooltip.jsx";
import { AXIS_LINE, AXIS_TICK, GRID, accuracyLine } from "./theme.js";

// Zoom the scaled-score axis to the data, in steps of 5, within the 120 to 180 scale.
const SCALED_DOMAIN = [
  (min) => Math.max(120, Math.floor((min - 3) / 5) * 5),
  (max) => Math.min(180, Math.ceil((max + 3) / 5) * 5),
];

export default function TrendChart({ data }) {
  const hasScaled = data.some((d) => d.scaled_score != null);
  const animate = !usePrefersReducedMotion();
  return (
    <ChartCard
      title="Progress by exam"
      subtitle={hasScaled ? "Accuracy and scaled score, oldest to newest" : "Accuracy, oldest to newest"}
    >
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: hasScaled ? 0 : 12, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis
            dataKey="exam_number"
            tick={AXIS_TICK}
            stroke={AXIS_LINE}
            interval="preserveStartEnd"
            minTickGap={12}
            padding={{ left: 12, right: 12 }}
          />
          <YAxis yAxisId="accuracy" domain={[0, 100]} unit="%" tick={AXIS_TICK} stroke={AXIS_LINE} />
          {hasScaled && (
            <YAxis
              yAxisId="scaled"
              orientation="right"
              domain={SCALED_DOMAIN}
              allowDecimals={false}
              tick={AXIS_TICK}
              stroke={AXIS_LINE}
            />
          )}
          <Tooltip
            content={(props) => (
              <StatTooltip
                {...props}
                title={(d) => `Exam ${d.exam_number}${d.exam_date ? `, ${fmtDate(d.exam_date)}` : ""}`}
                lines={(d) => [
                  accuracyLine(d),
                  d.scaled_score == null ? "No scaled score" : `Scaled score ${d.scaled_score}`,
                ]}
              />
            )}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Line
            yAxisId="accuracy"
            type="monotone"
            dataKey="accuracy"
            name="Accuracy (%)"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            isAnimationActive={animate}
          />
          {hasScaled && (
            <Line
              yAxisId="scaled"
              type="monotone"
              dataKey="scaled_score"
              name="Scaled score"
              stroke="#f97316"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              connectNulls
              isAnimationActive={animate}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
