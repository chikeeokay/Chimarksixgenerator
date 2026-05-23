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

  const idx = allScriptSources.indexOf("jackpotAmount");
  if (idx !== -1) {
      console.log(allScriptSources.substring(idx - 100, idx + 100));
  }
}
run();
