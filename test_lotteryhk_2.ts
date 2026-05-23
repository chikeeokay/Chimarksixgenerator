import fetch from "node-fetch";

async function run() {
  const res = await fetch("https://www.lotteryhk.com/marksix");
  const html = await res.text();
  console.log("HTML length:", html.length);
  // Just dump out some lines containing 2026
  const lines = html.split('\n');
  for (let i = 0; i < lines.length; i++) {
     if (lines[i].includes('2026')) {
         console.log(lines.slice(Math.max(i-2, 0), i+3).join('\n').trim());
     }
  }
}
run();
