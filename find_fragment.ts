import fs from "fs";
const data = fs.readFileSync("hkjc_main.js", "utf8");

const idx = data.indexOf("fragment lotteryDrawsFragment");
if (idx !== -1) {
    console.log(data.substring(idx, idx + 500));
} else {
    // just search for fragment 
    const matches = data.match(/fragment[^{]*?\{[^}]*?\}/g);
    if (matches) {
       for (const m of matches) {
           if (m.includes("marksix") || m.includes("draw")) {
               console.log(m);
           }
       }
    }
}
