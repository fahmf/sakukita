"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { formatCurrency } from "@/lib/format";

interface CumulativeCashflowProps {
  data: Array<any>;
}

export function CumulativeCashflow({ data }: CumulativeCashflowProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#5FBF9A" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#5FBF9A" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#E8A5A5" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#E8A5A5" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="date" fontSize={9} tickLine={false} stroke="var(--muted-foreground)" />
        <YAxis
          fontSize={9}
          tickLine={false}
          axisLine={false}
          stroke="var(--muted-foreground)"
          tickFormatter={(v) => `Rp ${v >= 1000000 ? (v / 1000000).toFixed(1) + "M" : v}`}
        />
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value)), ""]}
          contentStyle={{
            background: "var(--card)",
            borderColor: "var(--border)",
            borderRadius: "12px",
            fontSize: "11px",
            color: "var(--foreground)",
          }}
          itemStyle={{ color: "var(--foreground)" }}
          labelStyle={{ color: "var(--foreground)" }}
        />
        <Area
          type="monotone"
          dataKey="Pemasukan Kumulatif"
          stroke="#5FBF9A"
          fillOpacity={1}
          fill="url(#colorInc)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="Pengeluaran Kumulatif"
          stroke="#E8A5A5"
          fillOpacity={1}
          fill="url(#colorExp)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface NetWorthTrendProps {
  data: Array<any>;
}

export function NetWorthTrend({ data }: NetWorthTrendProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="month" fontSize={9} tickLine={false} stroke="var(--muted-foreground)" />
        <YAxis
          fontSize={9}
          tickLine={false}
          axisLine={false}
          stroke="var(--muted-foreground)"
          tickFormatter={(v) => `Rp ${v >= 1000000 ? (v / 1000000).toFixed(1) + "M" : v}`}
        />
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value)), "Kekayaan Bersih"]}
          contentStyle={{
            background: "var(--card)",
            borderColor: "var(--border)",
            borderRadius: "12px",
            fontSize: "11px",
            color: "var(--foreground)",
          }}
          itemStyle={{ color: "var(--foreground)" }}
          labelStyle={{ color: "var(--foreground)" }}
        />
        <Line
          type="monotone"
          dataKey="Kekayaan Bersih"
          stroke="#5FBF9A"
          strokeWidth={3}
          dot={{ r: 4, strokeWidth: 1 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
