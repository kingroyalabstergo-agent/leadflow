"use client"

import { useState, useEffect } from "react"
import { supabase, ScrapeJob } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const SCRAPE_SOURCES = [
  {
    id: "camara-comercio",
    endpoint: "/api/scrape/camara-comercio",
    name: "🏛️ Cámara de Comercio — Big Traders (>€1M)",
    description: "Spanish importers/exporters with China, India, Turkey, USA, UK + 5 more countries",
  },
  {
    id: "camara-comercio-sme",
    endpoint: "/api/scrape/camara-comercio-sme",
    name: "🏢 Cámara de Comercio — SMEs (€100K-€1M)",
    description: "Smaller companies trading with top 4 countries",
  },
  {
    id: "google-maps",
    endpoint: "/api/scrape/google-maps",
    name: "📍 Google Maps — Import/Export Businesses",
    description: "Import/export companies, distributors, customs agents across Spain",
  },
  {
    id: "google-search",
    endpoint: "/api/scrape/google-search",
    name: "🔍 Google Search — Companies & SaaS",
    description: "Find importers, exporters, trade fair exhibitors, and Bubble.io/SaaS companies",
  },
  {
    id: "icex-exporters",
    endpoint: "/api/scrape/icex-exporters",
    name: "🇪🇸 ICEX Exporters (>€1M)",
    description: "Major Spanish exporters from official directory",
  },
  {
    id: "trade-fairs",
    endpoint: "/api/scrape/trade-fairs",
    name: "🏭 Trade Sectors (Machinery, Electronics, Plastics)",
    description: "Companies in key import/export sectors",
  },
]

export function ScrapePanel({ onComplete }: { onComplete: () => void }) {
  const [jobs, setJobs] = useState<ScrapeJob[]>([])
  const [runningSource, setRunningSource] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, string>>({})
  const [enriching, setEnriching] = useState(false)
  const [enrichResult, setEnrichResult] = useState("")

  useEffect(() => { fetchJobs() }, [])

  const fetchJobs = async () => {
    const { data } = await supabase.from("scrape_jobs").select("*").order("started_at", { ascending: false }).limit(20)
    setJobs(data || [])
  }

  const runScraper = async (source: typeof SCRAPE_SOURCES[0]) => {
    setRunningSource(source.id)
    setResults(r => ({ ...r, [source.id]: "⏳ Running..." }))
    try {
      const res = await fetch(source.endpoint, { method: "POST" })
      const data = await res.json()
      if (data.success) {
        setResults(r => ({ ...r, [source.id]: `✅ Found ${data.leads_found} new leads` }))
        onComplete()
      } else {
        setResults(r => ({ ...r, [source.id]: `❌ ${data.error}` }))
      }
    } catch (e: any) {
      setResults(r => ({ ...r, [source.id]: `❌ ${e.message}` }))
    } finally {
      setRunningSource(null)
      fetchJobs()
    }
  }

  const runEnrichment = async () => {
    setEnriching(true)
    setEnrichResult("⏳ Enriching leads (finding phones, emails, executives)...")
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch: true }),
      })
      const data = await res.json()
      setEnrichResult(`✅ Enriched ${data.enriched}/${data.total} leads with contact info`)
      onComplete()
    } catch (e: any) {
      setEnrichResult(`❌ ${e.message}`)
    } finally {
      setEnriching(false)
    }
  }

  const runAll = async () => {
    for (const source of SCRAPE_SOURCES) {
      await runScraper(source)
    }
    await runEnrichment()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🕷️ Lead Sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {SCRAPE_SOURCES.map(source => (
            <div key={source.id} className="border border-border/50 rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex-1 mr-2">
                  <p className="text-sm font-medium">{source.name}</p>
                  <p className="text-xs text-muted-foreground">{source.description}</p>
                </div>
                <Button size="sm" onClick={() => runScraper(source)} disabled={runningSource !== null} className="text-xs shrink-0">
                  {runningSource === source.id ? "Running..." : "Run"}
                </Button>
              </div>
              {results[source.id] && <p className="text-xs">{results[source.id]}</p>}
            </div>
          ))}

          <div className="border border-blue-500/30 rounded-lg p-3 space-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">📞 Contact Enrichment</p>
                <p className="text-xs text-muted-foreground">Scrape websites to find phone numbers, emails, CEO/CFO names</p>
              </div>
              <Button size="sm" variant="secondary" onClick={runEnrichment} disabled={enriching} className="text-xs shrink-0">
                {enriching ? "Enriching..." : "Enrich"}
              </Button>
            </div>
            {enrichResult && <p className="text-xs">{enrichResult}</p>}
          </div>

          <Button className="w-full mt-2" onClick={runAll} disabled={runningSource !== null || enriching}>
            🚀 Run All + Enrich
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📋 Scrape History</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No scrape jobs yet</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-auto">
              {jobs.map(job => (
                <div key={job.id} className="flex items-center justify-between border border-border/50 rounded p-2">
                  <div>
                    <p className="text-sm font-medium">{job.source}</p>
                    <p className="text-xs text-muted-foreground">{new Date(job.started_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{job.leads_found} leads</span>
                    <Badge variant="outline" className={
                      job.status === "completed" ? "text-green-400 border-green-400/30" :
                      job.status === "running" ? "text-yellow-400 border-yellow-400/30" :
                      "text-red-400 border-red-400/30"
                    }>{job.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
