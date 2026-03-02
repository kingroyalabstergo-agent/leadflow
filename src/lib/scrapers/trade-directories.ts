import axios from "axios";
import * as cheerio from "cheerio";
import { Lead, ScrapeResult } from "./types";
import { scoreLead } from "./scorer";

const DIRECTORIES = [
  {
    name: "Spanish Import/Export Directory",
    searchUrl: "https://www.google.com/search?q=site:directorioempresas.com+importacion+exportacion&num=20",
  },
  {
    name: "Kompass Spain",
    searchUrl: "https://www.google.com/search?q=site:es.kompass.com+importacion+exportacion+empresa&num=20",
  },
];

async function scrapeGoogleResults(url: string): Promise<string[]> {
  try {
    const { data } = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      timeout: 10000,
    });
    const $ = cheerio.load(data);
    const links: string[] = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      if (href.startsWith("http") && !href.includes("google.com")) links.push(href);
    });
    return links.slice(0, 20);
  } catch {
    return [];
  }
}

async function extractCompanyFromPage(url: string): Promise<Lead | null> {
  try {
    const { data } = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      timeout: 10000,
    });
    const $ = cheerio.load(data);
    const title = $("h1").first().text().trim() || $("title").text().trim();
    if (!title) return null;

    const bodyText = $("body").text().toLowerCase();
    const currencies: string[] = [];
    if (bodyText.includes("usd") || bodyText.includes("dólar")) currencies.push("USD");
    if (bodyText.includes("gbp") || bodyText.includes("libra")) currencies.push("GBP");
    if (bodyText.includes("eur")) currencies.push("EUR");

    const emailMatch = $("body").text().match(/[\w.-]+@[\w.-]+\.\w+/);
    const phoneMatch = $("body").text().match(/\+?\d[\d\s()-]{7,}/);

    const lead: Lead = {
      company_name: title.substring(0, 100),
      website: url,
      country: "Spain",
      currencies_used: currencies,
      source: "trade-directory",
      email: emailMatch?.[0],
      phone: phoneMatch?.[0]?.trim(),
    };
    lead.score = scoreLead(lead).total;
    return lead;
  } catch {
    return null;
  }
}

export async function scrapeTradeDirectories(): Promise<ScrapeResult> {
  const leads: Lead[] = [];
  const errors: string[] = [];
  for (const dir of DIRECTORIES) {
    try {
      const links = await scrapeGoogleResults(dir.searchUrl);
      for (const link of links.slice(0, 10)) {
        const lead = await extractCompanyFromPage(link);
        if (lead) leads.push(lead);
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (e) {
      errors.push(`${dir.name}: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }
  return { source: "trade-directories", leads, errors };
}
