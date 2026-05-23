import fetch from "node-fetch";

async function run() {
  const res = await fetch("https://on99.life/lottery");
  const text = await res.text();
  const idx = text.indexOf('{"props":{');
  if (idx !== -1) {
      console.log(text.substring(idx - 100, idx + 100));
  }
  const nextDrawIdx = text.indexOf('nextDrawId');
  if (nextDrawIdx !== -1) {
      console.log(text.substring(nextDrawIdx - 50, nextDrawIdx + 150));
  }
}
run();
