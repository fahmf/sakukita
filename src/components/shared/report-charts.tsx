"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
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

interface ExpenseDonutProps {
  data: Array<{ id: string; name: string; value: number; color: string }>;
  selectedParentCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  totalSpent: number;
}

// Renders a bold percentage label centred on each slice that is large enough
// to fit one. White text reads clearly over the saturated palette in both
// light and dark mode.
function renderPercentLabel(total: number) {
  return function PercentLabel(props: any) {
    const { cx, cy, midAngle, innerRadius, outerRadius, value } = props;
    const percent = total > 0 ? value / total : 0;
    if (percent < 0.08) return null; // skip slivers — they'd overlap

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) / 2;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="#ffffff"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={700}
        style={{ pointerEvents: "none", textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}
      >
        {`${Math.round(percent * 100)}%`}
      </text>
    );
  };
}

export function ExpenseDonut({
  data,
  selectedParentCategoryId,
  onSelectCategory,
  totalSpent,
}: ExpenseDonutProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="h-[200px] w-full relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={78}
            paddingAngle={2}
            dataKey="value"
            stroke="hsl(var(--card))"
            strokeWidth={2}
            labelLine={false}
            label={renderPercentLabel(total)}
            onClick={(clickData: any) => {
              const clickedId = clickData?.payload?.id || clickData?.id;
              if (clickedId) onSelectCategory(clickedId);
            }}
          >
            {data.map((entry, index) => {
              const isSelected = selectedParentCategoryId === entry.id;
              const isDimmed = selectedParentCategoryId !== null && !isSelected;
              return (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  className="cursor-pointer transition-opacity outline-none"
                  style={{
                    opacity: isDimmed ? 0.45 : 1,
                    filter: isSelected ? "brightness(1.08)" : "none",
                  }}
                />
              );
            })}
          </Pie>
          <Tooltip
            formatter={(value) => [formatCurrency(Number(value)), "Jumlah"]}
            contentStyle={{
              background: "var(--card)",
              borderColor: "var(--border)",
              borderRadius: "12px",
              fontSize: "12px",
              color: "var(--foreground)",
            }}
            itemStyle={{ color: "var(--foreground)" }}
            labelStyle={{ color: "var(--foreground)" }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-[10px] text-muted-foreground font-semibold uppercase">Total</span>
        <span className="text-xs font-bold text-foreground truncate max-w-[100px]">
          {formatCurrency(totalSpent)}
        </span>
      </div>
    </div>
  );
}

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
