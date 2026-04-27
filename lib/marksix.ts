export const MARK_SIX_NUMBERS = Array.from({ length: 49 }, (_, i) => i + 1);

export const RED_BALLS = [
  1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45,
];
export const BLUE_BALLS = [
  3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48,
];
export const GREEN_BALLS = [
  5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 46, 49,
];

export type BallColor = "red" | "blue" | "green";

export function getBallColor(num: number): BallColor {
  if (RED_BALLS.includes(num)) return "red";
  if (BLUE_BALLS.includes(num)) return "blue";
  return "green";
}

export interface GenerateOptions {
  count: number; // Number of bets
  ranges?: {start: number, end: number}[]; // Multiple ranges
  onlyOdd?: boolean;
  onlyEven?: boolean;
  preferredOddCount?: number | null; // Exact number of odds requested
  preferredEvenCount?: number | null; // Exact number of evens requested
  colors?: BallColor[];
  colorRatioOption?: number; // Ratio of color1 to color2, from 1 to 5. Means we need colorRatioOption of color2, and (6 - colorRatioOption) of color1
  recentMode?: "none" | "exclude" | "include"; // Mode for recent draws
  recentCount?: number; // How many recent draws to consider (1-10)
  recentDraws?: number[][];
  includeSpecial?: boolean; // Whether to include special numbers in recent draws
  mustInclude?: number[]; // Numbers that MUST be in every generated bet
  excludedNumbers?: number[]; // Numbers that MUST NOT be in generated bet
}

export class PartialGenerationError extends Error {
  partialBets: number[][];
  constructor(message: string, partialBets: number[][]) {
    super(message);
    this.name = "PartialGenerationError";
    this.partialBets = partialBets;
    Object.setPrototypeOf(this, PartialGenerationError.prototype);
  }
}

export function generateBets(options: GenerateOptions): number[][] {
  const {
    count,
    ranges = [{start: 1, end: 49}],
    onlyOdd = false,
    onlyEven = false,
    colors = ["red", "blue", "green"],
    colorRatioOption = 3,
    recentMode = "none",
    recentCount = 5,
    recentDraws = [],
    includeSpecial = true,
    mustInclude = [],
    excludedNumbers = [],
  } = options;

  let pool = MARK_SIX_NUMBERS.filter((num) => {
    // If it's a must include number, we don't strictly apply filters here if we want to force them,
    // but the user expects them to be in the pool or we just inject them later.
    // It's better to just include them forcefully.
    if (mustInclude.includes(num)) return false; // Remove from pool to prevent duplicates when injecting
    if (excludedNumbers.includes(num)) return false; // User explicitly excluded

    const inRange = ranges.some(r => num >= r.start && num <= r.end);
    if (!inRange) return false;
    if (onlyOdd && num % 2 === 0) return false;
    if (onlyEven && num % 2 !== 0) return false;
    if (colors.length > 0 && !colors.includes(getBallColor(num))) return false;
    return true;
  });

  if (recentMode !== "none" && recentDraws.length > 0) {
    const drawsToConsider = recentDraws.slice(0, recentCount).map(draw => includeSpecial ? draw : draw.slice(0, 6));
    const recentNumbers = new Set(drawsToConsider.flat());
    
    if (recentMode === "exclude") {
      pool = pool.filter((num) => !recentNumbers.has(num));
    } else if (recentMode === "include") {
      pool = pool.filter((num) => recentNumbers.has(num));
    }
  }

  // If pool + mustInclude has less than 6 numbers, we can't generate a valid bet
  if (pool.length + mustInclude.length < 6) {
    throw new Error(`篩選條件過於嚴格，目前符合條件的號碼（含必出幸運號碼）只有 ${pool.length + mustInclude.length} 個，無法生成 6 個號碼。請嘗試：\n1. 擴大號碼範圍\n2. 選擇更多波色\n3. 放寬單雙數限制\n4. 調整近期號碼策略`);
  }
  
  if (mustInclude.length > 6) {
    throw new Error(`必出幸運號碼不能超過 6 個`);
  }

  const bets: number[][] = [];
  const seenBets = new Set<string>();
  let attempts = 0;
  const maxAttempts = count * 100; // Prevent infinite loop

  while (bets.length < count && attempts < maxAttempts) {
    const bet = generateSingleBet(pool, mustInclude);
    const betKey = bet.join(",");
    
    // Check preferred odds/evens count
    const oddCount = bet.filter(n => n % 2 !== 0).length;
    const evenCount = bet.filter(n => n % 2 === 0).length;
    
    let validCounts = true;
    if (options.preferredOddCount !== undefined && options.preferredOddCount !== null && oddCount !== options.preferredOddCount) {
        validCounts = false;
    }
    if (options.preferredEvenCount !== undefined && options.preferredEvenCount !== null && evenCount !== options.preferredEvenCount) {
        validCounts = false;
    }

    if (colors.length === 2 && options.colorRatioOption) {
      const color2Count = bet.filter(n => getBallColor(n) === colors[1]).length;
      if (color2Count !== options.colorRatioOption) {
        validCounts = false;
      }
    }

    if (validCounts && !seenBets.has(betKey)) {
      seenBets.add(betKey);
      bets.push(bet);
    }
    attempts++;
  }

  if (bets.length === 0) {
    throw new Error(`無法生成任何不重複的號碼組合。請嘗試：\n1. 擴大號碼範圍\n2. 選擇更多波色\n3. 放寬單雙數限制\n4. 減少排除的近期期數`);
  } else if (bets.length < count) {
    throw new PartialGenerationError(`篩選條件過於嚴格，目前符合條件的號碼組合不足，只能生成 ${bets.length} 注不重複號碼。請嘗試：\n1. 減少生成注數\n2. 放寬篩選限制`, bets);
  }

  return bets;
}

