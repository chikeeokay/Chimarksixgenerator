import * as cheerio from "cheerio";

async function run() {
    try {
        const response = await fetch('https://marksixinfo.com/');
        const html = await response.text();
        const $ = cheerio.load(html);
        
        console.log("Found title:", $('title').text());
        console.log("Body length:", html.length);
        
        const possibleDates = $('*').map((i, el) => $(el).text().trim()).get().filter(t => /2026-/.test(t) || /26\//.test(t)).slice(0, 20);
        console.log("Possible dates/draw numbers:", possibleDates);
    } catch(e) {
        console.error(e);
    }
}
run();
