import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /function compressSingleBetsToBankerLegs[\s\S]*?return \[\.\.\.isBanker, \.\.\.compressed, \.\.\.uncompressed\.map\(numbers => \(\{ isBankerLegs: false, numbers \}\)\)\];\n\}/m;

if (regex.test(content)) {
  content = content.replace(regex, '');
  fs.writeFileSync('src/App.tsx', content);
  console.log('Successfully removed compressSingleBetsToBankerLegs');
} else {
  console.log('Target not found.');
}
