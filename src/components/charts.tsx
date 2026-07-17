"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/lib/utils";

const palette = ["#168f84", "#f59e0b", "#2563eb", "#dc2626", "#7c3aed", "#0f766e", "#ea580c", "#475569"];

const tooltipFormatter = (value: unknown) => money(Number(value ?? 0));

export function SimpleBarChart({ title, data, xKey = "name", yKey = "amount" }: { title: string; data: Record<string, unknown>[]; xKey?: string; yKey?: string }) {
  return (
    <Card className="shadow-sm">
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis width={42} tick={{ fontSize: 11 }} tickFormatter={(value) => `${Number(value) / 1000}k`} />
            <Tooltip formatter={tooltipFormatter} />
            <Bar dataKey={yKey} radius={[5, 5, 0, 0]}>
              {data.map((_, index) => <Cell key={index} fill={palette[index % palette.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function TrendChart({ data }: { data: Record<string, unknown>[] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader><CardTitle>Monthly Expense Trend</CardTitle></CardHeader>
      <CardContent className="h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="expenseTrend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis width={42} tick={{ fontSize: 11 }} tickFormatter={(value) => `${Number(value) / 1000}k`} />
            <Tooltip formatter={tooltipFormatter} />
            <Area type="monotone" dataKey="amount" stroke="#f59e0b" strokeWidth={3} fill="url(#expenseTrend)" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function BudgetExpenseChart({ data }: { data: Record<string, unknown>[] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader><CardTitle>Budget, Received, and Expense</CardTitle></CardHeader>
      <CardContent className="h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis width={42} tick={{ fontSize: 11 }} tickFormatter={(value) => `${Number(value) / 1000}k`} />
            <Tooltip formatter={tooltipFormatter} />
            <Legend />
            <Bar dataKey="budget" fill="#2563eb" radius={[5, 5, 0, 0]} />
            <Bar dataKey="received" fill="#168f84" radius={[5, 5, 0, 0]} />
            <Line type="monotone" dataKey="expense" stroke="#dc2626" strokeWidth={3} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function DonutChart({ title, data, nameKey = "name", valueKey = "amount" }: { title: string; data: Record<string, unknown>[]; nameKey?: string; valueKey?: string }) {
  return (
    <Card className="shadow-sm">
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius={46} outerRadius={78} paddingAngle={2}>
              {data.map((_, index) => <Cell key={index} fill={palette[index % palette.length]} />)}
            </Pie>
            <Tooltip formatter={tooltipFormatter} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
