import fetch from "node-fetch";

async function run() {
  const res = await fetch("https://bet.hkjc.com/ch/marksix");
  const text = await res.text();
  console.log("HTML length: ", text.length);
  // look for next draw info
  const matches = text.match(/<script.*?>(.*?)<\/script>/gi);
  if (matches) {
     for (const m of matches) {
         if (m.includes("buildId") || m.includes("nextDraw") || m.includes("__NEXT_DATA__") || m.length > 500) {
             console.log(m.substring(0, 300));
         }
     }
  }
}
run();
