const https = require('https');
const http = require('http');

function fetch(url) {
  const mod = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
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
  
  // Find the sel_internacional select specifically
  const selectPattern = /name="internacional"[\s\S]*?<\/select>/i;
  const match = html.match(selectPattern);
  if (match) {
    console.log('Found internacional select');
    const options = [...match[0].matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)/g)];
    options.forEach(o => console.log(`  ${o[1]} = ${o[2].trim()}`));
  } else {
    // Find all selects
    const allSelects = [...html.matchAll(/<select[^>]*name="([^"]*)"[\s\S]*?<\/select>/g)];
    console.log('All select names:');
    allSelects.forEach(s => {
      console.log(`  name="${s[1]}" (${s[0].length} chars)`);
      if (s[1].includes('nternacional') || s[1].includes('area') || s[1].includes('pais')) {
        const opts = [...s[0].matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)/g)];
        opts.slice(0, 20).forEach(o => console.log(`    ${o[1]} = ${o[2].trim()}`));
      }
    });
  }
  
  // Count total companies found text
  const countMatch = html.match(/(\d[\d.]+)\s*empresas encontradas/);
  console.log('\nTotal companies:', countMatch ? countMatch[1] : 'not found');
  
  // Try with import+export and tramo > 1M (bigger companies)
  const bigUrl = 'http://directorio.camaras.org/index.php?pagina=1&registros=0&offset=0&cocin=&impexp=EI&anno=23&tramo=03&nombre=&producto=&nacional=&internacional=';
  const bigHtml = await fetch(bigUrl);
  const bigCount = bigHtml.match(/(\d[\d.]+)\s*empresas encontradas/);
  console.log('Big companies (>1M, import+export):', bigCount ? bigCount[1] : 'not found');
  
  // Extract company names from big companies page
  const companyLinks = [...bigHtml.matchAll(/<a[^>]*onclick="verempresa\([^"]*\)[^"]*"[^>]*>([^<]+)<\/a>/g)];
  console.log('Companies on page:', companyLinks.length);
  companyLinks.slice(0, 25).forEach(c => console.log(' ', c[1].trim()));
}

main().catch(console.error);
