"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ScrapeJob {
  id: string;
  source: string;
  status: string;
  leads_found: number;
  started_at: string;
  completed_at?: string;
}

const SOURCES = [
  { id: "camara-comercio", name: "🏛️ Cámara de Comercio — Big (>€1M)", endpoint: "/api/scrape/camara-comercio", desc: "China, India, Turkey, USA, UK + 5 more" },
  { id: "camara-comercio-sme", name: "🏢 Cámara SMEs (€100K-€1M)", endpoint: "/api/scrape/camara-comercio-sme", desc: "Smaller companies, top 4 countries" },
  { id: "google-maps", name: "📍 Google Maps", endpoint: "/api/scrape/google-maps", desc: "Import/export companies, distributors, agents" },
  { id: "google-search", name: "🔍 Google Search", endpoint: "/api/scrape/google-search", desc: "Companies, SaaS, trade fairs via Google" },
  { id: "icex-exporters", name: "🇪🇸 ICEX Exporters", endpoint: "/api/scrape/icex-exporters", desc: "Major Spanish exporters" },
  { id: "trade-fairs", name: "🏭 Trade Sectors", endpoint: "/api/scrape/trade-fairs", desc: "Machinery, electronics, plastics, vehicles" },
];

export default function ScrapePage() {
  const [jobs, setJobs] = useState<ScrapeJob[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState("");

  const fetchJobs = async () => {
    const res = await fetch("/api/scrape");
    const data = await res.json();
    if (Array.isArray(data)) setJobs(data);
  };

  useEffect(() => { fetchJobs(); }, []);

  const runScrape = async (source: typeof SOURCES[0]) => {
    setRunning(source.id);
    setResults(r => ({ ...r, [source.id]: "⏳ Running..." }));
    try {
      const res = await fetch(source.endpoint, { method: "POST" });
      const data = await res.json();
      setResults(r => ({ ...r, [source.id]: data.success ? `✅ ${data.leads_found} new leads` : `❌ ${data.error}` }));
    } catch (e: any) {
      setResults(r => ({ ...r, [source.id]: `❌ ${e.message}` }));
    }
    setRunning(null);
    fetchJobs();
  };

  const runEnrich = async () => {
    setEnriching(true);
    setEnrichResult("⏳ Finding phones, emails, executives...");
    try {
      const res = await fetch("/api/enrich", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batch: true }) });
      const data = await res.json();
      setEnrichResult(`✅ Enriched ${data.enriched}/${data.total} leads`);
    } catch (e: any) {
      setEnrichResult(`❌ ${e.message}`);
    }
    setEnriching(false);
  };

  const runAll = async () => {
    for (const s of SOURCES) await runScrape(s);
    await runEnrich();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">🕷️ Scraper Engine</h2>
        <button onClick={runAll} disabled={running !== null} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
          🚀 Run All + Enrich
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SOURCES.map((s) => (
          <div key={s.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-sm">{s.name}</p>
                <p className="text-xs text-zinc-500">{s.desc}</p>
              </div>
              <button onClick={() => runScrape(s)} disabled={running !== null}
                className={cn("px-3 py-1 rounded-lg text-xs font-medium transition-colors shrink-0",
                  running === s.id ? "bg-yellow-600 animate-pulse" : "bg-zinc-800 hover:bg-zinc-700")}>
                {running === s.id ? "Running..." : "Run"}
              </button>
            </div>
            {results[s.id] && <p className="text-xs">{results[s.id]}</p>}
          </div>
        ))}

        {/* Enrichment card */}
        <div className="bg-zinc-900 border border-blue-500/30 rounded-xl p-4 space-y-2">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-sm">📞 Contact Enrichment</p>
              <p className="text-xs text-zinc-500">Find phones, emails, CEO/CFO from websites</p>
            </div>
            <button onClick={runEnrich} disabled={enriching}
              className={cn("px-3 py-1 rounded-lg text-xs font-medium transition-colors shrink-0",
                enriching ? "bg-blue-600 animate-pulse" : "bg-blue-800 hover:bg-blue-700")}>
              {enriching ? "Enriching..." : "Enrich"}
            </button>
          </div>
          {enrichResult && <p className="text-xs">{enrichResult}</p>}
        </div>
      </div>

      {/* Job history */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-3 border-b border-zinc-800"><p className="font-medium text-sm">📋 Job History</p></div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
              <th className="text-left p-3">Source</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Leads</th>
              <th className="text-left p-3">Time</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-b border-zinc-800/50">
                <td className="p-3">{job.source}</td>
                <td className="p-3">
                  <span className={cn("px-2 py-0.5 rounded-full text-xs",
                    job.status === "completed" ? "bg-green-500/20 text-green-400" :
                    job.status === "failed" ? "bg-red-500/20 text-red-400" :
                    "bg-yellow-500/20 text-yellow-400"
                  )}>{job.status}</span>
                </td>
                <td className="p-3 text-zinc-400">{job.leads_found}</td>
                <td className="p-3 text-zinc-500 text-xs">{new Date(job.started_at).toLocaleString()}</td>
              </tr>
            ))}
            {jobs.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-zinc-500">No jobs yet — run a scraper!</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
