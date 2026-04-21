import https from 'https';

https.get('https://bet.hkjc.com/marksix/getJSON.aspx?sd=20250101&ed=20261231', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(data);
  });
}).on('error', (err) => {
  console.error(err);
});
