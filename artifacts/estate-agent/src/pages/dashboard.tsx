import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from "recharts";
import {
  TrendingUp, Users, CalendarCheck, RefreshCw, Handshake, CheckCircle2,
  Home, Key, MessageCircle
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { format, parseISO, subDays } from "date-fns";

const PERIODS = [
  { label: "All Time", value: "all" },
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 30 Days", value: "30d" },
  { label: "Last 3 Months", value: "90d" },
] as const;

type Period = typeof PERIODS[number]["value"];

function sinceFromPeriod(period: Period): string | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  return subDays(new Date(), days).toISOString();
}

function useDashboardMetrics(period: Period) {
  const since = sinceFromPeriod(period);
  const url = since ? `/api/dashboard/metrics?since=${encodeURIComponent(since)}` : "/api/dashboard/metrics";
  return useQuery({
    queryKey: ["dashboard-metrics", period],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch metrics");
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });
}

export default function Dashboard() {
  const [period, setPeriod] = useState<Period>("all");
  const { data: metrics, isLoading } = useDashboardMetrics(period);

  const renderMetricCard = (title: string, value: string | number, icon: React.ReactNode, trend?: string, color: string = "text-primary", bg: string = "bg-primary/10") => (
    <Card className="rounded-2xl border-border/50 shadow-lg shadow-black/5 hover:shadow-xl transition-all duration-300 group overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-500">
        {icon}
      </div>
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-3 rounded-xl ${bg} ${color}`}>
            {icon}
          </div>
          {trend && (
            <span className="flex items-center text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200">
              <TrendingUp size={12} className="mr-1" /> {trend}
            </span>
          )}
        </div>
        <div>
          <h3 className="text-3xl font-display font-bold text-foreground mb-1">
            {isLoading ? <div className="h-8 w-20 bg-muted animate-pulse rounded" /> : value}
          </h3>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-8">

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Analytics Dashboard</h1>
            <p className="text-muted-foreground mt-1">Track bot performance, lead conversion, and ROI.</p>
          </div>
          <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1 border border-border/50">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  period === p.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Top High-Impact Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {renderMetricCard("Referrals", metrics?.referralLeads || 0, <Handshake size={24} />, undefined, "text-pink-600", "bg-pink-100")}
          {renderMetricCard("Viewings Booked", metrics?.viewingsBooked || 0, <CalendarCheck size={24} />, undefined, "text-blue-600", "bg-blue-100")}
          {renderMetricCard("Reactivated", metrics?.reactivatedLeads || 0, <RefreshCw size={24} />, undefined, "text-indigo-600", "bg-indigo-100")}
        </div>

        {/* CRM Pipeline Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card className="rounded-xl border-border/50 bg-card/50">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
              <Users className="text-primary mb-2 opacity-80" size={20} />
              <p className="text-2xl font-bold">{metrics?.leadsEngaged || 0}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Engaged</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-border/50 bg-card/50">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
              <CheckCircle2 className="text-teal-500 mb-2 opacity-80" size={20} />
              <p className="text-2xl font-bold">{metrics?.leadsEngagedInstantly || 0}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Instant Reply</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-border/50 bg-card/50">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
              <Home className="text-indigo-500 mb-2 opacity-80" size={20} />
              <p className="text-2xl font-bold">{metrics?.buyers || 0}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Buyers</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-border/50 bg-card/50">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
              <Key className="text-orange-500 mb-2 opacity-80" size={20} />
              <p className="text-2xl font-bold">{metrics?.renters || 0}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Renters</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-border/50 bg-card/50">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
              <MessageCircle className="text-violet-500 mb-2 opacity-80" size={20} />
              <p className="text-2xl font-bold">{metrics?.reengagedLeads || 0}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Reengaged</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 gap-6">

          {/* Line Chart: Conversations over week */}
          <Card className="rounded-2xl border-border/50 shadow-md">
            <CardContent className="p-6">
              <h3 className="font-display font-semibold mb-6 text-lg">New Conversations (Last 7 Days)</h3>
              <div className="h-[300px] w-full">
                {isLoading ? (
                  <div className="w-full h-full bg-muted/20 animate-pulse rounded-xl" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics?.newConversationsLastWeek || []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(val) => format(parseISO(val), 'MMM d')}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        dx={-10}
                      />
                      <RechartsTooltip
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        labelFormatter={(val) => format(parseISO(val), 'MMMM d, yyyy')}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="hsl(var(--primary))"
                        strokeWidth={4}
                        dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 8, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

        </div>

      </div>
    </Layout>
  );
}
