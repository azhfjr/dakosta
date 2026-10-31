"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatNumberId } from "@/lib/dates";
import type { MonthlyTrendPoint } from "@/lib/kpi/sql";

const GRID = "#e5edf3";
const AXIS = "#597184";

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid #dbe6ee",
  boxShadow: "0 8px 24px rgba(16, 42, 67, 0.08)",
  fontSize: 12,
} as const;

export function MonthlyTrendChart({ data }: { data: MonthlyTrendPoint[] }) {
  const total = data.reduce((sum, point) => sum + point.approved, 0);

  return (
    <>
      {total === 0 && data.every((point) => point.submitted === 0) ? (
        <div className="mt-4 flex h-[260px] items-center justify-center rounded-lg border border-dashed border-border bg-surface-muted/40 px-4 text-center text-sm text-ink-muted">
          Belum ada aktivitas pada enam bulan terakhir untuk filter ini.
        </div>
      ) : (
        <>
          <div className="mt-4 h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                barGap={4}
              >
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: AXIS, fontSize: 11 }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: AXIS, fontSize: 11 }}
                  width={36}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "#0f2a43", fontWeight: 600 }}
                  formatter={(value, name) => [
                    `${formatNumberId(Number(value))} konten`,
                    name === "approved" ? "Disetujui" : "Dikirim",
                  ]}
                />
                <Legend
                  formatter={(value) =>
                    value === "approved" ? "Disetujui" : "Dikirim"
                  }
                  wrapperStyle={{ fontSize: 12, color: AXIS }}
                />
                <Bar
                  dataKey="approved"
                  fill="#218353"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="submitted"
                  fill="#0a78ca"
                  fillOpacity={0.45}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-ink-muted select-none">
              Tabel data enam bulan
            </summary>
            <div className="relative mt-2 overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">
                  Tren bulanan konten disetujui dan dikirim
                </caption>
                <thead>
                  <tr className="border-b border-border text-ink-muted">
                    <th scope="col" className="px-2 py-1.5 font-medium">Bulan</th>
                    <th scope="col" className="px-2 py-1.5 font-medium">Disetujui</th>
                    <th scope="col" className="px-2 py-1.5 font-medium">Dikirim</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((point) => (
                    <tr
                      key={point.month}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-2 py-1.5 text-ink-muted">{point.label}</td>
                      <td className="px-2 py-1.5 text-ink-muted tabular">
                        {formatNumberId(point.approved)}
                      </td>
                      <td className="px-2 py-1.5 text-ink-muted tabular">
                        {formatNumberId(point.submitted)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </>
  );
}
