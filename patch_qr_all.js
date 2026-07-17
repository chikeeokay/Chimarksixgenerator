import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

const replacement = `      let shouldSkipQR = false;
        if (qrData) {
          try {
            const parsedRaw = JSON.parse(qrData);
            const isOldFormat = Array.isArray(parsedRaw) && parsedRaw.every((val: any) => Array.isArray(val));
            if (isOldFormat && parsedRaw.length > 5) {
              shouldSkipQR = true;
            }
          } catch(e) {}
        }
`;

content = content.replace(
  /const qrParsed = parseQRData\(qrData\);\s*let validBets = expandBetsToSingle\(qrParsed\);\s*if \(validBets\.length > 0\) \{/g,
  `${replacement}
        const qrParsed = parseQRData(qrData);
        let validBets = expandBetsToSingle(qrParsed);
        if (!shouldSkipQR && validBets.length > 0) {`
);

content = content.replace(
  /const qrParsed = parseQRData\(qrData\);\s*let fileBets = expandBetsToSingle\(qrParsed\);\s*if \(fileBets\.length > 0\) \{/g,
  `${replacement}
        const qrParsed = parseQRData(qrData);
        let fileBets = expandBetsToSingle(qrParsed);
        if (!shouldSkipQR && fileBets.length > 0) {`
);

content = content.replace(
  /const qrParsed = parseQRData\(qrData\);\s*let qrValidBets = expandBetsToSingle\(qrParsed\);\s*if \(qrValidBets\.length > 0\) \{/g,
  `${replacement}
      const qrParsed = parseQRData(qrData);
      let qrValidBets = expandBetsToSingle(qrParsed);
      if (!shouldSkipQR && qrValidBets.length > 0) {`
);

content = content.replace(
  /const qrParsed = parseQRData\(qrData\);\s*let qrValidBets = qrParsed;\s*if \(qrValidBets\.length > 0\) \{/g,
  `${replacement}
      const qrParsed = parseQRData(qrData);
      let qrValidBets = qrParsed;
      if (!shouldSkipQR && qrValidBets.length > 0) {`
);

fs.writeFileSync('src/App.tsx', content);
console.log('Successfully patched all QR code checks.');
