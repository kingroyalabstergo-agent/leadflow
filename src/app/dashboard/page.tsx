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
  ceo_name?: string;
  cfo_name?: string;
  ceo_phone?: string;
  cfo_phone?: string;
  ceo_email?: string;
  cfo_email?: string;
  currencies_used?: string[];
  notes?: string;
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

const STATUS_ICONS: Record<string, string> = {
  new: "🆕",
  contacted: "📞",
  interested: "🔥",
  rejected: "❌",
  closed: "✅",
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
      {STATUS_ICONS[status] || ""} {status}
    </span>
  );
}

function QuickActions({ lead, onUpdate }: { lead: Lead; onUpdate: () => void }) {
  const [loading, setLoading] = useState(false);

  const setStatus = async (status: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLoading(false);
    onUpdate();
  };

  if (loading) return <span className="text-xs text-zinc-500">...</span>;

  return (
    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
      {lead.status === "new" && (
        <>
          <button onClick={(e) => setStatus("contacted", e)} className="px-2 py-0.5 rounded text-[10px] bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors" title="Mark as Called">📞 Called</button>
          <button onClick={(e) => setStatus("rejected", e)} className="px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors" title="Not relevant">❌</button>
        </>
      )}
      {lead.status === "contacted" && (
        <>
          <button onClick={(e) => setStatus("interested", e)} className="px-2 py-0.5 rounded text-[10px] bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors">🔥 Interested</button>
          <button onClick={(e) => setStatus("rejected", e)} className="px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">❌ No</button>
          <button onClick={(e) => setStatus("new", e)} className="px-2 py-0.5 rounded text-[10px] bg-zinc-700 text-zinc-400 hover:bg-zinc-600 transition-colors">↩ Retry</button>
        </>
      )}
      {lead.status === "interested" && (
        <>
          <button onClick={(e) => setStatus("closed", e)} className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors">✅ Closed</button>
          <button onClick={(e) => setStatus("contacted", e)} className="px-2 py-0.5 rounded text-[10px] bg-zinc-700 text-zinc-400 hover:bg-zinc-600 transition-colors">📞 Follow up</button>
        </>
      )}
      {(lead.status === "rejected" || lead.status === "closed") && (
        <button onClick={(e) => setStatus("new", e)} className="px-2 py-0.5 rounded text-[10px] bg-zinc-700 text-zinc-400 hover:bg-zinc-600 transition-colors">↩ Reopen</button>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/leads?${params}`);
    const data = await res.json();
    let filtered = data.leads ?? [];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((l: Lead) =>
        l.company_name.toLowerCase().includes(q) ||
        l.industry?.toLowerCase().includes(q) ||
        l.phone?.includes(q) ||
        l.email?.toLowerCase().includes(q)
      );
    }
    setLeads(filtered);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [statusFilter, searchQuery]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchLeads, 30000);
    return () => clearInterval(interval);
  }, [fetchLeads]);

  const stats = {
    total,
    hot: leads.filter((l) => l.score >= 50).length,
    new_count: leads.filter((l) => l.status === "new").length,
    contacted: leads.filter((l) => l.status === "contacted").length,
    interested: leads.filter((l) => l.status === "interested").length,
    closed: leads.filter((l) => l.status === "closed").length,
    withPhone: leads.filter((l) => l.phone).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Leads</h2>
        <div className="flex gap-2">
          <span className="text-xs text-zinc-500 self-center">Auto-refreshes every 30s</span>
          <button onClick={fetchLeads} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs transition-colors">🔄 Refresh</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-white" },
          { label: "Hot (50+)", value: stats.hot, color: "text-green-400" },
          { label: "New", value: stats.new_count, color: "text-blue-400" },
          { label: "Called", value: stats.contacted, color: "text-yellow-400" },
          { label: "Interested", value: stats.interested, color: "text-emerald-400" },
          { label: "Closed", value: stats.closed, color: "text-purple-400" },
          { label: "📞 W/ Phone", value: stats.withPhone, color: "text-cyan-400" },
        ].map((s) => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <p className="text-[10px] text-zinc-500">{s.label}</p>
            <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search companies, industries, phones..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm w-64 focus:outline-none focus:border-blue-500"
        />
        <div className="flex gap-1">
          {[
            { v: "", label: "All" },
            { v: "new", label: "🆕 New" },
            { v: "contacted", label: "📞 Called" },
            { v: "interested", label: "🔥 Interested" },
            { v: "closed", label: "✅ Closed" },
            { v: "rejected", label: "❌ Rejected" },
          ].map((s) => (
            <button
              key={s.v}
              onClick={() => setStatusFilter(s.v)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                statusFilter === s.v ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-zinc-500">Loading...</div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
                <th className="text-left p-3">Company</th>
                <th className="text-left p-3">📞 Phone</th>
                <th className="text-left p-3">Score</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer transition-colors" onClick={() => setSelectedLead(lead)}>
                  <td className="p-3">
                    <div className="font-medium">{lead.company_name}</div>
                    <div className="text-xs text-zinc-500">{lead.industry || lead.source}</div>
                  </td>
                  <td className="p-3">
                    {lead.phone ? (
                      <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()} className="text-blue-400 hover:underline text-xs font-mono">{lead.phone}</a>
                    ) : (
                      <span className="text-zinc-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="p-3"><ScoreBar score={lead.score} /></td>
                  <td className="p-3"><StatusBadge status={lead.status} /></td>
                  <td className="p-3"><QuickActions lead={lead} onUpdate={fetchLeads} /></td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-zinc-500">No leads found. Run the scraper to get started!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setSelectedLead(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-lg w-full mx-4 space-y-4 max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold">{selectedLead.company_name}</h3>
                {selectedLead.website && (
                  <a href={selectedLead.website.startsWith('http') ? selectedLead.website : `https://${selectedLead.website}`} target="_blank" className="text-xs text-blue-400 hover:underline">{selectedLead.website}</a>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-2xl font-bold", selectedLead.score >= 50 ? "text-green-400" : selectedLead.score >= 25 ? "text-yellow-400" : "text-red-400")}>{selectedLead.score}</span>
                <button onClick={() => setSelectedLead(null)} className="text-zinc-500 hover:text-white ml-2">✕</button>
              </div>
            </div>

            {/* Contact Info */}
            <div className="bg-zinc-800/50 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-zinc-400">📞 Contact Info</p>
              {selectedLead.phone && (
                <div className="flex items-center gap-2">
                  <a href={`tel:${selectedLead.phone}`} className="text-blue-400 hover:underline font-mono">{selectedLead.phone}</a>
                  <span className="text-zinc-500 text-xs">Main</span>
                </div>
              )}
              {selectedLead.ceo_name && (
                <div className="text-sm">
                  <span className="text-zinc-500">CEO:</span> {selectedLead.ceo_name}
                  {selectedLead.ceo_phone && <a href={`tel:${selectedLead.ceo_phone}`} className="ml-2 text-blue-400 hover:underline font-mono text-xs">{selectedLead.ceo_phone}</a>}
                  {selectedLead.ceo_email && <span className="ml-2 text-zinc-400 text-xs">{selectedLead.ceo_email}</span>}
                </div>
              )}
              {selectedLead.cfo_name && (
                <div className="text-sm">
                  <span className="text-zinc-500">CFO:</span> {selectedLead.cfo_name}
                  {selectedLead.cfo_phone && <a href={`tel:${selectedLead.cfo_phone}`} className="ml-2 text-blue-400 hover:underline font-mono text-xs">{selectedLead.cfo_phone}</a>}
                </div>
              )}
              {selectedLead.email && <div className="text-sm"><span className="text-zinc-500">Email:</span> <a href={`mailto:${selectedLead.email}`} className="text-blue-400 hover:underline">{selectedLead.email}</a></div>}
              {!selectedLead.phone && !selectedLead.email && !selectedLead.ceo_name && (
                <p className="text-zinc-500 text-xs italic">No contact info yet</p>
              )}
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-zinc-500">Industry: </span><span className="text-zinc-300">{selectedLead.industry || "—"}</span></div>
              <div><span className="text-zinc-500">Source: </span><span className="text-zinc-300">{selectedLead.source || "—"}</span></div>
              <div><span className="text-zinc-500">Country: </span><span className="text-zinc-300">{selectedLead.country || "—"}</span></div>
              <div>
                <span className="text-zinc-500">Currencies: </span>
                <span className="text-zinc-300">{selectedLead.currencies_used?.join(", ") || "—"}</span>
              </div>
            </div>

            {selectedLead.notes && (
              <div className="bg-zinc-800/30 rounded-lg p-3">
                <p className="text-xs text-zinc-400 mb-1">Notes</p>
                <p className="text-sm text-zinc-300">{selectedLead.notes}</p>
              </div>
            )}

            {/* Status buttons */}
            <div>
              <p className="text-xs text-zinc-400 mb-2">Set Status</p>
              <div className="flex gap-2 flex-wrap">
                {["new", "contacted", "interested", "rejected", "closed"].map((s) => (
                  <button
                    key={s}
                    onClick={async () => {
                      await fetch(`/api/leads/${selectedLead.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: s }) });
                      setSelectedLead({ ...selectedLead, status: s });
                      fetchLeads();
                    }}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      selectedLead.status === s ? "bg-blue-600 text-white" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
                    )}
                  >
                    {STATUS_ICONS[s]} {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
