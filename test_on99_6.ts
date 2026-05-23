import fetch from "node-fetch";

async function run() {
  const res = await fetch("https://on99.life/lottery/history/2026");
  const html = await res.text();
  console.log("HTML length:", html.length);
  // find exactly what dates are in there
  const matches = html.match(/"drawDate":"2026-05-\d\d"/g);
  if (matches) {
      console.log([...new Set(matches)]);
  }
}
run();
