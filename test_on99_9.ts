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
  console.log("Found __next_f:", allScriptSources.length);
  const resultsIdx = allScriptSources.indexOf('\\"results\\":[');
  console.log("resultsIdx:", resultsIdx);
}
run();
