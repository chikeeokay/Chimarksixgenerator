import * as cheerio from "cheerio";
import fetch from "node-fetch";

async function run() {
    try {
      const response = await fetch('https://marksixinfo.com/latest20draws');
      if (!response.ok) {
        throw new Error(`Failed to fetch from marksixinfo.com: ${response.status}`);
      }
      const html = await response.text();
      const $ = cheerio.load(html);
      
      const numDivs: number[] = [];
      $('*').each((i, el) => {
        const text = $(el).text().trim();
        if (/^\d{1,2}$/.test(text) && $(el).children().length === 0) {
          const num = parseInt(text, 10);
          if (num >= 1 && num <= 49) {
            numDivs.push(num);
          }
        }
      });
      
      const dateTextRegex = /\d{4}-\d{2}-\d{2}/;
      const allTexts = $('*').map((i, el) => $(el).text().trim()).get();
      const dates = allTexts.filter(text => dateTextRegex.test(text)).filter(text => text.length === 10); // Find YYYY-MM-DD
      const uniqueDates = [...new Set(dates)].map(d => {
        const parts = d.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return d;
      });

      // Each draw consists of 7 numbers (6 normal + 1 special)
      const draws: {numbers: number[], date: string}[] = [];
      const seen = new Set<string>();

      for (let i = 0; i < numDivs.length; i += 7) {
        if (i + 7 <= numDivs.length) {
          const draw = numDivs.slice(i, i + 7);
          const drawStr = draw.join(',');
          if (!seen.has(drawStr)) {
            seen.add(drawStr);
            const date = uniqueDates[draws.length] || "";
            draws.push({numbers: draw, date});
          }
        }
      }
      
      console.log(draws);
    } catch(err) {
        console.error(err);
    }
}
run();
