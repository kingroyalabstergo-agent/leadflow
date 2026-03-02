const token = 'sbp_40af568d4f4163c76889f14c84927d86bf7d43c7';
const res = await fetch('https://api.supabase.com/v1/projects/gnezbqpkaqgstdwycxys/database/query', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: "ALTER TABLE leads ADD COLUMN IF NOT EXISTS revenue_estimate numeric, ADD COLUMN IF NOT EXISTS enriched boolean DEFAULT false, ADD COLUMN IF NOT EXISTS employee_count text;" })
});
console.log('Status:', res.status);
console.log(await res.text());
