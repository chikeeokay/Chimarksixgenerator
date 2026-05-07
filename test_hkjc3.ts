import fetch from "node-fetch";

async function run() {
    try {
        const hkjcRes = await fetch('https://is.hkjc.com/it/marksix/json/draw.json', {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          }
        });
        const text = await hkjcRes.text();
        console.log(text.substring(0, 500));
        
    } catch(e) {
        console.error(e);
    }
}
run();
