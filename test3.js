
const getCombinationsCount = (n, k) => {
  if (k > n || k < 0) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result = (result * (n - i + 1)) / i;
  }
  return result;
};

function compressSingleBetsToBankerLegs(bets) {
  const isBanker = bets.filter(b => b.isBankerLegs);
  let uncompressed = bets.filter(b => !b.isBankerLegs).map(b => b.numbers);
  const compressed = [];
  
  let changed = true;
  while(changed && uncompressed.length > 0) {
    changed = false;
    let bestGroup = null;
    let bestGroupIndices = [];
    let maxBets = 1;

    for (let i = 0; i < uncompressed.length; i++) {
      for (let j = i + 1; j < uncompressed.length; j++) {
        const intersection = uncompressed[i].filter(n => uncompressed[j].includes(n));
        const bCount = intersection.length;
        if (bCount >= 1 && bCount <= 5) {
          let groupIndices = [];
          let uniqueNumbers = new Set();
          for (let k = 0; k < uncompressed.length; k++) {
            if (intersection.every(n => uncompressed[k].includes(n))) {
              groupIndices.push(k);
              uncompressed[k].forEach(n => uniqueNumbers.add(n));
            }
          }
          
          let lCount = uniqueNumbers.size - bCount;
          let expectedCombinations = getCombinationsCount(lCount, 6 - bCount);
          
          if (groupIndices.length === expectedCombinations && groupIndices.length > maxBets) {
             maxBets = groupIndices.length;
             bestGroup = {
               bankers: intersection.sort((a,b)=>a-b),
               legs: Array.from(uniqueNumbers).filter(n => !intersection.includes(n)).sort((a,b)=>a-b)
             };
             bestGroupIndices = groupIndices;
          }
        }
      }
    }
    
    if (bestGroup && bestGroupIndices.length > 1) {
       compressed.push({
         isBankerLegs: true,
         bankersCount: bestGroup.bankers.length,
         numbers: [...bestGroup.bankers, ...bestGroup.legs]
       });
       uncompressed = uncompressed.filter((_, idx) => !bestGroupIndices.includes(idx));
       changed = true;
    }
  }
  
  return [...isBanker, ...compressed, ...uncompressed.map(numbers => ({ isBankerLegs: false, numbers }))];
}

const getCombos = (arr, k) => {
  if (k === 0) return [[]];
  if (arr.length === 0) return [];
  const [first, ...rest] = arr;
  const combsWithoutFirst = getCombos(rest, k);
  const combsWithFirst = getCombos(rest, k - 1).map(c => [first, ...c]);
  return [...combsWithFirst, ...combsWithoutFirst];
};

const inputBets = [
  { isBankerLegs: true, bankersCount: 4, numbers: [16,18,38,39, 4,11,25,32] },
  { isBankerLegs: true, bankersCount: 3, numbers: [4,18,39, 11,16,25,38] },
  { isBankerLegs: true, bankersCount: 2, numbers: [4,16, 11,25,32,38,39] },
  { isBankerLegs: true, bankersCount: 4, numbers: [11,18,25,39, 4,16,32,38] }
];

let flattened = [];
for (const b of inputBets) {
    const bankers = b.numbers.slice(0, b.bankersCount);
    const legs = b.numbers.slice(b.bankersCount);
    const legCombos = getCombos(legs, 6 - b.bankersCount);
    for (const c of legCombos) {
        flattened.push({ isBankerLegs: false, numbers: [...bankers, ...c].sort((a,b)=>a-b) });
    }
}

// simulate what QR code read would do to flattened bets
console.log(JSON.stringify(compressSingleBetsToBankerLegs(flattened), null, 2));

