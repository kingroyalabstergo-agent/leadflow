export function calculateScore(lead: any): number {
  let score = 0

  const nonEurCurrencies = ['USD', 'INR', 'TRY', 'CNY', 'GBP', 'JPY', 'BRL', 'MXN', 'KRW', 'MAD']
  if (lead.currencies_used?.some((c: string) => nonEurCurrencies.includes(c.toUpperCase()))) {
    score += 30
  }

  if (lead.revenue_estimate && lead.revenue_estimate >= 1_000_000 && lead.revenue_estimate <= 15_000_000) {
    score += 20
  }

  if (lead.revenue_estimate && lead.revenue_estimate > 15_000_000) {
    score -= 50
  }

  if (lead.ceo_phone || lead.cfo_phone) {
    score += 15
  }

  if (lead.ceo_email || lead.cfo_email || lead.email) {
    score += 10
  }

  if (!lead.phone && !lead.email && !lead.ceo_phone && !lead.cfo_phone && !lead.ceo_email && !lead.cfo_email) {
    score -= 20
  }

  if (lead.source?.toLowerCase().includes('feria') || lead.source?.toLowerCase().includes('fair')) {
    score += 10
  }

  if (lead.source?.toLowerCase().includes('saas') || lead.source?.toLowerCase().includes('bubble')) {
    score += 10
  }

  return Math.max(0, Math.min(100, score))
}
