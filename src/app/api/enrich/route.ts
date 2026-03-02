import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { extractPhones, extractEmails, extractExecutives } from "@/lib/scraper-engine"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Fetch a webpage and extract text
async function fetchWebpage(url: string): Promise<string> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: controller.signal,
      redirect: "follow",
    })
    clearTimeout(timeout)
    if (!res.ok) return ""
    const html = await res.text()
    // Strip HTML tags, keep text
    return html.replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .substring(0, 50000) // Limit to 50KB of text
  } catch {
    return ""
  }
}

// Try to find the contact/about page
async function findContactPage(baseUrl: string): Promise<string[]> {
  const pages = [
    '/contacto', '/contact', '/contacta', '/sobre-nosotros', '/about',
    '/quienes-somos', '/empresa', '/about-us', '/equipo', '/team',
    '/legal', '/aviso-legal', '/politica-privacidad'
  ]
  return pages.map(p => {
    try {
      const u = new URL(p, baseUrl)
      return u.toString()
    } catch {
      return ''
    }
  }).filter(Boolean)
}

// Search Google for company contact info
async function searchForContact(companyName: string): Promise<string> {
  try {
    // Use a simple Google search to find contact info
    const query = encodeURIComponent(`"${companyName}" España teléfono contacto email`)
    const res = await fetch(`https://www.google.com/search?q=${query}&hl=es&num=5`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    })
    if (!res.ok) return ""
    return await res.text()
  } catch {
    return ""
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { lead_id, batch } = body

  if (batch) {
    // Enrich all leads without contact info
    const { data: leads } = await supabase
      .from("leads")
      .select("*")
      .is("phone", null)
      .is("email", null)
      .is("ceo_phone", null)
      .order("score", { ascending: false })
      .limit(20) // Process 20 at a time

    if (!leads || leads.length === 0) {
      return NextResponse.json({ message: "No leads need enrichment", enriched: 0 })
    }

    let enriched = 0
    for (const lead of leads) {
      const result = await enrichLead(lead)
      if (result) {
        await supabase.from("leads").update({
          ...result,
          updated_at: new Date().toISOString(),
        }).eq("id", lead.id)
        enriched++
      }
      // Rate limit
      await new Promise(r => setTimeout(r, 1000))
    }

    return NextResponse.json({ success: true, enriched, total: leads.length })
  }

  if (lead_id) {
    const { data: lead } = await supabase.from("leads").select("*").eq("id", lead_id).single()
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

    const result = await enrichLead(lead)
    if (result) {
      await supabase.from("leads").update({
        ...result,
        updated_at: new Date().toISOString(),
      }).eq("id", lead.id)
    }

    return NextResponse.json({ success: true, enriched: result ? 1 : 0, data: result })
  }

  return NextResponse.json({ error: "Provide lead_id or batch:true" }, { status: 400 })
}

async function enrichLead(lead: any): Promise<any | null> {
  const updates: any = {}
  let allText = ""

  // Step 1: Try to find company website via Google if not set
  if (!lead.website) {
    const searchText = await searchForContact(lead.company_name)
    allText += " " + searchText
    
    // Try to extract website from search results
    const urlMatch = searchText.match(/https?:\/\/(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)/g)
    if (urlMatch) {
      const validUrl = urlMatch.find(u => 
        !u.includes('google') && !u.includes('facebook') && !u.includes('linkedin') &&
        !u.includes('twitter') && !u.includes('instagram') && !u.includes('youtube')
      )
      if (validUrl) updates.website = validUrl
    }
  }

  const website = lead.website || updates.website

  // Step 2: Scrape company website
  if (website) {
    const mainText = await fetchWebpage(website)
    allText += " " + mainText

    // Also check contact/about pages
    const contactPages = await findContactPage(website)
    for (const page of contactPages.slice(0, 4)) {
      const pageText = await fetchWebpage(page)
      allText += " " + pageText
      if (pageText.length > 100) break // Found a good page
    }
  }

  // Step 3: Also search Google for contact info
  if (!allText || allText.length < 200) {
    const searchText = await searchForContact(lead.company_name)
    allText += " " + searchText
  }

  // Step 4: Extract contact info
  const phones = extractPhones(allText)
  const emails = extractEmails(allText)
  const executives = extractExecutives(allText)

  if (phones.length > 0) updates.phone = phones[0]
  if (phones.length > 1) updates.ceo_phone = phones[1] // Second phone might be direct
  if (emails.length > 0) {
    // Prefer info@, contacto@, or named emails over generic ones
    const sorted = emails.sort((a, b) => {
      const priority = (e: string) => {
        if (e.startsWith('info@')) return 3
        if (e.startsWith('contacto@')) return 3
        if (e.startsWith('comercial@')) return 4
        if (e.includes('@gmail') || e.includes('@hotmail')) return 1
        return 2
      }
      return priority(b) - priority(a)
    })
    updates.email = sorted[0]
  }

  if (executives.ceo) updates.ceo_name = executives.ceo
  if (executives.cfo) updates.cfo_name = executives.cfo

  // Recalculate score with new info
  if (Object.keys(updates).length > 0) {
    const { calculateScore } = await import("@/lib/scoring")
    updates.score = calculateScore({ ...lead, ...updates })
    return updates
  }

  return null
}
