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
  
  // Find the hidden select for international countries (likely loaded via JS)
  // Look for any reference to pais, country codes
  const intIdx = html.indexOf('areainternac');
  const section = html.substring(intIdx, intIdx + 3000);
  console.log('Area internac section:');
  console.log(section.substring(0, 1500));
  
  // Look for the internacional input (might be hidden/dynamic)
  const intlInput = html.match(/name="internacional"[^>]*/);
  console.log('\nInternacional input:', intlInput ? intlInput[0] : 'not found');
  
  // Try direct URL with pais filter
  const urls = [
    'http://directorio.camaras.org/index.php?pagina=1&impexp=EI&anno=23&tramo=03&areainternac=PS&internacional=156',  // China ISO numeric
    'http://directorio.camaras.org/index.php?pagina=1&impexp=EI&anno=23&tramo=03&areainternac=PS&internacional=CN',   // China ISO alpha
    'http://directorio.camaras.org/index.php?pagina=1&impexp=EI&anno=23&tramo=03&areainternac=PS&internacional=CHINA',
  ];
  
  for (const url of urls) {
    const h = await fetch(url);
    const count = h.match(/(\d[\d.]+)\s*empresas encontradas/);
    console.log(`URL param: ${url.split('internacional=')[1]} => ${count ? count[1] : 'no count'} companies`);
  }
}

main().catch(console.error);
