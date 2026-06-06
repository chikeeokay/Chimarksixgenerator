import fetch from "node-fetch";

async function run() {
  const res = await fetch("http://localhost:3000/api/marksix");
  const data = (await res.json()) as any;
  console.log("SUCCESS:", data.success);
  console.log("NEXT DRAW:", data.nextDraw);
  console.log("TOP 5 DRAWS FROM SERVER:");
  if (data.draws && Array.isArray(data.draws)) {
    console.log(data.draws.slice(0, 5));
  } else {
    console.log(data);
  }
}
run();
