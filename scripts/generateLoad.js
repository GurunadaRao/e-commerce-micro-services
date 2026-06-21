const http = require('http');

const GATEWAY_URL = 'http://localhost:3003';
const RUN_DURATION_MS = 30000; // 30 seconds
const CONCURRENCY = 5;

// Helper to make HTTP requests using native fetch or http module
async function makeRequest(url, method, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: data ? JSON.parse(data) : null,
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('🚀 Starting Performance & Scalability Load Generator...');
  console.log(`🔗 Target Gateway: ${GATEWAY_URL}`);
  console.log(`⏱️ Duration: ${RUN_DURATION_MS / 1000}s | Concurrency: ${CONCURRENCY}\n`);

  // 1. Register a test user
  const username = `perfuser_${Math.floor(Math.random() * 100000)}`;
  const password = 'Password123!';
  console.log(`[auth] Registering user: ${username}...`);
  try {
    await makeRequest(`${GATEWAY_URL}/auth/register`, 'POST', {}, {
      username,
      email: `${username}@example.com`,
      password,
    });
    console.log('[auth] Registration successful.');
  } catch (err) {
    console.log('[auth] Registration failed (user may already exist). Proceeding...');
  }

  // 2. Login to get JWT Token
  console.log('[auth] Logging in...');
  const loginRes = await makeRequest(`${GATEWAY_URL}/auth/login`, 'POST', {}, {
    username,
    password,
  });

  if (!loginRes.body || !loginRes.body.token) {
    throw new Error('Failed to obtain JWT auth token. Cannot run load tests.');
  }
  const token = loginRes.body.token;
  const headers = { 'Authorization': `Bearer ${token}` };
  console.log('[auth] Token acquired successfully.');

  // 3. Create dummy products to populate DB and get IDs
  console.log('[product] Creating test products...');
  const productIds = [];
  const dummyProducts = [
    { name: 'Scalability Server', price: 999, description: 'Super fast' },
    { name: 'Ultra Monitor', price: 499, description: '4K IPS screen' },
    { name: 'Mechanical Keyboard', price: 129, description: 'Clicky switch' },
    { name: 'Precision Mouse', price: 89, description: 'Wireless RGB' },
  ];

  for (const prod of dummyProducts) {
    const prodRes = await makeRequest(`${GATEWAY_URL}/products/api/products`, 'POST', headers, prod);
    if (prodRes.statusCode === 201 && prodRes.body && prodRes.body._id) {
      productIds.push(prodRes.body._id);
    }
  }
  console.log(`[product] Seeded ${productIds.length} test products.`);

  if (productIds.length === 0) {
    throw new Error('Could not seed any products. Make sure the database is up.');
  }

  // 4. Start concurrent workers to generate traffic
  const startTime = Date.now();
  let totalRequests = 0;
  let successfulOrders = 0;
  let failedRequests = 0;

  async function worker(workerId) {
    console.log(`[worker ${workerId}] Started.`);
    while (Date.now() - startTime < RUN_DURATION_MS) {
      try {
        // Step A: View products (Read traffic)
        const viewRes = await makeRequest(`${GATEWAY_URL}/products/api/products`, 'GET', headers);
        totalRequests++;
        
        // Step B: Buy products (Write / Messaging / Event-driven traffic)
        // Select random subset of products
        const countToBuy = Math.floor(Math.random() * 2) + 1;
        const selectedIds = [];
        for (let i = 0; i < countToBuy; i++) {
          selectedIds.push(productIds[Math.floor(Math.random() * productIds.length)]);
        }

        const buyRes = await makeRequest(`${GATEWAY_URL}/products/api/products/buy`, 'POST', headers, {
          ids: selectedIds,
          paymentMethod: 'card',
          currency: 'USD',
        });
        totalRequests++;

        if (buyRes.statusCode === 201) {
          successfulOrders++;
        } else {
          failedRequests++;
          console.log(`[worker ${workerId}] Buy request returned status ${buyRes.statusCode}`);
        }

        // Add a micro sleep to space out requests
        await sleep(200);
      } catch (err) {
        failedRequests++;
        console.error(`[worker ${workerId}] Error: ${err.message}`);
        await sleep(1000);
      }
    }
    console.log(`[worker ${workerId}] Finished.`);
  }

  const workers = [];
  for (let i = 1; i <= CONCURRENCY; i++) {
    workers.push(worker(i));
  }

  await Promise.all(workers);

  const durationSec = (Date.now() - startTime) / 1000;
  console.log('\n=============================================');
  console.log('🏁 Load Generation Completed!');
  console.log(`⏱️ Duration: ${durationSec.toFixed(2)}s`);
  console.log(`📊 Total Gateway Requests: ${totalRequests}`);
  console.log(`🛍️ Successful Checkout Flows: ${successfulOrders}`);
  console.log(`⚠️ Failed Requests: ${failedRequests}`);
  console.log(`⚡ Throughput: ${(totalRequests / durationSec).toFixed(2)} req/sec`);
  console.log('=============================================');
  console.log('Check your Grafana dashboard (http://localhost:3000) and RabbitMQ (http://localhost:15672) to see metrics/traces/queues populated!');
}

run().catch(err => {
  console.error('Fatal load generation error:', err);
  process.exit(1);
});
