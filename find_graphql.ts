import fs from "fs";
const data = fs.readFileSync("hkjc_main.js", "utf8");

// find all graphql like strings or anything mentioning "markSix" next draw
const regex = /(query\s+[a-zA-Z0-9_]*\s*\{.*?markSix.*?\})/gi;
let match;
while ((match = regex.exec(data)) !== null) {
  console.log("---- MATCH ----");
  console.log(match[1].substring(0, 1000));
}

const regex2 = /query:([^}]*markSix[^}]*)/gi;
let m2;
while ((m2 = regex2.exec(data)) !== null) {
  console.log("---- MATCH 2 ----");
  console.log(m2[1].substring(0, 1000));
}
