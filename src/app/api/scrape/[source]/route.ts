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

// Single country scraper — fast enough for Vercel's 10s limit
async function scrapeCountry(countryName: string, code: string, currency: string, tramo: string): Promise<any[]> {
  const leads: any[] = []
  const url = `http://directorio.camaras.org/index.php?pagina=1&registros=0&offset=0&cocin=&impexp=EI&anno=23&tramo=${tramo}&nombre=&producto=&areanacional=&codarea=&areainternac=PS&codareainter=${code}`
  
  const html = await fetchPage(url)
  const companies = extractCompanies(html)
  
  for (const company of companies) {
    leads.push({
      company_name: company,
      country: "Spain",
      currencies_used: ["EUR", currency],
      industry: `Import/Export (${countryName})`,
      source: tramo === "03" ? "camara-comercio" : "camara-comercio-sme",
      notes: `Trades with ${countryName} (${currency}). ${tramo === "03" ? ">€1M" : "€100K-€1M"} annual trade. Source: Cámara de Comercio.`,
    })
  }

  // Page 2 if time allows
  const url2 = url.replace("pagina=1", "pagina=2").replace("offset=0", "offset=25")
  const html2 = await fetchPage(url2)
  const companies2 = extractCompanies(html2)
  for (const company of companies2) {
    leads.push({
      company_name: company,
      country: "Spain",
      currencies_used: ["EUR", currency],
      industry: `Import/Export (${countryName})`,
      source: tramo === "03" ? "camara-comercio" : "camara-comercio-sme",
      notes: `Trades with ${countryName} (${currency}). ${tramo === "03" ? ">€1M" : "€100K-€1M"} annual trade. Source: Cámara de Comercio.`,
    })
  }

  return leads
}

// Scrape ALL countries in sequence (2 pages each = ~14 requests, should fit in ~8s)
async function scrapeAllCountries(tramo: string): Promise<any[]> {
  const all: any[] = []
  for (const [name, { code, currency }] of Object.entries(TARGET_COUNTRIES)) {
    const leads = await scrapeCountry(name, code, currency, tramo)
    all.push(...leads)
  }
  return all
}

async function scrapeICEX(): Promise<any[]> {
  const leads: any[] = []
  const url = `http://directorio.camaras.org/index.php?pagina=1&registros=0&offset=0&cocin=&impexp=E&anno=23&tramo=03&nombre=&producto=&areanacional=&codarea=&areainternac=&codareainter=`
  const html = await fetchPage(url)
  for (const company of extractCompanies(html)) {
    leads.push({
      company_name: company, country: "Spain", currencies_used: ["EUR"],
      industry: "Exporter", source: "icex-exporters",
      notes: "Major Spanish exporter (>€1M). Source: Cámara de Comercio/ICEX.",
    })
  }
  return leads
}

async function scrapeTradeSectors(): Promise<any[]> {
  const leads: any[] = []
  const sectors = [
    { producto: "84", name: "Machinery" },
    { producto: "85", name: "Electronics" },
    { producto: "39", name: "Plastics" },
  ]
  for (const sector of sectors) {
    const url = `http://directorio.camaras.org/index.php?pagina=1&registros=0&offset=0&cocin=&impexp=EI&anno=23&tramo=03&nombre=&producto=${sector.producto}&areanacional=&codarea=&areainternac=&codareainter=`
    const html = await fetchPage(url)
    for (const company of extractCompanies(html)) {
      leads.push({
        company_name: company, country: "Spain", currencies_used: ["EUR", "USD"],
        industry: sector.name, source: "trade-fairs",
        notes: `${sector.name} sector, import+export >€1M.`,
      })
    }
  }
  return leads
}

const scrapers: Record<string, () => Promise<any[]>> = {
  "camara-comercio": () => scrapeAllCountries("03"),
  "camara-comercio-sme": () => scrapeAllCountries("02"),
  "icex-exporters": scrapeICEX,
  "trade-fairs": scrapeTradeSectors,
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ source: string }> }
) {
  const { source } = await params
  const scraper = scrapers[source]

  if (!scraper) {
    return NextResponse.json({ error: `Unknown source: ${source}` }, { status: 400 })
  }

  const { data: job } = await supabase
    .from("scrape_jobs")
    .insert({ source, status: "running", leads_found: 0, started_at: new Date().toISOString() })
    .select().single()

  try {
    const rawLeads = await scraper()
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
