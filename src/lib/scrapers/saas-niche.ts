import axios from "axios";
import * as cheerio from "cheerio";
import { Lead, ScrapeResult } from "./types";
import { scoreLead } from "./scorer";

export async function scrapeSaasNiche(): Promise<ScrapeResult> {
  const leads: Lead[] = [];
  const errors: string[] = [];
  try {
    const { data } = await axios.get("https://bubble.io/showcase", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      timeout: 15000,
    });
    const $ = cheerio.load(data);
    $("[class*=showcase], [class*=app-card], .card, h3 a, h4 a").each((_, el) => {
      const name = $(el).text().trim();
      const href = $(el).attr("href") ?? "";
      if (name && name.length > 2 && name.length < 80) {
        const lead: Lead = {
          company_name: name,
          website: href.startsWith("http") ? href : undefined,
          industry: "SaaS",
          source: "bubble-showcase",
        };
        lead.score = scoreLead(lead).total;
        leads.push(lead);
      }
    });
  } catch (e) {
    errors.push(`Bubble showcase: ${e instanceof Error ? e.message : "Unknown"}`);
  }
  return { source: "saas-niche", leads, errors };
}
