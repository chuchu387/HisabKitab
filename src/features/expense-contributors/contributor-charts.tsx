"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ContributorCharts({ categorySummary, projectSummary, monthlySummary }: { categorySummary: any[]; projectSummary: any[]; monthlySummary: any[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <ChartCard title="By Category">
        <BarChart data={categorySummary}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="amount" fill="#0f766e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>
      <ChartCard title="By Project">
        <BarChart data={projectSummary}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="amount" fill="#2563eb" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>
      <ChartCard title="Monthly Trend">
        <LineChart data={monthlySummary}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="amount" stroke="#ea580c" strokeWidth={2} />
        </LineChart>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
