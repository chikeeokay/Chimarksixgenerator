import fetch from "node-fetch";

async function run() {
  const res = await fetch("https://on99.life/lottery");
  const html = await res.text();
  const scriptRegex = /<script>window\.__initialState=(.*?);<\/script>/;
  // look for any jackpot strings in the document
  const words = html.split(/"/);
  for (let i = 0; i < words.length; i++) {
     if (words[i].includes('0000')) {
         console.log(words.slice(Math.max(i-2, 0), i+3).join(' '));
     }
  }
}
run();
