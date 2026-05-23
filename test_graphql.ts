import fetch from "node-fetch";

async function run() {
  const query = `
    query {
      __schema {
        types {
          name
        }
      }
    }
  `;
  const res = await fetch("https://info.cld.hkjc.com/graphql/base/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query })
  });
  const data = await res.json();
  console.log(data);
}
run();
