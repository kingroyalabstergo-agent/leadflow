import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (client as any)[prop];
  },
});

export type Lead = {
  id: string
  company_name: string
  website: string | null
  industry: string | null
  revenue_estimate: number | null
  country: string
  currencies_used: string[]
  source: string
  score: number
  status: 'new' | 'contacted' | 'interested' | 'rejected' | 'closed'
  phone: string | null
  email: string | null
  ceo_name: string | null
  cfo_name: string | null
  ceo_phone: string | null
  cfo_phone: string | null
  ceo_email: string | null
  cfo_email: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type LeadActivity = {
  id: string
  lead_id: string
  action: string
  result: string | null
  notes: string | null
  created_at: string
}

export type ScrapeJob = {
  id: string
  source: string
  status: 'running' | 'completed' | 'failed'
  leads_found: number
  started_at: string
  completed_at: string | null
}
