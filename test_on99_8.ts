import fetch from "node-fetch";

async function run() {
  const res = await fetch("http://localhost:3000/api/marksix");
  const data = await res.json();
  // check if 2026/05/23 is from mock
  console.log("Draws count:", data.draws.length);
  // Are there draws from 2024? If on99 is failing, it would only be the 413 mock draws.
  const has2024 = data.draws.some((d: any) => d.date.includes('2024'));
  console.log("Has 2024?", has2024);
}
run();
