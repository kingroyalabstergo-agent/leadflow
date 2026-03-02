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
  
  // Find international area select options
  const intlIdx = html.indexOf('id="sel_internacional"');
  if (intlIdx === -1) {
    // Try other patterns
    const areaIdx = html.indexOf('internacional');
    console.log('Found "internacional" at:', areaIdx);
    const section = html.substring(areaIdx, areaIdx + 3000);
    const options = [...section.matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)/g)];
    console.log('Options found:', options.length);
    options.forEach(o => console.log(`  ${o[1]} = ${o[2].trim()}`));
  } else {
    const section = html.substring(intlIdx, intlIdx + 5000);
    const options = [...section.matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)/g)];
    options.forEach(o => console.log(`  ${o[1]} = ${o[2].trim()}`));
  }
  
  // Also find company detail URLs and what info they show
  // Get a company detail page
  const empresaMatch = html.match(/verempresa\('([^']+)','([^']+)','([^']+)','([^']+)','([^']+)'\)/);
  if (empresaMatch) {
    console.log('\nCompany detail params:', empresaMatch.slice(1));
    // Try to fetch company detail
    const detailUrl = `http://directorio.camaras.org/empresa.php?id=${encodeURIComponent(empresaMatch[1])}&anno=${empresaMatch[2]}&impexp=${empresaMatch[3]}&tramo=${empresaMatch[4]}&cocin=${encodeURIComponent(empresaMatch[5])}`;
    console.log('Detail URL:', detailUrl);
    const detail = await fetch(detailUrl);
    console.log('\nDetail page (first 2000):');
    console.log(detail.substring(0, 2000));
  }
  
  // Try filtering by China: index.php?impexp=EI&anno=23&internacional=CN
  console.log('\n--- SEARCHING CHINA EXPORTERS ---');
  const chinaUrl = 'http://directorio.camaras.org/index.php?pagina=1&registros=0&offset=0&cocin=&impexp=EI&anno=23&tramo=00&nombre=&producto=&nacional=&internacional=CN';
  const chinaHtml = await fetch(chinaUrl);
  console.log('China page length:', chinaHtml.length);
  // Extract company names
  const namePattern = /verempresa\([^)]+\)[^<]*<\/a>[^<]*<\/td>[^<]*<td[^>]*>([^<]+)/g;
  const names = [...chinaHtml.matchAll(/<a[^>]*>([^<]+)<\/a>/g)];
  const companyNames = names.filter(n => n[1].match(/[A-Z]{2,}/) && !n[1].includes('guiente'));
  console.log('Companies trading with China:', companyNames.length);
  companyNames.slice(0, 20).forEach(c => console.log(' ', c[1].trim()));
}

main().catch(console.error);
