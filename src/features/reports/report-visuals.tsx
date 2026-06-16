"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ReportVisuals({ categorySummary, monthlySummary, expenseTypeSummary, projects }: { categorySummary: any[]; monthlySummary: any[]; expenseTypeSummary: any[]; projects: any[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ReportChart title="Expense by Category">
        <BarChart data={categorySummary}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="amount" fill="#0f766e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ReportChart>
      <ReportChart title="Monthly Expense Trend">
        <LineChart data={monthlySummary}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="amount" stroke="#ea580c" strokeWidth={2} />
        </LineChart>
      </ReportChart>
      <ReportChart title="Project vs General Expense">
        <BarChart data={expenseTypeSummary}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="amount" fill="#2563eb" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ReportChart>
      <ReportChart title="Project Paid vs Expense">
        <BarChart data={projects}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="received" fill="#0f766e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" fill="#dc2626" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ReportChart>
    </div>
  );
}

function ReportChart({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
