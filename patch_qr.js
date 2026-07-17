import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace(/<QRCodeSVG ([^>]*?) size=\{150\}/g, '<QRCodeSVG $1 size={200}');
content = content.replace(/<QRCodeSVG ([^>]*?) size=\{160\}/g, '<QRCodeSVG $1 size={200}');
fs.writeFileSync('src/App.tsx', content);
console.log('Successfully patched QR sizes');
