export {};
async function main() {
  const res = await fetch('http://localhost:3000/api/marksix');
  const data = await res.json();
  const draws = data.draws;
  const currentDraw = draws[0];
  const winningNums = currentDraw.numbers.slice(0, 6);
  const past5Draws = draws.slice(1, 6);
  const past5Nums = new Set(past5Draws.flatMap((d: any) => d.numbers.slice(0, 6)));
  const recentMatches5 = winningNums.filter((n: number) => past5Nums.has(n)).length;
  console.log('recentMatches5', recentMatches5);
  console.log('winningNums', winningNums);
  console.log('past5Draws nums', past5Draws.map((d: any) => d.numbers.slice(0, 6)));
}
main();
