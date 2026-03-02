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
  // Correct params: areainternac=PS (pais) + codareainter=country_code
  const countries = {
    '720': { name: 'China', currency: 'CNY' },
    '664': { name: 'India', currency: 'INR' },
    '052': { name: 'Turkey', currency: 'TRY' },
    '400': { name: 'USA', currency: 'USD' },
    '006': { name: 'UK', currency: 'GBP' },
    '732': { name: 'Japan', currency: 'JPY' },
    '508': { name: 'Brazil', currency: 'BRL' },
  };
  
  for (const [code, info] of Object.entries(countries)) {
    const url = `http://directorio.camaras.org/index.php?pagina=1&registros=0&offset=0&cocin=&impexp=EI&anno=23&tramo=03&nombre=&producto=&areanacional=&codarea=&areainternac=PS&codareainter=${code}`;
    const html = await fetch(url);
    const count = html.match(/(\d[\d.]+)\s*empresas encontradas/);
    
    // Extract company names
    const names = [...html.matchAll(/<a[^>]*onclick="verempresa[^"]*"[^>]*>\s*([^<]+)\s*<\/a>/g)];
    
    console.log(`\n${info.name} (${info.currency}): ${count ? count[1] : '0'} companies, ${names.length} on page`);
    names.slice(0, 5).forEach(n => console.log(`  ${n[1].trim()}`));
  }
}

main().catch(console.error);
