import React from "react";
import Card from "../components/cards/Card";
import { ResponsiveContainer, PieChart, Pie, Tooltip, Cell } from "recharts";

export default function FlaggedPie({ flagged, unflagged }) {
  const data = [
    { name: "Flagged", value: flagged },
    { name: "Un-flagged", value: unflagged },
  ];
  return (
    <Card title="Flagged vs Un-flagged">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie dataKey="value" data={data} outerRadius={100} label>
            <Cell fill="#f43f5e" />
            <Cell fill="#14b8a6" />
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}
