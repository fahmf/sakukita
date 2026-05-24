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

export function ExpenseDonut({
  data,
  selectedParentCategoryId,
  onSelectCategory,
  totalSpent,
}: ExpenseDonutProps) {
  return (
    <div className="h-[200px] w-full relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={75}
            paddingAngle={2}
            dataKey="value"
            onClick={(clickData: any) => {
              const clickedId = clickData?.payload?.id || clickData?.id;
              if (clickedId) onSelectCategory(clickedId);
            }}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                className="cursor-pointer hover:opacity-85 transition-opacity outline-none"
                style={{
                  filter: selectedParentCategoryId === entry.id ? "drop-shadow(0px 0px 4px rgba(0,0,0,0.25))" : "none",
                }}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [formatCurrency(Number(value)), "Jumlah"]}
            contentStyle={{
              background: "hsl(var(--card))",
              borderColor: "hsl(var(--border))",
              borderRadius: "12px",
              fontSize: "12px",
            }}
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
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
        <XAxis dataKey="date" fontSize={9} tickLine={false} />
        <YAxis
          fontSize={9}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `Rp ${v >= 1000000 ? (v / 1000000).toFixed(1) + "M" : v}`}
        />
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value)), ""]}
          contentStyle={{
            background: "hsl(var(--card))",
            borderColor: "hsl(var(--border))",
            borderRadius: "12px",
            fontSize: "11px",
          }}
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
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
        <XAxis dataKey="month" fontSize={9} tickLine={false} />
        <YAxis
          fontSize={9}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `Rp ${v >= 1000000 ? (v / 1000000).toFixed(1) + "M" : v}`}
        />
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value)), "Kekayaan Bersih"]}
          contentStyle={{
            background: "hsl(var(--card))",
            borderColor: "hsl(var(--border))",
            borderRadius: "12px",
            fontSize: "11px",
          }}
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
