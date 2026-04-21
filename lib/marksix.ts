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
  colors?: BallColor[];
  recentMode?: "none" | "exclude" | "include"; // Mode for recent draws
  recentCount?: number; // How many recent draws to consider (1-10)
  recentDraws?: number[][];
  includeSpecial?: boolean; // Whether to include special numbers in recent draws
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
    recentMode = "none",
    recentCount = 5,
    recentDraws = [],
    includeSpecial = true,
  } = options;

  let pool = MARK_SIX_NUMBERS.filter((num) => {
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

  // If pool has less than 6 numbers, we can't generate a valid bet
  if (pool.length < 6) {
    throw new Error(`篩選條件過於嚴格，目前符合條件的號碼只有 ${pool.length} 個，無法生成 6 個號碼。請嘗試：\n1. 擴大號碼範圍\n2. 選擇更多波色\n3. 放寬單雙數限制\n4. 調整近期號碼策略`);
  }

  const bets: number[][] = [];
  const seenBets = new Set<string>();
  let attempts = 0;
  const maxAttempts = count * 100; // Prevent infinite loop

  while (bets.length < count && attempts < maxAttempts) {
    const bet = generateSingleBet(pool);
    const betKey = bet.join(",");
    
    if (!seenBets.has(betKey)) {
      seenBets.add(betKey);
      bets.push(bet);
    }
    attempts++;
  }

  if (bets.length === 0) {
    throw new Error(`無法生成任何不重複的號碼組合。請嘗試：\n1. 擴大號碼範圍\n2. 選擇更多波色\n3. 放寬單雙數限制\n4. 減少排除的近期期數`);
  } else if (bets.length < count) {
    throw new PartialGenerationError(`篩選條件過於嚴格，目前符合條件的號碼組合不足，只能生成 ${bets.length} 注不重複號碼。請嘗試：\n1. 減少生成注數\n2. 擴大號碼範圍\n3. 選擇更多波色\n4. 放寬單雙數限制`, bets);
  }

  return bets;
}

function generateSingleBet(pool: number[]): number[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 6).sort((a, b) => a - b);
}

// Mock past results (10 draws)
// Updated with real results up to 2026-04-11 (Draw 26/039)
export const MOCK_PAST_RESULTS = [
  [17, 20, 27, 32, 39, 46, 34], // Draw 042 (2026-04-18)
  [6, 12, 14, 28, 44, 46, 15],  // Draw 041 (2026-04-16)
  [8, 19, 22, 33, 44, 46, 18], // Draw 040 (2026-04-14)
  [11, 14, 17, 28, 40, 42, 2], // Draw 039 (2026-04-11)
  [13, 16, 24, 43, 44, 45, 40], // Draw 038 (2026-04-09)
  [8, 23, 25, 29, 33, 34, 49], // Draw 037 (2026-04-07)
  [20, 28, 32, 35, 40, 45, 43], // Draw 036 (2026-04-04)
  [9, 18, 19, 20, 28, 32, 44], // Draw 035 (2026-03-31)
  [11, 21, 26, 27, 42, 45, 19], // Draw 034 (2026-03-28)
  [12, 17, 23, 27, 28, 37, 3], // Draw 033 (2026-03-26)
  [6, 9, 22, 26, 44, 49, 7], // Draw 032 (2026-03-24)
  [5, 9, 11, 18, 23, 47, 24], // Draw 031 (2026-03-21)
  [2, 6, 8, 33, 41, 45, 48], // Draw 030 (2026-03-19)
  [16, 18, 22, 28, 45, 49, 13], // Draw 029 (2026-03-17)
  [7, 13, 14, 16, 26, 30, 34], // Draw 028 (2026-03-12)
  [2, 16, 25, 34, 35, 37, 49], // Draw 027 (2026-03-10)
  [12, 15, 18, 22, 28, 37, 31], // Draw 026 (2026-03-07)
  [4, 18, 24, 31, 42, 46, 11], // Draw 025 (2026-03-05)
  [6, 13, 20, 31, 32, 44, 45], // Draw 024 (2026-03-03)
  [5, 15, 37, 39, 46, 47, 29], // Draw 023 (2026-02-28)
  [6, 13, 15, 19, 38, 42, 34], // Draw 022 (2026-02-26)
  [2, 3, 4, 10, 13, 23, 12], // Draw 021 (2026-02-24)
  [2, 18, 34, 35, 37, 49, 33], // Draw 020 (2026-02-21)
  [8, 28, 33, 36, 37, 46, 4], // Draw 019 (2026-02-15)
  [2, 3, 14, 25, 37, 46, 10], // Draw 018 (2026-02-12)
  [3, 4, 14, 18, 26, 39, 40], // Draw 017 (2026-02-10)
  [12, 22, 28, 32, 37, 44, 20], // Draw 016 (2026-02-07)
  [1, 9, 17, 24, 35, 36, 42], // Draw 015 (2026-02-05)
  [12, 23, 27, 37, 39, 42, 5], // Draw 014 (2026-02-03)
  [25, 30, 32, 35, 36, 47, 46], // Draw 013 (2026-01-31)
  [6, 9, 12, 14, 35, 44, 11], // Draw 012 (2026-01-29)
  [7, 12, 14, 25, 38, 47, 15], // Draw 011 (2026-01-27)
  [6, 16, 17, 22, 28, 48, 45], // Draw 010 (2026-01-24)
  [4, 9, 15, 24, 27, 31, 45], // Draw 009 (2026-01-22)
  [1, 4, 6, 9, 44, 46, 27], // Draw 008 (2026-01-20)
  [5, 12, 15, 23, 27, 42, 46], // Draw 007 (2026-01-17)
  [3, 6, 37, 38, 39, 44, 48], // Draw 006 (2026-01-15)
  [14, 24, 34, 38, 48, 49, 27], // Draw 005 (2026-01-13)
  [3, 16, 20, 22, 24, 37, 42], // Draw 004 (2026-01-10)
  [15, 21, 24, 40, 45, 46, 13], // Draw 003 (2026-01-08)
  [2, 8, 12, 19, 28, 36, 1], // Draw 002 (2026-01-06)
  [2, 10, 13, 16, 20, 21, 14], // Draw 001 (2026-01-03)
  [7, 10, 11, 19, 25, 30, 45], // Draw 134 (2025-12-28)
  [1, 2, 4, 30, 41, 43, 13], // Draw 133 (2025-12-25)
  [9, 17, 27, 34, 39, 47, 46], // Draw 132 (2025-12-21)
  [6, 23, 28, 31, 33, 34, 11], // Draw 131 (2025-12-18)
  [3, 12, 23, 28, 35, 38, 24], // Draw 130 (2025-12-16)
  [10, 17, 19, 28, 45, 49, 1], // Draw 129 (2025-12-13)
  [1, 5, 6, 25, 30, 42, 43], // Draw 128 (2025-12-11)
  [4, 6, 26, 28, 34, 40, 25], // Draw 127 (2025-12-06)
  [1, 2, 3, 4, 5, 6, 7], // Fallback
  [8, 9, 10, 11, 12, 13, 14] // Fallback
];
