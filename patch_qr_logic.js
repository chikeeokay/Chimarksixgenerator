import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Remove compressSingleBetsToBankerLegs call from parseQRData
content = content.replace(
  /return compressSingleBetsToBankerLegs\(valid\);/g,
  'return valid;'
);

// 2. Remove compressSingleBetsToBankerLegs call from parseApiBets
content = content.replace(
  /return compressSingleBetsToBankerLegs\(valid\);/g,
  'return valid;'
);

fs.writeFileSync('src/App.tsx', content);
console.log('Successfully removed compressSingleBetsToBankerLegs');
