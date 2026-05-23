import fetch from "node-fetch";

async function run() {
  const res = await fetch("https://on99.life/lottery/history/2026");
  const html = await res.text();
  const starts = [html.indexOf('2026-05-'), html.indexOf('2026/05/')];
  for (const idx of starts) {
      if (idx !== -1) {
          console.log(html.substring(idx - 20, idx + 20));
      }
  }
  
  // also check how server.ts fails to parse the latest draw maybe? 
  // We saw earlier that `test_local_api.ts` returned `2026/05/23`.
}
run();
