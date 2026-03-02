"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gnezbqpkaqgstdwycxys.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

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

const S: Record<string, { bg: string; dot: string }> = {
  new: { bg: "bg-blue-500/10 text-blue-400", dot: "bg-blue-400" },
  contacted: { bg: "bg-amber-500/10 text-amber-400", dot: "bg-amber-400" },
  interested: { bg: "bg-emerald-500/10 text-emerald-400", dot: "bg-emerald-400" },
  rejected: { bg: "bg-zinc-500/10 text-zinc-500", dot: "bg-zinc-500" },
  closed: { bg: "bg-violet-500/10 text-violet-400", dot: "bg-violet-400" },
};

function Dot({ status }: { status: string }) {
  return <span className={cn("inline-block w-1.5 h-1.5 rounded-full", S[status]?.dot || "bg-zinc-600")} />;
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, score);
  const color = score >= 50 ? "bg-emerald-500" : score >= 25 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-14 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-zinc-500 font-mono tabular-nums w-5">{score}</span>
    </div>
  );
}

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [newCount, setNewCount] = useState(0);
  const prevCount = useRef(0);

  const fetchLeads = useCallback(async () => {
    let all: Lead[] = [];
    let offset = 0;
    const batchSize = 1000;
    while (true) {
      const res = await fetch(`/api/leads?limit=${batchSize}&offset=${offset}`);
      const data = await res.json();
      const batch = data.leads ?? [];
      all = [...all, ...batch];
      if (batch.length < batchSize) break;
      offset += batchSize;
    }
    setLeads(all);
    if (prevCount.current > 0 && all.length > prevCount.current) {
      setNewCount(n => n + (all.length - prevCount.current));
    }
    prevCount.current = all.length;
    setLoading(false);
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("leads-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setLeads(prev => [payload.new as Lead, ...prev]);
          setNewCount(n => n + 1);
        } else if (payload.eventType === "UPDATE") {
          setLeads(prev => prev.map(l => l.id === (payload.new as Lead).id ? payload.new as Lead : l));
          if (selected?.id === (payload.new as Lead).id) setSelected(payload.new as Lead);
        } else if (payload.eventType === "DELETE") {
          setLeads(prev => prev.filter(l => l.id !== payload.old?.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selected]);

  const filtered = leads.filter(l => {
    if (statusFilter && l.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return l.company_name.toLowerCase().includes(q) || l.industry?.toLowerCase().includes(q) || l.phone?.includes(q) || l.email?.toLowerCase().includes(q);
    }
    return true;
  }).sort((a, b) => b.score - a.score);

  const setStatus = async (id: string, status: string) => {
    await fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    if (selected?.id === id) setSelected(s => s ? { ...s, status } : s);
  };

  const [page, setPage] = useState(0);
  const perPage = 50;
  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice(page * perPage, (page + 1) * perPage);

  const counts = {
    total: leads.length,
    new: leads.filter(l => l.status === "new").length,
    contacted: leads.filter(l => l.status === "contacted").length,
    interested: leads.filter(l => l.status === "interested").length,
    closed: leads.filter(l => l.status === "closed").length,
    phone: leads.filter(l => l.phone).length,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Leads</h2>
          <span className="text-xs text-zinc-500 font-mono">{counts.total}</span>
          {newCount > 0 && (
            <button onClick={() => setNewCount(0)} className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full animate-pulse">
              +{newCount} new
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-zinc-500">Live</span>
        </div>
      </div>

      {/* Mini stats */}
      <div className="flex gap-4 text-xs text-zinc-500">
        <span><span className="text-blue-400 font-medium">{counts.new}</span> new</span>
        <span><span className="text-amber-400 font-medium">{counts.contacted}</span> called</span>
        <span><span className="text-emerald-400 font-medium">{counts.interested}</span> interested</span>
        <span><span className="text-violet-400 font-medium">{counts.closed}</span> closed</span>
        <span><span className="text-cyan-400 font-medium">{counts.phone}</span> w/ phone</span>
      </div>

      {/* Search + Filters */}
      <div className="flex gap-2 items-center">
        <input
          type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
          className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg px-3 py-1.5 text-xs w-48 focus:outline-none focus:border-zinc-600 placeholder:text-zinc-600"
        />
        <div className="flex gap-0.5">
          {["", "new", "contacted", "interested", "closed", "rejected"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn("px-2 py-1 rounded text-[10px] transition-colors",
                statusFilter === s ? "bg-zinc-700 text-zinc-200" : "text-zinc-500 hover:text-zinc-300"
              )}>
              {s || "all"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? <div className="text-center py-12 text-zinc-600 text-sm">Loading...</div> : (
        <div className="overflow-auto max-h-[calc(100vh-260px)]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-zinc-950/80 backdrop-blur-sm border-b border-zinc-800/30">
                <tr className="text-zinc-600">
                  <th className="text-left py-2 px-3 font-medium w-8"></th>
                  <th className="text-left py-2 px-3 font-medium">Company</th>
                  <th className="text-left py-2 px-3 font-medium">Source</th>
                  <th className="text-left py-2 px-3 font-medium">Score</th>
                  <th className="text-left py-2 px-3 font-medium">Phone</th>
                  <th className="text-left py-2 px-3 font-medium">Contact</th>
                  <th className="text-left py-2 px-3 font-medium">Added</th>
                  <th className="text-left py-2 px-3 font-medium w-32"></th>
                </tr>
              </thead>
              <tbody>
                {paged.map(lead => (
                  <tr key={lead.id} onClick={() => setSelected(lead)}
                    className={cn("border-b border-zinc-800/30 cursor-pointer transition-colors",
                      selected?.id === lead.id ? "bg-zinc-800/40" : "hover:bg-zinc-900/50",
                      lead.status === "rejected" && "opacity-40"
                    )}>
                    <td className="py-2 px-3"><Dot status={lead.status} /></td>
                    <td className="py-2 px-3">
                      <div className="font-medium text-zinc-200">{lead.company_name}</div>
                      {lead.industry && <div className="text-zinc-600 text-[10px]">{lead.industry}</div>}
                    </td>
                    <td className="py-2 px-3 text-zinc-500">{lead.source || "—"}</td>
                    <td className="py-2 px-3"><ScoreBar score={lead.score} /></td>
                    <td className="py-2 px-3">
                      {lead.phone ? (
                        <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()} className="text-zinc-400 hover:text-blue-400 font-mono transition-colors">{lead.phone}</a>
                      ) : <span className="text-zinc-700">—</span>}
                    </td>
                    <td className="py-2 px-3 text-zinc-500">{lead.email || lead.ceo_name || "—"}</td>
                    <td className="py-2 px-3 text-zinc-600">{new Date(lead.created_at).toLocaleDateString()}</td>
                    <td className="py-2 px-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-0.5">
                        {lead.status === "new" && <>
                          <button onClick={() => setStatus(lead.id, "contacted")} className="px-1.5 py-0.5 rounded text-[10px] text-amber-400/70 hover:bg-amber-500/10 transition-colors">called</button>
                          <button onClick={() => setStatus(lead.id, "rejected")} className="px-1.5 py-0.5 rounded text-[10px] text-zinc-500/70 hover:bg-zinc-500/10 transition-colors">skip</button>
                        </>}
                        {lead.status === "contacted" && <>
                          <button onClick={() => setStatus(lead.id, "interested")} className="px-1.5 py-0.5 rounded text-[10px] text-emerald-400/70 hover:bg-emerald-500/10 transition-colors">interested</button>
                          <button onClick={() => setStatus(lead.id, "rejected")} className="px-1.5 py-0.5 rounded text-[10px] text-zinc-500/70 hover:bg-zinc-500/10 transition-colors">no</button>
                        </>}
                        {lead.status === "interested" && <>
                          <button onClick={() => setStatus(lead.id, "closed")} className="px-1.5 py-0.5 rounded text-[10px] text-violet-400/70 hover:bg-violet-500/10 transition-colors">closed</button>
                        </>}
                        {(lead.status === "rejected" || lead.status === "closed") &&
                          <button onClick={() => setStatus(lead.id, "new")} className="px-1.5 py-0.5 rounded text-[10px] text-zinc-600 hover:bg-zinc-800 transition-colors">reopen</button>
                        }
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1">
          <span>{filtered.length} leads · page {page + 1}/{totalPages}</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-2 py-1 rounded hover:bg-zinc-800 disabled:opacity-20 transition-colors">← prev</button>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded hover:bg-zinc-800 disabled:opacity-20 transition-colors">next →</button>
          </div>
        </div>
      )}

      {/* Detail Panel */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setSelected(null)}>
          <div className="bg-zinc-900 border border-zinc-800/50 rounded-xl p-5 max-w-md w-full mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="font-semibold">{selected.company_name}</h3>
                {selected.website && <a href={selected.website.startsWith("http") ? selected.website : `https://${selected.website}`} target="_blank" className="text-[10px] text-zinc-500 hover:text-blue-400 transition-colors">{selected.website}</a>}
              </div>
              <div className="flex items-center gap-3">
                <ScoreBar score={selected.score} />
                <button onClick={() => setSelected(null)} className="text-zinc-600 hover:text-zinc-300 text-sm">×</button>
              </div>
            </div>

            {(selected.phone || selected.email || selected.ceo_name) && (
              <div className="space-y-1.5 text-xs">
                {selected.phone && <div className="flex items-center gap-2"><span className="text-zinc-600 w-10">tel</span><a href={`tel:${selected.phone}`} className="text-zinc-300 hover:text-blue-400 font-mono transition-colors">{selected.phone}</a></div>}
                {selected.email && <div className="flex items-center gap-2"><span className="text-zinc-600 w-10">mail</span><a href={`mailto:${selected.email}`} className="text-zinc-300 hover:text-blue-400 transition-colors">{selected.email}</a></div>}
                {selected.ceo_name && <div className="flex items-center gap-2"><span className="text-zinc-600 w-10">ceo</span><span className="text-zinc-300">{selected.ceo_name}</span>{selected.ceo_phone && <span className="text-zinc-500 font-mono">{selected.ceo_phone}</span>}</div>}
                {selected.cfo_name && <div className="flex items-center gap-2"><span className="text-zinc-600 w-10">cfo</span><span className="text-zinc-300">{selected.cfo_name}</span>{selected.cfo_phone && <span className="text-zinc-500 font-mono">{selected.cfo_phone}</span>}</div>}
              </div>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-500">
              {selected.industry && <span>{selected.industry}</span>}
              {selected.source && <span>{selected.source}</span>}
              {selected.currencies_used?.length ? <span>{selected.currencies_used.join(" · ")}</span> : null}
            </div>

            {selected.notes && <p className="text-[11px] text-zinc-500 leading-relaxed">{selected.notes}</p>}

            <div className="flex gap-1">
              {["new", "contacted", "interested", "rejected", "closed"].map(s => (
                <button key={s} onClick={() => setStatus(selected.id, s)}
                  className={cn("px-2.5 py-1 rounded text-[10px] transition-colors",
                    selected.status === s ? S[s]?.bg || "bg-zinc-700 text-zinc-300" : "text-zinc-600 hover:text-zinc-400"
                  )}>
                  <Dot status={s} /> <span className="ml-1">{s}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
