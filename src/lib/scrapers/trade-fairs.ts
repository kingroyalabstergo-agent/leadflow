import axios from "axios";
import * as cheerio from "cheerio";
import { Lead, ScrapeResult } from "./types";
import { scoreLead } from "./scorer";

const FAIR_SOURCES = [
  { name: "IFEMA Madrid", url: "https://www.ifema.es/en/fairs" },
  { name: "Fira Barcelona", url: "https://www.firabarcelona.com/en/trade-fairs" },
];

async function scrapeFairPage(source: { name: string; url: string }): Promise<Lead[]> {
  const leads: Lead[] = [];
  try {
    const { data } = await axios.get(source.url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      timeout: 15000,
    });
    const $ = cheerio.load(data);
    $("h3, h4, .exhibitor-name, .company-name, [class*=exhibitor], [class*=company]").each((_, el) => {
      const name = $(el).text().trim();
      if (name && name.length > 2 && name.length < 100) {
        const lead: Lead = { company_name: name, country: "Spain", source: `trade-fair:${source.name}` };
        lead.score = scoreLead(lead).total;
        leads.push(lead);
      }
    });
  } catch { /* skip */ }
  return leads;
}

export async function scrapeTradeFairs(): Promise<ScrapeResult> {
  const leads: Lead[] = [];
  const errors: string[] = [];
  for (const source of FAIR_SOURCES) {
    try {
      leads.push(...await scrapeFairPage(source));
    } catch (e) {
      errors.push(`${source.name}: ${e instanceof Error ? e.message : "Unknown"}`);
    }
  }
  return { source: "trade-fairs", leads, errors };
}
