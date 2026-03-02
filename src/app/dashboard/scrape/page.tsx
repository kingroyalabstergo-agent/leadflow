"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ScrapeJob {
  id: string;
  source: string;
  status: string;
  leads_found: number;
  error?: string;
  started_at: string;
  completed_at?: string;
}

const SOURCES = ["trade-directories", "trade-fairs", "saas-niche"];

export default function ScrapePage() {
  const [jobs, setJobs] = useState<ScrapeJob[]>([]);
  const [running, setRunning] = useState<string | null>(null);

  const fetchJobs = async () => {
    const res = await fetch("/api/scrape");
    setJobs(await res.json());
  };

  useEffect(() => { fetchJobs(); }, []);

  const runScrape = async (source: string) => {
    setRunning(source);
    await fetch("/api/scrape", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source }) });
    setRunning(null);
    fetchJobs();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Scrape Jobs</h2>
      <div className="grid grid-cols-3 gap-4">
        {SOURCES.map((s) => (
          <button key={s} onClick={() => runScrape(s)} disabled={running !== null}
            className={cn("bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-left hover:border-blue-500/50 transition-colors", running === s && "border-blue-500 animate-pulse")}>
            <p className="font-medium">{s}</p>
            <p className="text-xs text-zinc-500 mt-1">{running === s ? "Running..." : "Click to start"}</p>
          </button>
        ))}
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
              <th className="text-left p-3">Source</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Leads Found</th>
              <th className="text-left p-3">Started</th>
              <th className="text-left p-3">Error</th>
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
                    job.status === "running" ? "bg-yellow-500/20 text-yellow-400" : "bg-zinc-700 text-zinc-300"
                  )}>{job.status}</span>
                </td>
                <td className="p-3 text-zinc-400">{job.leads_found}</td>
                <td className="p-3 text-zinc-500 text-xs">{new Date(job.started_at).toLocaleString()}</td>
                <td className="p-3 text-red-400 text-xs truncate max-w-[200px]">{job.error || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
