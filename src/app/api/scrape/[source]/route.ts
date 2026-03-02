import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { calculateScore } from "@/lib/scoring"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TARGET_COUNTRIES: Record<string, { code: string; currency: string }> = {
  china: { code: "720", currency: "CNY" },
  india: { code: "664", currency: "INR" },
  turkey: { code: "052", currency: "TRY" },
  usa: { code: "400", currency: "USD" },
  uk: { code: "006", currency: "GBP" },
  japan: { code: "732", currency: "JPY" },
  brazil: { code: "508", currency: "BRL" },
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    redirect: "follow",
  })
  return res.text()
}

function extractCompanies(html: string): string[] {
  const regex = /verempresa\([^)]+\)">\s*([^<]+)\s*<\/a>/g
  const companies: string[] = []
  let match
  while ((match = regex.exec(html)) !== null) {
    companies.push(match[1].trim())
  }
  return companies
}

async function insertLeads(rawLeads: any[], source: string): Promise<{ inserted: number; total: number }> {
  let inserted = 0
  for (const lead of rawLeads) {
    const { data: existing } = await supabase
      .from("leads").select("id").eq("company_name", lead.company_name).maybeSingle()
    if (existing) continue
    const score = calculateScore(lead)
    const { error } = await supabase.from("leads").insert({
      ...lead, score, status: "new",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })
    if (!error) inserted++
  }
  return { inserted, total: rawLeads.length }
}

// Each source scrapes just ONE country or ONE thing — fits in 10s
const scrapers: Record<string, () => Promise<any[]>> = {}

// Generate per-country scrapers
for (const [name, { code, currency }] of Object.entries(TARGET_COUNTRIES)) {
  // Big companies (>€1M)
  scrapers[`camara-${name}`] = async () => {
    const url = `http://directorio.camaras.org/index.php?pagina=1&registros=0&offset=0&cocin=&impexp=EI&anno=23&tramo=03&nombre=&producto=&areanacional=&codarea=&areainternac=PS&codareainter=${code}`
    const html = await fetchPage(url)
    return extractCompanies(html).map(c => ({
      company_name: c, country: "Spain", currencies_used: ["EUR", currency],
      industry: `Import/Export (${name})`, source: `camara-${name}`,
      notes: `Trades with ${name} (${currency}). >€1M annual trade. Cámara de Comercio.`,
    }))
  }
  // SME companies (€100K-€1M)
  scrapers[`camara-${name}-sme`] = async () => {
    const url = `http://directorio.camaras.org/index.php?pagina=1&registros=0&offset=0&cocin=&impexp=EI&anno=23&tramo=02&nombre=&producto=&areanacional=&codarea=&areainternac=PS&codareainter=${code}`
    const html = await fetchPage(url)
    return extractCompanies(html).map(c => ({
      company_name: c, country: "Spain", currencies_used: ["EUR", currency],
      industry: `Import/Export (${name})`, source: `camara-${name}-sme`,
      notes: `Trades with ${name} (${currency}). €100K-€1M annual trade. Cámara de Comercio.`,
    }))
  }
}

// ICEX exporters
scrapers["icex-exporters"] = async () => {
  const url = `http://directorio.camaras.org/index.php?pagina=1&registros=0&offset=0&cocin=&impexp=E&anno=23&tramo=03&nombre=&producto=&areanacional=&codarea=&areainternac=&codareainter=`
  const html = await fetchPage(url)
  return extractCompanies(html).map(c => ({
    company_name: c, country: "Spain", currencies_used: ["EUR"],
    industry: "Exporter", source: "icex-exporters",
    notes: "Major Spanish exporter (>€1M). Cámara de Comercio/ICEX.",
  }))
}

// Trade sectors
scrapers["trade-fairs"] = async () => {
  const leads: any[] = []
  for (const s of [{ p: "84", n: "Machinery" }, { p: "85", n: "Electronics" }]) {
    const url = `http://directorio.camaras.org/index.php?pagina=1&registros=0&offset=0&cocin=&impexp=EI&anno=23&tramo=03&nombre=&producto=${s.p}&areanacional=&codarea=&areainternac=&codareainter=`
    const html = await fetchPage(url)
    leads.push(...extractCompanies(html).map(c => ({
      company_name: c, country: "Spain", currencies_used: ["EUR", "USD"],
      industry: s.n, source: "trade-fairs",
      notes: `${s.n} sector, import+export >€1M.`,
    })))
  }
  return leads
}

// Meta: run all country scrapers sequentially 
scrapers["camara-all"] = async () => {
  // This will likely timeout on Vercel free — use individual ones instead
  const all: any[] = []
  for (const name of Object.keys(TARGET_COUNTRIES)) {
    all.push(...await scrapers[`camara-${name}`]())
  }
  return all
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ source: string }> }
) {
  const { source } = await params
  const scraper = scrapers[source]

  if (!scraper) {
    return NextResponse.json({ 
      error: `Unknown source: ${source}`,
      available: Object.keys(scrapers),
    }, { status: 400 })
  }

  const { data: job } = await supabase
    .from("scrape_jobs")
    .insert({ source, status: "running", leads_found: 0, started_at: new Date().toISOString() })
    .select().single()

  try {
    const rawLeads = await scraper()
    const { inserted } = await insertLeads(rawLeads, source)

    await supabase.from("scrape_jobs").update({
      status: "completed", leads_found: inserted, completed_at: new Date().toISOString(),
    }).eq("id", job!.id)

    return NextResponse.json({ success: true, leads_found: inserted, total_scraped: rawLeads.length })
  } catch (e: any) {
    await supabase.from("scrape_jobs").update({
      status: "failed", completed_at: new Date().toISOString(),
    }).eq("id", job!.id)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
