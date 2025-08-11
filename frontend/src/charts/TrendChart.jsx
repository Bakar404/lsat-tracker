import React from "react";
import Card from "../components/cards/Card";
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
} from "recharts";

export default function TrendChart({ data }) {
  // Sort data by exam_number numerically to ensure proper x-axis ordering
  const sortedData = React.useMemo(() => {
    return [...data].sort((a, b) => {
      const numA = Number(a.exam_number);
      const numB = Number(b.exam_number);

      // If both are valid numbers, sort numerically
      if (Number.isFinite(numA) && Number.isFinite(numB)) {
        return numA - numB;
      }

      // Otherwise, fall back to string comparison
      return String(a.exam_number).localeCompare(String(b.exam_number));
    });
  }, [data]);

  return (
    <Card title="Trend by Exam (Accuracy & Scaled Score)">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={sortedData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="exam_number"
            type="category"
            interval={0}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis yAxisId="left" unit="%" />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip />
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="accuracy"
            name="Accuracy %"
            stroke="#10b981"
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="scaled_score"
            name="Scaled"
            stroke="#f97316"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
