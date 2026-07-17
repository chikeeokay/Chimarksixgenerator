function getCombinationsCount(n, k) {
  if (k > n || k < 0) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result = (result * (n - i + 1)) / i;
  }
  return result;
}

function compressBets(bets) {
  let uncompressed = [...bets];
  let compressed = [];
  
  // Try to find large banker-leg groups first (max numbers first)
  // We can group bets by their common intersection
  let changed = true;
  while(changed && uncompressed.length > 0) {
    changed = false;
    // Iterate over all possible number of bankers (1 to 5)
    // To maximize compression, we want the largest possible group (most combinations)
    let bestGroup = null;
    let bestGroupIndices = [];
    let maxBets = 1;

    for (let i = 0; i < uncompressed.length; i++) {
      for (let j = i + 1; j < uncompressed.length; j++) {
        const intersection = uncompressed[i].filter(n => uncompressed[j].includes(n));
        const bCount = intersection.length;
        if (bCount >= 1 && bCount <= 5) {
          // Find all bets that contain this intersection
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
               legs: [...uniqueNumbers].filter(n => !intersection.includes(n)).sort((a,b)=>a-b)
             };
             bestGroupIndices = groupIndices;
          }
        }
      }
    }
    
    if (bestGroup && bestGroupIndices.length > 1) {
       compressed.push(bestGroup);
       uncompressed = uncompressed.filter((_, idx) => !bestGroupIndices.includes(idx));
       changed = true;
    }
  }
  
  return { compressed, uncompressed };
}

console.log(compressBets([
  [16, 18, 38, 39, 4, 11],
  [16, 18, 38, 39, 4, 25],
  [16, 18, 38, 39, 4, 32],
  [16, 18, 38, 39, 11, 25],
  [16, 18, 38, 39, 11, 32],
  [16, 18, 38, 39, 25, 32]
]));
