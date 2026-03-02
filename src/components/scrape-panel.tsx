"use client"

import { useState, useEffect } from "react"
import { supabase, ScrapeJob } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const SCRAPE_SOURCES = [
  {
    id: "icex-exporters",
    name: "ICEX Spanish Exporters",
    description: "Spanish companies with international trade activity",
    icon: "🇪🇸",
  },
  {
    id: "trade-fairs",
    name: "Trade Fair Exhibitors",
    description: "Companies exhibiting at Spanish trade fairs (IFEMA, Fira Barcelona)",
    icon: "🏭",
  },
  {
    id: "importers-spain",
    name: "Spanish Importers Registry",
    description: "Companies importing from non-EUR countries",
    icon: "📦",
  },
  {
    id: "bubble-saas",
    name: "Bubble.io / SaaS Companies",
    description: "Spanish companies using Bubble.io and similar SaaS platforms",
    icon: "💻",
  },
  {
    id: "camara-comercio",
    name: "Cámara de Comercio",
    description: "Spanish Chamber of Commerce business directory",
    icon: "🏛️",
  },
]

export function ScrapePanel({ onComplete }: { onComplete: () => void }) {
  const [jobs, setJobs] = useState<ScrapeJob[]>([])
  const [runningSource, setRunningSource] = useState<string | null>(null)

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
    try {
      const res = await fetch(`/api/scrape/${sourceId}`, { method: "POST" })
      const data = await res.json()
      if (data.success) {
        onComplete()
      }
    } catch (e) {
      console.error("Scrape failed:", e)
    } finally {
      setRunningSource(null)
      fetchJobs()
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Scraper Sources */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Scraper Sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {SCRAPE_SOURCES.map(source => (
            <div
              key={source.id}
              className="flex items-center justify-between border border-border/50 rounded-lg p-3"
            >
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
                className="text-xs"
              >
                {runningSource === source.id ? "Running..." : "Run"}
              </Button>
            </div>
          ))}

          <Button
            className="w-full mt-2"
            onClick={() => {
              SCRAPE_SOURCES.forEach(s => runScraper(s.id))
            }}
            disabled={runningSource !== null}
          >
            🚀 Run All Scrapers
          </Button>
        </CardContent>
      </Card>

      {/* Job History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Scrape History</CardTitle>
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
