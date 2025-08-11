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

export default function AvgTimeBar({ data, fmt }) {
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
  const sliced = data.slice(0, 12);
  return (
    <Card title="Average Time by Subtype (mm:ss)">
      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={sliced}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="subtype"
            interval={0}
            angle={-20}
            textAnchor="end"
            height={80}
          />
          <YAxis />
          <Tooltip formatter={(v) => fmt(v)} />
          <Bar dataKey="avgSec">
            {sliced.map((_, idx) => (
              <Cell key={idx} fill={palette[(idx + 2) % palette.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
