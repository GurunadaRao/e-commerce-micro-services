const { Buffer } = require('buffer');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkUrl(url, options = {}, expectText = null) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP status ${res.status}` };
    }
    const text = await res.text();
    if (expectText && !text.includes(expectText)) {
      return { ok: false, error: `Expected text "${expectText}" not found in response` };
    }
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function verifyAll(maxAttempts = 30, intervalMs = 3000) {
  const targets = {
    Mimir: { url: 'http://127.0.0.1:9009/ready', expectText: 'ready' },
    Loki: { url: 'http://127.0.0.1:3100/ready', expectText: 'ready' },
    Tempo: { url: 'http://127.0.0.1:3200/ready', expectText: 'ready' },
    GrafanaHealth: { url: 'http://127.0.0.1:3000/api/health' }
  };

  const authHeader = 'Basic ' + Buffer.from('admin:admin').toString('base64');
  const grafanaDatasourcesUrl = 'http://127.0.0.1:3000/api/datasources';

  console.log('Starting LGTM stack verification...');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`\nAttempt ${attempt}/${maxAttempts}: Checking health endpoints...`);
    const results = {};
    let allHealthy = true;

    for (const [name, target] of Object.entries(targets)) {
      const res = await checkUrl(target.url, {}, target.expectText);
      results[name] = res;
      if (!res.ok) {
        allHealthy = false;
        console.log(`  [-] ${name} is NOT healthy yet (Error: ${res.error})`);
      } else {
        console.log(`  [+] ${name} is HEALTHY`);
      }
    }

    if (allHealthy) {
      console.log('\nAll core service health endpoints are healthy! Verifying Grafana datasources...');
      const dsRes = await checkUrl(grafanaDatasourcesUrl, {
        headers: { 'Authorization': authHeader }
      });

      if (!dsRes.ok) {
        console.log(`  [-] Failed to fetch Grafana datasources: ${dsRes.error}`);
      } else {
        try {
          const datasources = JSON.parse(dsRes.text);
          const dsNames = datasources.map(ds => ds.name);
          const dsTypes = datasources.map(ds => ds.type);
          
          console.log(`  [+] Found Grafana datasources:`, datasources.map(d => `${d.name} (${d.type})`));
          
          const hasMimir = dsNames.includes('Mimir') && dsTypes.includes('prometheus');
          const hasLoki = dsNames.includes('Loki') && dsTypes.includes('loki');
          const hasTempo = dsNames.includes('Tempo') && dsTypes.includes('tempo');

          if (hasMimir && hasLoki && hasTempo) {
            console.log('\n=============================================');
            console.log('🎉 SUCCESS: All LGTM services are healthy!');
            console.log('🎉 Grafana datasources (Mimir, Loki, Tempo) are fully provisioned.');
            console.log('=============================================');
            process.exit(0);
          } else {
            console.log('  [-] Missing some required datasources. Retrying...');
          }
        } catch (e) {
          console.log(`  [-] Failed to parse Grafana datasources JSON: ${e.message}`);
        }
      }
    }

    await sleep(intervalMs);
  }

  console.error('\n❌ ERROR: Timed out waiting for all services to become healthy.');
  process.exit(1);
}

verifyAll();
