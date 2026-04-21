const https = require('https');

https.get('https://www.lotteryextreme.com/hong_kong/mark_six_results', {
  headers: { 'User-Agent': 'Mozilla/5.0' }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const matches = data.match(/<td class="results">.*?<\/td>/gs);
    if (matches) {
       console.log(matches.slice(0, 10).join('\n'));
    } else {
       console.log("No matches");
    }
  });
});
