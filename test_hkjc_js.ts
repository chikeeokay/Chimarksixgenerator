import fetch from "node-fetch";

async function run() {
  const res = await fetch("https://bet.hkjc.com/ch/marksix");
  const html = await res.text();

  // Find JS bundles
  const scriptLinks = html.match(/<script.*?src="(.*?)".*?>/gi) || [];
  for (const s of scriptLinks) {
       console.log(s);
  }
}
run();
