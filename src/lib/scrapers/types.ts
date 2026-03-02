export interface Lead {
  id?: string;
  company_name: string;
  website?: string;
  industry?: string;
  revenue_estimate?: number;
  country?: string;
  currencies_used?: string[];
  source?: string;
  score?: number;
  status?: "new" | "contacted" | "interested" | "rejected" | "closed";
  phone?: string;
  email?: string;
  ceo_name?: string;
  cfo_name?: string;
  ceo_phone?: string;
  cfo_phone?: string;
  ceo_email?: string;
  cfo_email?: string;
  notes?: string;
  raw_data?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface ScrapeResult {
  source: string;
  leads: Lead[];
  errors: string[];
  jobId?: string;
}

export interface ScrapeJob {
  id?: string;
  source: string;
  status: "pending" | "running" | "completed" | "failed";
  leads_found: number;
  error?: string;
  started_at?: string;
  completed_at?: string;
}
