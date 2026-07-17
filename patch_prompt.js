import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');

const regex = /text: `You are an OCR and data extraction expert[\s\S]*?only the JSON string.`/m;
const newPrompt = `text: \`You are an OCR and data extraction expert extracting lottery bets (Mark Six / 六合彩) from an image. The image may be a physical ticket or a digital app screenshot. IMPORTANT RULES:
1. Identify if a bet is a normal bet (單式) or a "Banker and Legs" bet (膽拖).
2. For the app screenshot, "Banker and Legs" bets show the Banker numbers (膽) inside a yellow highlighted bubble with a small "拖" badge on the bottom right. The Leg numbers (腳) are displayed below them.
3. Return the result STRICTLY as a JSON array of objects.
   - For a normal bet, use this schema: { "isBankerLegs": false, "numbers": [8, 12, 14, 17, 27, 28] }
   - For a Banker and Legs bet, use this schema: { "isBankerLegs": true, "bankersCount": 2, "numbers": [8, 12, 14, 17, 27, 28, 30] } (where the first \\\`bankersCount\\\` numbers in the array MUST be the Bankers from the yellow bubble, and the rest are the Legs).
4. If some rows have fewer than 6 numbers or it's a partial read, capture them in "numbers" anyway.
5. Only use numbers from the image. Do not make up numbers.
6. Do not include any markdown formatting, only the JSON string.\``;

if (regex.test(content)) {
  content = content.replace(regex, newPrompt);
  fs.writeFileSync('server.ts', content);
  console.log('Successfully patched server.ts');
} else {
  console.log('Target not found.');
}
