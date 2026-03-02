const http = require('http');

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function main() {
  // Get full HTML source
  const res = await fetch('http://directorio.camaras.org/');
  console.log('Status:', res.status);
  console.log('Content length:', res.body.length);
  
  // Print raw HTML structure (first 3000 chars)
  console.log('\n--- RAW HTML (first 3000) ---');
  console.log(res.body.substring(0, 3000));
  
  console.log('\n--- FORMS ---');
  const forms = res.body.match(/<form[\s\S]*?<\/form>/gi);
  if (forms) {
    forms.forEach((f, i) => {
      console.log(`Form ${i}: ${f.substring(0, 500)}`);
    });
  }
  
  // Look for AJAX/API endpoints
  console.log('\n--- SCRIPTS ---');
  const scripts = [...res.body.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
  scripts.forEach((s, i) => {
    const content = s[1].trim();
    if (content.length > 0 && content.length < 2000) {
      console.log(`Script ${i}: ${content.substring(0, 500)}`);
    }
  });
}

main().catch(console.error);
