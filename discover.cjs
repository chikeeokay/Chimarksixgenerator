const fs = require('fs');

try {
  if (fs.existsSync('/app/applet/package.json')) {
    console.log("Found package.json in /app/applet/. Contents:");
    console.log(fs.readFileSync('/app/applet/package.json', 'utf8').slice(0, 300));
  } else {
    console.log("No package.json in /app/applet/");
  }
} catch (e) {
  console.log("Error checking /app/applet/package.json:", e.message);
}
