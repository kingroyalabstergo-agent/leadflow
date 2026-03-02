"use client"

import { Lead } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

const statusColors: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  contacted: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  interested: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  closed: "bg-green-500/20 text-green-400 border-green-500/30",
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 60 ? "text-green-400" : score >= 30 ? "text-yellow-400" : "text-red-400"
  return <span className={`font-bold ${color}`}>{score}</span>
}

export function LeadTable({ leads, loading, onSelect, selectedId }: {
  leads: Lead[]; loading: boolean; onSelect: (lead: Lead) => void; selectedId?: string
}) {
  if (loading) return <Card><CardContent className="flex items-center justify-center h-64 text-muted-foreground">Loading...</CardContent></Card>
  if (leads.length === 0) return <Card><CardContent className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2"><p className="text-lg">No leads yet</p><p className="text-sm">Run the scraper to find leads</p></CardContent></Card>

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-auto max-h-[600px]">
          <table className="w-full">
            <thead className="sticky top-0 bg-card border-b border-border">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left p-3">Score</th>
                <th className="text-left p-3">Company</th>
                <th className="text-left p-3">Currencies</th>
                <th className="text-left p-3">Source</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} onClick={() => onSelect(lead)}
                  className={`border-b border-border/50 cursor-pointer hover:bg-muted/50 transition-colors ${selectedId === lead.id ? "bg-muted/80" : ""}`}>
                  <td className="p-3"><ScoreBadge score={lead.score} /></td>
                  <td className="p-3">
                    <p className="font-medium text-sm">{lead.company_name}</p>
                    {lead.industry && <p className="text-xs text-muted-foreground">{lead.industry}</p>}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1 flex-wrap">
                      {lead.currencies_used?.map(c => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)}
                    </div>
                  </td>
                  <td className="p-3"><Badge variant="secondary" className="text-xs">{lead.source}</Badge></td>
                  <td className="p-3"><Badge className={`text-xs ${statusColors[lead.status] || ""}`}>{lead.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
