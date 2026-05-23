import fetch from "node-fetch";

async function run() {
  const res = await fetch("https://bet.hkjc.com/Config/GlobalConfig.js");
  const text = await res.text();
  console.log(text.substring(0, 1000));
}
run();
