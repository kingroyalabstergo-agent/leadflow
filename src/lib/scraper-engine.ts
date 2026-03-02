// Scraper Engine — finds and enriches B2B leads for Revolut Business
// Target: Spanish companies with import/export in non-EUR currencies, <€15M revenue

export interface RawLead {
  company_name: string
  website?: string
  phone?: string
  email?: string
  industry?: string
  country?: string
  currencies_used?: string[]
  source: string
  notes?: string
  ceo_name?: string
  cfo_name?: string
  ceo_phone?: string
  cfo_phone?: string
  ceo_email?: string
  cfo_email?: string
  revenue_estimate?: number
}

// Extract phone numbers from text (Spanish format)
export function extractPhones(text: string): string[] {
  const patterns = [
    /(?:\+34|0034)?[\s.-]?[6-9]\d{2}[\s.-]?\d{3}[\s.-]?\d{3}/g, // Spanish mobile/landline
    /(?:\+34|0034)?[\s.-]?9[0-9]{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}/g, // Spanish landline
    /\+\d{1,3}[\s.-]?\d{2,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g, // International
  ]
  const phones = new Set<string>()
  for (const pattern of patterns) {
    const matches = text.match(pattern)
    if (matches) matches.forEach(m => phones.add(m.replace(/[\s.-]/g, '').trim()))
  }
  return [...phones].filter(p => p.length >= 9)
}

// Extract emails from text
export function extractEmails(text: string): string[] {
  const pattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const matches = text.match(pattern) || []
  return [...new Set(matches)].filter(e => 
    !e.includes('example') && !e.includes('sentry') && !e.includes('webpack') && !e.includes('.png') && !e.includes('.jpg')
  )
}

// Extract potential CEO/CFO names from text
export function extractExecutives(text: string): { ceo?: string; cfo?: string } {
  const result: { ceo?: string; cfo?: string } = {}
  
  // Common patterns for CEO/Director/Gerente
  const ceoPatterns = [
    /(?:CEO|Director\s*General|Gerente|Consejero\s*Delegado|Fundador|Managing\s*Director)[:\s]*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/i,
    /([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)[,\s]*(?:CEO|Director\s*General|Gerente|Fundador)/i,
  ]
  
  const cfoPatterns = [
    /(?:CFO|Director\s*Financiero|Director\s*de\s*Finanzas|Finance\s*Director)[:\s]*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/i,
  ]
  
  for (const pattern of ceoPatterns) {
    const match = text.match(pattern)
    if (match) { result.ceo = match[1].trim(); break }
  }
  
  for (const pattern of cfoPatterns) {
    const match = text.match(pattern)
    if (match) { result.cfo = match[1].trim(); break }
  }
  
  return result
}

// Clean company name
export function cleanCompanyName(name: string): string {
  return name
    .replace(/\s+/g, ' ')
    .replace(/[""«»]/g, '')
    .trim()
    .replace(/\s+(SA|SL|SLU|SAU|SLL|SRL|SCRL)\.?\s*$/i, (_, suffix) => ` ${suffix.toUpperCase()}`)
}
