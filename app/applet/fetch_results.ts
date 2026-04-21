import https from 'https';

https.get('https://bet.hkjc.com/marksix/getJSON.aspx?sd=20250101&ed=20261231', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  }
}, (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Data:', data.substring(0, 500));
  });
}).on('error', (err) => {
  console.error(err);
});