function generateSingleBet(pool: number[], mustInclude: number[] = []): number[] {
  const filteredPool = pool.filter(n => !mustInclude.includes(n));
  const shuffled = [...filteredPool].sort(() => Math.random() - 0.5);
  const selectedNeeded = 6 - mustInclude.length;
  const selected = shuffled.slice(0, selectedNeeded);
  return [...mustInclude, ...selected].sort((a, b) => a - b);
}

// Mock past results
export const MOCK_PAST_RESULTS = [
  { numbers: [17, 20, 27, 32, 39, 46, 34], date: "18/04/2026" },
  { numbers: [6, 12, 14, 28, 44, 46, 15], date: "16/04/2026" },
  { numbers: [8, 19, 22, 33, 44, 46, 18], date: "14/04/2026" },
  { numbers: [11, 14, 17, 28, 40, 42, 2], date: "11/04/2026" },
  { numbers: [13, 16, 24, 43, 44, 45, 40], date: "09/04/2026" },
  { numbers: [8, 23, 25, 29, 33, 34, 49], date: "07/04/2026" },
  { numbers: [20, 28, 32, 35, 40, 45, 43], date: "04/04/2026" },
  { numbers: [9, 18, 19, 20, 28, 32, 44], date: "31/03/2026" },
  { numbers: [11, 21, 26, 27, 42, 45, 19], date: "28/03/2026" },
  { numbers: [12, 17, 23, 27, 28, 37, 3], date: "26/03/2026" },
  { numbers: [6, 9, 22, 26, 44, 49, 7], date: "24/03/2026" },
  { numbers: [5, 9, 11, 18, 23, 47, 24], date: "21/03/2026" },
  { numbers: [2, 6, 8, 33, 41, 45, 48], date: "19/03/2026" },
  { numbers: [16, 18, 22, 28, 45, 49, 13], date: "17/03/2026" },
  { numbers: [7, 13, 14, 16, 26, 30, 34], date: "12/03/2026" },
  { numbers: [2, 16, 25, 34, 35, 37, 49], date: "10/03/2026" },
  { numbers: [12, 15, 18, 22, 28, 37, 31], date: "07/03/2026" },
  { numbers: [4, 18, 24, 31, 42, 46, 11], date: "05/03/2026" },
  { numbers: [6, 13, 20, 31, 32, 44, 45], date: "03/03/2026" },
  { numbers: [5, 15, 37, 39, 46, 47, 29], date: "28/02/2026" },
  { numbers: [6, 13, 15, 19, 38, 42, 34], date: "26/02/2026" },
  { numbers: [2, 3, 4, 10, 13, 23, 12], date: "24/02/2026" },
  { numbers: [2, 18, 34, 35, 37, 49, 33], date: "21/02/2026" },
  { numbers: [8, 28, 33, 36, 37, 46, 4], date: "15/02/2026" },
  { numbers: [2, 3, 14, 25, 37, 46, 10], date: "12/02/2026" },
  { numbers: [3, 4, 14, 18, 26, 39, 40], date: "10/02/2026" },
  { numbers: [12, 22, 28, 32, 37, 44, 20], date: "07/02/2026" },
  { numbers: [1, 9, 17, 24, 35, 36, 42], date: "05/02/2026" },
  { numbers: [12, 23, 27, 37, 39, 42, 5], date: "03/02/2026" },
  { numbers: [25, 30, 32, 35, 36, 47, 46], date: "31/01/2026" },
  { numbers: [6, 9, 12, 14, 35, 44, 11], date: "29/01/2026" },
  { numbers: [7, 12, 14, 25, 38, 47, 15], date: "27/01/2026" },
  { numbers: [6, 16, 17, 22, 28, 48, 45], date: "24/01/2026" },
  { numbers: [4, 9, 15, 24, 27, 31, 45], date: "22/01/2026" },
  { numbers: [1, 4, 6, 9, 44, 46, 27], date: "20/01/2026" },
  { numbers: [5, 12, 15, 23, 27, 42, 46], date: "17/01/2026" },
  { numbers: [3, 6, 37, 38, 39, 44, 48], date: "15/01/2026" },
  { numbers: [14, 24, 34, 38, 48, 49, 27], date: "13/01/2026" },
  { numbers: [3, 16, 20, 22, 24, 37, 42], date: "10/01/2026" },
  { numbers: [15, 21, 24, 40, 45, 46, 13], date: "08/01/2026" },
  { numbers: [2, 8, 12, 19, 28, 36, 1], date: "06/01/2026" },
  { numbers: [2, 10, 13, 16, 20, 21, 14], date: "03/01/2026" },
  { numbers: [7, 10, 11, 19, 25, 30, 45], date: "28/12/2025" },
  { numbers: [1, 2, 4, 30, 41, 43, 13], date: "25/12/2025" },
  { numbers: [9, 17, 27, 34, 39, 47, 46], date: "21/12/2025" },
  { numbers: [6, 23, 28, 31, 33, 34, 11], date: "18/12/2025" },
  { numbers: [3, 12, 23, 28, 35, 38, 24], date: "16/12/2025" },
  { numbers: [10, 17, 19, 28, 45, 49, 1], date: "13/12/2025" },
  { numbers: [1, 5, 6, 25, 30, 42, 43], date: "11/12/2025" },
  { numbers: [4, 6, 26, 28, 34, 40, 25], date: "06/12/2025" },
  { numbers: [2, 9, 14, 22, 35, 41, 11], date: "04/12/2025" },
  { numbers: [3, 8, 15, 29, 36, 44, 2], date: "02/12/2025" },
  { numbers: [5, 12, 18, 25, 33, 49, 17], date: "29/11/2025" },
  { numbers: [1, 7, 21, 28, 38, 45, 9], date: "27/11/2025" },
  { numbers: [4, 11, 16, 23, 31, 40, 15], date: "25/11/2025" },
  { numbers: [6, 13, 19, 27, 34, 42, 5], date: "22/11/2025" },
  { numbers: [2, 10, 20, 30, 39, 47, 12], date: "20/11/2025" },
  { numbers: [8, 14, 22, 29, 37, 46, 3], date: "18/11/2025" },
  { numbers: [3, 9, 17, 25, 32, 43, 21], date: "15/11/2025" },
  { numbers: [5, 15, 24, 33, 41, 48, 7], date: "13/11/2025" },
  { numbers: [1, 12, 18, 26, 35, 44, 10], date: "11/11/2025" },
  { numbers: [7, 16, 21, 28, 36, 49, 4], date: "08/11/2025" },
  { numbers: [4, 13, 23, 31, 38, 45, 19], date: "06/11/2025" },
  { numbers: [2, 11, 19, 27, 34, 42, 6], date: "04/11/2025" },
  { numbers: [6, 14, 20, 29, 37, 46, 8], date: "01/11/2025" },
  { numbers: [3, 9, 18, 25, 33, 41, 12], date: "30/10/2025" },
  { numbers: [5, 15, 22, 30, 39, 48, 1], date: "28/10/2025" },
  { numbers: [8, 17, 24, 32, 40, 47, 14], date: "25/10/2025" },
  { numbers: [1, 10, 19, 26, 35, 43, 2], date: "23/10/2025" },
  { numbers: [4, 12, 21, 28, 36, 45, 9], date: "21/10/2025" },
  { numbers: [7, 18, 22, 25, 33, 41, 13], date: "18/10/2025" },
  { numbers: [2, 14, 20, 27, 34, 48, 5], date: "16/10/2025" },
  { numbers: [6, 11, 19, 29, 37, 42, 8], date: "14/10/2025" },
  { numbers: [3, 15, 24, 30, 39, 46, 1], date: "11/10/2025" },
  { numbers: [5, 13, 21, 28, 35, 49, 10], date: "09/10/2025" },
  { numbers: [9, 17, 23, 31, 40, 44, 4], date: "07/10/2025" },
  { numbers: [1, 10, 26, 32, 38, 47, 12], date: "04/10/2025" },
  { numbers: [4, 16, 22, 29, 36, 45, 2], date: "02/10/2025" },
  { numbers: [8, 14, 20, 25, 33, 43, 7], date: "30/09/2025" },
  { numbers: [2, 12, 19, 28, 37, 41, 6], date: "27/09/2025" },
  { numbers: [6, 15, 24, 31, 40, 48, 3], date: "25/09/2025" },
  { numbers: [5, 11, 18, 27, 35, 46, 9], date: "23/09/2025" },
  { numbers: [3, 17, 21, 30, 39, 44, 1], date: "20/09/2025" },
  { numbers: [7, 13, 23, 32, 38, 49, 4], date: "18/09/2025" },
  { numbers: [1, 9, 20, 26, 34, 42, 10], date: "16/09/2025" },
  { numbers: [4, 14, 25, 29, 36, 47, 8], date: "13/09/2025" },
  { numbers: [2, 16, 22, 28, 37, 45, 5], date: "11/09/2025" },
  { numbers: [8, 12, 19, 31, 40, 43, 7], date: "09/09/2025" },
  { numbers: [6, 18, 24, 30, 35, 41, 3], date: "06/09/2025" },
  { numbers: [1, 10, 15, 22, 31, 42, 5], date: "04/09/2025" },
  { numbers: [3, 11, 20, 28, 34, 45, 8], date: "02/09/2025" },
  { numbers: [7, 15, 24, 30, 39, 46, 2], date: "30/08/2025" },
  { numbers: [2, 13, 21, 27, 35, 48, 6], date: "28/08/2025" },
  { numbers: [5, 12, 19, 26, 33, 44, 1], date: "26/08/2025" },
  { numbers: [8, 16, 25, 32, 40, 49, 4], date: "23/08/2025" },
  { numbers: [4, 14, 23, 29, 38, 47, 9], date: "21/08/2025" },
  { numbers: [1, 10, 18, 28, 36, 45, 3], date: "19/08/2025" },
  { numbers: [6, 17, 22, 31, 41, 46, 7], date: "16/08/2025" },
  { numbers: [3, 11, 20, 27, 35, 43, 2], date: "14/08/2025" },
  { numbers: [2, 15, 24, 33, 42, 49, 5], date: "12/08/2025" },
  { numbers: [8, 14, 21, 30, 38, 47, 6], date: "09/08/2025" },
  { numbers: [4, 12, 19, 26, 34, 45, 1], date: "07/08/2025" },
  { numbers: [7, 16, 25, 32, 40, 48, 9], date: "05/08/2025" },
  { numbers: [1, 10, 23, 29, 37, 46, 4], date: "02/08/2025" },
  { numbers: [5, 13, 22, 28, 36, 44, 8], date: "31/07/2025" },
  { numbers: [2, 11, 18, 27, 35, 41, 3], date: "29/07/2025" },
  { numbers: [6, 17, 24, 31, 39, 49, 7], date: "26/07/2025" },
  { numbers: [3, 14, 21, 30, 38, 45, 2], date: "24/07/2025" },
  { numbers: [8, 15, 23, 29, 37, 48, 5], date: "22/07/2025" },
  { numbers: [1, 12, 19, 26, 34, 42, 6], date: "19/07/2025" },
  { numbers: [4, 10, 20, 32, 40, 46, 9], date: "17/07/2025" },
  { numbers: [7, 16, 25, 33, 41, 47, 1], date: "15/07/2025" },
  { numbers: [2, 11, 22, 28, 36, 45, 8], date: "12/07/2025" },
  { numbers: [5, 13, 24, 31, 38, 49, 3], date: "10/07/2025" },
  { numbers: [9, 17, 21, 30, 35, 44, 7], date: "08/07/2025" },
  { numbers: [3, 14, 23, 27, 39, 48, 4], date: "05/07/2025" },
  { numbers: [1, 12, 19, 29, 37, 43, 6], date: "03/07/2025" },
  { numbers: [8, 15, 20, 32, 41, 46, 2], date: "01/07/2025" },
  { numbers: [4, 11, 22, 26, 34, 45, 9], date: "28/06/2025" },
  { numbers: [6, 16, 25, 31, 40, 42, 5], date: "26/06/2025" },
  { numbers: [2, 10, 23, 30, 38, 47, 1], date: "24/06/2025" },
  { numbers: [7, 13, 21, 28, 35, 49, 8], date: "21/06/2025" },
  { numbers: [5, 14, 18, 27, 36, 44, 3], date: "19/06/2025" },
  { numbers: [9, 17, 24, 33, 41, 48, 4], date: "17/06/2025" },
  { numbers: [3, 12, 19, 29, 37, 45, 6], date: "14/06/2025" },
  { numbers: [1, 15, 22, 31, 40, 46, 2], date: "12/06/2025" },
  { numbers: [8, 11, 20, 28, 34, 42, 9], date: "10/06/2025" },
  { numbers: [4, 16, 23, 30, 39, 47, 5], date: "07/06/2025" },
  { numbers: [6, 13, 21, 26, 35, 49, 7], date: "05/06/2025" },
  { numbers: [2, 10, 25, 32, 38, 44, 3], date: "03/06/2025" },
  { numbers: [5, 14, 18, 27, 36, 48, 1], date: "31/05/2025" },
  { numbers: [7, 17, 24, 33, 41, 45, 8], date: "29/05/2025" },
  { numbers: [1, 12, 19, 29, 37, 43, 6], date: "27/05/2025" },
  { numbers: [3, 15, 22, 31, 40, 46, 9], date: "24/05/2025" },
  { numbers: [8, 11, 20, 28, 34, 42, 2], date: "22/05/2025" },
  { numbers: [4, 16, 23, 30, 39, 47, 5], date: "20/05/2025" },
  { numbers: [6, 13, 21, 26, 35, 49, 7], date: "17/05/2025" },
  { numbers: [2, 10, 25, 32, 38, 44, 3], date: "15/05/2025" },
  { numbers: [5, 14, 18, 27, 36, 48, 1], date: "13/05/2025" },
  { numbers: [7, 17, 24, 33, 41, 45, 8], date: "10/05/2025" },
];
