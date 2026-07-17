import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Helper to determine if we should skip QR
const skipQRSnippet = `
      let shouldSkipQR = false;
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

// Patch 1: processScreenshotForRegenerate
content = content.replace(
  /const qrParsed = parseQRData\(qrData\);\s*let qrValidBets = qrParsed;\s*if \(qrValidBets\.length > 0\) \{/m,
  `      let shouldSkipQR = false;
      if (qrData) {
        try {
          const parsedRaw = JSON.parse(qrData);
          const isOldFormat = Array.isArray(parsedRaw) && parsedRaw.every((val: any) => Array.isArray(val));
          if (isOldFormat && parsedRaw.length > 5) {
            shouldSkipQR = true;
          }
        } catch(e) {}
      }

      const qrParsed = parseQRData(qrData);
      let qrValidBets = qrParsed;
      
      if (!shouldSkipQR && qrValidBets.length > 0) {`
);

// Patch 2: handleCheckScreenshot
content = content.replace(
  /const qrParsed = parseQRData\(qrData\);\s*let qrValidBets = expandBetsToSingle\(qrParsed\);\s*if \(qrValidBets\.length > 0\) \{/m,
  `      let shouldSkipQR = false;
      if (qrData) {
        try {
          const parsedRaw = JSON.parse(qrData);
          const isOldFormat = Array.isArray(parsedRaw) && parsedRaw.every((val: any) => Array.isArray(val));
          if (isOldFormat && parsedRaw.length > 5) {
            shouldSkipQR = true;
          }
        } catch(e) {}
      }

      const qrParsed = parseQRData(qrData);
      let qrValidBets = expandBetsToSingle(qrParsed);
      
      if (!shouldSkipQR && qrValidBets.length > 0) {`
);

// Patch 3: handleFileUpload (backtest)
// There are two file upload handlers in the backtest... wait, handleFileUpload is in useEffect or where?
