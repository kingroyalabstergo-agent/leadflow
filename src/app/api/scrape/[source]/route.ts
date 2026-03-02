import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { calculateScore } from "@/lib/scoring"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Country codes for Cámara de Comercio directory
const TARGET_COUNTRIES: Record<string, { code: string; currency: string }> = {
  china: { code: "720", currency: "CNY" },
  india: { code: "664", currency: "INR" },
  turkey: { code: "052", currency: "TRY" },
  usa: { code: "400", currency: "USD" },
  uk: { code: "006", currency: "GBP" },
  japan: { code: "732", currency: "JPY" },
  brazil: { code: "508", currency: "BRL" },
  mexico: { code: "412", currency: "MXN" },
  morocco: { code: "604", currency: "MAD" },
  south_korea: { code: "728", currency: "KRW" },
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

function extractCount(html: string): number {
  const match = html.match(/([\d.]+)\s*empresas encontradas/)
  if (!match) return 0
  return parseInt(match[1].replace(/\./g, ""))
}

// Scraper: Cámara de Comercio directory — Spanish importers/exporters by country
async function scrapeCamaraComercio(): Promise<any[]> {
  const leads: any[] = []

  for (const [countryName, { code, currency }] of Object.entries(TARGET_COUNTRIES)) {
    try {
      // Fetch companies with >1M in import+export with this country
      const baseUrl = `http://directorio.camaras.org/index.php?pagina=PAGE&registros=0&offset=OFFSET&cocin=&impexp=EI&anno=23&tramo=03&nombre=&producto=&areanacional=&codarea=&areainternac=PS&codareainter=${code}`

      // Get first page
      const html = await fetchPage(baseUrl.replace("PAGE", "1").replace("OFFSET", "0"))
      const total = extractCount(html)
      const companies = extractCompanies(html)

      console.log(`${countryName}: ${total} total, ${companies.length} on page 1`)

      for (const company of companies) {
        leads.push({
          company_name: company,
          country: "Spain",
          currencies_used: ["EUR", currency],
          industry: `Import/Export (${countryName})`,
          source: "camara-comercio",
          notes: `Trades with ${countryName} (${currency}). >€1M annual trade volume. Source: Cámara de Comercio directory.`,
        })
      }

      // Get pages 2-4 (up to 100 companies per country)
      for (let page = 2; page <= 4; page++) {
        const offset = (page - 1) * 25
        if (offset >= total) break

        const pageHtml = await fetchPage(
          baseUrl.replace("PAGE", String(page)).replace("OFFSET", String(offset))
        )
        const pageCompanies = extractCompanies(pageHtml)
        
        for (const company of pageCompanies) {
          leads.push({
            company_name: company,
            country: "Spain",
            currencies_used: ["EUR", currency],
            industry: `Import/Export (${countryName})`,
            source: "camara-comercio",
            notes: `Trades with ${countryName} (${currency}). >€1M annual trade volume. Source: Cámara de Comercio directory.`,
          })
        }
      }

      // Small delay between countries
      await new Promise(r => setTimeout(r, 500))
    } catch (e) {
      console.error(`Error scraping ${countryName}:`, e)
    }
  }

  return leads
}

// Scraper: Cámara de Comercio — smaller companies (100K-1M) for broader coverage
async function scrapeCamaraSmall(): Promise<any[]> {
  const leads: any[] = []
  const topCountries = ["china", "india", "turkey", "usa"]

  for (const countryName of topCountries) {
    const { code, currency } = TARGET_COUNTRIES[countryName]
    try {
      const baseUrl = `http://directorio.camaras.org/index.php?pagina=PAGE&registros=0&offset=OFFSET&cocin=&impexp=EI&anno=23&tramo=02&nombre=&producto=&areanacional=&codarea=&areainternac=PS&codareainter=${code}`

      for (let page = 1; page <= 4; page++) {
        const offset = (page - 1) * 25
        const html = await fetchPage(baseUrl.replace("PAGE", String(page)).replace("OFFSET", String(offset)))
        const companies = extractCompanies(html)
        if (companies.length === 0) break

        for (const company of companies) {
          leads.push({
            company_name: company,
            country: "Spain",
            currencies_used: ["EUR", currency],
            industry: `Import/Export (${countryName})`,
            source: "camara-comercio-sme",
            notes: `Trades with ${countryName} (${currency}). €100K-€1M annual trade. Source: Cámara de Comercio.`,
          })
        }
      }
      await new Promise(r => setTimeout(r, 500))
    } catch (e) {
      console.error(`Error scraping small ${countryName}:`, e)
    }
  }

  return leads
}

// Scraper: ICEX exporters — general Spanish exporters
async function scrapeICEX(): Promise<any[]> {
  const leads: any[] = []
  try {
    // ICEX has their own directory at directorio.icex.es
    const baseUrl = `http://directorio.camaras.org/index.php?pagina=PAGE&registros=0&offset=OFFSET&cocin=&impexp=E&anno=23&tramo=03&nombre=&producto=&areanacional=&codarea=&areainternac=&codareainter=`

    for (let page = 1; page <= 4; page++) {
      const offset = (page - 1) * 25
      const html = await fetchPage(baseUrl.replace("PAGE", String(page)).replace("OFFSET", String(offset)))
      const companies = extractCompanies(html)
      if (companies.length === 0) break

      for (const company of companies) {
        leads.push({
          company_name: company,
          country: "Spain",
          currencies_used: ["EUR"],
          industry: "Exporter",
          source: "icex-exporters",
          notes: `Major Spanish exporter (>€1M). Source: Cámara de Comercio/ICEX directory.`,
        })
      }
    }
  } catch (e) {
    console.error("ICEX scraper error:", e)
  }
  return leads
}

// Scraper: Trade fairs — search for Spanish trade fair exhibitors
async function scrapeTradeFairs(): Promise<any[]> {
  const leads: any[] = []
  // We'll use the Cámara directory for now, but with different sectors that imply international trade
  // These are companies in sectors known for international operations
  const sectors = [
    { producto: "84", name: "Machinery" },   // Nuclear reactors, boilers, machinery
    { producto: "85", name: "Electronics" },  // Electrical machinery
    { producto: "39", name: "Plastics" },     // Plastics
    { producto: "87", name: "Vehicles" },     // Vehicles
  ]

  for (const sector of sectors) {
    try {
      const url = `http://directorio.camaras.org/index.php?pagina=1&registros=0&offset=0&cocin=&impexp=EI&anno=23&tramo=03&nombre=&producto=${sector.producto}&areanacional=&codarea=&areainternac=&codareainter=`
      const html = await fetchPage(url)
      const companies = extractCompanies(html)

      for (const company of companies) {
        leads.push({
          company_name: company,
          country: "Spain",
          currencies_used: ["EUR", "USD"],
          industry: sector.name,
          source: "trade-fairs",
          notes: `${sector.name} sector, import+export >€1M. Likely international currency exposure.`,
        })
      }
    } catch (e) {
      console.error(`Sector ${sector.name} error:`, e)
    }
  }

  return leads
}

// Scraper: Bubble/SaaS — companies likely paying in USD for SaaS
async function scrapeSaaS(): Promise<any[]> {
  // This is harder to automate — we'll create seed leads from known Bubble.io Spanish companies
  // In the future, this can be expanded with BuiltWith API
  return [
    {
      company_name: "Bubble.io Spanish Users (Manual Research Needed)",
      country: "Spain",
      currencies_used: ["EUR", "USD"],
      industry: "SaaS / Technology",
      source: "bubble-saas",
      notes: "Placeholder — search Bubble.io showcase, ProductHunt, and BuiltWith for Spanish companies using Bubble.io. These companies pay in USD and are ideal Revolut Business prospects.",
    },
  ]
}

// Scraper registry
const scrapers: Record<string, () => Promise<any[]>> = {
  "camara-comercio": scrapeCamaraComercio,
  "camara-comercio-sme": scrapeCamaraSmall,
  "icex-exporters": scrapeICEX,
  "trade-fairs": scrapeTradeFairs,
  "bubble-saas": scrapeSaaS,
  "importers-spain": scrapeCamaraSmall, // alias
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ source: string }> }
) {
  const { source } = await params
  const scraper = scrapers[source]

  if (!scraper) {
    return NextResponse.json({ error: `Unknown source: ${source}. Available: ${Object.keys(scrapers).join(", ")}` }, { status: 400 })
  }

  // Create scrape job
  const { data: job } = await supabase
    .from("scrape_jobs")
    .insert({ source, status: "running", leads_found: 0, started_at: new Date().toISOString() })
    .select()
    .single()

  try {
    const rawLeads = await scraper()
    let inserted = 0

    for (const lead of rawLeads) {
      // Check for duplicates by company name
      const { data: existing } = await supabase
        .from("leads")
        .select("id")
        .eq("company_name", lead.company_name)
        .maybeSingle()

      if (existing) continue

      const score = calculateScore(lead)
      const { error } = await supabase.from("leads").insert({
        ...lead,
        score,
        status: "new",
        country: lead.country || "Spain",
        currencies_used: lead.currencies_used || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      if (!error) inserted++
    }

    // Update job
    await supabase.from("scrape_jobs").update({
      status: "completed",
      leads_found: inserted,
      completed_at: new Date().toISOString(),
    }).eq("id", job!.id)

    return NextResponse.json({ success: true, leads_found: inserted, total_scraped: rawLeads.length })
  } catch (e: any) {
    await supabase.from("scrape_jobs").update({
      status: "failed",
      completed_at: new Date().toISOString(),
    }).eq("id", job!.id)

    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
