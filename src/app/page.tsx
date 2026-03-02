"use client"

import { useEffect, useState } from "react"
import { supabase, Lead, ScrapeJob } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { LeadTable } from "@/components/lead-table"
import { LeadDetail } from "@/components/lead-detail"
import { ScrapePanel } from "@/components/scrape-panel"
import { StatsCards } from "@/components/stats-cards"

export default function Home() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterSource, setFilterSource] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)

  const fetchLeads = async () => {
    setLoading(true)
    let query = supabase.from("leads").select("*").order("score", { ascending: false })

    if (filterStatus !== "all") query = query.eq("status", filterStatus)
    if (filterSource !== "all") query = query.eq("source", filterSource)
    if (searchQuery) query = query.ilike("company_name", `%${searchQuery}%`)

    const { data } = await query
    setLeads(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchLeads()
  }, [filterStatus, filterSource, searchQuery])

  const sources = [...new Set(leads.map(l => l.source))].filter(Boolean)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">LF</div>
            <h1 className="text-xl font-bold">LeadFlow</h1>
            <Badge variant="secondary" className="text-xs">Revolut Business</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs text-green-400 border-green-400/30">● Live</Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <StatsCards leads={leads} />

        <Tabs defaultValue="leads" className="space-y-4">
          <TabsList>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="scraper">Scraper Engine</TabsTrigger>
          </TabsList>

          <TabsContent value="leads" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <Input
                placeholder="Search companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="interested">Interested</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {sources.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={fetchLeads}>Refresh</Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <LeadTable
                  leads={leads}
                  loading={loading}
                  onSelect={setSelectedLead}
                  selectedId={selectedLead?.id}
                />
              </div>
              <div>
                {selectedLead ? (
                  <LeadDetail lead={selectedLead} onUpdate={fetchLeads} />
                ) : (
                  <Card>
                    <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
                      Select a lead to view details
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="scraper">
            <ScrapePanel onComplete={fetchLeads} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
