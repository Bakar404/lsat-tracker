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
  return (
    <Card title="Trend by Exam (Accuracy & Scaled Score)">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="exam_number" />
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
