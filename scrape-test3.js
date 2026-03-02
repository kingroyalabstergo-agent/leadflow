const https = require('https');
const http = require('http');

function fetch(url) {
  const mod = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        console.log('Redirect to:', res.headers.location);
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  const html = await fetch('http://directorio.camaras.org/');
  console.log('Length:', html.length);
  // Look for form
  const formIdx = html.indexOf('<form');
  if (formIdx > -1) {
    console.log('Form found at:', formIdx);
    console.log(html.substring(formIdx, formIdx + 1000));
  }
  // Print select elements area
  const selIdx = html.indexOf('<select');
  if (selIdx > -1) {
    console.log('\nSelect area:');
    console.log(html.substring(selIdx, selIdx + 2000));
  }
  // Look for links with empresa
  const links = [...html.matchAll(/href="([^"]*empresa[^"]*)"/gi)];
  links.slice(0, 5).forEach(l => console.log('Link:', l[1]));
  
  // Look for pagination
  const pageLinks = [...html.matchAll(/href="([^"]*pag[^"]*)"/gi)];
  pageLinks.slice(0, 5).forEach(l => console.log('Page link:', l[1]));
  
  // Company names - look for patterns
  const companies = [...html.matchAll(/<b>([A-Z][A-Z\s,\.]+(?:SA|SL|SLU|SAU|SLL))<\/b>/g)];
  console.log('\nCompanies found:', companies.length);
  companies.slice(0, 10).forEach(c => console.log(' ', c[1]));
}

main().catch(console.error);
