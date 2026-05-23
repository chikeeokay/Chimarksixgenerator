import fetch from "node-fetch";

async function run() {
  const res = await fetch("https://on99.life/lottery/history/2026");
  const text = await res.text();
  console.log("on99 html length:", text.length);
  const nextJson = text.substring(0, 5000); // just checking head
}
run();
