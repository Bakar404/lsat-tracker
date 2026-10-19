import {
  Bar,
  BarChart,
  CartesianGrid,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DIFFICULTY_COLORS } from "../ui/styles.js";
import ChartCard from "./ChartCard.jsx";
import StatTooltip from "./StatTooltip.jsx";
import { AXIS_LINE, AXIS_TICK, CURSOR, GRID, accuracyLine, timeLine } from "./theme.js";

export default function DifficultyChart({ data }) {
  return (
    <ChartCard title="Accuracy by difficulty" subtitle="LawHub difficulty, from Level 1 (easiest) to Level 5">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} stroke={AXIS_LINE} />
          <YAxis domain={[0, 100]} unit="%" tick={AXIS_TICK} stroke={AXIS_LINE} />
          <Tooltip
            cursor={CURSOR}
            content={(props) => (
              <StatTooltip
                {...props}
                title={(d) => d.label}
                lines={(d) => [accuracyLine(d), timeLine(d)]}
              />
            )}
          />
          <Bar
            dataKey="accuracy"
            name="Accuracy"
            maxBarSize={64}
            radius={[8, 8, 0, 0]}
            shape={(props) => (
              <Rectangle {...props} fill={DIFFICULTY_COLORS[props.payload.difficulty - 1] ?? "#64748b"} />
            )}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
