import React from "react";
import Card from "../components/cards/Card";
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Cell,
} from "recharts";

export default function SubtypeBar({ data }) {
  const palette = [
    "#0ea5e9",
    "#10b981",
    "#f97316",
    "#a78bfa",
    "#f43f5e",
    "#14b8a6",
    "#eab308",
    "#64748b",
  ];
  const sliced = data.slice(0, 15);
  return (
    <Card title="Subtype Weaknesses & Strengths (Accuracy)">
      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={sliced} layout="vertical" margin={{ left: 140 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" domain={[0, 100]} unit="%" />
          <YAxis type="category" dataKey="subtype" width={140} />
          <Tooltip
            formatter={(v, name) => (name === "accuracy" ? `${v}%` : v)}
          />
          <Bar dataKey="accuracy">
            {sliced.map((_, idx) => (
              <Cell key={idx} fill={palette[idx % palette.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
