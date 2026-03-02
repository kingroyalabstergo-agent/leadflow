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
  // Fetch China, big companies (>1M import+export)
  const url = 'http://directorio.camaras.org/index.php?pagina=1&registros=0&offset=0&cocin=&impexp=EI&anno=23&tramo=03&nombre=&producto=&areanacional=&codarea=&areainternac=PS&codareainter=720';
  const html = await fetch(url);
  
  // Find the table with companies
  const tableIdx = html.indexOf('LISTADO DE EMPRESAS');
  if (tableIdx > -1) {
    const tableSection = html.substring(tableIdx, tableIdx + 5000);
    console.log('Table section (first 2000):');
    console.log(tableSection.substring(0, 2000));
  }
  
  // Try various regex patterns for company names
  // Pattern 1: onclick verempresa
  const p1 = [...html.matchAll(/verempresa\(/g)];
  console.log('\nverempresa occurrences:', p1.length);
  
  // Get the actual HTML around first verempresa
  const veIdx = html.indexOf('verempresa');
  if (veIdx > -1) {
    console.log('\nAround first verempresa:');
    console.log(html.substring(veIdx - 100, veIdx + 300));
  }
  
  // Pagination
  const pageCount = html.match(/(\d[\d.]+)\s*empresas encontradas\.\s*\[(\d+)\s*-\s*(\d+)\]/);
  console.log('\nPagination:', pageCount ? `${pageCount[1]} total, showing ${pageCount[2]}-${pageCount[3]}` : 'not found');
  
  // Page 2
  const url2 = url.replace('pagina=1', 'pagina=2').replace('offset=0', 'offset=25');
  const html2 = await fetch(url2);
  const veIdx2 = html2.indexOf('verempresa');
  if (veIdx2 > -1) {
    console.log('\nPage 2, around verempresa:');
    console.log(html2.substring(veIdx2 - 100, veIdx2 + 300));
  }
}

main().catch(console.error);
