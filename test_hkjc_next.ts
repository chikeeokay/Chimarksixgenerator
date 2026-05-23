import fetch from "node-fetch";

async function run() {
  const res = await fetch("https://bet.hkjc.com/marksix/getJSON.aspx?snam=DailyMarkSixData");
  const text = await res.text();
  console.log(text.substring(0, 500));
}
run();
