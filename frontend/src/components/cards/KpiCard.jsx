import React from "react";
export default function KpiCard({ title, value, icon }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4 flex items-center gap-3">
      <div className="p-2 rounded-xl bg-slate-100">{icon}</div>
      <div>
        <div className="text-xs text-slate-500">{title}</div>
        <div className="text-lg font-semibold">{value ?? "—"}</div>
      </div>
    </div>
  );
}
