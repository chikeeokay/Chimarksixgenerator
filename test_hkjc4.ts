import fetch from "node-fetch";

async function run() {
    try {
        const hkjcRes = await fetch('https://bet.hkjc.com/marksix/getJSON.aspx?Language=en', {
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
