"use client";
import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface Lead {
  id: string;
  company_name: string;
  website?: string;
  industry?: string;
  score: number;
  status: string;
  source?: string;
  email?: string;
  phone?: string;
  country?: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400",
  contacted: "bg-yellow-500/20 text-yellow-400",
  interested: "bg-green-500/20 text-green-400",
  rejected: "bg-red-500/20 text-red-400",
  closed: "bg-purple-500/20 text-purple-400",
};

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, score);
  const color = score >= 50 ? "bg-green-500" : score >= 25 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-zinc-400">{score}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", STATUS_COLORS[status] ?? "bg-zinc-700 text-zinc-300")}>
      {status}
    </span>
  );
}

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/leads?${params}`);
    const data = await res.json();
    setLeads(data.leads ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const stats = {
    total,
    hot: leads.filter((l) => l.score >= 50).length,
    new_count: leads.filter((l) => l.status === "new").length,
    contacted: leads.filter((l) => l.status === "contacted").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Leads</h2>
        <button
          onClick={() => {
            fetch("/api/scrape", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "trade-directories" }) })
              .then(() => setTimeout(fetchLeads, 2000));
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
        >
          🔍 Run Scraper
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Leads", value: stats.total, color: "text-white" },
          { label: "Hot Leads (50+)", value: stats.hot, color: "text-green-400" },
          { label: "New", value: stats.new_count, color: "text-blue-400" },
          { label: "Contacted", value: stats.contacted, color: "text-yellow-400" },
        ].map((s) => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-500">{s.label}</p>
            <p className={cn("text-2xl font-bold mt-1", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {["", "new", "contacted", "interested", "rejected", "closed"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
              statusFilter === s ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
            )}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-500">Loading...</div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
                <th className="text-left p-3">Company</th>
                <th className="text-left p-3">Source</th>
                <th className="text-left p-3">Score</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Contact</th>
                <th className="text-left p-3">Added</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer transition-colors" onClick={() => setSelectedLead(lead)}>
                  <td className="p-3">
                    <div className="font-medium">{lead.company_name}</div>
                    {lead.website && <div className="text-xs text-zinc-500 truncate max-w-[200px]">{lead.website}</div>}
                  </td>
                  <td className="p-3 text-zinc-400">{lead.source ?? "—"}</td>
                  <td className="p-3"><ScoreBar score={lead.score} /></td>
                  <td className="p-3"><StatusBadge status={lead.status} /></td>
                  <td className="p-3 text-zinc-400 text-xs">{lead.email || lead.phone || "—"}</td>
                  <td className="p-3 text-zinc-500 text-xs">{new Date(lead.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-zinc-500">No leads yet. Run the scraper to get started!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedLead && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setSelectedLead(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-lg w-full mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold">{selectedLead.company_name}</h3>
                <p className="text-sm text-zinc-500">{selectedLead.website}</p>
              </div>
              <button onClick={() => setSelectedLead(null)} className="text-zinc-500 hover:text-white">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-zinc-500">Score: </span><ScoreBar score={selectedLead.score} /></div>
              <div><span className="text-zinc-500">Status: </span><StatusBadge status={selectedLead.status} /></div>
              <div><span className="text-zinc-500">Source: </span><span className="text-zinc-300">{selectedLead.source}</span></div>
              <div><span className="text-zinc-500">Country: </span><span className="text-zinc-300">{selectedLead.country}</span></div>
              <div><span className="text-zinc-500">Email: </span><span className="text-zinc-300">{selectedLead.email || "—"}</span></div>
              <div><span className="text-zinc-500">Phone: </span><span className="text-zinc-300">{selectedLead.phone || "—"}</span></div>
            </div>
            <div className="flex gap-2 pt-2">
              {["new", "contacted", "interested", "rejected", "closed"].map((s) => (
                <button
                  key={s}
                  onClick={async () => {
                    await fetch(`/api/leads/${selectedLead.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: s }) });
                    setSelectedLead({ ...selectedLead, status: s });
                    fetchLeads();
                  }}
                  className={cn("px-2 py-1 rounded text-xs", selectedLead.status === s ? "bg-blue-600" : "bg-zinc-800 hover:bg-zinc-700")}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
