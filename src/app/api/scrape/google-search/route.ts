import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { calculateScore } from "@/lib/scoring"
import { cleanCompanyName, extractPhones, extractEmails } from "@/lib/scraper-engine"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || ""
const GOOGLE_CX = process.env.GOOGLE_CX || ""

// Search queries to find Spanish import/export companies
const SEARCH_QUERIES = [
  // Direct company searches
  { query: "empresas importadoras china españa lista", currencies: ["CNY"], industry: "Import (China)" },
  { query: "empresas exportadoras españa india directorio", currencies: ["INR"], industry: "Export (India)" },
  { query: "empresas importadoras turquía españa", currencies: ["TRY"], industry: "Import (Turkey)" },
  { query: "empresas comercio exterior españa estados unidos", currencies: ["USD"], industry: "Trade (USA)" },
  { query: "distribuidores productos chinos españa mayorista", currencies: ["CNY"], industry: "Distribution (China)" },
  { query: "empresa importadora textil asia españa teléfono", currencies: ["CNY", "INR"], industry: "Textiles Import" },
  { query: "importador alimentación india españa contacto", currencies: ["INR"], industry: "Food Import (India)" },
  { query: "empresa exportadora maquinaria españa contacto", currencies: ["USD"], industry: "Machinery Export" },
  // SaaS companies
  { query: "startups SaaS españolas bubble.io", currencies: ["USD"], industry: "SaaS (Bubble.io)" },
  { query: "empresas españolas que usan bubble.io", currencies: ["USD"], industry: "SaaS (Bubble.io)" },
  { query: "startups españolas software suscripción USD", currencies: ["USD"], industry: "SaaS" },
  // Trade fairs
  { query: "expositores feria comercio internacional españa 2025 2026", currencies: ["USD"], industry: "Trade Fair" },
  { query: "IFEMA expositores comercio exterior lista empresas", currencies: ["USD"], industry: "Trade Fair" },
  { query: "Fira Barcelona expositores importación exportación", currencies: ["USD"], industry: "Trade Fair" },
]

async function googleSearch(query: string): Promise<any[]> {
  if (!GOOGLE_CX) {
    // Without CX, we can't use Custom Search API
    // Fall back to simple scraping approach
    return []
  }
  
  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}&num=10&gl=es&lr=lang_es`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    return data.items || []
  } catch {
    return []
  }
}

// Extract company-like names from search results
function extractCompanyFromResult(item: any): { name: string; website: string; snippet: string } | null {
  const title = item.title || ""
  const link = item.link || ""
  const snippet = item.snippet || ""
  
  // Skip directories, news sites, government sites
  if (link.includes('wikipedia') || link.includes('linkedin.com/company') || link.includes('facebook.com') || 
      link.includes('twitter.com') || link.includes('youtube.com') || link.includes('amazon.') ||
      link.includes('.gov.') || link.includes('google.com')) {
    return null
  }
  
  // Try to extract company name from title
  let name = title.split(' - ')[0].split(' | ')[0].split(' :: ')[0].trim()
  
  // Clean up common suffixes
  name = name.replace(/\s*[-–|].*$/, '').trim()
  
  if (name.length < 3 || name.length > 100) return null
  
  return { name: cleanCompanyName(name), website: link, snippet }
}

export async function POST(request: NextRequest) {
  if (!GOOGLE_API_KEY) {
    return NextResponse.json({ error: "GOOGLE_PLACES_API_KEY not configured" }, { status: 500 })
  }

  const { data: job } = await supabase
    .from("scrape_jobs")
    .insert({ source: "google-search", status: "running", leads_found: 0, started_at: new Date().toISOString() })
    .select()
    .single()

  try {
    let totalInserted = 0

    for (const search of SEARCH_QUERIES) {
      const results = await googleSearch(search.query)

      for (const item of results) {
        const company = extractCompanyFromResult(item)
        if (!company) continue

        // Check for duplicates
        const { data: existing } = await supabase
          .from("leads")
          .select("id")
          .eq("company_name", company.name)
          .maybeSingle()
        if (existing) continue

        // Extract phone/email from snippet
        const phones = extractPhones(company.snippet)
        const emails = extractEmails(company.snippet)

        const lead = {
          company_name: company.name,
          website: company.website,
          phone: phones[0] || null,
          email: emails[0] || null,
          country: "Spain",
          currencies_used: ["EUR", ...search.currencies],
          industry: search.industry,
          source: "google-search",
          notes: `Google Search: "${search.query}". ${company.snippet.substring(0, 200)}`,
          status: "new",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        const score = calculateScore(lead)
        const { error } = await supabase.from("leads").insert({ ...lead, score })
        if (!error) totalInserted++
      }

      await new Promise(r => setTimeout(r, 500))
    }

    await supabase.from("scrape_jobs").update({
      status: "completed",
      leads_found: totalInserted,
      completed_at: new Date().toISOString(),
    }).eq("id", job!.id)

    return NextResponse.json({ success: true, leads_found: totalInserted })
  } catch (e: any) {
    await supabase.from("scrape_jobs").update({
      status: "failed",
      completed_at: new Date().toISOString(),
    }).eq("id", job!.id)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
