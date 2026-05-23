import fetch from "node-fetch";

async function run() {
  const query = `
    query marksixDraw {
      lotteryDraws {
        drawDate
        status
        lotteryPool {
          jackpot
          derivedFirstPrizeDiv
        }
      }
    }
  `;
  const hkjcRes = await fetch("https://info.cld.hkjc.com/graphql/base/", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({ query, operationName: "marksixDraw" })
  });
  const hkjcData = await hkjcRes.json();
  console.log(JSON.stringify(hkjcData));
}
run();
