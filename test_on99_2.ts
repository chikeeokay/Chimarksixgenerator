import fetch from "node-fetch";

async function run() {
  const res = await fetch("https://on99.life/lottery");
  const text = await res.text();
  console.log(text.includes('nextDraw'));
  
  if (text.includes('jackpot')) {
      const idx = text.indexOf('jackpot');
      console.log(text.substring(idx - 100, idx + 100));
  }
}
run();
