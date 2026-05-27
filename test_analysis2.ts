import fetch from 'node-fetch';
async function main() {
  const res = await fetch('http://localhost:3000/api/marksix');
  const data = await res.json();
  const draws = data.draws;
  console.log("Latest draw:", draws[0].date, draws[0].numbers);
  console.log("Past 1:", draws[1].date, draws[1].numbers);
  console.log("Past 2:", draws[2].date, draws[2].numbers);
  console.log("Past 3:", draws[3].date, draws[3].numbers);
  console.log("Past 4:", draws[4].date, draws[4].numbers);
  console.log("Past 5:", draws[5].date, draws[5].numbers);
  console.log("Past 6:", draws[6].date, draws[6].numbers);
  
  const currentDraw = draws[0];
  const winningNums = currentDraw.numbers.slice(0, 6);
  const past5Draws = draws.slice(1, 6);
  const past5Nums = new Set(past5Draws.flatMap((d: any) => d.numbers.slice(0, 7))); // with special
  const recentMatches5 = winningNums.filter((n: number) => past5Nums.has(n)).length;
  console.log('recentMatches5 with special:', recentMatches5);

  const past5NumsNoSpec = new Set(past5Draws.flatMap((d: any) => d.numbers.slice(0, 6))); // without special
  const recentMatches5NoSpec = winningNums.filter((n: number) => past5NumsNoSpec.has(n)).length;
  console.log('recentMatches5 without special:', recentMatches5NoSpec);
}
main();
