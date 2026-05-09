import { useGetDashboardMetrics } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from "recharts";
import {
  TrendingUp, Users, CalendarCheck, RefreshCw, Handshake, CheckCircle2,
  Home, Key
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { format, parseISO } from "date-fns";

export default function Dashboard() {
  const { data: metrics, isLoading } = useGetDashboardMetrics();

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
        </div>

        {/* Top High-Impact Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {renderMetricCard("Referrals", metrics?.referralLeads || 0, <Handshake size={24} />, undefined, "text-pink-600", "bg-pink-100")}
          {renderMetricCard("Viewings Booked", metrics?.viewingsBooked || 0, <CalendarCheck size={24} />, undefined, "text-blue-600", "bg-blue-100")}
          {renderMetricCard("Reactivated", metrics?.reactivatedLeads || 0, <RefreshCw size={24} />, undefined, "text-indigo-600", "bg-indigo-100")}
        </div>

        {/* CRM Pipeline Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
              <RefreshCw className="text-blue-500 mb-2 opacity-80" size={20} />
              <p className="text-2xl font-bold">{metrics?.reactivatedLeads || 0}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Reactivated</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-border/50 bg-card/50">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
              <Handshake className="text-pink-500 mb-2 opacity-80" size={20} />
              <p className="text-2xl font-bold">{metrics?.referralLeads || 0}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Referrals</p>
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
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Line Chart: Conversations over week */}
          <Card className="col-span-1 lg:col-span-2 rounded-2xl border-border/50 shadow-md">
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

          {/* Bar Chart: Channels */}
          <Card className="rounded-2xl border-border/50 shadow-md">
            <CardContent className="p-6">
              <h3 className="font-display font-semibold mb-6 text-lg">Messages by Channel</h3>
              <div className="h-[300px] w-full">
                {isLoading ? (
                   <div className="w-full h-full bg-muted/20 animate-pulse rounded-xl" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics?.messagesByChannel || []} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" hide />
                      <YAxis 
                        type="category" 
                        dataKey="channel" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: 'hsl(var(--foreground))', fontWeight: 500 }} 
                        width={80}
                      />
                      <RechartsTooltip cursor={{fill: 'hsl(var(--muted)/0.5)'}} contentStyle={{ borderRadius: '8px' }}/>
                      <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={32}>
                        {metrics?.messagesByChannel.map((entry, index) => {
                          const colors = ['#22c55e', '#3b82f6', '#f97316'];
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Funnel */}
        <Card className="rounded-2xl border-border/50 shadow-md overflow-hidden bg-gradient-to-br from-card to-muted/20">
          <CardContent className="p-8">
            <h3 className="font-display font-semibold mb-8 text-xl text-center">Conversion Funnel</h3>
            
            {isLoading || !metrics ? (
               <div className="h-64 w-full bg-muted/20 animate-pulse rounded-xl" />
            ) : (
              <div className="max-w-4xl mx-auto flex flex-col items-center space-y-2">
                {[
                  { label: "New Leads", value: metrics.funnel.newLeads, color: "bg-blue-500", width: "100%" },
                  { label: "Engaged", value: metrics.funnel.engaged, color: "bg-indigo-500", width: "85%" },
                  { label: "Qualified", value: metrics.funnel.qualified, color: "bg-purple-500", width: "65%" },
                  { label: "Viewings Booked", value: metrics.funnel.viewingsBooked, color: "bg-pink-500", width: "40%" },
                  { label: "Offers Made", value: metrics.funnel.offers, color: "bg-rose-500", width: "25%" },
                ].map((step, i) => (
                  <div key={i} className="w-full flex flex-col items-center">
                    <div 
                      className={`h-14 ${step.color} rounded-lg flex items-center justify-between px-6 text-white font-medium shadow-md transition-all hover:scale-[1.02] cursor-default`}
                      style={{ width: step.width }}
                    >
                      <span>{step.label}</span>
                      <span className="font-bold text-lg">{step.value}</span>
                    </div>
                    {i < 4 && <div className="h-4 w-px bg-border/80 my-1"></div>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </Layout>
  );
}
