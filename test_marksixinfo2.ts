import * as cheerio from "cheerio";
import fetch from "node-fetch";

async function run() {
    try {
        const response = await fetch('https://marksixinfo.com/');
        const html = await response.text();
        const $ = cheerio.load(html);
        
        let nuxtText = "";
        $('script').each((i, el) => {
            const text = $(el).html();
            if (text && text.includes('window.__NUXT__=')) {
                nuxtText = text;
            }
        });
        
        console.log("Length of nuxt:", nuxtText.length);
        if(nuxtText.length > 500) {
            console.log("Snippet:", nuxtText.substring(0, 1000));
        }
        
    } catch(e) {
        console.error(e);
    }
}
run();
