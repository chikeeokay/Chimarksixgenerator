import fetch from "node-fetch";
import https from "https";

const agent = new https.Agent({
  rejectUnauthorized: false
});

async function run() {
  const res = await fetch("https://www.lotteryhk.com/marksix", { agent });
  const html = await res.text();
  console.log("HTML length:", html.length);
}
run();
