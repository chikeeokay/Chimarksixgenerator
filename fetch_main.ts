import fetch from "node-fetch";
import fs from "fs";

async function run() {
  const htmlRes = await fetch("https://bet.hkjc.com/ch/marksix");
  const html = await htmlRes.text();
  const scriptLinks = html.match(/<script.*?src="(.*?)".*?>/gi) || [];
  let mainJs = "";
  for (const s of scriptLinks) {
       if (s.includes("main.")) {
           const urlMatch = s.match(/src="(.*?)"/);
           if (urlMatch) {
               mainJs = urlMatch[1];
           }
       }
  }
  
  if (mainJs) {
      console.log("Fetching " + mainJs);
      const res = await fetch("https://bet.hkjc.com" + mainJs);
      const text = await res.text();
      fs.writeFileSync('hkjc_main.js', text);
      console.log("Written to hkjc_main.js, length " + text.length);
  }
}
run();
