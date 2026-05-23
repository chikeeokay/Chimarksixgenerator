import fetch from "node-fetch";

async function run() {
  const res = await fetch("http://localhost:3000/api/marksix");
  const data = await res.json();
  console.log(data);
}
run();
