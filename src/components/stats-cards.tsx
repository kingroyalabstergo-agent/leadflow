"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Lead } from "@/lib/supabase"

export function StatsCards({ leads }: { leads: Lead[] }) {
  const total = leads.length
  const today = leads.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length
  const contacted = leads.filter(l => l.status === "contacted").length
  const interested = leads.filter(l => l.status === "interested").length
  const closed = leads.filter(l => l.status === "closed").length
  const convRate = contacted > 0 ? ((interested + closed) / contacted * 100).toFixed(1) : "0"
  const avgScore = total > 0 ? (leads.reduce((s, l) => s + l.score, 0) / total).toFixed(0) : "0"

  const stats = [
    { label: "Total Leads", value: total, color: "text-blue-400" },
    { label: "New Today", value: today, color: "text-green-400" },
    { label: "Contacted", value: contacted, color: "text-yellow-400" },
    { label: "Interested", value: interested, color: "text-purple-400" },
    { label: "Closed Won", value: closed, color: "text-emerald-400" },
    { label: "Conv. Rate", value: `${convRate}%`, color: "text-orange-400" },
    { label: "Avg Score", value: avgScore, color: "text-cyan-400" },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {stats.map(s => (
        <Card key={s.label}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
