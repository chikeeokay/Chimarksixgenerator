import fetch from "node-fetch";

async function run() {
    try {
        const hkjcRes = await fetch('https://bet.hkjc.com/marksix/getJSON.aspx?sd=20260401&ed=20261231', {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
            "Cookie": "ai_user=...; ai_session=..."
          }
        });
        const text = await hkjcRes.text();
        console.log(text.substring(0, 1000));
    } catch(e) {
        console.error(e);
    }
}
run();
