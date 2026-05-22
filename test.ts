import fetch from "node-fetch";
import * as cheerio from "cheerio";

async function run() {
    const res = await fetch("https://on99.life/lottery/history/2026");
    const html = await res.text();
    const $ = cheerio.load(html);
    
    let allScriptSources = '';
    $('script').each((i, el) => {
        const text = $(el).html();
        if (text && text.includes('__next_f')) {
            allScriptSources += text;
        }
    });

    const idx = allScriptSources.indexOf('\\"results\\":[');
    if (idx !== -1) {
    console.log("Found escaped substring:", allScriptSources.slice(idx, idx + 500));
    // let's grab the array
    const startIdx = idx + '\\"results\\":'.length;
    const startStr = allScriptSources.slice(startIdx);
    
    let openBracket = 0;
     let inString = false;
     let escape = false;
     let resultsStr = '[]';
     for (let i = 0; i < startStr.length; i++) {
         const char = startStr[i];
         if (escape) {
             escape = false;
             continue;
         }
         if (char === '\\') { // wait, in JS, literal backslash is '\\'. Let's just track backslash. I'll just adjust the snippet.
             escape = true;
             continue;
         }
         if (char === '"') {
             inString = !inString;
             continue;
         }
         if (!inString) {
             if (char === '[') openBracket++;
             else if (char === ']') openBracket--;
         }
         if (openBracket === 0 && char === ']') {
             resultsStr = startStr.slice(0, i + 1);
             break;
         }
     }
     
     console.log("Extracted: ", resultsStr.slice(0, 50));
     
     try {
       const cleaned = JSON.parse('"' + resultsStr + '"');
       console.log("JSON.parse string wrap cleaned: ", cleaned.slice(0, 50));
       JSON.parse(cleaned);
       console.log("Success with JSON.parse string wrap");
     } catch (e) {
       console.error("JSON.parse string wrap failed", e.message);
     }
     
     try {
       const cleaned = resultsStr.replace(/\\\\"/g, '"');
       console.log("server.ts cleaned: ", cleaned.slice(0, 50));
       JSON.parse(cleaned);
       console.log("Success with server.ts regex");
     } catch (e) {
       console.error("server.ts regex failed", e.message);
     }
    } else {
        console.log("Not found.");
    }
}
run();
