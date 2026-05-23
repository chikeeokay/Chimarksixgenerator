import fs from "fs";

const data = fs.readFileSync("hkjc_main.js", "utf8");

// Extract the exact marksixDraw query string
const matches = [...data.matchAll(/(query marksixDraw \{.*?lotteryDrawsFragment\n\s*\})/gs)];
if (matches.length > 0) {
    let q = matches[0][1];
    // extract fragment
    const fragMatch = data.match(/fragment lotteryDrawsFragment on LotteryDraw \{.*?\}/s);
    if (fragMatch) {
        q += "\\n" + fragMatch[0];
    }
    console.log(q);
}
