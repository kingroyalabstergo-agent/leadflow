import { Lead } from "./types";

interface ScoreBreakdown {
  total: number;
  reasons: string[];
}

export function scoreLead(lead: Lead): ScoreBreakdown {
  let total = 0;
  const reasons: string[] = [];

  const nonEurCurrencies = (lead.currencies_used ?? []).filter((c) => c !== "EUR");
  if (nonEurCurrencies.length > 0) {
    total += 30;
    reasons.push(`+30: non-EUR currencies (${nonEurCurrencies.join(", ")})`);
  }

  const rev = lead.revenue_estimate ?? 0;
  if (rev >= 1_000_000 && rev <= 15_000_000) {
    total += 20;
    reasons.push("+20: revenue €1M-€15M");
  }
  if (rev > 15_000_000) {
    total -= 50;
    reasons.push("-50: revenue >€15M (enterprise)");
  }

  if (lead.ceo_phone || lead.cfo_phone) {
    total += 15;
    reasons.push("+15: decision-maker phone available");
  }

  if (lead.industry?.toLowerCase().includes("saas") || lead.industry?.toLowerCase().includes("software")) {
    total += 10;
    reasons.push("+10: SaaS/software industry");
  }

  if (lead.source?.toLowerCase().includes("fair") || lead.source?.toLowerCase().includes("feria")) {
    total += 10;
    reasons.push("+10: trade fair source");
  }

  if (!lead.phone && !lead.email && !lead.ceo_phone && !lead.cfo_phone && !lead.ceo_email && !lead.cfo_email) {
    total -= 20;
    reasons.push("-20: no contact info");
  }

  return { total: Math.max(0, total), reasons };
}
