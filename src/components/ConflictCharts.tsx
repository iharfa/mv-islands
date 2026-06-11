"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const SEVERITY_COLORS: Record<string, string> = {
  low: "#737780", medium: "#E65100", high: "#B71C1C", critical: "#6A1B9A",
};

export default function ConflictCharts({
  byField, bySeverity, byAtoll,
}: {
  byField: { name: string; count: number }[];
  bySeverity: { name: string; count: number }[];
  byAtoll: { name: string; count: number }[];
}) {
  const chart = (title: string, data: { name: string; count: number }[], colorFn?: (n: string) => string) => (
    <div className="card p-4">
      <h3 className="label-md text-ink-soft mb-2">{title}</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
            <Tooltip cursor={{ fill: "rgba(0,51,102,0.05)" }} />
            <Bar dataKey="count" radius={[0, 3, 3, 0]}>
              {data.map((d) => (
                <Cell key={d.name} fill={colorFn ? colorFn(d.name) : "#003366"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  return (
    <div className="grid lg:grid-cols-3 gap-4 mb-8">
      {chart("Conflicts by field", byField)}
      {chart("Conflicts by severity", bySeverity, (n) => SEVERITY_COLORS[n] ?? "#003366")}
      {chart("Conflicts by atoll (top 10)", byAtoll)}
    </div>
  );
}
