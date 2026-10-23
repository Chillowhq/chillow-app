const https = require('https');
const http = require('http');

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    const req = (u.protocol === 'https:' ? https : http).request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function runTests() {
  console.log('=== 1. INFRASTRUCTURE ===');
  for (const path of ['/healthz', '/ready']) {
    try {
      const res = await request('https://api.quickservehq.com' + path);
      console.log('GET ' + path + ' -> Status:', res.statusCode, 'Body:', res.body.trim());
    } catch (e) {
      console.log('GET ' + path + ' ERROR:', e.message);
    }
  }

  console.log('\n=== 2. FRONTEND ===');
  for (const path of ['/', '/login']) {
    try {
      const res = await request('https://app.quickservehq.com' + path);
      console.log('GET https://app.quickservehq.com' + path + ' -> Status:', res.statusCode, 'Location:', res.headers.location || 'N/A', 'Content-Type:', res.headers['content-type']);
    } catch (e) {
      console.log('GET https://app.quickservehq.com' + path + ' ERROR:', e.message);
    }
  }

  console.log('\n=== 3 & 4. CORS & PREFLIGHT ===');
  try {
    const corsOpts = {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://app.quickservehq.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type'
      }
    };
    const preflightLogin = await request('https://api.quickservehq.com/auth/login', corsOpts);
    console.log('OPTIONS /auth/login Status:', preflightLogin.statusCode);
    console.log('Access-Control-Allow-Origin:', preflightLogin.headers['access-control-allow-origin']);
    console.log('Access-Control-Allow-Credentials:', preflightLogin.headers['access-control-allow-credentials']);
    console.log('Access-Control-Allow-Headers:', preflightLogin.headers['access-control-allow-headers']);
  } catch (e) {
    console.log('OPTIONS /auth/login ERROR:', e.message);
  }

  try {
    const meOpts = {
      method: 'GET',
      headers: {
        'Origin': 'https://app.quickservehq.com'
      }
    };
    const meRes = await request('https://api.quickservehq.com/auth/me', meOpts);
    console.log('GET /auth/me Status:', meRes.statusCode);
    console.log('GET /auth/me CORS origin:', meRes.headers['access-control-allow-origin']);
    console.log('GET /auth/me Body:', meRes.body);
  } catch (e) {
    console.log('GET /auth/me ERROR:', e.message);
  }

  console.log('\n=== 12. ROOT DOMAIN ===');
  try {
    const rootRes = await request('https://quickservehq.com');
    console.log('GET https://quickservehq.com Status:', rootRes.statusCode, 'Location:', rootRes.headers.location || 'N/A');
  } catch (e) {
    console.log('GET https://quickservehq.com ERROR:', e.message);
  }
}

runTests();
