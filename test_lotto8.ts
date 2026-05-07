import fetch from "node-fetch";
import * as cheerio from "cheerio";
import iconv from "iconv-lite";

async function run() {
    try {
        const response = await fetch('https://www.lotto-8.com/listltohk.asp', {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          }
        });
        const buffer = await response.arrayBuffer();
        const html = iconv.decode(Buffer.from(buffer), 'big5'); // lots of TW sites use big5
        const $ = cheerio.load(html);
        
        console.log("Title:", $('title').text());
        
        let found = $('*').map((i, el) => $(el).text().trim()).get().filter(t => /2026\/05/.test(t) || /2026-05/.test(t) || t.includes("2026"));
        console.log("Found texts:", found.slice(0, 50));
        
    } catch(e) {
        console.error(e);
    }
}
run();
