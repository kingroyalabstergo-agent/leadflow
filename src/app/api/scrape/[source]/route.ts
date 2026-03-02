import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { calculateScore } from "@/lib/scoring"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Scraper registry
const scrapers: Record<string, () => Promise<any[]>> = {
  "icex-exporters": scrapeICEXExporters,
  "trade-fairs": scrapeTradeFairs,
  "importers-spain": scrapeImporters,
  "bubble-saas": scrapeBubbleSaaS,
  "camara-comercio": scrapeCamaraComercio,
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ source: string }> }
) {
  const { source } = await params
  const scraper = scrapers[source]

  if (!scraper) {
    return NextResponse.json({ error: "Unknown source" }, { status: 400 })
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
      // Check for duplicates
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
        source,
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

    return NextResponse.json({ success: true, leads_found: inserted })
  } catch (e: any) {
    await supabase.from("scrape_jobs").update({
      status: "failed",
      completed_at: new Date().toISOString(),
    }).eq("id", job!.id)

    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ========================
// SCRAPER IMPLEMENTATIONS
// ========================

async function scrapeICEXExporters() {
  // ICEX (Instituto de Comercio Exterior) - Spanish exporters database
  // We search for Spanish companies with international trade
  const leads: any[] = []

  try {
    // Search Google for Spanish exporters directories
    const searchQueries = [
      "directorio exportadores españoles empresas comercio internacional",
      "empresas españolas exportadoras china india turquia",
      "spanish exporters directory companies import export",
    ]

    for (const query of searchQueries) {
      const res = await fetch(
        `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CX}&q=${encodeURIComponent(query)}&num=10`,
        { next: { revalidate: 3600 } }
      ).catch(() => null)

      if (!res?.ok) continue
      const data = await res.json()

      // Extract company-like results
      for (const item of data.items || []) {
        if (item.title && !item.title.includes("directorio") && !item.title.includes("listado")) {
          leads.push({
            company_name: item.title.split(" - ")[0].split(" | ")[0].trim(),
            website: item.link,
            industry: "International Trade",
            currencies_used: ["USD", "CNY"],
            notes: `Found via ICEX search: ${item.snippet?.substring(0, 200)}`,
          })
        }
      }
    }
  } catch (e) {
    console.error("ICEX scraper error:", e)
  }

  return leads
}

async function scrapeTradeFairs() {
  const leads: any[] = []

  try {
    // Scrape trade fair exhibitor pages
    const fairUrls = [
      "https://www.ifema.es/en",
      "https://www.firabarcelona.com/en",
    ]

    // For now, search for exhibitors at major Spanish trade fairs
    const res = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CX}&q=${encodeURIComponent("exhibitors list feria internacional españa 2025 2026 import export")}&num=10`,
      { next: { revalidate: 3600 } }
    ).catch(() => null)

    if (res?.ok) {
      const data = await res.json()
      for (const item of data.items || []) {
        leads.push({
          company_name: item.title.split(" - ")[0].split(" | ")[0].trim(),
          website: item.link,
          industry: "Trade Fair Exhibitor",
          currencies_used: [],
          notes: `Trade fair: ${item.snippet?.substring(0, 200)}`,
        })
      }
    }
  } catch (e) {
    console.error("Trade fairs scraper error:", e)
  }

  return leads
}

async function scrapeImporters() {
  const leads: any[] = []

  try {
    const queries = [
      "empresas importadoras españa china productos",
      "importadores españoles india textil",
      "empresas españolas importan turquia",
      "spanish companies importing from asia",
    ]

    for (const query of queries) {
      const res = await fetch(
        `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CX}&q=${encodeURIComponent(query)}&num=10`,
        { next: { revalidate: 3600 } }
      ).catch(() => null)

      if (!res?.ok) continue
      const data = await res.json()

      for (const item of data.items || []) {
        leads.push({
          company_name: item.title.split(" - ")[0].split(" | ")[0].trim(),
          website: item.link,
          industry: "Import/Export",
          currencies_used: ["USD", "CNY", "INR"],
          notes: `Importer: ${item.snippet?.substring(0, 200)}`,
        })
      }
    }
  } catch (e) {
    console.error("Importers scraper error:", e)
  }

  return leads
}

async function scrapeBubbleSaaS() {
  const leads: any[] = []

  try {
    // Find Spanish companies using Bubble.io
    const queries = [
      "site:bubble.io spain spanish empresa",
      '"built with bubble" empresa española',
      '"hecho con bubble" españa',
      "spanish startups bubble.io",
    ]

    for (const query of queries) {
      const res = await fetch(
        `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CX}&q=${encodeURIComponent(query)}&num=10`,
        { next: { revalidate: 3600 } }
      ).catch(() => null)

      if (!res?.ok) continue
      const data = await res.json()

      for (const item of data.items || []) {
        leads.push({
          company_name: item.title.split(" - ")[0].split(" | ")[0].trim(),
          website: item.link,
          industry: "SaaS / Technology",
          currencies_used: ["USD"],
          notes: `Bubble.io/SaaS user: ${item.snippet?.substring(0, 200)}`,
        })
      }
    }
  } catch (e) {
    console.error("Bubble/SaaS scraper error:", e)
  }

  return leads
}

async function scrapeCamaraComercio() {
  const leads: any[] = []

  try {
    const queries = [
      "camara de comercio empresas comercio exterior españa",
      "directorio empresas cámara comercio barcelona exportadores",
      "cámara comercio madrid empresas internacionales",
    ]

    for (const query of queries) {
      const res = await fetch(
        `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CX}&q=${encodeURIComponent(query)}&num=10`,
        { next: { revalidate: 3600 } }
      ).catch(() => null)

      if (!res?.ok) continue
      const data = await res.json()

      for (const item of data.items || []) {
        leads.push({
          company_name: item.title.split(" - ")[0].split(" | ")[0].trim(),
          website: item.link,
          industry: "General Business",
          currencies_used: [],
          notes: `Cámara de Comercio: ${item.snippet?.substring(0, 200)}`,
        })
      }
    }
  } catch (e) {
    console.error("Cámara de Comercio scraper error:", e)
  }

  return leads
}
