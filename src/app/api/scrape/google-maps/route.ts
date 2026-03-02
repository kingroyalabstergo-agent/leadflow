import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { calculateScore } from "@/lib/scoring"
import { cleanCompanyName } from "@/lib/scraper-engine"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || ""

// Search queries targeting import/export companies in Spain
// Keep queries small to fit in Vercel's 10s timeout
const SEARCH_QUERIES = [
  { query: "empresa importadora china Barcelona", currency: "CNY", country: "china" },
  { query: "empresa importadora china Madrid", currency: "CNY", country: "china" },
  { query: "importador productos turcos España", currency: "TRY", country: "turkey" },
  { query: "empresa importadora India España", currency: "INR", country: "india" },
  { query: "empresa exportadora USA España", currency: "USD", country: "usa" },
  { query: "comercio internacional empresa Barcelona", currency: "USD", country: "international" },
  { query: "distribuidor productos asiáticos España", currency: "CNY", country: "china" },
  { query: "startup SaaS Barcelona empresa software", currency: "USD", country: "saas" },
]

async function searchPlaces(query: string): Promise<any[]> {
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.internationalPhoneNumber,places.types,places.rating,places.userRatingCount",
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: "es",
        locationBias: {
          rectangle: {
            low: { latitude: 36.0, longitude: -9.3 },  // Southwest Spain
            high: { latitude: 43.8, longitude: 3.3 },   // Northeast Spain
          },
        },
        maxResultCount: 20,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      console.error("Places API error:", err.error?.message)
      return []
    }

    const data = await res.json()
    return data.places || []
  } catch (e) {
    console.error("Places search error:", e)
    return []
  }
}

export async function POST(request: NextRequest) {
  if (!GOOGLE_API_KEY) {
    return NextResponse.json({ error: "GOOGLE_PLACES_API_KEY not configured" }, { status: 500 })
  }

  // Create scrape job
  const { data: job } = await supabase
    .from("scrape_jobs")
    .insert({ source: "google-maps", status: "running", leads_found: 0, started_at: new Date().toISOString() })
    .select()
    .single()

  try {
    let totalInserted = 0

    for (const search of SEARCH_QUERIES) {
      const places = await searchPlaces(search.query)

      for (const place of places) {
        const companyName = cleanCompanyName(place.displayName?.text || "")
        if (!companyName || companyName.length < 3) continue

        // Check for duplicates
        const { data: existing } = await supabase
          .from("leads")
          .select("id")
          .eq("company_name", companyName)
          .maybeSingle()

        if (existing) continue

        const lead = {
          company_name: companyName,
          website: place.websiteUri || null,
          phone: place.internationalPhoneNumber || place.nationalPhoneNumber || null,
          country: "Spain",
          currencies_used: ["EUR", search.currency],
          industry: `Import/Export (${search.country})`,
          source: "google-maps",
          notes: `Found via Google Maps: "${search.query}". Address: ${place.formattedAddress || "N/A"}`,
          status: "new",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        const score = calculateScore(lead)
        const { error } = await supabase.from("leads").insert({ ...lead, score })
        if (!error) totalInserted++
      }

      // Rate limit between searches
      await new Promise(r => setTimeout(r, 300))
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
