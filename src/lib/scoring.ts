import { Lead } from './supabase'

export function calculateScore(lead: Partial<Lead>): number {
  let score = 0

  // +30: confirmed import/export in non-EUR currencies
  const nonEurCurrencies = ['USD', 'INR', 'TRY', 'CNY', 'GBP', 'JPY', 'BRL', 'MXN', 'ARS']
  if (lead.currencies_used?.some(c => nonEurCurrencies.includes(c.toUpperCase()))) {
    score += 30
  }

  // +20: revenue between €1M-€15M
  if (lead.revenue_estimate && lead.revenue_estimate >= 1_000_000 && lead.revenue_estimate <= 15_000_000) {
    score += 20
  }

  // -50: revenue > €15M (disqualify)
  if (lead.revenue_estimate && lead.revenue_estimate > 15_000_000) {
    score -= 50
  }

  // +15: CEO/CFO phone number available
  if (lead.ceo_phone || lead.cfo_phone) {
    score += 15
  }

  // +10: has contact info (email at least)
  if (lead.ceo_email || lead.cfo_email || lead.email) {
    score += 10
  }

  // -20: no contact info at all
  if (!lead.phone && !lead.email && !lead.ceo_phone && !lead.cfo_phone && !lead.ceo_email && !lead.cfo_email) {
    score -= 20
  }

  // +10: from trade fair source
  if (lead.source?.toLowerCase().includes('feria') || lead.source?.toLowerCase().includes('fair')) {
    score += 10
  }

  // +10: SaaS/software related
  if (lead.source?.toLowerCase().includes('saas') || lead.source?.toLowerCase().includes('bubble')) {
    score += 10
  }

  return Math.max(0, Math.min(100, score))
}
