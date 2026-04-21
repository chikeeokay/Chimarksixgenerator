async function run() {
  const res = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent('https://marksixinfo.com/'));
  const html = await res.text();
  console.log(html.slice(0, 500));
}
run();
