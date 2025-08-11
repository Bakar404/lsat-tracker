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
} from "recharts";

export default function SectionAccuracyChart({ data }) {
  return (
    <Card title="Accuracy by Section Type">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="section_type" />
          <YAxis unit="%" />
          <Tooltip />
          <Bar dataKey="accuracy" fill="#0ea5e9" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
