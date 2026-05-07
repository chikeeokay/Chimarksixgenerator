import fetch from "node-fetch";

async function run() {
    try {
        const response = await fetch('https://marksixinfo.com/_nuxt/builds/meta/...');
        // Let's just find the API from nuxt data if possible.
        // Actually, the nuxt payload might have the history!
        // It was in the body of test_marksixinfo.ts! 
    } catch(e) {
    }
}
