import fetch from "node-fetch";
import * as cheerio from "cheerio";

async function run() {
  const response = await fetch(`https://on99.life/lottery/history/2026`);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  let allScriptSources = '';
  $('script').each((i, el) => {
      const text = $(el).html();
      if (text && text.includes('__next_f')) {
          allScriptSources += text;
      }
  });
  const resultsIdx = allScriptSources.indexOf('\\"results\\":[');
  const startStr = allScriptSources.slice(resultsIdx + '\\"results\\":'.length);
  const match = startStr.match(/^(\[.*?\]\]\}),\\"cacheStrategy\\"/);
  let resultsStr = '[]';
  if (match) {
     resultsStr = match[1];
  } else {
     let openBracket = 0;
     let inString = false;
     let escape = false;
     for (let i = 0; i < startStr.length; i++) {
         const char = startStr[i];
         if (escape) {
             escape = false;
             continue;
         }
         if (char === '\\') { // <--- THIS is bugged in server.ts! `\\` was in text representation, but in actual JS string we need to check `\\` then `\"`...
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
  }

  // Then unescape backslashes...
  const cleanedStr = resultsStr.replace(/\\"/g, '"');
  try {
     console.log("Parsing: ", cleanedStr.substring(0, 100));
     const parsed = JSON.parse(cleanedStr);
     console.log("Success! Array length:", parsed.length);
  } catch(e) {
     console.error("FAIL:", e);
     console.log("Failing string:", cleanedStr.substring(0, 500));
  }
}
run();
