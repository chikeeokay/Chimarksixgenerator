import fetch from "node-fetch";
import * as cheerio from "cheerio";

async function run() {
    try {
        const response = await fetch('https://bet.hkjc.com/marksix/index.aspx?lang=en', {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          }
        });
        const html = await response.text();
        const $ = cheerio.load(html);
        
        console.log("Found title:", $('title').text());
        
        // Output some text content to see if the marksix numbers are there
        console.log("Body snippet:", html.substring(0, 1000));
        
        let foundNumbers = $('*').map((i, el) => $(el).text().trim()).get().filter(t => t.includes("Draw Date") || t.includes("Results") || /^[0-9]+$/.test(t));
        // console.log(foundNumbers);
    } catch(e) {
        console.error(e);
    }
}
run();
