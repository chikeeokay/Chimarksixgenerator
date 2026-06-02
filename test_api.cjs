const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function run() {
  try {
    const health = await get('http://localhost:8000/health');
    console.log("Health endpoint status:", health.statusCode, health.data);
  } catch (e) {
    console.log("Health error:", e.message);
  }

  // Try calling other common endpoints or checking if we can see routes
  try {
    const files = await get('http://localhost:8000/files');
    console.log("Files endpoint status:", files.statusCode, files.data);
  } catch (e) {
    console.log("Files error:", e.message);
  }
}

run();
