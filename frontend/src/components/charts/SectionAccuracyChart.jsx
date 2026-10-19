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
import { SECTION_TYPE_COLORS } from "../ui/styles.js";
import ChartCard from "./ChartCard.jsx";
import StatTooltip from "./StatTooltip.jsx";
import { AXIS_LINE, AXIS_TICK, CURSOR, GRID, accuracyLine, timeLine } from "./theme.js";

export default function SectionAccuracyChart({ data }) {
  return (
    <ChartCard title="Accuracy by section type" subtitle="Share of questions answered correctly">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="section_type" tick={AXIS_TICK} stroke={AXIS_LINE} />
          <YAxis domain={[0, 100]} unit="%" tick={AXIS_TICK} stroke={AXIS_LINE} />
          <Tooltip
            cursor={CURSOR}
            content={(props) => (
              <StatTooltip
                {...props}
                title={(d) => d.section_type}
                lines={(d) => [accuracyLine(d), timeLine(d)]}
              />
            )}
          />
          <Bar
            dataKey="accuracy"
            name="Accuracy"
            maxBarSize={88}
            radius={[8, 8, 0, 0]}
            shape={(props) => (
              <Rectangle {...props} fill={SECTION_TYPE_COLORS[props.payload.section_type]} />
            )}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
