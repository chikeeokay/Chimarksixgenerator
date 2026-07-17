function getCombinationsCount(n, k) {
  if (k > n || k < 0) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result = (result * (n - i + 1)) / i;
  }
  return result;
}

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

const bets = [
  { numbers: [1, 2, 3, 4, 5, 6], isBankerLegs: false },
  { numbers: [1, 2, 3, 4, 5, 7], isBankerLegs: false },
  { numbers: [1, 2, 3, 4, 5, 8], isBankerLegs: false },
  { numbers: [1, 2, 3, 4, 5, 9], isBankerLegs: false }
];

console.log(JSON.stringify(compressSingleBetsToBankerLegs(bets), null, 2));
const bets2 = [
  { isBankerLegs: true, bankersCount: 4, numbers: [16,18,38,39,4,11,25,32] }
];
console.log(JSON.stringify(compressSingleBetsToBankerLegs(bets2), null, 2));

const qrData = JSON.stringify([
  { isBankerLegs: true, bankersCount: 4, numbers: [16,18,38,39,4,11,25,32] },
  { isBankerLegs: true, bankersCount: 3, numbers: [4,18,39,11,16,25,38] },
  { isBankerLegs: true, bankersCount: 2, numbers: [4,16,11,25,32,38,39] },
  { isBankerLegs: true, bankersCount: 4, numbers: [11,18,25,39,4,16,32,38] }
]);

function parseQRData(qrData) {
  if (!qrData) return [];
  try {
    const parsed = JSON.parse(qrData);
    if (!Array.isArray(parsed)) return [];
    const valid = [];
    for (const val of parsed) {
       if (Array.isArray(val) && val.length === 6 && val.every((n) => typeof n === 'number' && n >= 1 && n <= 49)) {
         valid.push({ numbers: val, isBankerLegs: false });
       } else if (val && typeof val === 'object' && Array.isArray(val.numbers) && val.numbers.every((n) => typeof n === 'number' && n >= 1 && n <= 49)) {
         valid.push(val);
       }
    }
    return compressSingleBetsToBankerLegs(valid);
  } catch(e) {
    return [];
  }
}

console.log(JSON.stringify(parseQRData(qrData), null, 2));

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

const bets = [
  [16, 18, 38, 39, 4, 11],
  [16, 18, 38, 39, 4, 25],
  [16, 18, 38, 39, 4, 32],
  [16, 18, 38, 39, 11, 25],
  [16, 18, 38, 39, 11, 32],
  [16, 18, 38, 39, 25, 32]
].map(numbers => ({ isBankerLegs: false, numbers }));

console.log(JSON.stringify(compressSingleBetsToBankerLegs(bets), null, 2));

