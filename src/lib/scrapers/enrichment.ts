import axios from "axios";
import * as cheerio from "cheerio";
import { Lead } from "./types";

export async function enrichLead(lead: Lead): Promise<Lead> {
  const enriched = { ...lead };
  if (!lead.website) return enriched;

  try {
    const { data } = await axios.get(lead.website, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      timeout: 10000,
    });
    const $ = cheerio.load(data);
    const text = $("body").text();

    const emails = text.match(/[\w.-]+@[\w.-]+\.\w+/g) ?? [];
    if (!enriched.email && emails.length > 0) enriched.email = emails[0];

    const phones = text.match(/\+?\d[\d\s()-]{7,}\d/g) ?? [];
    if (!enriched.phone && phones.length > 0) enriched.phone = phones[0]!.trim();

    const lines = text.split("\n");
    for (const line of lines) {
      const lower = line.toLowerCase();
      if ((lower.includes("ceo") || lower.includes("director general")) && !enriched.ceo_name) {
        const m = line.match(/(?:CEO|Director General)[:\s-]+([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+)+)/i);
        if (m) enriched.ceo_name = m[1].trim();
      }
      if ((lower.includes("cfo") || lower.includes("director financiero")) && !enriched.cfo_name) {
        const m = line.match(/(?:CFO|Director Financiero)[:\s-]+([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+)+)/i);
        if (m) enriched.cfo_name = m[1].trim();
      }
    }

    const currencies: string[] = [];
    if (text.includes("USD") || text.includes("$")) currencies.push("USD");
    if (text.includes("GBP") || text.includes("£")) currencies.push("GBP");
    if (text.includes("EUR") || text.includes("€")) currencies.push("EUR");
    if (currencies.length > 0 && (!enriched.currencies_used || enriched.currencies_used.length === 0)) {
      enriched.currencies_used = currencies;
    }
  } catch { /* skip */ }

  return enriched;
}
