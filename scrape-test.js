const http = require('http');

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  const html = await fetch('http://directorio.camaras.org/');
  
  // Find form action
  const formMatch = html.match(/form[^>]*action=["']([^"']*)["']/);
  console.log('Form action:', formMatch ? formMatch[1] : 'not found');
  
  // Find all select names
  const selects = [...html.matchAll(/select[^>]*name=["']([^"']*)["']/g)];
  console.log('Select names:', selects.map(s => s[1]));
  
  // Find internacional select options
  const intlIdx = html.indexOf('internacional');
  if (intlIdx > -1) {
    const section = html.substring(intlIdx, intlIdx + 5000);
    const options = [...section.matchAll(/option[^>]*value=["']([^"']*)["'][^>]*>([^<]*)/g)];
    console.log('\nInternational area options:');
    options.slice(0, 40).forEach(o => console.log(`  ${o[1]} = ${o[2].trim()}`));
  }
  
  // Find hidden inputs
  const hiddens = [...html.matchAll(/input[^>]*type=["']hidden["'][^>]*name=["']([^"']*)["'][^>]*value=["']([^"']*)["']/g)];
  console.log('\nHidden inputs:', hiddens.map(h => `${h[1]}=${h[2]}`));
  
  // Try fetching page 2 with China filter
  // First let's see what the form URL looks like
  const links = [...html.matchAll(/href=["']([^"']*pagina[^"']*)["']/g)];
  console.log('\nPagination links:', links.map(l => l[1]).slice(0, 5));
}

main().catch(console.error);
