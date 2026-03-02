export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { scrapeTradeDirectories } from "@/lib/scrapers/trade-directories";
import { scrapeTradeFairs } from "@/lib/scrapers/trade-fairs";
import { scrapeSaasNiche } from "@/lib/scrapers/saas-niche";
import { enrichLead } from "@/lib/scrapers/enrichment";
import { scoreLead } from "@/lib/scrapers/scorer";
import { Lead } from "@/lib/scrapers/types";

type ScraperFn = () => Promise<{ source: string; leads: Lead[]; errors: string[] }>;

const SCRAPERS: Record<string, ScraperFn> = {
  "trade-directories": scrapeTradeDirectories,
  "trade-fairs": scrapeTradeFairs,
  "saas-niche": scrapeSaasNiche,
};

export async function GET() {
  const { data, error } = await supabase.from("scrape_jobs").select("*").order("started_at", { ascending: false }).limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const { source } = await req.json();
  const scraperFn = SCRAPERS[source];
  if (!scraperFn) return NextResponse.json({ error: `Unknown source: ${source}` }, { status: 400 });

  const { data: job } = await supabase.from("scrape_jobs").insert({ source, status: "running" }).select().single();

  try {
    const result = await scraperFn();
    const enrichedLeads = [];
    for (const lead of result.leads) {
      const enriched = await enrichLead(lead);
      enriched.score = scoreLead(enriched).total;
      enrichedLeads.push(enriched);
    }

    if (enrichedLeads.length > 0) await supabase.from("leads").insert(enrichedLeads);

    await supabase.from("scrape_jobs").update({
      status: "completed",
      leads_found: enrichedLeads.length,
      completed_at: new Date().toISOString(),
      error: result.errors.length > 0 ? result.errors.join("; ") : null,
    }).eq("id", job!.id);

    return NextResponse.json({ jobId: job!.id, leadsFound: enrichedLeads.length, errors: result.errors });
  } catch (e) {
    await supabase.from("scrape_jobs").update({
      status: "failed",
      error: e instanceof Error ? e.message : "Unknown error",
      completed_at: new Date().toISOString(),
    }).eq("id", job!.id);
    return NextResponse.json({ error: "Scrape failed" }, { status: 500 });
  }
}
