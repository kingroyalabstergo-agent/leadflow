"use client"

import { useState, useEffect } from "react"
import { supabase, ScrapeJob } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const SCRAPE_SOURCES = [
  {
    id: "camara-comercio",
    name: "Cámara de Comercio — Big Traders",
    description: "Spanish companies trading >€1M with China, India, Turkey, USA, UK, Japan, Brazil, Mexico, Morocco, S.Korea",
    icon: "🏛️",
  },
  {
    id: "camara-comercio-sme",
    name: "Cámara de Comercio — SMEs",
    description: "Smaller companies (€100K-€1M) trading with China, India, Turkey, USA",
    icon: "🏢",
  },
  {
    id: "icex-exporters",
    name: "ICEX Spanish Exporters",
    description: "Major Spanish exporters (>€1M annual exports)",
    icon: "🇪🇸",
  },
  {
    id: "trade-fairs",
    name: "Trade Sectors (Machinery, Electronics, Plastics, Vehicles)",
    description: "Companies in key import/export sectors with likely FX exposure",
    icon: "🏭",
  },
  {
    id: "bubble-saas",
    name: "Bubble.io / SaaS Companies",
    description: "Spanish companies using SaaS platforms (paying in USD)",
    icon: "💻",
  },
]

export function ScrapePanel({ onComplete }: { onComplete: () => void }) {
  const [jobs, setJobs] = useState<ScrapeJob[]>([])
  const [runningSource, setRunningSource] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchJobs()
  }, [])

  const fetchJobs = async () => {
    const { data } = await supabase
      .from("scrape_jobs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(20)
    setJobs(data || [])
  }

  const runScraper = async (sourceId: string) => {
    setRunningSource(sourceId)
    setResults(r => ({ ...r, [sourceId]: "Running..." }))
    try {
      const res = await fetch(`/api/scrape/${sourceId}`, { method: "POST" })
      const data = await res.json()
      if (data.success) {
        setResults(r => ({ ...r, [sourceId]: `✅ Found ${data.leads_found} new leads (${data.total_scraped} scraped)` }))
        onComplete()
      } else {
        setResults(r => ({ ...r, [sourceId]: `❌ ${data.error}` }))
      }
    } catch (e: any) {
      setResults(r => ({ ...r, [sourceId]: `❌ ${e.message}` }))
    } finally {
      setRunningSource(null)
      fetchJobs()
    }
  }

  const runAll = async () => {
    for (const source of SCRAPE_SOURCES) {
      await runScraper(source.id)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Scraper Sources */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🕷️ Scraper Sources</CardTitle>
          <p className="text-xs text-muted-foreground">
            Data sourced from Cámara de Comercio official directory of Spanish importers/exporters
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {SCRAPE_SOURCES.map(source => (
            <div key={source.id} className="border border-border/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{source.icon}</span>
                  <div>
                    <p className="text-sm font-medium">{source.name}</p>
                    <p className="text-xs text-muted-foreground">{source.description}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => runScraper(source.id)}
                  disabled={runningSource !== null}
                  className="text-xs shrink-0"
                >
                  {runningSource === source.id ? "Running..." : "Run"}
                </Button>
              </div>
              {results[source.id] && (
                <p className="text-xs text-muted-foreground ml-11">{results[source.id]}</p>
              )}
            </div>
          ))}

          <Button
            className="w-full mt-2"
            onClick={runAll}
            disabled={runningSource !== null}
          >
            🚀 Run All Scrapers
          </Button>
        </CardContent>
      </Card>

      {/* Job History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📋 Scrape History</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No scrape jobs yet — run a scraper!</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-auto">
              {jobs.map(job => (
                <div key={job.id} className="flex items-center justify-between border border-border/50 rounded p-2">
                  <div>
                    <p className="text-sm font-medium">{job.source}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(job.started_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{job.leads_found} leads</span>
                    <Badge
                      variant="outline"
                      className={
                        job.status === "completed"
                          ? "text-green-400 border-green-400/30"
                          : job.status === "running"
                          ? "text-yellow-400 border-yellow-400/30"
                          : "text-red-400 border-red-400/30"
                      }
                    >
                      {job.status}
                    </Badge>
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
