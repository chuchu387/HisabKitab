"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/lib/utils";

const palette = ["#168f84", "#f59e0b", "#2563eb", "#dc2626", "#7c3aed", "#0f766e", "#ea580c", "#475569"];
const tooltipFormatter = (value: unknown) => money(Number(value ?? 0));

export function ReportVisuals({ categorySummary, monthlySummary, expenseTypeSummary, projects }: { categorySummary: any[]; monthlySummary: any[]; expenseTypeSummary: any[]; projects: any[] }) {
  const topProjects = [...projects].sort((a, b) => (b.expense ?? 0) - (a.expense ?? 0)).slice(0, 8);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ReportChart title="Expense Allocation">
        <PieChart>
          <Pie data={expenseTypeSummary} dataKey="amount" nameKey="name" innerRadius={46} outerRadius={78} paddingAngle={2}>
            {expenseTypeSummary.map((_, index) => <Cell key={index} fill={palette[index % palette.length]} />)}
          </Pie>
          <Tooltip formatter={tooltipFormatter} />
          <Legend />
        </PieChart>
      </ReportChart>
      <ReportChart title="Expense by Category">
        <BarChart data={categorySummary}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis width={42} tick={{ fontSize: 11 }} tickFormatter={(value) => `${Number(value) / 1000}k`} />
          <Tooltip formatter={tooltipFormatter} />
          <Bar dataKey="amount" radius={[5, 5, 0, 0]}>
            {categorySummary.map((_, index) => <Cell key={index} fill={palette[index % palette.length]} />)}
          </Bar>
        </BarChart>
      </ReportChart>
      <ReportChart title="Monthly Expense Trend">
        <AreaChart data={monthlySummary}>
          <defs>
            <linearGradient id="reportMonthly" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis width={42} tick={{ fontSize: 11 }} tickFormatter={(value) => `${Number(value) / 1000}k`} />
          <Tooltip formatter={tooltipFormatter} />
          <Area type="monotone" dataKey="amount" stroke="#f59e0b" strokeWidth={3} fill="url(#reportMonthly)" />
        </AreaChart>
      </ReportChart>
      <ReportChart title="Project Received vs Expense">
        <ComposedChart data={topProjects}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis width={42} tick={{ fontSize: 11 }} tickFormatter={(value) => `${Number(value) / 1000}k`} />
          <Tooltip formatter={tooltipFormatter} />
          <Legend />
          <Bar dataKey="received" fill="#168f84" radius={[5, 5, 0, 0]} />
          <Line type="monotone" dataKey="expense" stroke="#dc2626" strokeWidth={3} />
        </ComposedChart>
      </ReportChart>
    </div>
  );
}

function ReportChart({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-64 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
