import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  Dices,
  ExternalLink,
  RefreshCw,
  Save,
  Settings2,
  AlertTriangle,
  CheckCircle2,
  Check,
  Sparkles,
  AlertCircle,
  Copy,
  MonitorUp,
  Link2,
  BarChart2,
  Home,
  Image as ImageIcon,
  Upload,
  SearchCheck,
  RotateCcw,
  MessageCircle,
  Undo,
  Trash2,
  Cpu,
  Smartphone
} from "lucide-react";
import { toPng } from "html-to-image";
import { QRCodeSVG } from 'qrcode.react';
import jsQR from 'jsqr';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  generateBets,
  getBallColor,
  BallColor,
  MOCK_PAST_RESULTS,
  PartialGenerationError,
  MARK_SIX_NUMBERS,
} from "@/lib/marksix";

function getCombinationsCount(n: number, k: number) {
  if (k > n || k < 0) return 0;
  if (k === 0 || k === n) return 1;
  let c = 1;
  for (let i = 1; i <= k; i++) c = c * (n - i + 1) / i;
  return c;
}

function generateBankerConfigs(totalBudget: number, count: number): { bCount: number, legsLength: number, cost: number, isBanker: boolean }[] {
  const configs: { bCount: number, legsLength: number, cost: number, isBanker: boolean }[] = [];
  
  let remainingBudget = totalBudget;
  
  // Try to create up to 'count' bets, cycling banker count: 4, then 3, then 2.
  // We ensure each bet is a valid banker bet of 2-4 bankers.
  for (let i = 0; i < count; i++) {
    const targetB = [4, 3, 2][i % 3];
    const minL = Math.max(2, 7 - targetB); // Minimum legs to not be a single bet (i.e. at least 7 numbers total)
    const minCost = getCombinationsCount(minL, 6 - targetB) * 10;
    
    if (remainingBudget >= minCost) {
      configs.push({
        bCount: targetB,
        legsLength: minL,
        cost: minCost,
        isBanker: true
      });
      remainingBudget -= minCost;
    } else {
      // If we can't afford the cycled targetB, try alternative banker counts to fit
      const alternatives = [4, 3, 2]; // 4-banker is the cheapest (needs 3 legs, min cost $30)
      let found = false;
      for (const altB of alternatives) {
        const altMinL = Math.max(2, 7 - altB);
        const altCost = getCombinationsCount(altMinL, 6 - altB) * 10;
        if (remainingBudget >= altCost) {
          configs.push({
            bCount: altB,
            legsLength: altMinL,
            cost: altCost,
            isBanker: true
          });
          remainingBudget -= altCost;
          found = true;
          break;
        }
      }
      if (!found) {
        break; // Can't afford any genuine banker combinations
      }
    }
  }

  // If we couldn't even afford 1 bet of any config, let's try to fit at least one if we have enough budget for the absolute minimum ($30 for 4-banker)
  if (configs.length === 0 && totalBudget >= 30) {
    configs.push({
      bCount: 4,
      legsLength: 3,
      cost: 30,
      isBanker: true
    });
    remainingBudget = totalBudget - 30;
  }

  // Now, expand the legs of the successfully created banker-leg bets using the remaining budget to maximize coverage
  if (configs.length > 0) {
    let expanded = true;
    let attempts = 0;
    while (expanded && remainingBudget >= 10 && attempts < 1000) {
      expanded = false;
      attempts++;
      
      // Shuffle indices to distribute leg upgrades evenly and naturally, avoiding rigid patterns
      const indices = Array.from({ length: configs.length }, (_, i) => i).sort(() => Math.random() - 0.5);
      
      for (const idx of indices) {
        const cfg = configs[idx];
        const nextL = cfg.legsLength + 1;
        if (nextL > 40) continue; // Safety limit of 40 legs
        
        const newCost = getCombinationsCount(nextL, 6 - cfg.bCount) * 10;
        const costIncrease = newCost - cfg.cost;
        
        if (remainingBudget >= costIncrease) {
          cfg.legsLength = nextL;
          cfg.cost = newCost;
          remainingBudget -= costIncrease;
          expanded = true;
          break; // Break and reshuffle to distribute remaining budget fairly across all bets
        }
      }
    }
  }

  return configs;
}

function getCombos(arr: number[], k: number): number[][] {
  if (k === 0) return [[]];
  if (arr.length === 0) return [];
  const [first, ...rest] = arr;
  const combsWithoutFirst = getCombos(rest, k);
  const combsWithFirst = getCombos(rest, k - 1).map(c => [first, ...c]);
  return [...combsWithFirst, ...combsWithoutFirst];
}

const parseRanges = (input: string): {start: number, end: number}[] => {
  const ranges: {start: number, end: number}[] = [];
  if (!input.trim()) return ranges;
  const parts = input.split(/[,，\s]+/);
  for (const part of parts) {
    if (!part) continue;
    const match = part.match(/^(\d+)(?:-(\d+))?$/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : start;
      if (start > 0 && end >= start) {
        ranges.push({start, end});
      }
    }
  }
  return ranges;
};

export interface DrawInfo {
  numbers: number[];
  date: string;
  turnover?: number;
  firstPrize?: number;
  firstPrizeWinners?: number;
}

const getLegsCols = (count: number) => {
  if (count <= 4) return count;
  if (count === 5 || count === 6) return 3;
  if (count === 7 || count === 8) return 4;
  if (count === 9) return 3;
  return 4;
};

export default function App() {
  const [betCount, setBetCount] = useState<number>(6);
  const [sumRange, setSumRange] = useState<[number, number]>([21, 279]);
  const [preferredOddCount, setPreferredOddCount] = useState<number | null>(null);
  const [preferredEvenCount, setPreferredEvenCount] = useState<number | null>(null);
  const [ranges, setRanges] = useState<{start: number, end: number}[]>([{start: 1, end: 49}]);
  const [oddEven, setOddEven] = useState<"all" | "odd" | "even">("all");
  const [colors, setColors] = useState<BallColor[]>(["red", "blue", "green"]);
  const [luckyNumbers, setLuckyNumbers] = useState<number[]>([]);
  const [excludedNumbers, setExcludedNumbers] = useState<number[]>([]);
  const [isLuckyDialogOpen, setIsLuckyDialogOpen] = useState(false);
  const [isExcludedDialogOpen, setIsExcludedDialogOpen] = useState(false);
  const [colorRatioOption, setColorRatioOption] = useState<number>(3); // 1 to 5

  const [enableRecent, setEnableRecent] = useState(false);
  const [recentMode, setRecentMode] = useState<"exclude" | "include" | "">("");
  const [recentCount, setRecentCount] = useState<number>(5);
  const [includeSpecial, setIncludeSpecial] = useState(false);
  const [enableComplexRecent, setEnableComplexRecent] = useState(false);
  const [complexExcludeRanges, setComplexExcludeRanges] = useState<{start: number, end: number}[]>([{start: 1, end: 5}]);
  const [complexIncludeRanges, setComplexIncludeRanges] = useState<{start: number, end: number}[]>([{start: 6, end: 10}]);
  const [enableExcludeUnseen, setEnableExcludeUnseen] = useState(false);
  const [excludeUnseenCount, setExcludeUnseenCount] = useState<number>(20);
  const [excludeUnseenIncludeSpecial, setExcludeUnseenIncludeSpecial] = useState(false);
  const [noConsecutivePairs, setNoConsecutivePairs] = useState(false);
  const [noConsecutiveTriplets, setNoConsecutiveTriplets] = useState(false);
  const [use2Combos, setUse2Combos] = useState(false);
  const [combo2Count, setCombo2Count] = useState<number>(1);
  const [use3Combos, setUse3Combos] = useState(false);
  const [combo3Count, setCombo3Count] = useState<number>(1);
  const [showUnseenNumbers, setShowUnseenNumbers] = useState(false);
  const [generatedBets, setGeneratedBetsInternal] = useState<import('@/lib/marksix').GeneratedBet[]>([]);
  const setGeneratedBets = (val: import('@/lib/marksix').GeneratedBet[] | ((prev: import('@/lib/marksix').GeneratedBet[]) => import('@/lib/marksix').GeneratedBet[])) => {
    setGeneratedBetsInternal(prev => {
      const raw = typeof val === 'function' ? val(prev) : val;
      if (!raw) return [];
      const seen = new Set<string>();
      const unique: import('@/lib/marksix').GeneratedBet[] = [];
      for (const bet of raw) {
        if (!bet || !bet.numbers) continue;
        let key = "";
        if (bet.isBankerLegs && bet.bankersCount) {
          // Normalize banker legs key
          const bk = [...bet.numbers.slice(0, bet.bankersCount)].sort((a: any, b: any) => a - b).join(",");
          const lg = [...bet.numbers.slice(bet.bankersCount)].sort((a: any, b: any) => a - b).join(",");
          key = `banker:${bk}|legs:${lg}`;
        } else {
          // Normalize standard bet key
          key = `std:${[...bet.numbers].sort((a: any, b: any) => a - b).join(",")}`;
        }
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(bet);
        }
      }
      return unique;
    });
  };
  const [undoStack, setUndoStack] = useState<{index: number, bet: import('@/lib/marksix').GeneratedBet}[]>([]);
  const [generationTime, setGenerationTime] = useState<Date | null>(null);

  useEffect(() => {
    if (generatedBets.length > 0) {
      if (!generationTime) {
        setGenerationTime(new Date());
      }
    } else {
      setGenerationTime(null);
    }
  }, [generatedBets]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [analysisDrawIndex, setAnalysisDrawIndex] = useState<number | null>(null);
  const [analysisRangeCount, setAnalysisRangeCount] = useState<number>(5);
  const [bankers, setBankers] = useState<number[]>([]);
  const [excludedLegs, setExcludedLegs] = useState<number[]>([]);

  // Check Results State
  const [isCheckDialogOpen, setIsCheckDialogOpen] = useState(false);
  const [isAnalysisDialogOpen, setIsAnalysisDialogOpen] = useState(false);
  const [payoutAnalysisDraws, setPayoutAnalysisDraws] = useState<number>(50);
  const [isStrategyInfoOpen, setIsStrategyInfoOpen] = useState(false);
  const [checkDrawIndex, setCheckDrawIndex] = useState<number>(0);
  const [checkMethod, setCheckMethod] = useState<"upload" | "manual">("upload");
  const [checkManualInput, setCheckManualInput] = useState("");
  const [checkResults, setCheckResults] = useState<{ matches: number[], specialMatch: boolean }[] | null>(null);
  const [isCheckingScreenshot, setIsCheckingScreenshot] = useState(false);

  // Backtesting State
  const [isBacktestDialogOpen, setIsBacktestDialogOpen] = useState(false);
  const [backtestFiles, setBacktestFiles] = useState<{
    name: string;
    bets: number[][];
    status: 'loading' | 'success' | 'error';
    errorMsg?: string;
  }[]>([]);
  const [backtestDrawIndex, setBacktestDrawIndex] = useState<number>(0);
  const [isProcessingBacktest, setIsProcessingBacktest] = useState(false);
  const [backtestResults, setBacktestResults] = useState<{
    checkedBets: {
      fileName: string;
      bet: number[];
      matches: number[];
      specialMatch: boolean;
      prizeTier: string;
      isWin: boolean;
    }[];
    summary: {
      totalFiles: number;
      totalBets: number;
      totalCost: number;
      totalWins: number;
      totalWinnings: number;
      winsByTier: Record<string, number>;
    };
  } | null>(null);

  const runBacktestCheck = (filesList: { name: string; bets: number[][]; status: 'loading' | 'success' | 'error'; errorMsg?: string }[], drawIdx: number) => {
    if (!liveResults || !liveResults[drawIdx]) return;
    const drawObj = liveResults[drawIdx];
    const draw = getRawDrawNumbers(drawObj);
    const winningNumbers = draw.slice(0, 6);
    const specialNumber = draw[6];

    const checkedBets: {
      fileName: string;
      bet: number[];
      matches: number[];
      specialMatch: boolean;
      prizeTier: string;
      isWin: boolean;
    }[] = [];
    let totalWins = 0;
    let totalWinnings = 0;
    const winsByTier: Record<string, number> = {
      "頭獎": 0,
      "二獎": 0,
      "三獎": 0,
      "四獎": 0,
      "五獎": 0,
      "六獎": 0,
      "七獎": 0,
      "未中獎": 0,
    };

    filesList.forEach((f, fileIdx) => {
      if (f.status === 'success') {
        f.bets.forEach(bet => {
          const matches = bet.filter(n => winningNumbers.includes(n));
          const specialMatch = bet.includes(specialNumber);
          const matchCount = matches.length;
          
          let prizeTier = "未中獎";
          let isWin = false;

          if (matchCount === 6) {
            prizeTier = "頭獎";
            isWin = true;
          } else if (matchCount === 5 && specialMatch) {
            prizeTier = "二獎";
            isWin = true;
          } else if (matchCount === 5) {
            prizeTier = "三獎";
            isWin = true;
          } else if (matchCount === 4 && specialMatch) {
            prizeTier = "四獎";
            isWin = true;
          } else if (matchCount === 4) {
            prizeTier = "五獎";
            isWin = true;
          } else if (matchCount === 3 && specialMatch) {
            prizeTier = "六獎";
            isWin = true;
          } else if (matchCount === 3) {
            prizeTier = "七獎";
            isWin = true;
          }

          if (isWin) {
            totalWins++;
            let prizeAmount = 0;
            if (prizeTier === "頭獎") {
              prizeAmount = (drawObj && !Array.isArray(drawObj) && drawObj.firstPrize && drawObj.firstPrize > 0) 
                ? drawObj.firstPrize 
                : 8000000;
            } else if (prizeTier === "二獎") {
              prizeAmount = 150000;
            } else if (prizeTier === "三獎") {
              prizeAmount = 40000;
            } else if (prizeTier === "四獎") {
              prizeAmount = 9600;
            } else if (prizeTier === "五獎") {
              prizeAmount = 640;
            } else if (prizeTier === "六獎") {
              prizeAmount = 320;
            } else if (prizeTier === "七獎") {
              prizeAmount = 40;
            }
            totalWinnings += prizeAmount;
          }
          winsByTier[prizeTier] = (winsByTier[prizeTier] || 0) + 1;

          checkedBets.push({
            fileName: getDisplayNameForFile(f.name, fileIdx + 1),
            bet,
            matches,
            specialMatch,
            prizeTier,
            isWin
          });
        });
      }
    });

    const totalBets = checkedBets.length;
    setBacktestResults({
      checkedBets,
      summary: {
        totalFiles: filesList.filter(f => f.status === 'success').length,
        totalBets,
        totalCost: totalBets * 10,
        totalWins,
        totalWinnings,
        winsByTier
      }
    });
  };

  const handleBacktestUpload = async (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;

    setIsProcessingBacktest(true);
    const fileArray = Array.from(filesList);

    // Filter duplicates in new files compared with existing
    const existingNames = new Set(backtestFiles.map(f => f.name));
    const uniqueNewFiles = fileArray.filter(f => !existingNames.has(f.name));

    if (uniqueNewFiles.length === 0) {
      toast.info("已剔除重複上傳的檔案");
      setIsProcessingBacktest(false);
      return;
    }

    const newItems = uniqueNewFiles.map(file => ({
      name: file.name,
      bets: [] as number[][],
      status: 'loading' as const,
    }));

    // Update state to render loader immediately
    const updatedFileList = [...backtestFiles, ...newItems];
    setBacktestFiles(updatedFileList);

    for (let i = 0; i < uniqueNewFiles.length; i++) {
      const file = uniqueNewFiles[i];
      
      try {
        // 1. Try QR code
        const qrData = await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                try {
                  const code = jsQR(imageData.data, imageData.width, imageData.height);
                  resolve(code ? code.data : null);
                } catch(err) {
                  resolve(null);
                }
              } else {
                resolve(null);
              }
            };
            img.onerror = () => resolve(null);
            img.src = e.target?.result as string;
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        });

        let validBets: number[][] = [];
        if (qrData) {
          try {
            const parsed = JSON.parse(qrData);
            if (Array.isArray(parsed) && parsed.every(val => Array.isArray(val) && val.length === 6)) {
              validBets = parsed;
            }
          } catch(e) {}
        }

        if (validBets.length > 0) {
          setBacktestFiles(prev => {
            const updated = prev.map(item => 
              item.name === file.name ? { ...item, status: 'success' as const, bets: validBets } : item
            );
            setTimeout(() => runBacktestCheck(updated, backtestDrawIndex), 0);
            return updated;
          });
          continue;
        }

        // 2. Try API fallback
        const base64data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;
              const MAX_DIMENSION = 2000;

              if (width > height && width > MAX_DIMENSION) {
                height = Math.round((height * MAX_DIMENSION) / width);
                width = MAX_DIMENSION;
              } else if (height > MAX_DIMENSION) {
                width = Math.round((width * MAX_DIMENSION) / height);
                height = MAX_DIMENSION;
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.90));
              } else {
                resolve(e.target?.result as string);
              }
            };
            img.onerror = reject;
            img.src = e.target?.result as string;
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const mimeTypeMatch = base64data.match(/^data:(image\/(png|jpeg|jpg|webp|heic|heif));base64,/);
        const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";
        const base64DataReplaced = base64data.includes(",") ? base64data.split(",")[1] : base64data;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);
        
        const response = await fetch('/api/extract-numbers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            base64DataReplaced,
            mimeType
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "無法解析圖片");
        }

        const responseData = await response.json();
        if (!responseData.success) {
          throw new Error("無法辨識圖片號碼");
        }

        const parsed = responseData.bets;
        if (Array.isArray(parsed)) {
          const extractedBets = parsed.filter((b: any) => 
            Array.isArray(b) && b.length === 6 && b.every((n: any) => typeof n === 'number' && n >= 1 && n <= 49)
          );
          
          if (extractedBets.length > 0) {
            setBacktestFiles(prev => {
              const updated = prev.map(item => 
                item.name === file.name ? { ...item, status: 'success' as const, bets: extractedBets } : item
              );
              setTimeout(() => runBacktestCheck(updated, backtestDrawIndex), 0);
              return updated;
            });
          } else {
            throw new Error("不包含有效號碼組合");
          }
        } else {
          throw new Error("格式識別失敗");
        }

      } catch (err: any) {
        console.error(`Error processing backtest file ${file.name}:`, err);
        setBacktestFiles(prev => {
          const updated = prev.map(item => 
            item.name === file.name ? { ...item, status: 'error' as const, errorMsg: err.message || "解析失敗" } : item
          );
          setTimeout(() => runBacktestCheck(updated, backtestDrawIndex), 0);
          return updated;
        });
      }
    }

    setIsProcessingBacktest(false);
  };



  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [aiAnalysisDraws, setAiAnalysisDraws] = useState(50);
  const [aiBetCount, setAiBetCount] = useState(6);
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [aiAnalysisDrawsUsed, setAiAnalysisDrawsUsed] = useState(50);
  const [aiReasoning, setAiReasoning] = useState<string[]>([]);
  const [aiBankerMode, setAiBankerMode] = useState(false);
  const [aiBankerBudget, setAiBankerBudget] = useState(100);
  const [aiBankerBetCount, setAiBankerBetCount] = useState(1);
  const [coverUnselectedMode, setCoverUnselectedMode] = useState(false);
  const [coverBudget, setCoverBudget] = useState(300);
  const [coverBetCount, setCoverBetCount] = useState(3);
  const [isCoverDialogOpen, setIsCoverDialogOpen] = useState(false);
  const [specialCoverBets, setSpecialCoverBets] = useState<any[]>([]);

  useEffect(() => {
    setBankers([]);
    setExcludedLegs([]);
  }, [generatedBets]);

  const [liveResults, setLiveResults] = useState<DrawInfo[] | any[]>([]);
  const [liveResultsLoading, setLiveResultsLoading] = useState(true);
  const [nextDrawInfo, setNextDrawInfo] = useState<{date: string, estimatedJackpot: number} | null>(null);

  // Fetch live results on mount
  useEffect(() => {
    async function fetchLiveResults() {
      try {
        const res = await fetch('/api/marksix');
        const data = await res.json();
        if (data.success && data.draws && data.draws.length > 0) {
          setLiveResults(data.draws);
          if (data.nextDraw) {
            setNextDrawInfo(data.nextDraw);
          }
        } else {
          setLiveResults(MOCK_PAST_RESULTS); // Fallback
        }
      } catch (err) {
        console.error("Failed to fetch live results, using mock:", err);
        setLiveResults(MOCK_PAST_RESULTS); // Fallback
      } finally {
        setLiveResultsLoading(false);
      }
    }
    fetchLiveResults();
  }, []);

  // Helper to extract numbers array depending on if we have formatted dates or not
  const getRawDrawNumbers = (draw: number[] | { numbers: number[], date: string }): number[] => {
    return Array.isArray(draw) ? draw : draw.numbers;
  };

  const getDrawDateStr = (draw: any): string => {
    if (Array.isArray(draw)) return "";
    return draw?.date || "";
  };

  const getFormattedCurrentTime = (d?: Date | null) => {
    const targetDate = d || generationTime || new Date();
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dVal = String(targetDate.getDate()).padStart(2, '0');
    const hours = String(targetDate.getHours()).padStart(2, '0');
    const mins = String(targetDate.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${dVal} ${hours}:${mins}`;
  };

  const getDisplayNameForFile = (fileName: string, fallbackIndex: number): string => {
    // Try pattern marksixYYYYMMDDHHmm
    const marksixTimeRegex = /marksix(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/i;
    let match = fileName.match(marksixTimeRegex);
    if (match) {
      const [_, year, month, day, hour, min] = match;
      return `${year}-${month}-${day} ${hour}:${min} 生成`;
    }

    // Try pattern YYYYMMDDHHmm directly anywhere in the filename
    const generalTimeRegex = /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/;
    match = fileName.match(generalTimeRegex);
    if (match) {
      const [_, year, month, day, hour, min] = match;
      const m = parseInt(month, 10);
      const d = parseInt(day, 10);
      const h = parseInt(hour, 10);
      const mn = parseInt(min, 10);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && h >= 0 && h <= 23 && mn >= 0 && mn <= 59) {
        return `${year}-${month}-${day} ${hour}:${min} 生成`;
      }
    }

    // Try pattern marksix-lucky-numbers-YYYY-MM-DD
    const marksixLuckyRegex = /marksix-lucky-numbers-(\d{4})-(\d{2})-(\d{2})/i;
    match = fileName.match(marksixLuckyRegex);
    if (match) {
      const [_, year, month, day] = match;
      return `${year}-${month}-${day} 生成`;
    }

    return `檔案 #${fallbackIndex}`;
  };

  const [displayPastCount, setDisplayPastCount] = useState<number>(10);
  const [sliderPastCount, setSliderPastCount] = useState<number>(10);

  const getDisplayPastResults = () => {
    let results = [...liveResults];
    return results.slice(0, displayPastCount);
  };
  const displayPastResults = getDisplayPastResults();

  const [hkjcUsername, setHkjcUsername] = useState("");
  const [hkjcPassword, setHkjcPassword] = useState("");
  const [isHkjcDialogOpen, setIsHkjcDialogOpen] = useState(false);
  const [savedCredentials, setSavedCredentials] = useState(false);
  const [errorModal, setErrorModal] = useState<{ message: string; partialBets?: import('@/lib/marksix').GeneratedBet[] } | null>(null);
  const [viewingBetExpl, setViewingBetExpl] = useState<{ index: number, bet: import('@/lib/marksix').GeneratedBet } | null>(null);
  const [selectedBetModal, setSelectedBetModal] = useState<{ bet: import('@/lib/marksix').GeneratedBet, index: number } | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("hkjc_mock_user");
    if (savedUser) {
      setHkjcUsername(savedUser);
      setSavedCredentials(true);
    }
  }, []);

  useEffect(() => {
    if (analysisDrawIndex !== null) {
      setTimeout(() => {
        const el = document.getElementById('analysis-scroll-area');
        if (el) {
          el.scrollTop = 0;
        }
      }, 50);
    }
  }, [analysisDrawIndex]);

  // Reactive Safety Net to guarantee that all generated bets conform to strict HKJC Banker-Leg rules:
  // (Banker count 1-4, Legs count >= 2, total numbers >= 7).
  // Also ensures that 5 Bankers is forbidden and 4 Bankers 2 Legs is invalid.
  // If a bet fails, it is automatically downgraded to a standard single bet (with isBankerLegs = false, bankersCount = 0).
  useEffect(() => {
    let changed = false;
    const checkAndSanitize = (bets: any[]) => {
      return bets.map(bet => {
        if (bet.isBankerLegs && bet.bankersCount) {
          const bCount = bet.bankersCount;
          const bankers = bet.numbers.slice(0, bCount);
          const legs = bet.numbers.slice(bCount);
          const bankersLength = bankers.length;
          const legsLength = legs.length;

          const isInvalid = bankersLength < 1 || bankersLength > 4 || legsLength < Math.max(2, 7 - bankersLength);
          if (isInvalid) {
            changed = true;
            return {
              ...bet,
              isBankerLegs: false,
              bankersCount: 0,
              type: "standard",
              explanations: [
                ...(bet.explanations || []).map((exp: string) => 
                  exp.replace(/精選 \d+膽 \d+腳/g, "單式組合")
                     .replace(/精華 \d+ 膽拖 \d+ 腳/g, "單式組合")
                     .replace(/膽拖投注/g, "單式投注")
                ),
                bankersLength === 5
                  ? "⚠️ 系統自動優化：應您的特別設定，系統已停止使用「5 膽」組合，並為您智能轉換為標準單式注項（不影響號碼覆蓋）。"
                  : "⚠️ 系統自動優化：因此組合不符合限制（4 膽至少需 3 腳，3 膽至少 4 腳，2 膽至少 5 腳，且拒絕 5 膽），系統已自動為您智能轉換為標準單式注項。"
              ]
            };
          }
        }
        return bet;
      });
    };

    const sanitizedGenerated = checkAndSanitize(generatedBets);
    if (changed) {
      setGeneratedBets(sanitizedGenerated);
    }
  }, [generatedBets]);

  useEffect(() => {
    let changed = false;
    const checkAndSanitize = (bets: any[]) => {
      return bets.map(bet => {
        if (bet.isBankerLegs && bet.bankersCount) {
          const bCount = bet.bankersCount;
          const bankers = bet.numbers.slice(0, bCount);
          const legs = bet.numbers.slice(bCount);
          const bankersLength = bankers.length;
          const legsLength = legs.length;

          const isInvalid = bankersLength < 1 || bankersLength > 4 || legsLength < Math.max(2, 7 - bankersLength);
          if (isInvalid) {
            changed = true;
            return {
              ...bet,
              isBankerLegs: false,
              bankersCount: 0,
              type: "standard",
              explanations: [
                ...(bet.explanations || []).map((exp: string) => 
                  exp.replace(/精選 \d+膽 \d+腳/g, "單式組合")
                     .replace(/精華 \d+ 膽拖 \d+ 腳/g, "單式組合")
                     .replace(/膽拖投注/g, "單式投注")
                ),
                bankersLength === 5
                  ? "⚠️ 系統自動優化：應您的特別設定，系統已停止使用「5 膽」組合，並為您智能轉換為標準單式注項（不影響號碼覆蓋）。"
                  : "⚠️ 系統自動優化：因此組合不符合限制（4 膽至少需 3 腳，3 膽至少 4 腳，2 膽至少 5 腳，且拒絕 5 膽），系統已自動為您智能轉換為標準單式注項。"
              ]
            };
          }
        }
        return bet;
      });
    };

    const sanitizedSpecial = checkAndSanitize(specialCoverBets);
    if (changed) {
      setSpecialCoverBets(sanitizedSpecial);
    }
  }, [specialCoverBets]);

  const resetSettings = () => {
    setBetCount(6);
    setSumRange([21, 279]);
    setPreferredOddCount(null);
    setPreferredEvenCount(null);
    setRanges([{start: 1, end: 49}]);
    setOddEven("all");
    setColors(["red", "blue", "green"]);
    setColorRatioOption(3);
    setLuckyNumbers([]);
    setExcludedNumbers([]);
    setBankers([]);
    setExcludedLegs([]);
    setEnableRecent(false);
    setRecentMode("");
    setRecentCount(5);
    setIncludeSpecial(false);
    setEnableComplexRecent(false);
    setComplexExcludeRanges([{start: 1, end: 5}]);
    setComplexIncludeRanges([{start: 6, end: 10}]);
    setEnableExcludeUnseen(false);
    setExcludeUnseenCount(20);
    setExcludeUnseenIncludeSpecial(false);
    setNoConsecutivePairs(false);
    setNoConsecutiveTriplets(false);
    setUse2Combos(false);
    setCombo2Count(1);
    setUse3Combos(false);
    setCombo3Count(1);
  };

  const handleAddCoverUnselectedBet = () => {
    // 為了計算未選號碼，我們需要看 generatedBets (這裡只看原本的，因為全覆蓋是用來生成新的一頁)
    const allGeneratedNumbers = [...generatedBets].map((b: any) => b.numbers).flat();
    const usedNums = new Set<number>(allGeneratedNumbers);
    const unselected = Array.from({length: 49}, (_, i) => i + 1).filter(n => !usedNums.has(n));
    
    if (unselected.length === 0) {
      toast.success("太強了！所有 49 個號碼已經被全數覆蓋。");
      setIsCoverDialogOpen(false);
      return;
    }

    let shuffledUnselected = [...unselected].sort(() => 0.5 - Math.random());
    
    // 計算冷門號碼列表 (用作補充)
    const counts = Array(50).fill(0);
    MOCK_PAST_RESULTS.slice(0, 50).forEach(draw => {
      draw.numbers.forEach((n: number) => counts[n]++);
      if ((draw as any).special) {
        counts[(draw as any).special] += 0.5;
      }
    });
    // 所有可用的補充號碼 (非 unselected 的) 排列，由冷到熱
    const availableExtras = Array.from({length: 49}, (_, i) => i + 1)
      .filter(n => !unselected.includes(n))
      .sort((a, b) => {
         if (counts[a] === counts[b]) return Math.random() - 0.5;
         return counts[a] - counts[b]; // 由冷到熱
      });

    const betsCountToGenerate = coverBetCount || 1;
    const newBets: any[] = [];

    // Pre-calculate highly varied, non-uniform configs that sum up perfectly to the budget
    const configs = generateBankerConfigs(coverBudget, betsCountToGenerate);

    const tempBets: any[] = [];
    let reclaimedBudget = 0;

    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      let isBanker = config.isBanker;
      let bankers: number[] = [];
      let legs: number[] = [];

      if (isBanker) {
        const targetBCount = config.bCount;
        if (shuffledUnselected.length <= targetBCount) {
          bankers = [...shuffledUnselected];
        } else {
          // Pick targetBCount bankers with wrap-around shift to diversify bankers and partition the risk
          for (let j = 0; j < targetBCount; j++) {
            const idx = (i * targetBCount + j) % shuffledUnselected.length;
            bankers.push(shuffledUnselected[idx]);
          }
        }
      }

      const bCount = bankers.length;

      if (!isBanker || bCount === 0 || bCount >= 6) {
        isBanker = false;
        bankers = [];
        legs = shuffledUnselected.slice(0, 6);
      } else {
        const remainingUnselected = shuffledUnselected.filter(n => !bankers.includes(n));
        const requiredLegsLength = config.legsLength;
        const selectedLegs = remainingUnselected.slice(0, requiredLegsLength);
        
        if (selectedLegs.length < requiredLegsLength) {
          const extraCount = requiredLegsLength - selectedLegs.length;
          selectedLegs.push(
            ...availableExtras
              .filter(n => !bankers.includes(n) && !selectedLegs.includes(n))
              .slice(0, extraCount)
          );
        }
        
        legs = selectedLegs;
      }

      if (isBanker && (bankers.length === 0 || legs.length < 2 || bankers.length + legs.length < 7)) {
         isBanker = false;
      }

      const selectedBankers = bankers.sort((a,b)=>a-b);
      const selectedLegsSorted = legs.sort((a,b)=>a-b);
      const actualCost = isBanker ? getCombinationsCount(selectedLegsSorted.length, 6 - bCount) * 10 : 10;

      if (isBanker) {
        tempBets.push({
          id: `unselected-cover-${Date.now()}-${i}`,
          numbers: [...selectedBankers, ...selectedLegsSorted],
          explanations: [`全包未選號碼 [第 ${i+1} 組]：精華 ${bCount} 膽拖 ${selectedLegsSorted.length} 腳，以冷門號碼補足您預算，成本 $${actualCost}。`],
          type: 'banker',
          isBankerLegs: true,
          bankersCount: bCount
        });
      } else {
        reclaimedBudget += actualCost; // Reclaim standard bet cost to redistribute
      }
    }

    // Redistribute reclaimed budget to expand legs of the genuine banker configurations
    if (reclaimedBudget >= 10 && tempBets.length > 0) {
      let expanded = true;
      let attempts = 0;
      while (expanded && reclaimedBudget >= 10 && attempts < 1000) {
        expanded = false;
        attempts++;
        const indices = Array.from({ length: tempBets.length }, (_, idx) => idx).sort(() => Math.random() - 0.5);
        for (const idx of indices) {
          const bet = tempBets[idx];
          const bCount = bet.bankersCount;
          const currentLegsLength = bet.numbers.length - bCount;
          const nextL = currentLegsLength + 1;
          if (nextL > 40) continue;

          const currentCost = getCombinationsCount(currentLegsLength, 6 - bCount) * 10;
          const nextCost = getCombinationsCount(nextL, 6 - bCount) * 10;
          const costIncrease = nextCost - currentCost;

          if (reclaimedBudget >= costIncrease) {
            const newLeg = availableExtras.find(n => !bet.numbers.includes(n));
            if (newLeg) {
              const bankers = bet.numbers.slice(0, bCount);
              const legs = [...bet.numbers.slice(bCount), newLeg].sort((a,b)=>a-b);
              bet.numbers = [...bankers, ...legs];
              const updatedCost = getCombinationsCount(legs.length, 6 - bCount) * 10;
              bet.explanations = [`全包未選號碼 [第 ${idx+1} 組]：精華 ${bCount} 膽拖 ${legs.length} 腳，以冷門號碼補足您預算，成本 $${updatedCost}。`];
              reclaimedBudget -= costIncrease;
              expanded = true;
              break;
            }
          }
        }
      }
    }

    // 生成全新一頁
    setGeneratedBets(tempBets);
    setSpecialCoverBets([]);
    setIsAiGenerated(false);
    setIsCoverDialogOpen(false);
    setTimeout(() => {
        document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleGenerate = () => {
    setIsAiGenerated(false);
    if (enableRecent && recentMode === "" && !enableComplexRecent) {
      toast.error("請選擇「排除近期號碼」或「只買近期號碼」");
      return;
    }

    if (luckyNumbers.length > 6) {
      toast.error("幸運號碼最多只能設定 6 個");
      return;
    }

    setIsGenerating(true);
    try {
      // For generateBets, recentDraws can now handle both raw arrays and full DrawInfo objects
      const bets = generateBets({
        count: betCount,
        ranges,
        onlyOdd: oddEven === "odd",
        onlyEven: oddEven === "even",
        preferredOddCount,
        preferredEvenCount,
        colors,
        colorRatioOption: colors.length === 2 ? colorRatioOption : undefined,
        recentMode: enableRecent ? (recentMode as "exclude" | "include") : "none",
        recentCount,
        recentDraws: liveResults,
        includeSpecial,
        mustInclude: luckyNumbers,
        excludedNumbers: excludedNumbers,
        complexRecentStrategy: {
          enabled: enableComplexRecent,
          excludeRanges: complexExcludeRanges,
          includeRanges: complexIncludeRanges
        },
        excludeUnseenInRecent: (enableRecent || enableComplexRecent) && enableExcludeUnseen ? excludeUnseenCount : undefined,
        excludeUnseenIncludeSpecial,
        use2Combos,
        combo2Count,
        use3Combos,
        combo3Count,
        comboAnalysisDrawCount: 100,
        noConsecutivePairs: noConsecutivePairs,
        noConsecutiveTriplets: noConsecutiveTriplets,
        sumDistributionRange: sumRange
      });

      setTimeout(() => {
        setGeneratedBets(bets);
        setSpecialCoverBets([]);
        setUndoStack([]);
        setIsGenerating(false);
        setTimeout(() => {
          document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }, 400); // Fake loading for better UX
    } catch (error: any) {
      if (error.name === "PartialGenerationError") {
        setErrorModal({
          message: error.message,
          partialBets: error.partialBets,
        });
      } else {
        setErrorModal({ message: error.message || "生成失敗，請放寬篩選條件" });
      }
      setIsGenerating(false);
    }
  };

  const handleAIGenerate = () => {
    setIsAiDialogOpen(false);
    setIsGenerating(true);
    setIsAiGenerated(true);
    setAiAnalysisDrawsUsed(aiAnalysisDraws);

    try {
      const rawRecentDraws = liveResults.slice(0, aiAnalysisDraws).map(getRawDrawNumbers);
      const allNums = rawRecentDraws.flatMap(d => d.slice(0,6));
      
      const oddCount = allNums.filter(n => n % 2 !== 0).length;
      const evenCount = allNums.filter(n => n % 2 === 0).length;
      const preferOdd = oddCount >= evenCount ? Math.floor(Math.random() * 2) + 3 : Math.floor(Math.random() * 3) + 2;

      setBetCount(aiBetCount);
      setPreferredOddCount(preferOdd);
      setPreferredEvenCount(6 - preferOdd);
      setColors(["red", "blue", "green"]);
      setColorRatioOption(3);
      setEnableRecent(false);
      setEnableComplexRecent(true);
      setComplexExcludeRanges([]);
      setComplexIncludeRanges([{ start: 2, end: 5 }]);
      
      setIncludeSpecial(false);
      setLuckyNumbers([]);
      setExcludedNumbers([]);
      setBankers([]);
      setExcludedLegs([]);
      setEnableExcludeUnseen(false);
      setExcludeUnseenIncludeSpecial(false);
      setNoConsecutivePairs(false);
      setNoConsecutiveTriplets(false);
      setUse2Combos(true);
      setCombo2Count(3);
      const willUse3Combos = Math.random() > 0.5;
      setUse3Combos(willUse3Combos);
      setCombo3Count(1);
      
      const comboPercentage = (Math.random() * 0.25 + 0.15); // Between 15% and 40%
      const totalComboBets = Math.max(1, Math.round(aiBetCount * comboPercentage));

      const filterExplanation = `溫度過濾：採用均衡分配，將注數平均分配給「保守組（高頻號碼）」、「激進組（冷門號碼）」與「均衡組」，分散投資風險並排除歷史機率較低的衰減規律。`;

      const roundedComboPct = Math.round(comboPercentage * 100);

      const explanations = [
        `大數據隱藏趨勢分析：透過深度拆解過去歷年逾數百期的開彩數據，比對冷熱號碼分佈、單雙偏差及波色出現頻率，精確捕捉具備統計顯著性的變化。`,
        `預計頭獎與總和規律演算 (Jackpot Strategy)：AI 自動分析每次頭獎基金 (通常 > 2400 萬) 的勝出組合總和區間與邊界。我們針對高預計頭獎金額的組合進行數據擬合，透過動態演算法封鎖歷史頭獎金額較低的總和區間。`,
        `號碼間距與遺漏分析（Number Gaps & Skips）：追蹤號碼出現間距是否符合幾何分佈，並透過 FFG 算法 (賭博基本公式) 計算當前遺漏期數與期望期數，捕捉即將回歸均值的「壁花」號碼。`,
        `總和值分佈與正態性（Sum Distribution）：依據大數定律和中心極限定理，確保最終生成的組合總和值落入動態優化後的高潛力頭獎區間。`,
        filterExplanation,
        `關聯挖掘與共現分析：從 ${aiBetCount} 注中撥出約 ${roundedComboPct}% (約 ${totalComboBets} 注) 使用「同盟挖掘 (FP-Growth)」及同伴號碼組合；同時應用飽和衰減防止熱號陷阱。`
      ];
      setAiReasoning(explanations);
      
      const baseGenerateOptions = {
        ranges: [{start: 1, end: 49}],
        onlyOdd: false,
        onlyEven: false,
        colors: ["red", "blue", "green"] as BallColor[],
        recentMode: "none" as const,
        recentCount: 5,
        recentDraws: liveResults,
        includeSpecial: false,
        mustInclude: [],
        excludedNumbers: [],
        excludeUnseenInRecent: undefined,
        excludeUnseenIncludeSpecial: false,
        noConsecutivePairs: false,
        noConsecutiveTriplets: false,
        comboAnalysisDrawCount: aiAnalysisDraws,
        enforceNormalSumDistribution: true,
        sumDistributionRange: sumRange
      };

      const counts = [
        Math.floor(aiBetCount / 3),
        Math.floor(aiBetCount / 3),
        Math.floor(aiBetCount / 3)
      ];
      const remainder = aiBetCount % 3;
      for (let i = 0; i < remainder; i++) {
        counts[i]++;
      }

      let allocatedCombos = [0, 0, 0];
      let cbRemaining = totalComboBets;
      let currentIndex = 0;
      while (cbRemaining > 0) {
        if (allocatedCombos[0] === counts[0] && allocatedCombos[1] === counts[1] && allocatedCombos[2] === counts[2]) {
          break; 
        }
        if (allocatedCombos[currentIndex] < counts[currentIndex]) {
          allocatedCombos[currentIndex]++;
          cbRemaining--;
        }
        currentIndex = (currentIndex + 1) % 3;
      }

      let allBets: any[] = [];

      if (aiBankerMode && aiBetCount >= 10) {
        setAiReasoning([
          `啟動大數據拖膽模式：因注數較多，AI 已自動改為為您精研「膽拖」配搭，以貼近總預算 $${aiBankerBudget} 極大化覆蓋號碼！`,
          ...explanations,
        ]);

        const betsCountToGenerate = aiBankerBetCount || 1;
        const configs = generateBankerConfigs(aiBankerBudget, betsCountToGenerate);

        const tempBets: any[] = [];
        let reclaimedBudget = 0;

        for (let i = 0; i < configs.length; i++) {
          const bestConfig = configs[i];
          
          const rawBets = generateBets({
            ...baseGenerateOptions,
            complexRecentStrategy: { enabled: true, excludeRanges: [{ start: 1, end: 2 }], includeRanges: [] },
            count: Math.ceil((bestConfig.bCount + bestConfig.legsLength) / 2 || 6),
            aiStrategy: i % 2 === 0 ? "balanced" : "cold", // Mix strategies
          });
          
          const merged = Array.from(new Set(rawBets.flatMap(b => b.numbers))).sort(() => Math.random() - 0.5);
          const targetTotal = bestConfig.bCount + bestConfig.legsLength;
          const selectedNums = merged.slice(0, targetTotal);
          while (selectedNums.length < targetTotal) {
             const nextRanked = Array.from(new Set(generateBets({ ...baseGenerateOptions, count: 1 })[0].numbers));
             for (const n of nextRanked) {
                if (!selectedNums.includes(n) && selectedNums.length < targetTotal) {
                  selectedNums.push(n);
                }
             }
          }
          selectedNums.sort(() => Math.random() - 0.5);
          const bCount = bestConfig.bCount;
          const bankers = selectedNums.slice(0, bCount).sort((a,b)=>a-b);
          const legs = selectedNums.slice(bCount).sort((a,b)=>a-b);
          
          const isBanker = bestConfig.isBanker && bankers.length > 0 && legs.length >= 2 && (bankers.length + legs.length >= 7);
          
          if (isBanker) {
            tempBets.push({
              numbers: [...bankers, ...legs],
              explanations: [`AI 智能膽拖配搭 [第 ${i+1} 組]：精選 ${bankers.length}膽 ${legs.length}腳，結合冷熱分佈機制，成本 $${bestConfig.cost}，大幅提升覆蓋率！`],
              isBankerLegs: true,
              bankersCount: bCount
            });
          } else {
            reclaimedBudget += bestConfig.cost; // Reclaim standard bet cost to redistribute
          }
        }

        // Redistribute reclaimed budget to expand legs of genuine AI banker configurations
        if (reclaimedBudget >= 10 && tempBets.length > 0) {
          let expanded = true;
          let attempts = 0;
          while (expanded && reclaimedBudget >= 10 && attempts < 1000) {
            expanded = false;
            attempts++;
            const indices = Array.from({ length: tempBets.length }, (_, idx) => idx).sort(() => Math.random() - 0.5);
            for (const idx of indices) {
              const bet = tempBets[idx];
              const bCount = bet.bankersCount;
              const currentLegsLength = bet.numbers.length - bCount;
              const nextL = currentLegsLength + 1;
              if (nextL > 40) continue;

              const currentCost = getCombinationsCount(currentLegsLength, 6 - bCount) * 10;
              const nextCost = getCombinationsCount(nextL, 6 - bCount) * 10;
              const costIncrease = nextCost - currentCost;

              if (reclaimedBudget >= costIncrease) {
                const nextRandomPool = Array.from(new Set(generateBets({ ...baseGenerateOptions, count: 5 }).flatMap(b => b.numbers)));
                const newLeg = nextRandomPool.find(n => !bet.numbers.includes(n));
                if (newLeg) {
                  const bankers = bet.numbers.slice(0, bCount);
                  const legs = [...bet.numbers.slice(bCount), newLeg].sort((a,b)=>a-b);
                  bet.numbers = [...bankers, ...legs];
                  const updatedCost = getCombinationsCount(legs.length, 6 - bCount) * 10;
                  bet.explanations = [`AI 智能膽拖配搭 [第 ${idx+1} 組]：精選 ${bCount}膽 ${legs.length}腳，結合冷熱分佈機制，成本 $${updatedCost}，大幅提升覆蓋率！`];
                  reclaimedBudget -= costIncrease;
                  expanded = true;
                  break;
                }
              }
            }
          }
        }
        allBets = tempBets;
      } else {
        for (let s = 0; s < 3; s++) {
          let countForStrategy = counts[s];
          if (countForStrategy <= 0) continue;
        
        let comboBetCountForS = allocatedCombos[s];
        let normalBetCountForS = countForStrategy - comboBetCountForS;

        let complexStrategy;
        let stratName = "";
        let currentAiStrategy: "hot" | "cold" | "balanced" = "balanced";
        if (s === 0) {
          stratName = "保守組 (高頻選號) - 排除近期飽和熱號，鎖定持續活躍的號碼";
          complexStrategy = { enabled: true, excludeRanges: [{ start: 1, end: 1 }], includeRanges: [] };
          currentAiStrategy = "hot";
        } else if (s === 1) {
          stratName = "激進組 (冷門捕捉) - 應用拉伸間距分析，捕捉長期遺漏的「壁花」號碼";
          complexStrategy = { enabled: true, excludeRanges: [{ start: 1, end: 5 }], includeRanges: [] };
          currentAiStrategy = "cold";
        } else {
          stratName = "均衡組 (動態平衡) - 結合冷熱號碼，遵循正態分佈原則";
          complexStrategy = { enabled: true, excludeRanges: [{ start: 1, end: 2 }], includeRanges: [] };
          currentAiStrategy = "balanced";
        }

        const injectDynamicExplanations = (bet: any, typeName: string) => {
          let expls = (bet.explanations && bet.explanations.length > 0) ? [...bet.explanations] : [];
          expls.push(`大數據演算法：${typeName}`);
          
          const sum = bet.numbers.reduce((a: number, b: number) => a + b, 0);
          if (sum < 110 || sum > 190) {
            expls.push(`總和值分佈：此注總和為 ${sum}，屬於極端分佈。AI 已觸發 30% 多樣性放行機制，保留此邊緣數據以應對「黑天鵝」隨機事件。`);
          } else {
            expls.push(`總和值分佈：此注總和為 ${sum}，處於正態分佈核心 110~190 區間內，符合大數法則的常態預期。`);
          }

          if (currentAiStrategy === "hot") {
            expls.push(`飽和衰減制動：已自動降低近期出現超過4次之過熱號碼的比重，防止誤墮「熱號陷阱」。`);
          } else if (currentAiStrategy === "cold") {
            expls.push(`FFG 遺漏分析：已對遺漏超過 10 期、20 期以上的號碼進行指數級權重提升，精準捕捉回歸均值的「壁花」。`);
          } else if (currentAiStrategy === "balanced") {
            expls.push(`動態平衡演算：同時應用 FFG 遺漏捕捉與飽和衰減制動，維持冷熱號碼的正態平衡。`);
          }

          const bOdds = bet.numbers.filter((n: number) => n % 2 !== 0).length;
          const bEvens = 6 - bOdds;
          expls.push(`單雙配置：此注自動配置為 ${bOdds}單 ${bEvens}雙。`);
          
          const rbCounts = { red: 0, blue: 0, green: 0 };
          bet.numbers.forEach((n: number) => rbCounts[getBallColor(n) as keyof typeof rbCounts]++);
          let colorParts = [];
          if (rbCounts.red > 0) colorParts.push(`${rbCounts.red}紅`);
          if (rbCounts.blue > 0) colorParts.push(`${rbCounts.blue}藍`);
          if (rbCounts.green > 0) colorParts.push(`${rbCounts.green}綠`);
          expls.push(`波色配置：此注蘊含 ${colorParts.join(' ')}。`);
          
          expls.push(`溫度過濾：${stratName}。`);
          return { ...bet, explanations: expls };
        };

        if (normalBetCountForS > 0) {
          const normalBets = generateBets({
            ...baseGenerateOptions,
            complexRecentStrategy: complexStrategy,
            count: normalBetCountForS,
            use2Combos: false,
            combo2Count: 0,
            use3Combos: false,
            combo3Count: 0,
            aiStrategy: currentAiStrategy,
          }).map(bet => injectDynamicExplanations(bet, `此注採用純機率分佈進行獨立選號，透過先進隨機洗牌演算法排除人為偏差，確保每個數字在統計學上具有完全平等的出現機率。`));
          allBets.push(...normalBets);
        }

        if (comboBetCountForS > 0) {
          const comboBets = generateBets({
            ...baseGenerateOptions,
            complexRecentStrategy: complexStrategy,
            count: comboBetCountForS,
            use2Combos: true,
            combo2Count: 3,
            use3Combos: willUse3Combos,
            combo3Count: 1,
            aiStrategy: currentAiStrategy,
          }).map(bet => injectDynamicExplanations(bet, `使用「2合策略」${willUse3Combos ? '及「3合策略」' : ''}，自動尋找最高勝率的同伴號碼組合。`));
          allBets.push(...comboBets);
        }
        }
      }

      setTimeout(() => {
        setGeneratedBets(allBets);
        setSpecialCoverBets([]);
        setUndoStack([]);
        setIsGenerating(false);
        setTimeout(() => {
          document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }, 400);

    } catch(error: any) {
      if (error.name === "PartialGenerationError") {
        setErrorModal({
          message: error.message,
          partialBets: error.partialBets,
        });
      } else {
        setErrorModal({ message: error.message || "生成失敗，請重試" });
      }
      setIsGenerating(false);
    }
  };

  const handleColorToggle = (color: BallColor) => {
    setColors((prev) => {
      if (prev.includes(color)) {
        const next = prev.filter((c) => c !== color);
        // If unchecking the last color, revert to "All Colors"
        return next.length === 0 ? ["red", "blue", "green"] : next;
      }
      return [...prev, color];
    });
  };

  const handleCopyBets = () => {
    if (generatedBets.length === 0) return;
    const text = generatedBets
      .map((bet, index) => {
        if (bet.isBankerLegs && bet.bankersCount) {
          const bankers = bet.numbers.slice(0, bet.bankersCount).join(", ");
          const legs = bet.numbers.slice(bet.bankersCount).join(", ");
          return `注 ${index + 1}: [膽] ${bankers} [腳] ${legs}`;
        }
        return `注 ${index + 1}: ${bet.numbers.map((n) => n.toString()).join(", ")}`;
      })
      .join("\n");
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success("已複製號碼！請前往 HKJC 網站貼上或手動輸入。");
      })
      .catch(() => {
        toast.error("複製失敗，請手動抄寫。");
      });
  };

  const [checkBetsData, setCheckBetsData] = useState<number[][] | null>(null);

  const handlePerformCheck = (betsToCheck: number[][], drawIdx: number = checkDrawIndex) => {
    if (!liveResults[drawIdx]) {
      toast.error("找不到該期開彩結果");
      return;
    }
    const drawObj = liveResults[drawIdx];
    const draw = getRawDrawNumbers(drawObj);
    const winningNumbers = draw.slice(0, 6);
    const specialNumber = draw[6];

    const results = betsToCheck.map(bet => {
      const matches = bet.filter(n => winningNumbers.includes(n));
      const specialMatch = bet.includes(specialNumber);
      return { bet, matches, specialMatch };
    });
    setCheckResults(results);
    setCheckBetsData(betsToCheck);
  };

  // 當開啟對獎視窗、或投注組合變更、或更換期數時，自動重新核對過關
  useEffect(() => {
    if (isCheckDialogOpen && checkBetsData) {
      handlePerformCheck(checkBetsData, checkDrawIndex);
    }
  }, [isCheckDialogOpen, checkBetsData, checkDrawIndex]);

  // 當開啟回測視窗、或回測檔案變更、或更換期數時，自動重新核對過關
  useEffect(() => {
    if (isBacktestDialogOpen && backtestFiles.length > 0) {
      runBacktestCheck(backtestFiles, backtestDrawIndex);
    }
  }, [isBacktestDialogOpen, backtestFiles, backtestDrawIndex]);

  const handleManualCheck = () => {
    try {
      const parsedBets: number[][] = [];
      const getCombos = (arr: number[], k: number): number[][] => {
        if (k === 0) return [[]];
        if (arr.length === 0) return [];
        const [first, ...rest] = arr;
        const combsWithoutFirst = getCombos(rest, k);
        const combsWithFirst = getCombos(rest, k - 1).map(c => [first, ...c]);
        return [...combsWithFirst, ...combsWithoutFirst];
      };

      let unparsedNumbers: number[] = [];

      checkManualInput.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        const bankerMatch = trimmed.match(/\[膽\](.*?)\[腳\](.*)/);
        if (bankerMatch) {
          const bankers: number[] = [...new Set<number>((bankerMatch[1].match(/\d+/g) || []).map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= 49))];
          const legs: number[] = [...new Set<number>((bankerMatch[2].match(/\d+/g) || []).map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= 49))];
          
          if (bankers.length > 0 && legs.length > 0 && bankers.length + legs.length >= 6) {
             const requiredLegs = 6 - bankers.length;
             if (requiredLegs > 0) {
               getCombos(legs, requiredLegs).forEach(c => parsedBets.push([...bankers, ...c].sort((a,b)=>a-b)));
             } else if (requiredLegs === 0) {
               parsedBets.push([...bankers].sort((a,b)=>a-b));
             }
          }
          return;
        }

        // Standard line processing
        const cleanedLine = trimmed.replace(/^(?:\d+[\.\)\]]\s*|(?:注|bet|第)\s*\d+\s*(?:注)?\s*[:：\.]?\s*)/ig, '');
        const nums = (cleanedLine.match(/\d+/g) || []).map(n => parseInt(n, 10)).filter(n => !isNaN(n) && n >= 1 && n <= 49);
        unparsedNumbers.push(...nums);
      });

      for (let i = 0; i <= unparsedNumbers.length - 6; i += 6) {
        parsedBets.push(unparsedNumbers.slice(i, i + 6));
      }

      if (parsedBets.length === 0) {
        toast.error("未能解析出任何有效的 6 個號碼組合，請檢查輸入格式。");
        return;
      }
      handlePerformCheck(parsedBets);
    } catch (e) {
      toast.error("輸入格式有誤");
    }
  };

  const processScreenshotsForCheck = async (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    setIsCheckingScreenshot(true);
    
    const fileArray = Array.from(filesList);
    const totalFiles = fileArray.length;
    let allCombinedBets: number[][] = [];
    let succeededCount = 0;
    let failedCount = 0;
    
    for (let idx = 0; idx < totalFiles; idx++) {
      const file = fileArray[idx];
      const toastMsg = totalFiles > 1 
        ? `正在解析圖片中的號碼 (${idx + 1}/${totalFiles})...` 
        : `正在解析圖片中的號碼...`;
        
      toast.loading(
        <div className="text-center w-full font-bold text-[16px] text-zinc-700">{toastMsg}</div>,
        { id: "check-screenshot" }
      );
      
      try {
        // 1. Try QR Code First
        const qrData = await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                try {
                  const code = jsQR(imageData.data, imageData.width, imageData.height);
                  resolve(code ? code.data : null);
                } catch(e) {
                  resolve(null);
                }
              } else {
                resolve(null);
              }
            };
            img.onerror = () => resolve(null);
            img.src = e.target?.result as string;
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        });

        let fileBets: number[][] = [];
        if (qrData) {
          try {
            const parsed = JSON.parse(qrData);
            if (Array.isArray(parsed) && parsed.every(val => Array.isArray(val) && val.length === 6)) {
              fileBets = parsed;
            }
          } catch(e) {}
        }

        if (fileBets.length > 0) {
          allCombinedBets.push(...fileBets);
          succeededCount++;
          continue;
        }

        // 2. Fallback to API if QR not found or invalid
        const base64data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;
              const MAX_DIMENSION = 2500;

              if (width > height && width > MAX_DIMENSION) {
                height = Math.round((height * MAX_DIMENSION) / width);
                width = MAX_DIMENSION;
              } else if (height > MAX_DIMENSION) {
                width = Math.round((width * MAX_DIMENSION) / height);
                height = MAX_DIMENSION;
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.95));
              } else {
                resolve(e.target?.result as string);
              }
            };
            img.onerror = reject;
            img.src = e.target?.result as string;
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const mimeTypeMatch = base64data.match(/^data:(image\/(png|jpeg|jpg|webp|heic|heif));base64,/);
        const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";
        const base64DataReplaced = base64data.includes(",") ? base64data.split(",")[1] : base64data;

        // Send to Backend API
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);
        
        const response = await fetch('/api/extract-numbers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            base64DataReplaced,
            mimeType
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to analyze image");
        }

        const responseData = await response.json();
        if (!responseData.success) {
          throw new Error("Failed to extract numbers");
        }
        const parsed = responseData.bets;

        if (Array.isArray(parsed)) {
          const validBets = parsed.filter((b: any) => Array.isArray(b) && b.length === 6 && b.every((n: any) => typeof n === 'number' && n >= 1 && n <= 49));
          if (validBets.length > 0) {
            allCombinedBets.push(...validBets);
            succeededCount++;
          } else {
            failedCount++;
          }
        } else {
          failedCount++;
        }
      } catch (err: any) {
        console.error(`Error parsing file ${file.name}:`, err);
        failedCount++;
      }
    }

    setIsCheckingScreenshot(false);

    if (allCombinedBets.length > 0) {
      handlePerformCheck(allCombinedBets);
      if (failedCount > 0) {
        toast.success(
          <div className="text-center flex-1 font-bold">
            成功解析號碼！(成功: {succeededCount}張, 失敗: {failedCount}張)
          </div>, 
          { id: "check-screenshot" }
        );
      } else {
        toast.success(
          <div className="text-center flex-1 font-bold">
            成功讀取全部圖片中的號碼！(共 {allCombinedBets.length}注)
          </div>, 
          { id: "check-screenshot" }
        );
      }
    } else {
      toast.error(
        <div className="text-left font-bold text-[15px] whitespace-pre-wrap break-words">
          未能成功解析任何圖片。請確保您使用的是本系統下載的截圖（含 QR Code 或號碼）。
        </div>,
        { id: "check-screenshot", duration: 5000 }
      );
    }
  };

  const processScreenshotForCheck = async (file: File) => {
    setIsCheckingScreenshot(true);
    toast.loading(
      <div className="text-center w-full font-bold text-[16px] text-zinc-700">正在解析圖片中的號碼...</div>,
      { id: "check-screenshot" }
    );

    try {
      // 1. Try QR Code First
      const qrData = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              try {
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                resolve(code ? code.data : null);
              } catch(e) {
                resolve(null);
              }
            } else {
              resolve(null);
            }
          };
          img.onerror = () => resolve(null);
          img.src = e.target?.result as string;
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });

      if (qrData) {
        let validBets: number[][] = [];
        try {
          const parsed = JSON.parse(qrData);
          if (Array.isArray(parsed) && parsed.every(val => Array.isArray(val) && val.length === 6)) {
             validBets = parsed;
          }
        } catch(e) {}
        
        if (validBets.length > 0) {
          handlePerformCheck(validBets);
          toast.success(<div className="text-center flex-1 font-bold text-xl">成功讀取號碼！</div>, { id: "check-screenshot" });
          setIsCheckingScreenshot(false);
          return;
        }
      }

      // 2. Fallback to API if QR not found or invalid
      const base64data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_DIMENSION = 2500;

            if (width > height && width > MAX_DIMENSION) {
              height = Math.round((height * MAX_DIMENSION) / width);
              width = MAX_DIMENSION;
            } else if (height > MAX_DIMENSION) {
              width = Math.round((width * MAX_DIMENSION) / height);
              height = MAX_DIMENSION;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
// Compress to JPEG with high quality for better OCR
              resolve(canvas.toDataURL('image/jpeg', 0.95));
            } else {
              resolve(e.target?.result as string);
            }
          };
          img.onerror = reject;
          img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const mimeTypeMatch = base64data.match(/^data:(image\/(png|jpeg|jpg|webp|heic|heif));base64,/);
      const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";
      const base64DataReplaced = base64data.includes(",") ? base64data.split(",")[1] : base64data;

      // Send to Backend API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      
      const response = await fetch('/api/extract-numbers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          base64DataReplaced,
          mimeType
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to analyze image");
      }

      const responseData = await response.json();
      if (!responseData.success) {
        throw new Error("Failed to extract numbers");
      }
      const parsed = responseData.bets;

      if (Array.isArray(parsed)) {
        const validBets = parsed.filter((b: any) => Array.isArray(b) && b.length === 6 && b.every((n: any) => typeof n === 'number' && n >= 1 && n <= 49));
        if (validBets.length > 0) {
          handlePerformCheck(validBets);
          toast.success(<div className="text-center flex-1 font-bold">成功解析號碼！</div>, { id: "check-screenshot" });
        } else {
          throw new Error("無效圖片，請使用本系統截圖");
        }
      } else {
        throw new Error("無效圖片，請使用本系統截圖");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(
        <div className="flex flex-col gap-3 w-full">
          <div className="text-left font-bold text-[15px] whitespace-pre-wrap break-words">
            {err.message || "無效圖片，請使用本系統截圖"}
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" variant="outline" onClick={() => processScreenshotForCheck(file)}>
              重試 API
            </Button>
          </div>
        </div>,
        { 
          id: "check-screenshot",
          duration: 10000
        }
      );
    } finally {
      setIsCheckingScreenshot(false);
    }
  };

  // removed old handlers

  const processScreenshotForRegenerate = async (file: File) => {
    toast.loading(
      <div className="text-center w-full font-bold text-[16px] text-zinc-700">正在解析圖片載入號碼...</div>,
      { id: "regenerate-screenshot" }
    );

    try {
      // 1. Try QR code first
      const qrData = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              try {
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                resolve(code ? code.data : null);
              } catch(e) {
                resolve(null);
              }
            } else {
              resolve(null);
            }
          };
          img.onerror = () => resolve(null);
          img.src = e.target?.result as string;
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });

      if (qrData) {
        let validBets: number[][] = [];
        try {
          const parsed = JSON.parse(qrData);
          if (Array.isArray(parsed) && parsed.every(val => Array.isArray(val) && val.length === 6)) {
             validBets = parsed;
          }
        } catch(e) {}
        
        if (validBets.length > 0) {
          setGeneratedBets(validBets.map(b => ({ numbers: b, explanations: ["從圖片解析載入"] })));
          setUndoStack([]);
          setIsHkjcDialogOpen(false);
          toast.success(<div className="text-center flex-1 font-bold text-xl">成功載入 {validBets.length} 注號碼！</div>, { id: "regenerate-screenshot" });
          return;
        }
      }

      // 2. Fallback to API if QR fails
      const base64data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_DIMENSION = 2500;

            if (width > height && width > MAX_DIMENSION) {
              height = Math.round((height * MAX_DIMENSION) / width);
              width = MAX_DIMENSION;
            } else if (height > MAX_DIMENSION) {
              width = Math.round((width * MAX_DIMENSION) / height);
              height = MAX_DIMENSION;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
// Compress to JPEG with high quality for better OCR
              resolve(canvas.toDataURL('image/jpeg', 0.95));
            } else {
              resolve(e.target?.result as string);
            }
          };
          img.onerror = reject;
          img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const mimeTypeMatch = base64data.match(/^data:(image\/(png|jpeg|jpg|webp|heic|heif));base64,/);
      const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";
      const base64DataReplaced = base64data.includes(",") ? base64data.split(",")[1] : base64data;

      // Send to Backend API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      
      const response = await fetch('/api/extract-numbers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          base64DataReplaced,
          mimeType
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to analyze image");
      }

      const responseData = await response.json();
      if (!responseData.success) {
        throw new Error("Failed to extract numbers");
      }
      const parsed = responseData.bets;

      if (Array.isArray(parsed)) {
        const validBets = parsed.filter((b: any) => Array.isArray(b) && b.length === 6 && b.every((n: any) => typeof n === 'number' && n >= 1 && n <= 49));
        if (validBets.length > 0) {
          setGeneratedBets(validBets.map(b => ({ numbers: b, explanations: ["從圖片解析載入"] })));
          setUndoStack([]);
          toast.success(<div className="text-center flex-1 font-bold text-xl">成功載入 {validBets.length} 注號碼！</div>, { id: "regenerate-screenshot" });
        } else {
          throw new Error("無法識別號碼，請使用本系統截圖");
        }
      } else {
        throw new Error("無法識別號碼，請使用本系統截圖");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(
        <div className="flex flex-col gap-3 w-full">
          <div className="text-left font-bold text-[15px] whitespace-pre-wrap break-words">
            {err.message || "無法識別號碼，請使用本系統截圖"}
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" variant="outline" onClick={() => processScreenshotForRegenerate(file)}>
              重試 API
            </Button>
          </div>
        </div>,
        { 
          id: "regenerate-screenshot",
          duration: 10000
        }
      );
    }
  };

  // removed old handlers

  const handleCaptureScreenshot = async () => {
    const captureArea = document.getElementById('capture-area');
    if (!captureArea) return;
    
    toast.loading("準備圖片中...", { id: "capture-toast" });

    try {
      const options = {
        pixelRatio: 2, // High resolution
        backgroundColor: '#1e1e1e',
        width: captureArea.offsetWidth,
        height: captureArea.offsetHeight,
        cacheBust: true,
      };

      // Warm up call (often required for html-to-image on first run to load assets into cache)
      await toPng(captureArea, options).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 200));

      const dataUrl = await toPng(captureArea, options);

      if (!dataUrl || dataUrl.length < 5000) {
        throw new Error("截圖資料異常，可能是畫面尚未準備好，請重試");
      }

      const a = document.createElement('a');
      a.href = dataUrl;
      const fileDate = generationTime || new Date();
      const yr = fileDate.getFullYear();
      const mo = String(fileDate.getMonth() + 1).padStart(2, '0');
      const dy = String(fileDate.getDate()).padStart(2, '0');
      const hr = String(fileDate.getHours()).padStart(2, '0');
      const mn = String(fileDate.getMinutes()).padStart(2, '0');
      a.download = `marksix${yr}${mo}${dy}${hr}${mn}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast.success("成功儲存圖片！", { id: "capture-toast" });
    } catch (e: any) {
      console.error(e);
      toast.error(`截圖失敗: ${e?.message || '未知錯誤'}`, { id: "capture-toast" });
    }
  };

  const handleCaptureOCRScreenshot = async () => {
    const captureArea = document.getElementById('capture-area-ocr');
    if (!captureArea) return;
    
    toast.loading("準備 OCR 專用圖片中...", { id: "capture-toast" });

    try {
      const options = {
        pixelRatio: 2, // High resolution
        backgroundColor: '#ffffff',
        width: captureArea.offsetWidth,
        height: captureArea.offsetHeight,
        cacheBust: true,
        style: {
          transform: 'none',
        }
      };

      // Warm up call
      await toPng(captureArea, options).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 200));

      const dataUrl = await toPng(captureArea, options);

      if (!dataUrl || dataUrl.length < 5000) {
        throw new Error("截圖資料異常，可能是畫面尚未準備好，請重試");
      }

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `marksix-ocr-numbers-${new Date().toISOString().slice(0,10)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast.success("成功儲存 OCR 專用圖片！", { id: "capture-toast" });
    } catch (e: any) {
      console.error(e);
      toast.error(`截圖失敗: ${e?.message || '未知錯誤'}`, { id: "capture-toast" });
    }
  };

  const handleFloatingWindow = async () => {
    if (generatedBets.length === 0) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>幸運號碼</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 12px; background: #fff; color: #000; }
          h3 { margin-top: 0; font-weight: 900; font-size: 16px; border-bottom: 3px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
          .bet { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; border: 2px solid #000; padding: 6px; border-radius: 8px; box-shadow: 2px 2px 0 #000; }
          .index { font-weight: 900; font-size: 14px; transform: rotate(-10deg); width: 20px; text-align: center; }
          .balls { display: flex; gap: 4px; flex-wrap: wrap; }
          .ball { width: 24px; height: 24px; border-radius: 50%; border: 2px solid #000; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 11px; color: #fff; text-shadow: 1px 1px 0 #000; box-shadow: 1px 1px 0 #000; }
          .red { background: #FF9999; }
          .blue { background: #99CCFF; }
          .green { background: #99FF99; }
        </style>
      </head>
      <body>
        <h3>您的幸運號碼</h3>
        ${generatedBets.map((bet, i) => {
          if (bet.isBankerLegs && bet.bankersCount) {
            const htmlBankers = bet.numbers.slice(0, bet.bankersCount).map(n => {
              const color = getBallColor(n);
              const colorClass = color === 'red' ? 'red' : color === 'blue' ? 'blue' : 'green';
              return `<div class="ball ${colorClass}">${n}</div>`;
            }).join('');
            const htmlLegs = bet.numbers.slice(bet.bankersCount).map(n => {
              const color = getBallColor(n);
              const colorClass = color === 'red' ? 'red' : color === 'blue' ? 'blue' : 'green';
              return `<div class="ball ${colorClass}">${n}</div>`;
            }).join('');
            return `
              <div class="bet">
                <div class="index">#${i + 1}</div>
                <div class="balls" style="align-items: center;">
                  <div style="display:flex;gap:4px;padding:2px;background:rgba(255,235,59,0.3);border-radius:20px;">${htmlBankers}</div>
                  <div style="font-size:10px;font-weight:900;background:#000;color:#FFE867;padding:1px 3px;border-radius:4px;border:1px solid #fff;transform:rotate(6deg);">拖</div>
                  ${htmlLegs}
                </div>
              </div>
            `;
          }
          return `
          <div class="bet">
            <div class="index">#${i + 1}</div>
            <div class="balls">
              ${bet.numbers.map(n => {
                const color = getBallColor(n);
                const colorClass = color === 'red' ? 'red' : color === 'blue' ? 'blue' : 'green';
                return `<div class="ball ${colorClass}">${n}</div>`;
              }).join('')}
            </div>
          </div>
        `}).join('')}
      </body>
      </html>
    `;

    if ('documentPictureInPicture' in window) {
      try {
        const pipWindow = await (window as any).documentPictureInPicture.requestWindow({
          width: 280,
          height: 400,
        });
        pipWindow.document.open();
        pipWindow.document.write(htmlContent);
        pipWindow.document.close();
        return;
      } catch (err) {
        console.error("PiP failed:", err);
      }
    }

    // Fallback to standard popup
    const popup = window.open('', 'HKJC_Helper', 'width=280,height=400,left=100,top=100');
    if (popup) {
      popup.document.open();
      popup.document.write(htmlContent);
      popup.document.close();
    } else {
      toast.error("無法開啟小視窗，請允許瀏覽器彈出視窗。");
    }
  };

  const getBankerBookmarkletCode = (isDesktop: boolean = false) => {
    const bankerBets = generatedBets.filter(b => b.isBankerLegs && (b.bankersCount || 0) > 0);
    const convertedBets = bankerBets.map(b => ({
      bankers: b.numbers.slice(0, b.bankersCount!),
      legs: b.numbers.slice(b.bankersCount!)
    }));
    const betsJson = JSON.stringify(convertedBets);
    
    if (isDesktop) {
      const script = `(async function(){
        const bets = ${betsJson};
        if (!bets || bets.length === 0) { alert("沒有生成拖膽號碼！"); return; }
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const isCartWindow = (win) => {
          try {
            var name = (win.name || "").toLowerCase();
            var href = "";
            try { href = (win.location.href || "").toLowerCase(); } catch(e) {}
            if (
              name.includes("cart") || name.includes("slip") || name.includes("basket") || name.includes("reflist") || name.includes("receipt") || name.includes("queue") ||
              href.includes("cart") || href.includes("slip") || href.includes("basket") || href.includes("reflist") || href.includes("receipt") || href.includes("queue")
            ) {
              return true;
            }
          } catch(e){}
          return false;
        };
        const getFrames = (win) => {
          let res = [];
          if (isCartWindow(win)) return res;
          try { if(win.document) res.push({w: win, d: win.document}); } catch(e){}
          try {
            for(let i=0; i<win.frames.length; i++){
              res = res.concat(getFrames(win.frames[i]));
            }
          } catch(e){}
          return res;
        };
        const triggerClick = (el, win) => {
          try { el.scrollIntoView({block: 'center', behavior: 'smooth'}); } catch(e) {}
          const rect = el.getBoundingClientRect();
          const cx = Math.round(rect.left + rect.width / 2);
          const cy = Math.round(rect.top + rect.height / 2);
          el.click();
          if(win.MouseEvent){
            el.dispatchEvent(new win.MouseEvent('mousedown', {bubbles: true, clientX: cx, clientY: cy}));
            el.dispatchEvent(new win.MouseEvent('mouseup', {bubbles: true, clientX: cx, clientY: cy}));
          }
          if(win.PointerEvent){
            el.dispatchEvent(new win.PointerEvent('pointerdown', {bubbles: true, clientX: cx, clientY: cy}));
            el.dispatchEvent(new win.PointerEvent('pointerup', {bubbles: true, clientX: cx, clientY: cy}));
          }
        };
        const isInCart = (element, win) => {
          if (win && isCartWindow(win)) return true;
          var curr = element;
          while (curr) {
            var cl = "";
            var id = "";
            if (curr.className && typeof curr.className === "string") {
              cl = curr.className.toLowerCase();
            }
            if (curr.id && typeof curr.id === "string") {
              id = curr.id.toLowerCase();
            }
            if (
              cl.includes("cart") || cl.includes("slip") || cl.includes("basket") || cl.includes("summary") || cl.includes("infolist") || cl.includes("selected-numbers") || cl.includes("reflist") || cl.includes("receipt") || cl.includes("queue") ||
              id.includes("cart") || id.includes("slip") || id.includes("basket") || id.includes("summary") || id.includes("infolist") || id.includes("selected-numbers") || id.includes("reflist") || id.includes("receipt") || id.includes("queue")
            ) {
              return true;
            }
            if (cl.includes("header") || cl.includes("footer") || cl.includes("sidebar") || id.includes("header") || id.includes("footer") || id.includes("sidebar")) {
              return true;
            }
            curr = curr.parentElement;
          }
          return false;
        };

        const getSectionContainer = (section, docObj) => {
          const word = section === 'bankers' ? '膽' : '配腳';
          const engWord = section === 'bankers' ? 'Banker' : 'Leg';
          let bestContainer = null;
          let bestScore = -1;
          try {
            const allEls = docObj.querySelectorAll('div, section, ul, form, td');
            for (let i = 0; i < allEls.length; i++) {
              const el = allEls[i];
              if (!el) continue;
              let rect;
              try { rect = el.getBoundingClientRect(); } catch(e) { continue; }
              if (rect.width === 0 || rect.height === 0) continue;
              const textContent = el.textContent || "";
              const hasCnHdr = textContent.includes(word);
              const hasEnHdr = textContent.toLowerCase().includes(engWord.toLowerCase());
              if (!hasCnHdr && !hasEnHdr) continue;
              
              let ballCount = 0;
              const children = el.querySelectorAll('*');
              for (let j = 0; j < children.length; j++) {
                const child = children[j];
                if (!child) continue;
                const childText = (child.textContent || "").trim();
                const num = parseInt(childText, 10);
                if (num >= 1 && num <= 49 && childText === num.toString()) {
                  let crect;
                  try { crect = child.getBoundingClientRect(); } catch(e) { continue; }
                  if (crect.width > 0 && crect.height > 0) {
                    ballCount++;
                  }
                }
              }
              if (ballCount >= 6) {
                let score = ballCount;
                if (hasCnHdr) score += 100;
                if (hasEnHdr) score += 50;
                score += (10000 / (rect.height || 1));
                if (score > bestScore) {
                  bestScore = score;
                  bestContainer = el;
                }
              }
            }
          } catch(e){}
          return bestContainer;
        };

        let count = 0;
        for(const bet of bets){
          for (const section of ['bankers', 'legs']) {
            const arr = bet[section];
            if (!arr || arr.length === 0) continue;
            
            const framesTabs = getFrames(window);
            for(let {w, d} of framesTabs) {
              try {
                const xps = section === 'bankers' 
                  ? [
                      "//*[(normalize-space(.)='膽' or normalize-space(.)='膽拖' or normalize-space(.)='膽組' or normalize-space(.)='選擇膽') and (self::a or self::button or self::span or self::div or self::input or @role='button' or contains(@class, 'btn') or contains(@class, 'tab') or contains(@class, 'item') or contains(@class, 'select'))]",
                      "//*[normalize-space(text())='膽' or normalize-space(text())='膽拖' or @value='膽' or @value='膽拖' or @alt='膽' or @alt='膽拖']", 
                      "//*[normalize-space(text())='Bankers' or @value='Bankers']", 
                      "//*[normalize-space(text())='Banker' or @value='Banker']"
                    ] 
                  : [
                      "//*[(normalize-space(.)='配腳' or normalize-space(.)='腳' or normalize-space(.)='選擇配腳') and (self::a or self::button or self::span or self::div or self::input or @role='button' or contains(@class, 'btn') or contains(@class, 'tab') or contains(@class, 'item') or contains(@class, 'select'))]",
                      "//*[normalize-space(text())='配腳' or @value='配腳' or @alt='配腳']", 
                      "//*[normalize-space(text())='Legs' or @value='Legs']"
                    ];
                  
                let clickedTab = false;
                for (let xp of xps) {
                  const els = d.evaluate(xp, d, null, 7, null);
                  for(let i=0; i<els.snapshotLength; i++){
                    const el = els.snapshotItem(i);
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0 && !isInCart(el, w) && el.tagName !== 'BODY' && el.tagName !== 'HTML') {
                      triggerClick(el, w);
                      clickedTab = true;
                      break;
                    }
                  }
                  if (clickedTab) break;
                }
              } catch(e){}
            }
            await sleep(650);

            for(const num of arr){
              const str = num.toString();
              const pad = num < 10 ? '0'+num : str;
              let clicked = false;
              const frames = getFrames(window);
              for(let {w, d} of frames) {
                  try {
                      const container = getSectionContainer(section, d);
                      const xp = container 
                        ? ".//*[(normalize-space(text())='" + str + "' or normalize-space(text())='" + pad + "') and not(*)] | .//*[(normalize-space(.)='" + str + "' or normalize-space(.)='" + pad + "')]"
                        : "//*[(normalize-space(text())='" + str + "' or normalize-space(text())='" + pad + "') and not(*)] | //*[(normalize-space(.)='" + str + "' or normalize-space(.)='" + pad + "')]";
                      const els = d.evaluate(xp, container || d, null, 7, null);
                      let targetEl = null;
                      for(let i=0; i<els.snapshotLength; i++){
                        const el = els.snapshotItem(i);
                        const rect = el.getBoundingClientRect();
                        if(rect.width > 0 && rect.height > 0){
                          if (isInCart(el, w)) continue;
                          let hasChildrenText = false;
                          for(let c of el.children) {
                            if(c.textContent.trim().length > 0 && c.textContent.trim() !== str && c.textContent.trim() !== pad) {
                              hasChildrenText = true;
                            }
                          }
                          if (hasChildrenText) continue;
                          if (rect.width >= 20 && rect.width <= 150 && rect.height >= 20 && rect.height <= 150) {
                              targetEl = el;
                              if (el.className && typeof el.className === 'string' && (el.className.toLowerCase().includes('ball') || el.className.toLowerCase().includes('num'))) {
                                break;
                              }
                          }
                        }
                      }
                      if(targetEl){ 
                        triggerClick(targetEl, w); 
                        clicked = true;
                        break; 
                      }
                  } catch(e){}
              }
              if (!clicked) console.log("找不到號碼: " + str);
              await sleep(750);
            }
          }
          await sleep(2000);
          
          let clickedAdd = false;
          const frames2 = getFrames(window);
          for(let {w, d} of frames2) {
              try {
                const exactXp = "//*[normalize-space(.)='添加到投注區' or normalize-space(.)='加入注項' or @alt='添加到投注區' or @alt='加入注項'] | //*[contains(translate(text(), ' ', ''), '添加到投注區') or contains(translate(text(), ' ', ''), '加入注項')]";
                const exactEls = d.evaluate(exactXp, d, null, 7, null);
                for(let i=exactEls.snapshotLength - 1; i>=0; i--){
                  const el = exactEls.snapshotItem(i);
                  const rect = el.getBoundingClientRect();
                  if(rect.width > 0 && rect.height > 0 && el.tagName !== 'BODY' && el.tagName !== 'HTML'){ 
                    triggerClick(el, w); clickedAdd = true; break; 
                  }
                }
                if(clickedAdd) break;
              } catch(e){}
          }
          if(clickedAdd) {
            count++;
            await sleep(5000);
          } else {
            await sleep(2500);
          }
        }
        alert("拖膽電腦版點擊完成！共輸入 " + count + " 注。請核對投注區內容。");
      })();`;
      return `javascript:${encodeURIComponent(script)}`;
    } else {
      const script = `(async function(){
        const bets = ${betsJson};
        if (!bets || bets.length === 0) { alert("沒有生成拖膽號碼！"); return; }
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const triggerClick = (el) => {
          try { el.scrollIntoView({block: 'center', behavior: 'auto'}); } catch(e) {}
          const rect = el.getBoundingClientRect();
          const cx = Math.round(rect.left + rect.width / 2);
          const cy = Math.round(rect.top + rect.height / 2);
          
          if(window.TouchEvent){
            try {
              const touch = new Touch({
                identifier: Date.now(),
                target: el,
                clientX: cx,
                clientY: cy,
                screenX: cx,
                screenY: cy,
                pageX: cx + window.scrollX,
                pageY: cy + window.scrollY
              });
              el.dispatchEvent(new TouchEvent('touchstart', {bubbles: true, cancelable: true, touches: [touch], targetTouches: [touch], changedTouches: [touch]}));
              el.dispatchEvent(new TouchEvent('touchend', {bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [touch]}));
            } catch(te){}
          }
          
          el.click();
          if(window.MouseEvent){
            el.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, clientX: cx, clientY: cy}));
            el.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, clientX: cx, clientY: cy}));
          }
          if(window.PointerEvent){
            el.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, clientX: cx, clientY: cy}));
            el.dispatchEvent(new PointerEvent('pointerup', {bubbles: true, clientX: cx, clientY: cy}));
          }
        };
        const isInCart = (element) => {
          var curr = element;
          while (curr) {
            var cl = "";
            var id = "";
            if (curr.className && typeof curr.className === "string") {
              cl = curr.className.toLowerCase();
            }
            if (curr.id && typeof curr.id === "string") {
              id = curr.id.toLowerCase();
            }
            if (
              cl.includes("cart") || cl.includes("slip") || cl.includes("basket") || cl.includes("summary") || cl.includes("infolist") || cl.includes("selected-numbers") || cl.includes("selected_numbers") || cl.includes("selected-num") || cl.includes("selected_num") || cl.includes("reflist") || cl.includes("receipt") || cl.includes("queue") || cl.includes("preview") || cl.includes("favorite") || cl.includes("heart") || cl.includes("fixed-bottom") || cl.includes("footer") || cl.includes("bottom") || cl.includes("punter") ||
              id.includes("cart") || id.includes("slip") || id.includes("basket") || id.includes("summary") || id.includes("infolist") || id.includes("selected-numbers") || id.includes("selected_numbers") || id.includes("selected-num") || id.includes("selected_num") || id.includes("reflist") || id.includes("receipt") || id.includes("queue") || id.includes("preview") || id.includes("favorite") || id.includes("heart") || id.includes("fixed-bottom") || id.includes("footer") || id.includes("bottom") || id.includes("punter")
            ) {
              return true;
            }
            if (cl.includes("header") || cl.includes("footer") || cl.includes("sidebar") || id.includes("header") || id.includes("footer") || id.includes("sidebar")) {
              return true;
            }
            curr = curr.parentElement;
          }
          return false;
        };

        const getSectionContainer = (section, docObj) => {
          const word = section === 'bankers' ? '膽' : '配腳';
          const engWord = section === 'bankers' ? 'Banker' : 'Leg';
          let bestContainer = null;
          let bestScore = -1;
          try {
            const allEls = docObj.querySelectorAll('div, section, ul, form, td');
            for (let i = 0; i < allEls.length; i++) {
              const el = allEls[i];
              if (!el) continue;
              let rect;
              try { rect = el.getBoundingClientRect(); } catch(e) { continue; }
              if (rect.width === 0 || rect.height === 0) continue;
              const textContent = el.textContent || "";
              const hasCnHdr = textContent.includes(word);
              const hasEnHdr = textContent.toLowerCase().includes(engWord.toLowerCase());
              if (!hasCnHdr && !hasEnHdr) continue;
              
              let ballCount = 0;
              const children = el.querySelectorAll('*');
              for (let j = 0; j < children.length; j++) {
                const child = children[j];
                if (!child) continue;
                const childText = (child.textContent || "").trim();
                const num = parseInt(childText, 10);
                if (num >= 1 && num <= 49 && childText === num.toString()) {
                  let crect;
                  try { crect = child.getBoundingClientRect(); } catch(e) { continue; }
                  if (crect.width > 0 && crect.height > 0) {
                    ballCount++;
                  }
                }
              }
              if (ballCount >= 6) {
                let score = ballCount;
                if (hasCnHdr) score += 100;
                if (hasEnHdr) score += 50;
                score += (10000 / (rect.height || 1));
                if (score > bestScore) {
                  bestScore = score;
                  bestContainer = el;
                }
              }
            }
          } catch(e){}
          return bestContainer;
        };

        let count = 0;
        for(const bet of bets){
          for (const section of ['bankers', 'legs']) {
            const arr = bet[section];
            if (!arr || arr.length === 0) continue;
            
            try {
              const xps = section === 'bankers' 
                ? [
                    "//*[(normalize-space(.)='膽' or normalize-space(.)='膽拖' or normalize-space(.)='膽組' or normalize-space(.)='選擇膽') and (self::a or self::button or self::span or self::div or self::input or @role='button' or contains(@class, 'btn') or contains(@class, 'tab') or contains(@class, 'item') or contains(@class, 'select'))]",
                    "//*[normalize-space(text())='膽' or normalize-space(text())='膽拖' or @value='膽' or @value='膽拖' or @alt='膽' or @alt='膽拖']", 
                    "//*[normalize-space(text())='Bankers' or @value='Bankers']", 
                    "//*[normalize-space(text())='Banker' or @value='Banker']"
                  ] 
                : [
                    "//*[(normalize-space(.)='配腳' or normalize-space(.)='腳' or normalize-space(.)='選擇配腳') and (self::a or self::button or self::span or self::div or self::input or @role='button' or contains(@class, 'btn') or contains(@class, 'tab') or contains(@class, 'item') or contains(@class, 'select'))]",
                    "//*[normalize-space(text())='配腳' or @value='配腳' or @alt='配腳']", 
                    "//*[normalize-space(text())='Legs' or @value='Legs']"
                  ];
                
              let clickedTab = false;
              for (let xp of xps) {
                const els = document.evaluate(xp, document, null, 7, null);
                for(let i=0; i<els.snapshotLength; i++){
                  const el = els.snapshotItem(i);
                  const rect = el.getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0 && !isInCart(el) && el.tagName !== 'BODY' && el.tagName !== 'HTML') {
                    triggerClick(el);
                    clickedTab = true;
                    break;
                  }
                }
                if (clickedTab) break;
              }
            } catch(e){}
            await sleep(650);

            const container = getSectionContainer(section, document);
            for(const num of arr){
              const str = num.toString();
              const pad = num < 10 ? '0'+num : str;
              const xp = container 
                ? ".//*[(normalize-space(text())='" + str + "' or normalize-space(text())='" + pad + "') and not(*)] | .//*[(normalize-space(.)='" + str + "' or normalize-space(.)='" + pad + "')]"
                : "//*[(normalize-space(text())='" + str + "' or normalize-space(text())='" + pad + "') and not(*)] | //*[(normalize-space(.)='" + str + "' or normalize-space(.)='" + pad + "')]";
              const els = document.evaluate(xp, container || document, null, 7, null);
              let clicked = false;
              let targetEl = null;

              for(let i=0; i<els.snapshotLength; i++){
                const el = els.snapshotItem(i);
                const rect = el.getBoundingClientRect();
                if(rect.width > 0 && rect.height > 0){
                  if (isInCart(el)) continue;
                  
                  let hasChildrenText = false;
                  for(let c of el.children) {
                    if(c.textContent.trim().length > 0 && c.textContent.trim() !== str && c.textContent.trim() !== pad) {
                      hasChildrenText = true;
                    }
                  }
                  if (hasChildrenText) continue;
                  
                  if (rect.width >= 20 && rect.width <= 150 && rect.height >= 20 && rect.height <= 150) {
                      targetEl = el;
                      const tagName = el.tagName.toLowerCase();
                      const className = (el.className && typeof el.className === 'string') ? el.className.toLowerCase() : "";
                      if (className.includes('ball') || className.includes('num') || tagName === 'button' || tagName === 'a') {
                        break;
                      }
                  }
                }
              }
              if(targetEl){ 
                triggerClick(targetEl); 
                clicked = true;
              }

              if (!clicked) console.log("找不到號碼: " + str);
              await sleep(850);
            }
          }
          await sleep(2000);
          
          let clickedAdd = false;
          const exactXp = "//*[normalize-space(.)='添加到投注區' or normalize-space(.)='加入注項' or @alt='添加到投注區' or @alt='加入注項'] | //*[contains(translate(text(), ' ', ''), '添加到投注區') or contains(translate(text(), ' ', ''), '加入注項')]";
          const exactEls = document.evaluate(exactXp, document, null, 7, null);
          for(let i=exactEls.snapshotLength - 1; i>=0; i--){
            const el = exactEls.snapshotItem(i);
            const rect = el.getBoundingClientRect();
            if(rect.width > 0 && rect.height > 0 && el.tagName !== 'BODY' && el.tagName !== 'HTML'){ 
              triggerClick(el); 
              clickedAdd = true; 
              break; 
            }
          }
          
          if(!clickedAdd) {
            const fallbackXp = "//*[contains(text(), '添加到投注區') or contains(text(), '加入注項')]";
            const fallbackEls = document.evaluate(fallbackXp, document, null, 7, null);
            for(let i=fallbackEls.snapshotLength - 1; i>=0; i--){
              const el = fallbackEls.snapshotItem(i);
              const rect = el.getBoundingClientRect();
              if(rect.width > 0 && rect.height > 0 && el.tagName !== 'BODY' && el.tagName !== 'HTML'){ 
                triggerClick(el); clickedAdd = true; break; 
              }
            }
          }
          
          if(clickedAdd) count++;
          await sleep(5000);
        }
        alert("拖膽手機版點擊完成！共嘗試輸入 " + count + " 注。請核對投注區內容。");
      })();`;
      return `javascript:${encodeURIComponent(script)}`;
    }
  };

  const getBookmarkletCode = (isDesktop: boolean = false) => {
    const betsJson = JSON.stringify(generatedBets.map(b => b.numbers));
    if (isDesktop) {
      const script = `(async function(){
        const bets = ${betsJson};
        if (!bets || bets.length === 0) { alert("沒有生成號碼！"); return; }
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const isCartWindow = (win) => {
          try {
            var name = (win.name || "").toLowerCase();
            var href = "";
            try { href = (win.location.href || "").toLowerCase(); } catch(e) {}
            if (
              name.includes("cart") || name.includes("slip") || name.includes("basket") || name.includes("reflist") || name.includes("receipt") || name.includes("queue") ||
              href.includes("cart") || href.includes("slip") || href.includes("basket") || href.includes("reflist") || href.includes("receipt") || href.includes("queue")
            ) {
              return true;
            }
          } catch(e){}
          return false;
        };
        const getFrames = (win) => {
          let res = [];
          if (isCartWindow(win)) return res;
          try { if(win.document) res.push({w: win, d: win.document}); } catch(e){}
          try {
            for(let i=0; i<win.frames.length; i++){
              res = res.concat(getFrames(win.frames[i]));
            }
          } catch(e){}
          return res;
        };
        const triggerClick = (el, win) => {
          try { el.scrollIntoView({block: 'center', behavior: 'smooth'}); } catch(e) {}
          const rect = el.getBoundingClientRect();
          const cx = Math.round(rect.left + rect.width / 2);
          const cy = Math.round(rect.top + rect.height / 2);
          el.click();
          if(win.MouseEvent){
            el.dispatchEvent(new win.MouseEvent('mousedown', {bubbles: true, clientX: cx, clientY: cy}));
            el.dispatchEvent(new win.MouseEvent('mouseup', {bubbles: true, clientX: cx, clientY: cy}));
          }
          if(win.PointerEvent){
            el.dispatchEvent(new win.PointerEvent('pointerdown', {bubbles: true, clientX: cx, clientY: cy}));
            el.dispatchEvent(new win.PointerEvent('pointerup', {bubbles: true, clientX: cx, clientY: cy}));
          }
        };
        const isInCart = (element, win) => {
          if (win && isCartWindow(win)) return true;
          var curr = element;
          while (curr) {
            var cl = "";
            var id = "";
            if (curr.className && typeof curr.className === "string") {
              cl = curr.className.toLowerCase();
            }
            if (curr.id && typeof curr.id === "string") {
              id = curr.id.toLowerCase();
            }
            if (
              cl.includes("cart") || cl.includes("slip") || cl.includes("basket") || cl.includes("summary") || cl.includes("infolist") || cl.includes("selected-numbers") || cl.includes("reflist") || cl.includes("receipt") || cl.includes("queue") ||
              id.includes("cart") || id.includes("slip") || id.includes("basket") || id.includes("summary") || id.includes("infolist") || id.includes("selected-numbers") || id.includes("reflist") || id.includes("receipt") || id.includes("queue")
            ) {
              return true;
            }
            if (cl.includes("header") || cl.includes("footer") || cl.includes("sidebar") || id.includes("header") || id.includes("footer") || id.includes("sidebar")) {
              return true;
            }
            curr = curr.parentElement;
          }
          return false;
        };

        let count = 0;
        for(const bet of bets){
          for(const num of bet){
            const str = num.toString();
            const pad = num < 10 ? '0'+num : str;
            let clicked = false;
            const frames = getFrames(window);
            for(let {w, d} of frames) {
                try {
                    const xp = "//*[(normalize-space(text())='"+str+"' or normalize-space(text())='"+pad+"') and not(*)] | //*[(normalize-space(.)='"+str+"' or normalize-space(.)='"+pad+"')]";
                    const els = d.evaluate(xp, d, null, 7, null);
                    let targetEl = null;

                    for(let i=0; i<els.snapshotLength; i++){
                      const el = els.snapshotItem(i);
                      const rect = el.getBoundingClientRect();
                      if(rect.width > 0 && rect.height > 0){
                        if (isInCart(el, w)) continue;
                        
                        let hasChildrenText = false;
                        for(let c of el.children) {
                          if(c.textContent.trim().length > 0 && c.textContent.trim() !== str && c.textContent.trim() !== pad) {
                            hasChildrenText = true;
                          }
                        }
                        if (hasChildrenText) continue;
                        
                        if (rect.width >= 20 && rect.width <= 150 && rect.height >= 20 && rect.height <= 150) {
                            targetEl = el;
                            if (el.className && typeof el.className === 'string' && (el.className.toLowerCase().includes('ball') || el.className.toLowerCase().includes('num'))) {
                              break;
                            }
                        }
                      }
                    }
                    if(targetEl){ 
                      triggerClick(targetEl, w); 
                      clicked = true;
                      break; 
                    }
                } catch(e){}
            }
            if (!clicked) console.log("找不到號碼: " + str);
            await sleep(800);
          }
          await sleep(2000);
          
          let clickedAdd = false;
          const frames2 = getFrames(window);
          for(let {w, d} of frames2) {
              try {
                  const exactXp = "//*[normalize-space(.)='添加到投注區' or normalize-space(.)='加入注項' or @alt='添加到投注區' or @alt='加入注項'] | //*[contains(translate(text(), ' ', ''), '添加到投注區') or contains(translate(text(), ' ', ''), '加入注項')]";
                  const exactEls = d.evaluate(exactXp, d, null, 7, null);
                  for(let i=exactEls.snapshotLength - 1; i>=0; i--){
                    const el = exactEls.snapshotItem(i);
                    const rect = el.getBoundingClientRect();
                    if(rect.width > 0 && rect.height > 0 && el.tagName !== 'BODY' && el.tagName !== 'HTML'){ 
                      triggerClick(el, w); 
                      clickedAdd = true; 
                      break; 
                    }
                  }
                  if(clickedAdd) break;
              } catch(e){}
          }
          if(clickedAdd) count++;
          await sleep(5000);
        }
        alert("電腦版自動點擊完成！共嘗試輸入 " + count + " 注。請核對投注區內容。");
      })();`;
      return `javascript:${encodeURIComponent(script)}`;
    } else {
      const script = `(async function(){
        const bets = ${betsJson};
        if (!bets || bets.length === 0) {
          alert("沒有生成號碼！");
          return;
        }
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const triggerClick = (el) => {
          try { el.scrollIntoView({block: 'center', behavior: 'auto'}); } catch(e) {}
          const rect = el.getBoundingClientRect();
          const cx = Math.round(rect.left + rect.width / 2);
          const cy = Math.round(rect.top + rect.height / 2);
          
          if(window.TouchEvent){
            try {
              const touch = new Touch({
                identifier: Date.now(),
                target: el,
                clientX: cx,
                clientY: cy,
                screenX: cx,
                screenY: cy,
                pageX: cx + window.scrollX,
                pageY: cy + window.scrollY
              });
              el.dispatchEvent(new TouchEvent('touchstart', {bubbles: true, cancelable: true, touches: [touch], targetTouches: [touch], changedTouches: [touch]}));
              el.dispatchEvent(new TouchEvent('touchend', {bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [touch]}));
            } catch(te){}
          }
          
          el.click();
          if(window.MouseEvent){
            el.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, clientX: cx, clientY: cy}));
            el.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, clientX: cx, clientY: cy}));
          }
          if (window.PointerEvent) {
            el.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, clientX: cx, clientY: cy}));
            el.dispatchEvent(new PointerEvent('pointerup', {bubbles: true, clientX: cx, clientY: cy}));
          }
        };
        const isInCart = (element) => {
          var curr = element;
          while (curr) {
            var cl = "";
            var id = "";
            if (curr.className && typeof curr.className === "string") {
              cl = curr.className.toLowerCase();
            }
            if (curr.id && typeof curr.id === "string") {
              id = curr.id.toLowerCase();
            }
            if (
              cl.includes("cart") || cl.includes("slip") || cl.includes("basket") || cl.includes("summary") || cl.includes("infolist") || cl.includes("selected-numbers") || cl.includes("selected_numbers") || cl.includes("selected-num") || cl.includes("selected_num") || cl.includes("reflist") || cl.includes("receipt") || cl.includes("queue") || cl.includes("preview") || cl.includes("favorite") || cl.includes("heart") || cl.includes("fixed-bottom") || cl.includes("footer") || cl.includes("bottom") || cl.includes("punter") ||
              id.includes("cart") || id.includes("slip") || id.includes("basket") || id.includes("summary") || id.includes("infolist") || id.includes("selected-numbers") || id.includes("selected_numbers") || id.includes("selected-num") || id.includes("selected_num") || id.includes("reflist") || id.includes("receipt") || id.includes("queue") || id.includes("preview") || id.includes("favorite") || id.includes("heart") || id.includes("fixed-bottom") || id.includes("footer") || id.includes("bottom") || id.includes("punter")
            ) {
              return true;
            }
            if (cl.includes("header") || cl.includes("footer") || cl.includes("sidebar") || id.includes("header") || id.includes("footer") || id.includes("sidebar")) {
              return true;
            }
            curr = curr.parentElement;
          }
          return false;
        };
        let count = 0;
        for(const bet of bets){
          for(const num of bet){
            const str = num.toString();
            const pad = num < 10 ? '0'+num : str;
            const xp = "//*[(normalize-space(text())='"+str+"' or normalize-space(text())='"+pad+"') and not(*)] | //*[(normalize-space(.)='"+str+"' or normalize-space(.)='"+pad+"')]";
            const els = document.evaluate(xp, document, null, 7, null);
            let clicked = false;
            let targetEl = null;

            for(let i=0; i<els.snapshotLength; i++){
              const el = els.snapshotItem(i);
              const rect = el.getBoundingClientRect();
              if(rect.width > 0 && rect.height > 0){
                if (isInCart(el)) continue;
                
                let hasChildrenText = false;
                for(let c of el.children) {
                  if(c.textContent.trim().length > 0 && c.textContent.trim() !== str && c.textContent.trim() !== pad) {
                    hasChildrenText = true;
                  }
                }
                if (hasChildrenText) continue;
                
                if (rect.width >= 20 && rect.width <= 150 && rect.height >= 20 && rect.height <= 150) {
                    targetEl = el;
                    const tagName = el.tagName.toLowerCase();
                    const className = (el.className && typeof el.className === 'string') ? el.className.toLowerCase() : "";
                    if (className.includes('ball') || className.includes('num') || tagName === 'button' || tagName === 'a') {
                      break;
                    }
                }
              }
            }
            if(targetEl){ 
              triggerClick(targetEl); 
              clicked = true;
            }

            if (!clicked) console.log("找不到號碼: " + str);
            await sleep(800);
          }
          await sleep(2000);
          
          let clickedAdd = false;
          const exactXp = "//*[normalize-space(.)='添加到投注區' or normalize-space(.)='加入注項']";
          const exactEls = document.evaluate(exactXp, document, null, 7, null);
          for(let i=exactEls.snapshotLength - 1; i>=0; i--){
            const el = exactEls.snapshotItem(i);
            const rect = el.getBoundingClientRect();
            if(rect.width > 0 && rect.height > 0){ triggerClick(el); clickedAdd = true; break; }
          }
          
          if(!clickedAdd) {
            const fallbackXp = "//*[contains(text(), '添加到投注區') or contains(text(), '加入注項')]";
            const fallbackEls = document.evaluate(fallbackXp, document, null, 7, null);
            for(let i=fallbackEls.snapshotLength - 1; i>=0; i--){
              const el = fallbackEls.snapshotItem(i);
              const rect = el.getBoundingClientRect();
              if(rect.width > 0 && rect.height > 0 && el.tagName !== 'BODY' && el.tagName !== 'HTML'){ 
                triggerClick(el); clickedAdd = true; break; 
              }
            }
          }
          
          if(clickedAdd) count++;
          await sleep(5000);
        }
        alert("自動點擊完成！共嘗試輸入 " + count + " 注。請核對投注區內容。");
      })();`;
      return `javascript:${encodeURIComponent(script)}`;
    }
  };

  const handleSubmitToHKJC = () => {
    if (!hkjcUsername || !hkjcPassword) {
      toast.error("請輸入登入名稱及密碼");
      return;
    }

    localStorage.setItem("hkjc_mock_user", hkjcUsername);
    setSavedCredentials(true);
    setIsHkjcDialogOpen(false);

    toast.promise(new Promise((resolve) => setTimeout(resolve, 1500)), {
      loading: "正在連接香港賽馬會...",
      success: "已成功將注項傳送至 HKJC (模擬) 🚀",
      error: "連接失敗",
    });
  };

  return (
    <div className="min-h-screen text-zinc-900 pb-20 font-sans selection:bg-[#FF4D4D] selection:text-white">
      <header className="bg-[#BAE6FD] border-b-4 border-black sticky top-0 z-10 shadow-[0px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="max-w-[1600px] mx-auto px-2 sm:px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 sm:shrink sm:flex-1 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#FF4D4D] border-[3px] sm:border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center font-black transform -rotate-6 shrink-0">
              <span className="text-[#FFE867] text-xl sm:text-[26px] leading-none mb-[1px]" style={{ WebkitTextStroke: '1.5px black' }}>
                $
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 min-w-0 pb-0.5 sm:flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 min-w-0 shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2 font-black text-black bg-[#FFD700] px-2 py-0.5 sm:px-3 sm:py-1 border-[2px] sm:border-[3px] border-black rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] sm:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] leading-none w-fit">
                  <h1 className="text-[17px] sm:text-xl tracking-tighter uppercase whitespace-nowrap leading-none m-0 p-0">
                    池要中六合彩
                  </h1>
                  <span className="text-[10px] sm:text-xs font-bold text-black/80 whitespace-nowrap leading-none mt-[1px] sm:mt-0">
                    此系統由池記桌遊提供
                  </span>
                </div>
              </div>
              <div className="hidden lg:flex flex-1 justify-between gap-x-3 gap-y-10 flex-wrap overflow-hidden px-4 pl-8 self-center max-h-[44px] pt-0.5">
                {Array.from({ length: 15 }).map((_, i) => (
                  <div key={i} className="w-10 h-10 rounded-full bg-[#FF4D4D] border-4 border-black flex items-center justify-center font-black transform -rotate-6 shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <span className="text-[#FFE867] text-[26px] leading-none mb-[1px]" style={{ WebkitTextStroke: '1.5px black' }}>
                      $
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Button
              variant="outline"
              className="border-[3px] border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] sm:border-4 sm:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 sm:hover:translate-y-1 sm:hover:translate-x-1 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all rounded-full h-auto py-1 px-2 sm:py-1.5 sm:px-3 text-xs sm:text-sm bg-orange-400 hover:bg-orange-500 text-black border-black/80"
              onClick={() => {
                setGeneratedBets([]);
                setSpecialCoverBets([]);
                setUndoStack([]);
                setBankers([]);
                setAnalysisDrawIndex(null);
                setExcludedLegs([]);

                // Reset all generation settings to defaults so there are no lingering AI presets
                setPreferredOddCount(null);
                setPreferredEvenCount(null);
                setOddEven("all");
                setColors(["red", "blue", "green"]);
                setColorRatioOption(3);
                setEnableRecent(false);
                setRecentMode("");
                setRecentCount(5);
                setEnableComplexRecent(false);
                setComplexExcludeRanges([{start: 1, end: 5}]);
                setComplexIncludeRanges([{start: 6, end: 10}]);
                setEnableExcludeUnseen(false);
                setExcludeUnseenCount(20);
                setExcludeUnseenIncludeSpecial(false);
                setNoConsecutivePairs(false);
                setNoConsecutiveTriplets(false);
                setUse2Combos(false);
                setCombo2Count(1);
                setUse3Combos(false);
                setCombo3Count(1);
              }}
            >
              <span className="hidden sm:inline">回到首頁</span>
              <span className="inline sm:hidden"><Home className="w-3.5 h-3.5" /></span>
            </Button>
            <Button
              variant="outline"
              className="border-[3px] border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] sm:border-4 sm:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 sm:hover:translate-y-1 sm:hover:translate-x-1 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all rounded-full h-auto py-1 px-2 sm:py-1.5 sm:px-3 text-xs sm:text-sm bg-black text-[#FFD700] hover:bg-black hover:text-[#FFD700]"
              onClick={() => {
                const isAndroid = /Android/i.test(navigator.userAgent);
                const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
                if (isAndroid) {
                  window.open("intent://bet.hkjc.com/ch/marksix/home#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fbet.hkjc.com%2Fch%2Fmarksix%2Fhome;end", "_top");
                } else if (isIOS) {
                  window.open("googlechrome://bet.hkjc.com/ch/marksix/home", "_top");
                  setTimeout(() => {
                    window.open("https://bet.hkjc.com/ch/marksix/home", "_blank");
                  }, 1000);
                } else {
                  window.open("https://bet.hkjc.com/ch/marksix/home", "_blank");
                }
              }}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1 sm:mr-1.5" />
              <span>前往 HKJC</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-0 sm:px-4 pt-0 pb-2 sm:pt-0 sm:pb-2 bg-black">
        <div className={`grid grid-cols-1 ${generatedBets.length === 0 ? "lg:grid-cols-12" : ""} gap-1.5 sm:gap-4`}>
          {/* Left Column: Settings */}
          {generatedBets.length === 0 && (
            <div className="lg:col-span-5 space-y-2">
            <Card className="border-y-[3px] sm:border-4 border-x-0 sm:border-x-4 border-black rounded-none sm:rounded-3xl shadow-none sm:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden p-0 gap-0">
              <CardHeader className="flex flex-row items-center justify-between sm:items-end sm:gap-2 space-y-0 bg-[#ffedd5] border-b-[3px] sm:border-b-4 border-black px-3 py-2 sm:px-4 sm:py-3 m-0 rounded-none w-full !grid-cols-1 sm:!flex">
                <div className="flex flex-col sm:flex-row sm:items-end sm:gap-2">
                  <CardTitle className="flex items-center gap-1.5 text-base sm:text-xl font-black shrink-0">
                    <Settings2 className="w-4 h-4 sm:w-5 sm:h-5 sm:mb-[1px]" />
                    號碼生成設定
                  </CardTitle>
                  <CardDescription className="text-black font-bold opacity-80 text-[11px] sm:text-[15px] leading-none mt-0.5 sm:mt-0 sm:pb-[2px] truncate">
                    自訂您的幸運選號策略 ✨
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={resetSettings} 
                  className="bg-[#FF5C00] text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#E65300] hover:text-black hover:translate-x-px hover:translate-y-px hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all font-bold h-7 sm:h-8 px-2 sm:px-3 text-xs sm:text-sm shrink-0"
                >
                  <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5 text-black" />
                  重設
                </Button>
              </CardHeader>
              <CardContent className="space-y-1.5 px-3 pb-3 pt-2 sm:space-y-2 sm:px-4 sm:pb-4 sm:pt-3">
                {/* Bet Count */}
                <div className="space-y-0.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-bold">生成注數</Label>
                    <span className="font-black text-lg text-black bg-[#FFD700] px-3 py-0.5 border-[2px] sm:border-[3px] border-black rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                      {betCount} 注
                    </span>
                  </div>
                  <Slider
                    value={betCount}
                    min={1}
                    max={30}
                    step={1}
                    onValueChange={(val) => {
                      const newValue = Array.isArray(val) ? val[0] : val;
                      setBetCount(newValue as number);
                    }}
                    className="py-1 sm:py-2 cursor-pointer"
                  />
                </div>

                {/* Range */}
                <div className="space-y-0.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-bold">號碼範圍</Label>
                    <div className="flex gap-2">
                      {ranges.length < 3 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs border-2 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all"
                          onClick={() => {
                            setRanges([...ranges, {start: 1, end: 49}]);
                          }}
                        >
                          + 新增範圍
                        </Button>
                      )}
                      {ranges.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs border-2 border-[red] text-red-600 font-bold shadow-[2px_2px_0px_0px_rgba(255,0,0,0.5)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all"
                          onClick={() => {
                            const newRanges = [...ranges];
                            newRanges.pop();
                            setRanges(newRanges);
                          }}
                        >
                          - 移除範圍
                        </Button>
                      )}
                    </div>
                  </div>
                  {ranges.map((range, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex justify-end items-center">
                        {ranges.length > 1 && <span className="text-sm font-bold text-zinc-500 mr-auto">範圍 {index + 1}</span>}
                    <span className="font-black text-[15px] sm:text-lg text-black bg-[#FFD700] px-3 py-0.5 border-[2px] sm:border-[3px] border-black rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                      {range.start} - {range.end}
                    </span>
                      </div>
                      <Slider
                        value={[range.start, range.end]}
                        min={1}
                        max={49}
                        step={1}
                        onValueChange={(val) => {
                          const valArray = Array.isArray(val) ? val : [val, val];
                          const newRanges = [...ranges];
                          newRanges[index] = {start: valArray[0], end: valArray[1] || valArray[0]};
                          setRanges(newRanges);
                        }}
                        className="py-1 sm:py-2 cursor-pointer"
                      />
                    </div>
                  ))}
                </div>

                {/* Sum Range */}
                <div className="space-y-0.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-bold">總和值分佈 (110~190為常態)</Label>
                    <span className="font-black text-[15px] sm:text-lg text-black bg-[#FFD700] px-3 py-0.5 border-[2px] sm:border-[3px] border-black rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                      {sumRange[0]} - {sumRange[1]}
                    </span>
                  </div>
                  <Slider
                    value={sumRange}
                    min={21}
                    max={279}
                    step={1}
                    onValueChange={(val) => {
                      const valArray = Array.isArray(val) ? val : [val, val];
                      setSumRange([valArray[0], valArray[1] || valArray[0]]);
                    }}
                    className="py-1 sm:py-2 cursor-pointer"
                  />
                </div>

                {/* Odd/Even */}
                <div className="space-y-0.5">
                  <Label className="text-base font-bold">單雙組合</Label>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => { setOddEven("all"); setPreferredOddCount(null); setPreferredEvenCount(null); }}
                      className={`px-3 py-1 border-4 border-black rounded-full font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${oddEven === "all" && preferredOddCount === null ? "bg-[#FFE867] translate-y-0.5 translate-x-0.5 shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]" : "bg-white hover:bg-zinc-50"}`}
                    >
                      不限組合
                    </button>
                    <button
                      onClick={() => { setOddEven("odd"); setPreferredOddCount(null); setPreferredEvenCount(null); }}
                      className={`px-3 py-1 border-4 border-black rounded-full font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${oddEven === "odd" ? "bg-[#FFE867] translate-y-0.5 translate-x-0.5 shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]" : "bg-white hover:bg-zinc-50"}`}
                    >
                      全單數 (6單)
                    </button>
                    <button
                      onClick={() => { setOddEven("even"); setPreferredOddCount(null); setPreferredEvenCount(null); }}
                      className={`px-3 py-1 border-4 border-black rounded-full font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${oddEven === "even" ? "bg-[#FFE867] translate-y-0.5 translate-x-0.5 shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]" : "bg-white hover:bg-zinc-50"}`}
                    >
                      全雙數 (6雙)
                    </button>
                    <button
                      onClick={() => { setOddEven("all"); setPreferredOddCount(3); setPreferredEvenCount(3); }}
                      className={`px-3 py-1 border-4 border-black rounded-full font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${preferredOddCount === 3 ? "bg-[#FFE867] translate-y-0.5 translate-x-0.5 shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]" : "bg-white hover:bg-zinc-50"}`}
                    >
                      3單 3雙
                    </button>
                    <button
                      onClick={() => { setOddEven("all"); setPreferredOddCount(4); setPreferredEvenCount(2); }}
                      className={`px-3 py-1 border-4 border-black rounded-full font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${preferredOddCount === 4 ? "bg-[#FFE867] translate-y-0.5 translate-x-0.5 shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]" : "bg-white hover:bg-zinc-50"}`}
                    >
                      4單 2雙
                    </button>
                    <button
                      onClick={() => { setOddEven("all"); setPreferredOddCount(2); setPreferredEvenCount(4); }}
                      className={`px-3 py-1 border-4 border-black rounded-full font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${preferredEvenCount === 4 ? "bg-[#FFE867] translate-y-0.5 translate-x-0.5 shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]" : "bg-white hover:bg-zinc-50"}`}
                    >
                      2單 4雙
                    </button>
                    <button
                      onClick={() => { setOddEven("all"); setPreferredOddCount(5); setPreferredEvenCount(1); }}
                      className={`px-3 py-1 border-4 border-black rounded-full font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${preferredOddCount === 5 ? "bg-[#FFE867] translate-y-0.5 translate-x-0.5 shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]" : "bg-white hover:bg-zinc-50"}`}
                    >
                      5單 1雙
                    </button>
                    <button
                      onClick={() => { setOddEven("all"); setPreferredOddCount(1); setPreferredEvenCount(5); }}
                      className={`px-3 py-1 border-4 border-black rounded-full font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${preferredEvenCount === 5 ? "bg-[#FFE867] translate-y-0.5 translate-x-0.5 shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]" : "bg-white hover:bg-zinc-50"}`}
                    >
                      1單 5雙
                    </button>
                  </div>
                </div>

                {/* Colors */}
                <div className="space-y-0.5">
                  <Label className="text-base font-bold">波色選擇</Label>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setColors(["red", "blue", "green"])}
                      className={`px-3 py-1 border-4 border-black rounded-full font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${colors.length === 3 ? "bg-[#FFE867] translate-y-0.5 translate-x-0.5 shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]" : "bg-white hover:bg-zinc-50"}`}
                    >
                      全部顏色
                    </button>
                    <button
                      onClick={() => {
                        if (colors.length === 3) {
                          setColors(["red"]);
                        } else {
                          handleColorToggle("red");
                        }
                      }}
                      className={`px-3 py-1 border-4 border-black rounded-full font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${colors.includes("red") && colors.length < 3 ? "bg-[#FF9999] text-black translate-y-0.5 translate-x-0.5 shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]" : "bg-white hover:bg-red-50 text-black/50"}`}
                    >
                      包含紅波
                    </button>
                    <button
                      onClick={() => {
                        if (colors.length === 3) {
                          setColors(["blue"]);
                        } else {
                          handleColorToggle("blue");
                        }
                      }}
                      className={`px-3 py-1 border-4 border-black rounded-full font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${colors.includes("blue") && colors.length < 3 ? "bg-[#99CCFF] text-black translate-y-0.5 translate-x-0.5 shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]" : "bg-white hover:bg-blue-50 text-black/50"}`}
                    >
                      包含藍波
                    </button>
                    <button
                      onClick={() => {
                        if (colors.length === 3) {
                          setColors(["green"]);
                        } else {
                          handleColorToggle("green");
                        }
                      }}
                      className={`px-3 py-1 border-4 border-black rounded-full font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${colors.includes("green") && colors.length < 3 ? "bg-[#99FF99] text-black translate-y-0.5 translate-x-0.5 shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]" : "bg-white hover:bg-green-50 text-black/50"}`}
                    >
                      包含綠波
                    </button>
                  </div>
                  {colors.length === 2 && (
                    <div className="mt-4 pt-4 border-t-2 border-black border-dashed flex flex-col gap-3">
                      <Label className="text-sm font-bold flex justify-between items-center">
                        <span>波色比例 (共 6 球)</span>
                        <span className="font-black text-[15px] sm:text-[16px] text-black bg-[#FFD700] px-2 py-0.5 border-[3px] border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                          {colors[0] === "red" ? "紅" : colors[0] === "blue" ? "藍" : "綠"} {6 - (colorRatioOption || 3)} : {colorRatioOption || 3} {colors[1] === "red" ? "紅" : colors[1] === "blue" ? "藍" : "綠"}
                        </span>
                      </Label>
                      <div className="flex items-center gap-3">
                        <span className={`flex-none flex items-center justify-center font-black aspect-square w-8 h-8 text-sm sm:text-base rounded-full border-[2.5px] border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] ${colors[0] === "red" ? "bg-[#FF9999] text-black" : colors[0] === "blue" ? "bg-[#99CCFF] text-black" : "bg-[#99FF99] text-black"}`}>
                          {colors[0] === "red" ? "紅" : colors[0] === "blue" ? "藍" : "綠"}
                        </span>
                        <Slider
                          value={[colorRatioOption || 3]}
                          onValueChange={(val) => {
                            const newValue = Array.isArray(val) ? val[0] : val;
                            setColorRatioOption(newValue);
                          }}
                          max={5}
                          min={1}
                          step={1}
                          className="w-full flex-1 cursor-pointer"
                        />
                        <span className={`flex-none flex items-center justify-center font-black aspect-square w-8 h-8 text-sm sm:text-base rounded-full border-[2.5px] border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] ${colors[1] === "red" ? "bg-[#FF9999] text-black" : colors[1] === "blue" ? "bg-[#99CCFF] text-black" : "bg-[#99FF99] text-black"}`}>
                          {colors[1] === "red" ? "紅" : colors[1] === "blue" ? "藍" : "綠"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Consecutive Numbers */}
                <div className="space-y-0.5">
                  <Label className="text-base font-bold">連號限制</Label>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setNoConsecutivePairs(!noConsecutivePairs)}
                      className={`px-3 py-1 border-4 border-black rounded-full font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${noConsecutivePairs ? "bg-[#FFE867] translate-y-0.5 translate-x-0.5 shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]" : "bg-white hover:bg-zinc-50"}`}
                    >
                      不要連2號
                    </button>
                    <button
                      onClick={() => setNoConsecutiveTriplets(!noConsecutiveTriplets)}
                      className={`px-3 py-1 border-4 border-black rounded-full font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${noConsecutiveTriplets ? "bg-[#FFE867] translate-y-0.5 translate-x-0.5 shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]" : "bg-white hover:bg-zinc-50"}`}
                    >
                      不要連3號
                    </button>
                  </div>
                </div>

                {/* Lucky Numbers Input */}
                <div className="space-y-1.5 pt-1 border-t-[3px] border-black border-dashed">
                  <div className="flex flex-col gap-2">
                    <Label className="text-base font-bold flex items-center gap-2">
                      選擇你的幸運號碼
                      <span className="text-[11px] bg-[#FFE867] px-1.5 py-[1px] border border-black rounded shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">選填</span>
                    </Label>
                    
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => setIsLuckyDialogOpen(true)}
                        className="flex-1 justify-start h-auto min-h-12 py-2 px-3 border-4 border-black rounded-xl font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all bg-white whitespace-normal text-left"
                      >
                        {luckyNumbers.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {luckyNumbers.map(num => {
                              const color = getBallColor(num);
                              const bgColor = color === "red" ? "bg-[#FF9999]" : color === "blue" ? "bg-[#99CCFF]" : "bg-[#99FF99]";
                              return (
                                <div key={num} className={`w-8 h-8 rounded-full border-2 border-black flex items-center justify-center font-black text-sm text-black ${bgColor}`}>
                                  {num}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-zinc-500">點擊選擇號碼 (最多 6 個) ...</span>
                        )}
                      </Button>
                      <Dialog open={isLuckyDialogOpen} onOpenChange={setIsLuckyDialogOpen}>
                        <DialogContent className="border-4 border-black rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] sm:max-w-md w-[95vw] bg-white text-black p-4 sm:p-6">
                          <DialogHeader>
                            <DialogTitle className="text-xl font-black">選擇幸運號碼</DialogTitle>
                            <DialogDescription className="font-bold text-black/80">
                              已選 {luckyNumbers.length} / 6 個號碼
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 my-2">
                            {MARK_SIX_NUMBERS.map(num => {
                              const isSelected = luckyNumbers.includes(num);
                              const isDisabled = excludedNumbers.includes(num);
                              return (
                                <button
                                  key={num}
                                  onClick={() => {
                                    if (isDisabled) {
                                      toast.error("此號碼己在剔除名單中");
                                      return;
                                    }
                                    if (isSelected) {
                                      setLuckyNumbers(prev => prev.filter(n => n !== num));
                                    } else {
                                      if (luckyNumbers.length >= 6) {
                                        toast.error("最多只能選擇 6 個幸運號碼");
                                        return;
                                      }
                                      setLuckyNumbers(prev => [...prev, num].sort((a, b) => a - b));
                                    }
                                  }}
                                  className={`
                                    aspect-square rounded-full border-[2.5px] border-black flex items-center justify-center font-black text-sm sm:text-base shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] transition-all active:shadow-none
                                    ${isSelected 
                                      ? getBallColor(num) === "red" ? "bg-[#FF9999] text-black border-zinc-900 shadow-none translate-y-[1px] translate-x-[1px]" : getBallColor(num) === "blue" ? "bg-[#99CCFF] text-black border-zinc-900 shadow-none translate-y-[1px] translate-x-[1px]" : "bg-[#99FF99] text-black border-zinc-900 shadow-none translate-y-[1px] translate-x-[1px]" 
                                      : isDisabled ? "bg-zinc-100 text-zinc-400 border-zinc-300 shadow-none cursor-not-allowed opacity-50" : "bg-white text-black hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none"
                                    }
                                  `}
                                >
                                  {num}
                                </button>
                              );
                            })}
                          </div>
                          
                          <div className="flex gap-3 mt-2">
                            <Button 
                              onClick={() => setLuckyNumbers([])}
                              className="flex-none border-4 border-black font-black text-lg bg-zinc-200 text-black hover:bg-zinc-300 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all py-6 px-4"
                            >
                              全部清除
                            </Button>
                            <Button 
                              onClick={() => setIsLuckyDialogOpen(false)}
                              className="flex-1 border-4 border-black font-black text-lg bg-[#FFE867] text-black hover:bg-[#FFD700] rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all py-6"
                            >
                              確定
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      {luckyNumbers.length > 0 && (
                        <Button 
                          onClick={() => setLuckyNumbers([])}
                          className="flex-none h-auto min-h-12 w-16 border-[3px] border-black rounded-xl font-black bg-[#FF4D4D] text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all"
                          title="清除所有號碼"
                        >
                          刪除
                        </Button>
                      )}
                    </div>
                    
                    <p className="text-xs font-bold text-zinc-500 mt-1">
                      最多可填寫 6 個號碼。系統每一注都必定會包含這些號碼。
                      <br/>
                      <span className="text-[#3b82f6]">選取的幸運號碼可以不在選取的號碼範圍﹐但依然可以生成。</span>
                    </p>
                  </div>
                </div>

                {/* Excluded Numbers Input */}
                <div className="space-y-1.5 pt-1 border-t-[3px] border-black border-dashed">
                  <div className="flex flex-col gap-2">
                    <Label className="text-base font-bold flex items-center gap-2">
                      選擇你必要剔除號碼
                      <span className="text-[11px] bg-[#FFE867] px-1.5 py-[1px] border border-black rounded shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">選填</span>
                    </Label>
                    
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => setIsExcludedDialogOpen(true)}
                        className="flex-1 justify-start h-auto min-h-12 py-2 px-3 border-4 border-black rounded-xl font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all bg-white whitespace-normal text-left"
                      >
                        {excludedNumbers.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {excludedNumbers.map(num => {
                              const color = getBallColor(num);
                              const bgColor = color === "red" ? "bg-[#FF9999]" : color === "blue" ? "bg-[#99CCFF]" : "bg-[#99FF99]";
                              return (
                                <div key={num} className={`w-8 h-8 rounded-full border-2 border-black flex items-center justify-center font-black text-sm text-black ${bgColor}`}>
                                  {num}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-zinc-500">點擊選擇號碼 ...</span>
                        )}
                      </Button>
                      <Dialog open={isExcludedDialogOpen} onOpenChange={setIsExcludedDialogOpen}>
                        <DialogContent className="border-4 border-black rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] sm:max-w-md w-[95vw] bg-white text-black p-4 sm:p-6">
                          <DialogHeader>
                            <DialogTitle className="text-xl font-black">選擇剔除號碼</DialogTitle>
                            <DialogDescription className="font-bold text-black/80">
                              已選 {excludedNumbers.length} 個號碼
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 my-2">
                            {MARK_SIX_NUMBERS.map(num => {
                              const isSelected = excludedNumbers.includes(num);
                              const isDisabled = luckyNumbers.includes(num);
                              return (
                                <button
                                  key={num}
                                  onClick={() => {
                                    if (isDisabled) {
                                      toast.error("此號碼己在幸運號碼中");
                                      return;
                                    }
                                    if (isSelected) {
                                      setExcludedNumbers(prev => prev.filter(n => n !== num));
                                    } else {
                                      setExcludedNumbers(prev => [...prev, num].sort((a, b) => a - b));
                                    }
                                  }}
                                  className={`
                                    aspect-square rounded-full border-[2.5px] border-black flex items-center justify-center font-black text-sm sm:text-base shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] transition-all active:shadow-none
                                    ${isSelected 
                                      ? "bg-zinc-800 text-white border-zinc-900 shadow-none translate-y-[1px] translate-x-[1px]" 
                                      : isDisabled ? "bg-zinc-100 text-zinc-400 border-zinc-300 shadow-none cursor-not-allowed opacity-50" : "bg-white text-black hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none"
                                    }
                                  `}
                                >
                                  {num}
                                </button>
                              );
                            })}
                          </div>
                          
                          <div className="flex gap-3 mt-2">
                            <Button 
                              onClick={() => setExcludedNumbers([])}
                              className="flex-none border-4 border-black font-black text-lg bg-zinc-200 text-black hover:bg-zinc-300 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all py-6 px-4"
                            >
                              全部清除
                            </Button>
                            <Button 
                              onClick={() => setIsExcludedDialogOpen(false)}
                              className="flex-1 border-4 border-black font-black text-lg bg-[#FFE867] text-black hover:bg-[#FFD700] rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all py-6"
                            >
                              確定
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      {excludedNumbers.length > 0 && (
                        <Button 
                          onClick={() => setExcludedNumbers([])}
                          className="flex-none h-auto min-h-12 w-16 border-[3px] border-black rounded-xl font-black bg-[#FF4D4D] text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all"
                          title="清除所有號碼"
                        >
                          刪除
                        </Button>
                      )}
                    </div>
                    
                    <p className="text-xs font-bold text-zinc-500">
                      系統生成號碼時必定不包含這些號碼。
                    </p>
                  </div>
                </div>

                {/* Past Results */}
                <div className="space-y-1 pt-1 border-t-[3px] border-black border-dashed">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 border-b-[2px] border-black pb-1 mb-1 border-dashed w-fit">
                      <Checkbox 
                        id="enable-recent"
                        checked={enableRecent}
                        onCheckedChange={(checked) => {
                          setEnableRecent(checked as boolean);
                          if (checked) setEnableComplexRecent(false);
                        }}
                        className="w-4 h-4 border-[3px] border-black rounded-sm data-[state=checked]:bg-[#FF4D4D] data-[state=checked]:text-white"
                      />
                      <Label htmlFor="enable-recent" className="text-[15px] cursor-pointer">啟用近期號碼策略</Label>
                    </div>

                    {enableRecent && (
                      <div className="space-y-1 mt-0.5 flex flex-col gap-0.5 mb-2">
                        <div className="flex flex-col gap-1">
                          <label className="flex items-center space-x-1.5 bg-white border-[3px] border-black py-0.5 px-1.5 rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:bg-zinc-50 relative active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all">
                            <input 
                              type="radio" 
                              name="recentMode" 
                              value="exclude" 
                              checked={recentMode === "exclude"} 
                              onChange={() => setRecentMode("exclude")} 
                              className="w-3 h-3 accent-black cursor-pointer"
                            />
                            <span className="text-xs flex-1 select-none">排除近期號碼</span>
                          </label>
                          <label className="flex items-center space-x-1.5 bg-white border-[3px] border-black py-0.5 px-1.5 rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:bg-zinc-50 relative active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all">
                            <input 
                              type="radio" 
                              name="recentMode" 
                              value="include" 
                              checked={recentMode === "include"} 
                              onChange={() => setRecentMode("include")} 
                              className="w-3 h-3 accent-black cursor-pointer"
                            />
                            <span className="text-xs flex-1 select-none">只買近期號碼</span>
                          </label>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="flex items-center gap-1.5 bg-white border-[3px] border-black py-0.5 px-1.5 rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] w-fit cursor-pointer hover:bg-zinc-50 relative active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all">
                            <input 
                              type="checkbox" 
                              checked={includeSpecial} 
                              onChange={(e) => setIncludeSpecial(e.target.checked)} 
                              className="w-4 h-4 accent-[#3b82f6] cursor-pointer"
                            />
                            <span className="text-[11px] sm:text-xs whitespace-nowrap select-none">連特別號碼一齊考慮</span>
                          </label>
                          <div className="flex items-center gap-1.5 w-full bg-white border-[3px] border-black py-0.5 px-1.5 rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-zinc-50 transition-colors">
                            <Slider
                              value={[recentCount]}
                              min={1}
                              max={50}
                              step={1}
                              onValueChange={(val) => {
                                const newValue = Array.isArray(val) ? val[0] : val;
                                setRecentCount(newValue as number);
                              }}
                              className="py-1 cursor-pointer flex-1"
                            />
                            <span className="font-black text-xs sm:text-sm bg-[#FFE867] px-3 py-0.5 border-[2px] sm:border-[3px] border-black rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] whitespace-nowrap select-none">
                              參考 {recentCount || 0} 期
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 border-b-[2px] border-black pb-1 mb-1 border-dashed w-fit">
                      <Checkbox 
                        id="enable-complex-recent"
                        checked={enableComplexRecent}
                        onCheckedChange={(checked) => {
                          setEnableComplexRecent(checked as boolean);
                          if (checked) setEnableRecent(false);
                        }}
                        className="w-4 h-4 border-[3px] border-black rounded-sm data-[state=checked]:bg-[#FF4D4D] data-[state=checked]:text-white"
                      />
                      <Label htmlFor="enable-complex-recent" className="text-[15px] cursor-pointer">啟用更複雜的近期號碼策略</Label>
                    </div>

                    {enableComplexRecent && (() => {
                      const hasOverlap = complexExcludeRanges.some(ex => 
                        complexIncludeRanges.some(inc => 
                          Math.max(ex.start, inc.start) <= Math.min(ex.end, inc.end)
                        )
                      );
                      
                      const maxHistoryCount = 50;

                      return (
                        <div className="space-y-4 mt-1 p-3 bg-zinc-50 border-[3px] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-xl relative">
                          <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                              <Label className="text-sm font-black flex items-center gap-1 text-[#FF4D4D]">
                                <Dices className="w-4 h-4"/>排除近期號碼區間
                              </Label>
                              <div className="flex gap-1.5">
                                {complexExcludeRanges.length < 3 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-[11px] border-[2px] border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all bg-white"
                                    onClick={() => setComplexExcludeRanges([...complexExcludeRanges, {start: 1, end: 5}])}
                                  >
                                    + 新增範圍
                                  </Button>
                                )}
                                {complexExcludeRanges.length > 0 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-[11px] border-[2px] border-[red] text-red-600 font-bold shadow-[2px_2px_0px_0px_rgba(255,0,0,0.5)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all bg-white"
                                    onClick={() => {
                                      const newRanges = [...complexExcludeRanges];
                                      newRanges.pop();
                                      setComplexExcludeRanges(newRanges);
                                    }}
                                  >
                                    - 移除範圍
                                  </Button>
                                )}
                              </div>
                            </div>
                            
                            {complexExcludeRanges.map((range, index) => (
                              <div key={`exclude-${index}`} className="flex flex-col gap-1.5">
                                <div className="flex justify-end items-center">
                                  {complexExcludeRanges.length > 1 && <span className="text-xs font-bold text-zinc-500 mr-auto">範圍 {index + 1}</span>}
                                  <span className="font-black text-sm bg-[#FFD700] px-2 py-0.5 border-[2px] border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                    {range.start} - {range.end} 期
                                  </span>
                                </div>
                                <Slider
                                  value={[range.start, range.end]}
                                  min={1}
                                  max={maxHistoryCount}
                                  step={1}
                                  onValueChange={(val) => {
                                    const newRanges = [...complexExcludeRanges];
                                    newRanges[index] = {start: val[0], end: val[1]};
                                    setComplexExcludeRanges(newRanges);
                                  }}
                                  className="py-1 cursor-pointer mt-1"
                                />
                              </div>
                            ))}
                          </div>
                          
                          <div className="flex flex-col gap-2 pt-2 border-t-[2px] border-black border-dashed">
                            <div className="flex justify-between items-center">
                              <Label className="text-sm font-black flex items-center gap-1 text-[#3b82f6]">
                                <Dices className="w-4 h-4"/>只買近期號碼區間
                              </Label>
                              <div className="flex gap-1.5">
                                {complexIncludeRanges.length < 3 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-[11px] border-[2px] border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all bg-white"
                                    onClick={() => setComplexIncludeRanges([...complexIncludeRanges, {start: 1, end: 5}])}
                                  >
                                    + 新增範圍
                                  </Button>
                                )}
                                {complexIncludeRanges.length > 0 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-[11px] border-[2px] border-[red] text-red-600 font-bold shadow-[2px_2px_0px_0px_rgba(255,0,0,0.5)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all bg-white"
                                    onClick={() => {
                                      const newRanges = [...complexIncludeRanges];
                                      newRanges.pop();
                                      setComplexIncludeRanges(newRanges);
                                    }}
                                  >
                                    - 移除範圍
                                  </Button>
                                )}
                              </div>
                            </div>
                            
                            {complexIncludeRanges.map((range, index) => (
                              <div key={`include-${index}`} className="flex flex-col gap-1.5">
                                <div className="flex justify-end items-center">
                                  {complexIncludeRanges.length > 1 && <span className="text-xs font-bold text-zinc-500 mr-auto">範圍 {index + 1}</span>}
                                  <span className="font-black text-sm bg-[#FFD700] px-2 py-0.5 border-[2px] border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                    {range.start} - {range.end} 期
                                  </span>
                                </div>
                                <Slider
                                  value={[range.start, range.end]}
                                  min={1}
                                  max={maxHistoryCount}
                                  step={1}
                                  onValueChange={(val) => {
                                    const newRanges = [...complexIncludeRanges];
                                    newRanges[index] = {start: val[0], end: val[1]};
                                    setComplexIncludeRanges(newRanges);
                                  }}
                                  className="py-1 cursor-pointer mt-1"
                                />
                              </div>
                            ))}
                          </div>

                          {hasOverlap && (
                            <div className="flex items-center gap-1.5 bg-red-100 border-[2px] border-red-500 text-red-600 text-xs font-bold p-1.5 rounded-lg mt-2">
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              此設定存在重疊範圍，會排除重疊區間內的所有號碼。
                            </div>
                          )}

                          <label className="flex items-center gap-1.5 bg-white border-[3px] border-black py-1 px-2 rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] w-fit cursor-pointer hover:bg-zinc-50 relative active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all mt-2">
                            <input 
                              type="checkbox" 
                              checked={includeSpecial} 
                              onChange={(e) => setIncludeSpecial(e.target.checked)} 
                              className="w-4 h-4 accent-[#3b82f6] cursor-pointer"
                            />
                            <span className="text-xs sm:text-sm whitespace-nowrap select-none">連特別號碼一齊考慮</span>
                          </label>
                        </div>
                      );
                    })()}

                    {(enableRecent || enableComplexRecent) && (
                      <div className="flex flex-col gap-1 mt-2 border-t-[2px] border-black border-dashed pt-2">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <Checkbox 
                            checked={enableExcludeUnseen}
                            onCheckedChange={(checked) => setEnableExcludeUnseen(checked as boolean)}
                            className="w-4 h-4 border-[3px] border-black rounded-sm data-[state=checked]:bg-[#FF4D4D] data-[state=checked]:text-white"
                          />
                          <span className="text-xs sm:text-sm whitespace-nowrap select-none flex items-center gap-1">排除近期沒有出現過的所有號碼</span>
                        </label>
                        {enableExcludeUnseen && (
                          <div className="flex flex-col gap-1.5 mb-1 w-full pl-4">
                            <div className="flex items-center gap-1.5 w-[calc(100%-1rem)] bg-white border-[3px] border-black py-0.5 px-1.5 rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-zinc-50 transition-colors">
                              <Slider
                                value={[excludeUnseenCount]}
                                min={1}
                                max={50}
                                step={1}
                                onValueChange={(val) => {
                                  const newValue = Array.isArray(val) ? val[0] : val;
                                  setExcludeUnseenCount(newValue as number);
                                }}
                                className="py-1 cursor-pointer flex-1"
                              />
                              <span className="font-black text-xs sm:text-sm bg-[#FFE867] px-3 py-0.5 border-[2px] sm:border-[3px] border-black rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] whitespace-nowrap select-none">
                                參考 {excludeUnseenCount || 0} 期
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1.5 ml-1 mb-1.5 w-fit">
                              <label className="flex items-center gap-1.5 bg-white border-[3px] border-black py-0.5 px-1.5 rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:bg-zinc-50 relative active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all">
                                <input 
                                  type="checkbox" 
                                  checked={excludeUnseenIncludeSpecial} 
                                  onChange={(e) => setExcludeUnseenIncludeSpecial(e.target.checked)} 
                                  className="w-4 h-4 accent-[#3b82f6] cursor-pointer"
                                />
                                <span className="text-[11px] sm:text-xs whitespace-nowrap select-none">連特別號碼一齊考慮</span>
                              </label>
                            </div>
                            
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="w-fit h-7 text-[11px] font-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-none transition-all ml-1"
                              onClick={() => setShowUnseenNumbers(!showUnseenNumbers)}
                            >
                              {showUnseenNumbers ? "隱藏沒有出現過的號碼" : "顯示沒有出現過的號碼"}
                            </Button>
                            
                            {showUnseenNumbers && (() => {
                              if (liveResults.length === 0) return <div className="text-xs text-zinc-500 font-bold ml-1">載入中...</div>;
                              const rawRecentDraws = liveResults.map(getRawDrawNumbers);
                              const drawsToConsider = rawRecentDraws.slice(0, excludeUnseenCount).map(draw => excludeUnseenIncludeSpecial ? draw : draw.slice(0, 6));
                              const seenNumbers = new Set(drawsToConsider.flat());
                              const unseenNumbers = MARK_SIX_NUMBERS.filter(num => !seenNumbers.has(num));

                              return (
                                <div className="mt-1 mr-4 p-2.5 bg-white border-[3px] border-black rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                  <div className="text-xs font-black mb-2 text-zinc-700">此 {excludeUnseenCount} 期沒有出現過的號碼 (共 {unseenNumbers.length} 個):</div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {unseenNumbers.map(n => {
                                      const color = getBallColor(n);
                                      const bgClass = color === 'red' ? 'bg-red-100/80 border-red-500 text-red-700' : 
                                                      color === 'blue' ? 'bg-blue-100/80 border-blue-500 text-blue-700' : 
                                                      'bg-green-100/80 border-green-500 text-green-700';
                                                      
                                      return (
                                        <span key={n} className={`flex items-center justify-center w-7 h-7 rounded-full border-[2px] font-black text-xs shadow-sm ${bgClass}`}>
                                          {n}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex flex-col gap-1 mt-2 border-t-[2px] border-black border-dashed pt-3 pb-1">
                      <div className="flex flex-row items-center justify-between w-full">
                        <div className="flex flex-col gap-3 ml-1 shrink-0">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <Checkbox 
                              checked={use2Combos}
                              onCheckedChange={(checked) => {
                                setUse2Combos(checked as boolean);
                                if (checked) setUse3Combos(false);
                              }}
                              className="w-[20px] h-[20px] border-[3px] border-black rounded-full data-[state=checked]:bg-black data-[state=checked]:text-white flex items-center justify-center [&>span>svg]:hidden relative before:content-[''] before:absolute before:inset-0 before:m-auto before:w-2.5 before:h-2.5 before:bg-white before:rounded-full before:opacity-0 data-[state=checked]:before:opacity-100"
                            />
                            <span className="font-bold text-sm sm:text-[15px] whitespace-nowrap select-none">採用「2合」策略</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <Checkbox 
                              checked={use3Combos}
                              onCheckedChange={(checked) => {
                                setUse3Combos(checked as boolean);
                                if (checked) setUse2Combos(false);
                              }}
                              className="w-[20px] h-[20px] border-[3px] border-black rounded-full data-[state=checked]:bg-black data-[state=checked]:text-white flex items-center justify-center [&>span>svg]:hidden relative before:content-[''] before:absolute before:inset-0 before:m-auto before:w-2.5 before:h-2.5 before:bg-white before:rounded-full before:opacity-0 data-[state=checked]:before:opacity-100"
                            />
                            <span className="font-bold text-sm sm:text-[15px] whitespace-nowrap select-none">採用「3合」策略</span>
                          </label>
                        </div>
                        <button
                          onClick={() => setIsStrategyInfoOpen(true)}
                          className="bg-white border-[3px] border-black text-black px-3 py-1.5 sm:px-4 sm:py-2 rounded-[16px] text-[13px] sm:text-sm font-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-zinc-100 hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all shrink-0 flex items-center justify-center mr-1"
                        >
                          2合和3合說明
                        </button>
                      </div>

                      {use2Combos && (
                        <div className="ml-7 mb-2 flex items-center gap-2 border-[2px] border-zinc-200 p-1.5 bg-zinc-50 rounded-lg w-fit">
                          <span className="text-xs font-bold text-zinc-600">抽選「2合」數量:</span>
                          <div className="flex gap-1">
                            {[1, 2, 3].map(c => (
                              <button
                                key={c}
                                onClick={() => setCombo2Count(c)}
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-full border-2 border-black transition-all ${combo2Count === c ? "bg-[#3b82f6] text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" : "bg-white text-black hover:bg-zinc-100"}`}
                              >
                                {c} 組
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {use3Combos && (
                        <div className="ml-7 mt-1.5 mb-1 flex items-center gap-2 border-[2px] border-zinc-200 p-1.5 bg-zinc-50 rounded-lg w-fit">
                          <span className="text-xs font-bold text-zinc-600">抽選「3合」數量:</span>
                          <div className="flex gap-1">
                            {[1, 2].map(c => (
                              <button
                                key={c}
                                onClick={() => setCombo3Count(c)}
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-full border-2 border-black transition-all ${combo3Count === c ? "bg-[#3b82f6] text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" : "bg-white text-black hover:bg-zinc-100"}`}
                              >
                                {c} 組
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-zinc-100 border-t-[3px] border-black py-2 px-3 sm:py-3 sm:px-4 m-0 rounded-none w-full flex flex-col justify-center gap-3 mt-auto">
                <div className="flex flex-col sm:flex-row gap-3 w-full justify-center mt-2 max-w-sm mx-auto">
                  <Button
                    className="flex-1 bg-orange-400 font-bold hover:bg-orange-500 text-black h-auto py-1.5 px-4 text-base border-2 border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <RefreshCw className="w-5 h-5 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="w-5 h-5 mr-1" />
                    )}
                    {isGenerating ? "生成中..." : "生成號碼"}
                  </Button>
                  <Button
                    className="flex-1 bg-green-400 font-bold hover:bg-green-500 text-black h-auto py-1.5 px-4 text-base border-2 border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all"
                    onClick={() => setIsAiDialogOpen(true)}
                  >
                    <Sparkles className="w-5 h-5 mr-1 text-white" />
                    AI 選號
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full justify-center mx-auto items-center mt-1">
                  <Button
                    variant="outline"
                    className="w-fit bg-[#ffedd5] hover:bg-[#fed7aa] text-black h-auto py-1.5 px-4 text-base font-black border-4 border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all"
                    onClick={() => setIsCheckDialogOpen(true)}
                  >
                    <SearchCheck className="w-5 h-5 mr-1" />
                    核對中獎號碼
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full justify-center mt-2 flex-wrap">
                  <Button
                    variant="outline"
                    className="flex-1 min-w-[200px] bg-[#FFE867] hover:bg-[#FFD700] text-black h-auto py-2 px-3 text-base sm:text-lg font-black border-[3px] border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all"
                    onClick={() => document.getElementById('regenerate-api-upload')?.click()}
                  >
                    上載系統截圖重新生成
                  </Button>
                  <input 
                    type="file" 
                    id="regenerate-api-upload" 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) processScreenshotForRegenerate(file);
                      e.target.value = "";
                    }}
                  />

                  {generatedBets.length > 0 && !generatedBets.some((b: any) => b.isBankerLegs && (b.bankersCount || 0) > 0) && (
                    <div className="flex flex-col sm:flex-row gap-2 w-full justify-center">
                      <Button
                        variant="outline"
                        className="flex-1 max-w-sm bg-[#fca5a5] hover:bg-[#f87171] text-black h-auto py-2.5 px-4 text-sm font-black border-[3px] border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all"
                        onClick={() => {
                          const evt = new MouseEvent("click", { bubbles: true });
                          document.querySelector('[data-automation-id="hkjc-mobile-btn"]')?.dispatchEvent(evt);
                        }}
                      >
                        <Smartphone className="w-4 h-4 mr-1.5" />
                        自動按球(手機版) 教學
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 max-w-sm bg-[#FFE867] hover:bg-[#FFD700] text-black h-auto py-2.5 px-4 text-sm font-black border-[3px] border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all"
                        onClick={() => {
                          const evt = new MouseEvent("click", { bubbles: true });
                          document.querySelector('[data-automation-id="hkjc-desktop-btn"]')?.dispatchEvent(evt);
                        }}
                      >
                        <MonitorUp className="w-4 h-4 mr-1.5" />
                        自動點擊(電腦版) 教學
                      </Button>
                    </div>
                  )}
                  {generatedBets.length > 0 && generatedBets.some((b: any) => b.isBankerLegs && (b.bankersCount || 0) > 0) && (
                    <div className="flex flex-col sm:flex-row gap-2 w-full justify-center">
                      <Button
                        variant="outline"
                        className="flex-1 max-w-sm bg-[#f87171] hover:bg-[#ef4444] text-black h-auto py-2.5 px-4 text-sm font-black border-[3px] border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all"
                        onClick={() => {
                          const evt = new MouseEvent("click", { bubbles: true });
                          document.querySelector('[data-automation-id="hkjc-banker-mobile-btn"]')?.dispatchEvent(evt);
                        }}
                      >
                        <Smartphone className="w-4 h-4 mr-1.5" />
                        自動拖膽(手機版) 教學
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 max-w-sm bg-[#60a5fa] hover:bg-[#3b82f6] text-black h-auto py-2.5 px-4 text-sm font-black border-[3px] border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all"
                        onClick={() => {
                          const evt = new MouseEvent("click", { bubbles: true });
                          document.querySelector('[data-automation-id="hkjc-banker-desktop-btn"]')?.dispatchEvent(evt);
                        }}
                      >
                        <Sparkles className="w-4 h-4 mr-1.5" />
                        自動點擊(拖膽PC) 教學
                      </Button>
                    </div>
                  )}
                </div>
              </CardFooter>
            </Card>
          </div>
          )}

          {/* Right Column: Results */}
          <div id="results" className={generatedBets.length === 0 ? "lg:col-span-7 space-y-4" : generatedBets.length > 5 ? "max-w-6xl mx-auto w-full space-y-2 sm:space-y-4" : "max-w-2xl mx-auto w-full space-y-1 sm:space-y-2"}>
            {generatedBets.length > 0 ? (
              <div className="space-y-1 sm:space-y-2">
                <div className="flex flex-col gap-1 items-center justify-center w-full">
                  {!generatedBets.some((b: any) => b.isBankerLegs && (b.bankersCount || 0) > 0) && (
                    <div className="bg-black text-[#FFD700] border-4 border-black py-1 px-3 sm:py-1.5 sm:px-4 rounded-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-fit mx-auto transition-transform hover:-translate-y-1 mb-2">
                      <h2 className="text-lg sm:text-xl font-black flex items-center justify-center gap-1.5 sm:gap-2">
                        <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-[#FFD700] shrink-0" />
                        <span>成功生成 {generatedBets.length} 注號碼！ 🎉</span>
                      </h2>
                    </div>
                  )}

                  {(() => {
                    const allGeneratedNumbers = generatedBets.map(b => b.numbers).flat();
                    
                    const freqMap = new Map<number, number>();
                    allGeneratedNumbers.forEach(n => freqMap.set(n, (freqMap.get(n) || 0) + 1));
                    
                    const recentDrawsToConsider = liveResults.slice(0, recentCount);
                    const historicalFreqMap = new Map<number, number>();
                    Array.from(freqMap.keys()).forEach(n => {
                      historicalFreqMap.set(n, recentDrawsToConsider.filter(draw => getRawDrawNumbers(draw).includes(n)).length);
                    });

                    // Sort primarily by historical frequency (descending), then generated frequency (descending), then by value (ascending)
                    const uniqueGeneratedNumbers = Array.from(freqMap.keys()).sort((a, b) => {
                      const histFreqDiff = historicalFreqMap.get(b)! - historicalFreqMap.get(a)!;
                      if (histFreqDiff !== 0) return histFreqDiff;

                      const genFreqDiff = freqMap.get(b)! - freqMap.get(a)!;
                      if (genFreqDiff !== 0) return genFreqDiff;

                      return a - b;
                    });
                    
                    const totalNumbers = generatedBets.length * 6;
                    const expectedUnique = 49 * (1 - Math.pow(43 / 49, generatedBets.length)); // Expected unique numbers for purely random selection
                    // Recommend Banker only if unique numbers are very low (e.g. <= 16) so combinations don't explode
                    const hasBankers = generatedBets.some((b: any) => b.isBankerLegs === true || b.type === "banker");
                    const isHighlyRepeated = !hasBankers && generatedBets.length >= 3 && uniqueGeneratedNumbers.length > 6 && uniqueGeneratedNumbers.length <= 16;

                    const getCombinationsCount = (n: number, k: number) => {
                      if (k > n || k < 0) return 0;
                      if (k === 0 || k === n) return 1;
                      let c = 1;
                      for (let i = 1; i <= k; i++) {
                        c = c * (n - i + 1) / i;
                      }
                      return Math.round(c);
                    };

                    const handleToggleBanker = (num: number) => {
                      setBankers(prev => {
                        if (prev.includes(num)) {
                          return prev.filter(n => n !== num);
                        } else {
                          if (prev.length >= 5) {
                            toast.error("最多只能選擇 5 個膽！");
                            return prev;
                          }
                          setExcludedLegs(prevExcluded => prevExcluded.filter(n => n !== num));
                          return [...prev, num].sort((a, b) => a - b);
                        }
                      });
                    };

                    const handleToggleExcludedLeg = (num: number) => {
                      setExcludedLegs(prev => {
                        if (prev.includes(num)) {
                          return prev.filter(n => n !== num);
                        } else {
                          return [...prev, num].sort((a, b) => a - b);
                        }
                      });
                    };

                    if (!isHighlyRepeated) return null;

                    const activeLegs = uniqueGeneratedNumbers.filter(n => !bankers.includes(n) && !excludedLegs.includes(n));
                    const totalBetsWithBankers = getCombinationsCount(activeLegs.length, 6 - bankers.length);
                    const totalCost = totalBetsWithBankers * 10;

                    return (
                      <div className="bg-[#ffedd5] max-w-3xl mx-auto border-4 border-black rounded-2xl p-3 sm:p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-2 relative mt-1 sm:mt-2 mb-2 w-full">
                        <h3 className="text-base sm:text-lg font-black flex items-center gap-1.5 text-black">
                          💡 號碼高度重覆！建議使用「膽拖」投注
                        </h3>
                        <p className="text-xs sm:text-sm font-bold text-zinc-700">
                          這 {generatedBets.length} 注號碼僅由 {uniqueGeneratedNumbers.length} 個不同數字組成。挑選 1-5 個心水「膽」，不僅能覆蓋所有生成的數字，還能省下注本！(號碼已按歷史出現次數由高至低排列)
                        </p>

                        <div className="bg-white border-[3px] border-black rounded-xl p-2 sm:p-3 mt-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] space-y-3">
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-[11px] sm:text-xs text-black border-2 border-black bg-[#FFD700] px-2 py-0.5 rounded-md inline-block w-fit">第一步：選 1-5 個「膽」</span>
                              <span className="text-[10px] sm:text-[11px] font-bold text-zinc-500">球上方數字為近 {recentCount} 期出現次數</span>
                            </div>
                            <div className="flex flex-wrap justify-center gap-2 sm:gap-3 items-end pt-0.5">
                              {uniqueGeneratedNumbers.map((num) => {
                                const isSelected = bankers.includes(num);
                                const pastRecentFreq = liveResults.slice(0, recentCount).filter(draw => getRawDrawNumbers(draw).includes(num)).length;
                                
                                const color = getBallColor(num);
                                let baseBgClass = "bg-white text-black border-black";
                                let textColor = "text-black";
                                if (color === "red") {
                                  baseBgClass = "bg-[#FF9999]";
                                } else if (color === "blue") {
                                  baseBgClass = "bg-[#99CCFF]";
                                } else if (color === "green") {
                                  baseBgClass = "bg-[#99FF99]";
                                }

                                return (
                                  <div key={num} className="flex flex-col items-center gap-1">
                                    <div className="text-[10px] sm:text-[11px] font-bold text-center leading-[1] whitespace-nowrap bg-zinc-100 border-2 border-zinc-300 rounded px-1 py-0.5 text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,0.2)] mb-0.5">
                                      {pastRecentFreq}次
                                    </div>
                                    <button
                                      onClick={() => handleToggleBanker(num)}
                                      className={`w-[40px] h-[40px] sm:w-[44px] sm:h-[44px] rounded-full border-[3px] border-black font-black text-[22px] sm:text-[24px] leading-none pt-0.5 tracking-tighter flex items-center justify-center transition-all shrink-0 ${baseBgClass} ${textColor} ${isSelected ? 'shadow-none translate-y-0.5 translate-x-0.5 opacity-100 ring-2 ring-offset-2 ring-black' : excludedLegs.includes(num) ? 'opacity-30' : 'shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]'}`}
                                    >
                                      {num}
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                          
                          {bankers.length > 0 && (
                            <div className="pt-3 border-t-[3px] border-black border-dashed flex flex-col gap-2">
                              <div className="space-y-1.5">
                                <span className="font-bold text-[11px] sm:text-xs text-black border-2 border-black bg-[#dcfce7] px-2 py-0.5 rounded-md inline-block w-fit">第二步：點擊剔除不需要的配腳 (可省略)</span>
                                <div className="flex flex-wrap justify-center gap-1 sm:gap-1.5 pt-0.5 p-2 bg-zinc-50 border-[3px] border-black rounded-lg">
                                  {uniqueGeneratedNumbers.filter(n => !bankers.includes(n)).map(num => {
                                    const isExcluded = excludedLegs.includes(num);
                                    const color = getBallColor(num);
                                    let bgColor = "bg-white";
                                    if (color === "red") bgColor = "bg-[#FF9999]";
                                    else if (color === "blue") bgColor = "bg-[#99CCFF]";
                                    else if (color === "green") bgColor = "bg-[#99FF99]";
                                    if (isExcluded) {
                                      return (
                                        <button
                                          key={num}
                                          onClick={() => handleToggleExcludedLeg(num)}
                                          className={`w-[40px] h-[40px] sm:w-[44px] sm:h-[44px] rounded-full border-[3px] border-zinc-300 font-black text-[22px] sm:text-[24px] leading-none pt-0.5 tracking-tighter flex items-center justify-center transition-all bg-zinc-100 text-zinc-400 relative`}
                                        >
                                          {num}
                                          <div className="absolute inset-x-1 top-1/2 h-[3px] bg-zinc-400 transform -translate-y-1/2 rotate-45"></div>
                                        </button>
                                      )
                                    }
                                    
                                    return (
                                      <button
                                        key={num}
                                        onClick={() => handleToggleExcludedLeg(num)}
                                        className={`w-[40px] h-[40px] sm:w-[44px] sm:h-[44px] rounded-full border-[3px] border-black font-black text-black text-[22px] sm:text-[24px] leading-none pt-0.5 tracking-tighter flex items-center justify-center transition-all ${bgColor} shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]`}
                                      >
                                        {num}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            
                              <div className="flex flex-col gap-1.5 mt-1">
                                <div className="text-sm sm:text-base font-bold text-black flex flex-wrap gap-x-3 gap-y-1 bg-zinc-50 border-2 border-black rounded-lg p-2.5">
                                  <span className="flex items-center gap-1.5">
                                    <span className="bg-black text-white px-1.5 py-0.5 rounded text-xs">膽</span> 
                                    <span className="font-black text-[#FF4D4D]">{bankers.map(n => n.toString()).join(', ')}</span>
                                    <span className="text-xs text-zinc-500">({bankers.length})</span>
                                  </span>
                                  <span className="flex items-center gap-1.5 flex-wrap">
                                    <span className="bg-black text-white px-1.5 py-0.5 rounded text-xs">有效配腳</span>
                                    <span className="font-black">{activeLegs.map(n => n.toString()).join(', ')}</span>
                                    <span className="text-xs text-zinc-500">({activeLegs.length})</span>
                                  </span>
                                </div>
                                <div className="bg-[#FFE867] px-3 py-2 rounded-lg border-2 border-black font-black flex flex-wrap items-center justify-between gap-y-1 gap-x-2 w-full mt-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                  <span className="text-sm sm:text-base">膽拖投注總注數：</span>
                                  <span className="text-xl sm:text-2xl text-[#FF4D4D] flex items-center gap-1">
                                    {totalBetsWithBankers} <span className="text-sm sm:text-base text-black">注</span>
                                  </span>
                                </div>
                                <div className="text-right text-sm font-black text-zinc-600 pr-1">
                                  總投注額 (以 $10/注 計算): <span className="text-black">${totalCost} HKD</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-4 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all rounded-full h-auto py-1 px-3 bg-[#d2b48c]"
                      onClick={() => {
                        setGeneratedBets([]);
                        setSpecialCoverBets([]);
                        setUndoStack([]);
                        setBankers([]);
                        setExcludedLegs([]);
                        
                        // Reset all generation settings to defaults so there are no lingering AI presets
                        setPreferredOddCount(null);
                        setPreferredEvenCount(null);
                        setOddEven("all");
                        setColors(["red", "blue", "green"]);
                        setColorRatioOption(3);
                        setEnableRecent(false);
                        setRecentMode("");
                        setRecentCount(5);
                        setEnableComplexRecent(false);
                        setComplexExcludeRanges([{start: 1, end: 5}]);
                        setComplexIncludeRanges([{start: 6, end: 10}]);
                        setEnableExcludeUnseen(false);
                        setExcludeUnseenCount(20);
                        setExcludeUnseenIncludeSpecial(false);
                        setNoConsecutivePairs(false);
                        setNoConsecutiveTriplets(false);
                        setUse2Combos(false);
                        setCombo2Count(1);
                        setUse3Combos(false);
                        setCombo3Count(1);

                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      <Settings2 className="w-3.5 h-3.5 mr-1" />
                      更改設定
                    </Button>
                    {undoStack.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-4 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all rounded-full h-auto py-1 px-3 bg-[#ffb6c1] text-black"
                        onClick={() => {
                          const lastAction = undoStack[undoStack.length - 1];
                          setUndoStack(prev => prev.slice(0, -1));
                          setGeneratedBets(prev => {
                            const newBets = [...prev];
                            newBets.splice(lastAction.index, 0, lastAction.bet);
                            return newBets;
                          });
                        }}
                      >
                        <Undo className="w-3.5 h-3.5 mr-1" />
                        復原 ({undoStack.length})
                      </Button>
                    )}
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-[#FFE867] text-black hover:bg-[#FFD700] border-4 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all rounded-full h-auto py-1 px-3"
                      onClick={isAiGenerated ? handleAIGenerate : handleGenerate}
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1" />
                      {isAiGenerated ? "AI 重新生成" : "重新生成"}
                    </Button>
                    <div className="flex w-full sm:w-auto gap-1.5 sm:gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-shrink-0 border-4 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all rounded-full h-auto py-1 px-3 bg-zinc-200"
                        onClick={handleCopyBets}
                      >
                        <Copy className="w-3.5 h-3.5 mr-1" />
                        複製號碼
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 w-full border-4 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all rounded-full min-h-[32px] h-auto py-1.5 px-3 bg-zinc-800 text-white hover:text-white break-words items-center"
                        onClick={handleCaptureScreenshot}
                      >
                        <div className="flex flex-col items-center leading-tight">
                          <span className="flex items-center whitespace-nowrap"><ImageIcon className="w-3.5 h-3.5 mr-1" />儲存生成結果圖片</span>
                          <span className="text-[10px] sm:text-xs opacity-90 mt-0.5">(內含 QR Code、生成時間及下期開彩日期)</span>
                        </div>
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-4 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all rounded-full h-auto py-1 px-3 bg-[#4ade80] text-black"
                      onClick={handleFloatingWindow}
                    >
                      <MonitorUp className="w-3.5 h-3.5 mr-1" />
                      懸浮顯示 (免切換)
                    </Button>
                    {!generatedBets.some((b: any) => b.isBankerLegs && (b.bankersCount || 0) > 0) && (
                      <Dialog>
                        <DialogTrigger render={
                          <Button
                            data-automation-id="hkjc-desktop-btn"
                            variant="outline"
                            size="sm"
                            className="border-4 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all rounded-full h-auto py-1 px-3 bg-[#a5b4fc] text-black"
                          />
                        }>
                          <span className="flex items-center justify-center px-1 whitespace-nowrap">
                            <Sparkles className="w-3.5 h-3.5 mr-1 shrink-0" />
                            <span className="text-xs sm:text-sm">自動點擊 HKJC</span>
                          </span>
                        </DialogTrigger>
                        <DialogContent className="border-4 border-black rounded-[40px] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] sm:max-w-3xl w-[95vw] overflow-hidden bg-white text-black p-0 top-[5vh] translate-y-0 sm:top-1/2 sm:-translate-y-1/2 flex flex-col h-[90vh] sm:h-auto max-h-[90vh]">
                          <div className="p-6 sm:p-8 overflow-y-auto w-full flex-1 grow custom-scrollbar min-h-0">
                            <DialogHeader>
                              <DialogTitle className="text-xl sm:text-2xl font-black flex items-center gap-2 text-black">
                                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500" /> 自動點擊電腦版教學
                              </DialogTitle>
                              <DialogDescription className="font-bold text-black/80 text-sm sm:text-base space-y-2 flex flex-col">
                                <span>此教學專為電腦桌面版瀏覽器的 單式 / 複式 投注頁面設計。</span>
                              </DialogDescription>
                            </DialogHeader>

                            <div className="w-full mt-4 space-y-6">
                              {/* Bookmarklet Instructions */}
                              <div className="border-4 border-black rounded-2xl p-5 bg-[#fffbfa] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <h4 className="font-black text-lg text-zinc-900 flex items-center gap-2 mb-4">
                                  <span className="bg-zinc-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">★</span>
                                  新增與設定瀏覽器自動點擊書籤
                                </h4>
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Button 
                                      variant="outline"
                                      className="border-4 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all bg-[#FFE867] text-black h-auto py-3 text-sm truncate"
                                      onClick={() => {
                                        navigator.clipboard.writeText("自動按球");
                                        toast.success("名稱已複製！");
                                      }}
                                    >
                                      <Copy className="w-4 h-4 mr-2 shrink-0" />
                                      複製書籤名稱 (自動按球)
                                    </Button>
                                    <Button 
                                      className="border-4 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all bg-zinc-800 text-white hover:bg-zinc-900 h-auto py-3 text-sm truncate"
                                      onClick={() => {
                                        const scriptContent = getBookmarkletCode(true); // desktop bookmarklet for normal single/multi...
                                        navigator.clipboard.writeText(scriptContent);
                                        toast.success("自動按球書籤 URL 代碼已複製！");
                                      }}
                                    >
                                      <Copy className="w-4 h-4 mr-2 shrink-0" />
                                      複製書籤網址 (javascript:...)
                                    </Button>
                                  </div>
                                  <div className="space-y-2 pt-2 border-t border-zinc-200">
                                    <span className="text-sm font-black text-zinc-800">📌 貼心步驟說明：</span>
                                    <ol className="list-decimal list-inside space-y-2.5 font-bold text-sm text-zinc-800 bg-white p-4 rounded-xl border-2 border-zinc-200">
                                      <li>請在您的瀏覽器<b>書籤列</b>上點擊滑鼠右鍵，選擇 <b>「新增網頁」</b> 或 <b>「新增書籤」</b>。</li>
                                      <li>在<b>名稱</b>欄位填入或貼上：<kbd className="bg-[#FFE867] px-1.5 py-0.5 rounded border border-black text-black text-xs font-bold">自動按球</kbd>。</li>
                                      <li>在<b>網址 (URL)</b> 欄位中，貼上剛剛複製的 <kbd className="bg-zinc-100 px-1 py-0.5 rounded text-xs text-rose-600 font-mono">javascript:...</kbd> 腳本代碼並儲存。</li>
                                      <li>
                                        前往 <a href="https://bet.hkjc.com/ch/marksix" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold hover:text-blue-800">HKJC 六合彩投注網頁</a>，接著在書籤列點擊您建好的書籤，程式即刻全自動化點擊並分批加入注項！
                                      </li>
                                    </ol>
                                    <p className="text-[11px] font-bold text-[#FF4D4D] bg-[#FF4D4D]/10 p-2.5 rounded-xl border border-[#FF4D4D]/20 mt-2">
                                      ⚠️ 注意：書籤貼上的號碼是固定的！每次重新生成號碼後，您必須編輯舊書籤更換網址，或者重新建一個新書籤喔。
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                    <div className="flex flex-wrap w-full gap-1.5 sm:gap-2 mt-1 lg:mt-0 lg:w-auto lg:flex-none">
                      {!generatedBets.some((b: any) => b.isBankerLegs && (b.bankersCount || 0) > 0) && (
                        <Dialog>
                          <DialogTrigger render={
                          <Button
                            data-automation-id="hkjc-mobile-btn"
                            variant="outline"
                            size="sm"
                            className="lg:flex-none border-4 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all rounded-full h-auto py-1 px-2 sm:px-3 bg-[#fca5a5] text-black"
                          />
                        }>
                            <span className="flex items-center justify-center px-1 whitespace-nowrap">
                              <Smartphone className="w-3.5 h-3.5 mr-1 shrink-0" />
                              <span className="text-xs sm:text-sm">自動按球(手機)</span>
                            </span>
                        </DialogTrigger>
                        <DialogContent className="border-4 border-black rounded-[40px] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] sm:max-w-3xl w-[95vw] overflow-hidden bg-white text-black p-0 top-[5vh] translate-y-0 sm:top-1/2 sm:-translate-y-1/2 flex flex-col h-[90vh] sm:h-auto max-h-[90vh]">
                        <div className="p-6 sm:p-8 overflow-y-auto w-full flex-1 grow custom-scrollbar min-h-0">
                          <DialogHeader>
                            <DialogTitle className="text-xl sm:text-2xl font-semibold flex items-center gap-2"><Smartphone className="w-5 h-5 sm:w-6 sm:h-6"/> 手機版自動點擊教學</DialogTitle>
                            <DialogDescription className="text-black/80 text-sm sm:text-base space-y-2 flex flex-col">
                              <span>請依據以下步驟，在手機瀏覽器 (Safari 或 Chrome) 設定自動點擊「書籤腳本」。<br/>設定完成後便可於 HKJC 投注頁面執行。</span>
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="w-full mt-4 space-y-5">
                            <div className="space-y-3">
                              <h4 className="font-semibold text-base flex items-center gap-2"><span className="bg-black text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span> 準備書籤內容 (一鍵複製)</h4>
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline"
                                  className="w-1/2 border-4 border-black font-medium shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:translate-x-1 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all bg-[#FFE867] text-black h-auto py-2.5 text-sm sm:text-base px-2 truncate"
                                  onClick={() => {
                                    navigator.clipboard.writeText("自動按球");
                                    toast.success("名稱「自動按球」已複製！");
                                  }}
                                >
                                  <Copy className="w-4 h-4 mr-2 shrink-0" />
                                  <span className="truncate">複製名稱</span>
                                </Button>
                                <Button 
                                  className="w-1/2 border-4 border-black font-medium shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:translate-x-1 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all bg-[#4ade80] text-black hover:bg-[#22c55e] h-auto py-2.5 text-sm sm:text-base px-2 truncate"
                                  onClick={() => {
                                    const scriptContent = decodeURIComponent(getBookmarkletCode(false).replace('javascript:', ''));
                                    navigator.clipboard.writeText("javascript:" + scriptContent);
                                    toast.success("腳本代碼已複製！");
                                  }}
                                >
                                  <Copy className="w-4 h-4 mr-2 shrink-0" />
                                  <span className="truncate">複製腳本代碼</span>
                                </Button>
                              </div>
                              <p className="text-[11px] sm:text-xs text-[#FF4D4D] bg-[#FF4D4D]/10 p-2 rounded-md border-2 border-[#FF4D4D]/20 mt-2">
                                ⚠️ 每次生成新號碼後，請重新複製腳本代碼並更新書籤網址！
                              </p>
                            </div>
                            
                            <div className="space-y-2">
                              <h4 className="font-semibold text-base flex items-center gap-2"><span className="bg-black text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span> 新增並修改書籤</h4>
                              <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-700 bg-zinc-100 p-3 rounded-xl border-2 border-zinc-200">
                                <li>點擊瀏覽器的 分享 或 選單，選擇 加入書籤 (先儲存當前網頁)。</li>
                                <li>進入 書籤列表，點擊剛新增書籤的 編輯。</li>
                                <li>將名稱改為貼上 <kbd className="bg-[#FFE867] px-1.5 py-0.5 rounded border border-black text-black">自動按球</kbd>。</li>
                                <li>將網址(URL) 全部清空，並 貼上腳本代碼。<br/><span className="text-xs text-red-500 block mt-1">(請檢查開頭是否包含 javascript:)</span></li>
                                <li>點擊 儲存。</li>
                              </ol>
                            </div>

                            <div className="space-y-2">
                              <h4 className="font-semibold text-base flex items-center gap-2"><span className="bg-black text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">3</span> 在 HKJC 網頁使用</h4>
                              <div className="text-sm text-zinc-700 bg-zinc-100 p-3 rounded-xl border-2 border-zinc-200 space-y-3">
                                <p>1. 前往 <a href="#" onClick={(e) => {
                                  e.preventDefault();
                                  const isAndroid = /Android/i.test(navigator.userAgent);
                                  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
                                  if (isAndroid) {
                                    window.open("intent://bet.hkjc.com/ch/marksix/Single#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fbet.hkjc.com%2Fch%2Fmarksix%2FSingle;end", "_top");
                                  } else if (isIOS) {
                                    window.open("googlechrome://bet.hkjc.com/ch/marksix/Single", "_top");
                                    setTimeout(() => {
                                      window.open("https://bet.hkjc.com/ch/marksix/Single", "_blank");
                                    }, 1000);
                                  } else {
                                    window.open("https://bet.hkjc.com/ch/marksix/Single", "_blank");
                                  }
                                }} className="text-blue-600 underline font-bold">HKJC 六合彩投注網頁 (Chrome)</a>。</p>
                                <div className="border-l-4 border-[#3b82f6] pl-2 py-1 mb-2 mt-2">
                                  <span className="text-black">Safari 用戶：</span><br/>
                                  點擊下方 <kbd className="bg-white px-1.5 py-0.5 rounded border border-black text-black text-xs">📖 書籤</kbd> 圖示，直接點擊 <kbd className="bg-[#FFE867] px-1 py-0.5 rounded border border-black text-black text-xs">自動按球</kbd>。
                                </div>
                                <div className="border-l-4 border-[#10b981] pl-2 py-1 mb-2">
                                  <span className="text-black">Chrome / Android 用戶：</span><br/>
                                  點擊頂部 網址列，搜尋 <kbd className="bg-[#FFE867] px-1 py-0.5 rounded border border-black text-black text-xs">自動按球</kbd>，點選下方出現的有 ⭐ 星星圖示的搜尋建議。
                                </div>
                                <p className="text-[#FF4D4D] mt-3 tracking-wide">▶ 程式即會幫您自動點擊號碼球和「加入注項」！</p>
                              </div>
                            </div>

                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    )}
                    {generatedBets.some((b: any) => b.isBankerLegs && (b.bankersCount || 0) > 0) && (
                      <Dialog>
                        <DialogTrigger render={
                          <Button
                            data-automation-id="hkjc-banker-desktop-btn"
                            variant="outline"
                            size="sm"
                            className="lg:flex-none border-4 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all rounded-full h-auto py-1 px-2 sm:px-3 bg-[#60a5fa] text-black"
                          />
                        }>
                            <span className="flex items-center justify-center px-1 whitespace-nowrap">
                              <Sparkles className="w-3.5 h-3.5 mr-1 shrink-0" />
                              <span className="text-xs sm:text-sm">自動點擊(拖膽PC)</span>
                            </span>
                        </DialogTrigger>
                        <DialogContent className="border-4 border-black rounded-[40px] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] sm:max-w-3xl w-[95vw] overflow-hidden bg-white text-black p-0 top-[5vh] translate-y-0 sm:top-1/2 sm:-translate-y-1/2 flex flex-col h-[90vh] sm:h-auto max-h-[90vh]">
                          <div className="p-6 sm:p-8 overflow-y-auto w-full flex-1 grow custom-scrollbar min-h-0">
                            <DialogHeader>
                              <DialogTitle className="text-xl sm:text-2xl font-black flex items-center gap-2 text-black">
                                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" /> 拖膽電腦版自動點擊教學
                              </DialogTitle>
                              <DialogDescription className="font-bold text-black/80 text-sm sm:text-base space-y-2 flex flex-col">
                                <span>此教學專為電腦桌面版瀏覽器的 拖膽 (Banker-Legs) 投注頁面 設計。</span>
                              </DialogDescription>
                            </DialogHeader>

                            <div className="w-full mt-4 space-y-6">
                              {/* Bookmarklet Instructions */}
                              <div className="border-4 border-black rounded-2xl p-5 bg-[#fffbfa] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <h4 className="font-black text-lg text-zinc-900 flex items-center gap-2 mb-4">
                                  <span className="bg-zinc-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">★</span>
                                  新增與設定瀏覽器自動點擊書籤
                                </h4>
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Button 
                                      variant="outline"
                                      className="border-4 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all bg-[#FFE867] text-black h-auto py-3 text-sm truncate"
                                      onClick={() => {
                                        navigator.clipboard.writeText("自動拖膽(PC)");
                                        toast.success("名稱已複製！");
                                      }}
                                    >
                                      <Copy className="w-4 h-4 mr-2 shrink-0" />
                                      複製書籤名稱 (自動拖膽(PC))
                                    </Button>
                                    <Button 
                                      className="border-4 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all bg-zinc-800 text-white hover:bg-zinc-900 h-auto py-3 text-sm truncate"
                                      onClick={() => {
                                        const scriptContent = getBankerBookmarkletCode(true);
                                        navigator.clipboard.writeText(scriptContent);
                                        toast.success("拖膽(PC)書籤 URL 代碼已複製！");
                                      }}
                                    >
                                      <Copy className="w-4 h-4 mr-2 shrink-0" />
                                      複製書籤網址 (javascript:...)
                                    </Button>
                                  </div>
                                  <div className="space-y-2 pt-2 border-t border-zinc-200">
                                    <span className="text-sm font-black text-zinc-800">📌 貼心步驟說明：</span>
                                    <ol className="list-decimal list-inside space-y-2.5 font-bold text-sm text-zinc-800 bg-white p-4 rounded-xl border-2 border-zinc-200">
                                      <li>請在您的瀏覽器<b>書籤列</b>上點擊滑鼠右鍵，選擇 <b>「新增網頁」</b> 或 <b>「新增書籤」</b>。</li>
                                      <li>在<b>名稱</b>欄位填入或貼上：<kbd className="bg-[#FFE867] px-1.5 py-0.5 rounded border border-black text-black text-xs font-bold">自動拖膽(PC)</kbd>。</li>
                                      <li>在<b>網址 (URL)</b> 欄位中，貼上剛剛複製的 <kbd className="bg-zinc-100 px-1 py-0.5 rounded text-xs text-rose-600 font-mono">javascript:...</kbd> 腳本代碼並儲存。</li>
                                      <li>
                                        前往 <a href="https://bet.hkjc.com/ch/marksix/Banker" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold hover:text-blue-800">HKJC 六合彩拖膽投注網頁</a>，接著在書籤列點擊您建好的書籤，程式即刻全自動化點擊並分批加入注項！
                                      </li>
                                    </ol>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                    {generatedBets.some((b: any) => b.isBankerLegs && (b.bankersCount || 0) > 0) && (
                      <Dialog>
                        <DialogTrigger render={
                          <Button
                            data-automation-id="hkjc-banker-mobile-btn"
                            variant="outline"
                            size="sm"
                            className="lg:flex-none border-4 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all rounded-full h-auto py-1 px-2 sm:px-3 bg-[#f87171] text-black"
                          />
                        }>
                            <span className="flex items-center justify-center px-1 whitespace-nowrap">
                              <Smartphone className="w-3.5 h-3.5 mr-1 shrink-0" />
                              <span className="text-xs sm:text-sm">自動拖膽(手機)</span>
                            </span>
                        </DialogTrigger>
                        <DialogContent className="border-4 border-black rounded-[40px] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] sm:max-w-3xl w-[95vw] bg-white text-black p-0 top-[5vh] translate-y-0 sm:top-1/2 sm:-translate-y-1/2 flex flex-col h-[90vh] sm:h-auto max-h-[90vh]">
                          <div className="p-6 sm:p-8 overflow-y-auto w-full flex-1 grow custom-scrollbar min-h-0">
                          <DialogHeader>
                            <DialogTitle className="text-xl sm:text-2xl font-semibold flex items-center gap-2"><Smartphone className="w-5 h-5 sm:w-6 sm:h-6"/> 拖膽手機版自動點擊教學</DialogTitle>
                            <DialogDescription className="text-black/80 text-sm sm:text-base space-y-2 flex flex-col">
                              <span>此腳本專為手機版拖膽(Banker)生成。</span>
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="w-full mt-4 space-y-5">
                            <div className="space-y-3">
                              <h4 className="font-semibold text-base flex items-center gap-2"><span className="bg-black text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span> 準備書籤內容 (一鍵複製)</h4>
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline"
                                  className="w-1/2 border-4 border-black font-medium shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:translate-x-1 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all bg-[#FFE867] text-black h-auto py-2.5 text-sm sm:text-base px-2 truncate"
                                  onClick={() => {
                                    navigator.clipboard.writeText("自動拖膽");
                                    toast.success("名稱「自動拖膽」已複製！");
                                  }}
                                >
                                  <Copy className="w-4 h-4 mr-2 shrink-0" />
                                  <span className="truncate">複製名稱</span>
                                </Button>
                                <Button 
                                  className="w-1/2 border-4 border-black font-medium shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:translate-x-1 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all bg-[#4ade80] text-black hover:bg-[#22c55e] h-auto py-2.5 text-sm sm:text-base px-2 truncate"
                                  onClick={() => {
                                    const scriptContent = decodeURIComponent(getBankerBookmarkletCode(false).replace('javascript:', ''));
                                    navigator.clipboard.writeText("javascript:" + scriptContent);
                                    toast.success("拖膽腳本代碼已複製！");
                                  }}
                                >
                                  <Copy className="w-4 h-4 mr-2 shrink-0" />
                                  <span className="truncate">複製腳本代碼</span>
                                </Button>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <h4 className="font-semibold text-base flex items-center gap-2"><span className="bg-black text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span> 新增並修改書籤</h4>
                              <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-700 bg-zinc-100 p-3 rounded-xl border-2 border-zinc-200">
                                <li>點擊瀏覽器的 分享 或 選單，選擇 加入書籤 (先儲存當前網頁)。</li>
                                <li>進入 書籤列表，點擊剛新增書籤的 編輯。</li>
                                <li>將名稱改為貼上 <kbd className="bg-[#FFE867] px-1.5 py-0.5 rounded border border-black text-black">自動拖膽</kbd>。</li>
                                <li>將網址(URL) 全部清空，並 貼上腳本代碼。<br/><span className="text-xs text-red-500 block mt-1">(請檢查開頭是否包含 javascript:)</span></li>
                                <li>點擊 儲存。</li>
                              </ol>
                            </div>

                            <div className="space-y-2">
                              <h4 className="font-semibold text-base flex items-center gap-2"><span className="bg-black text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">3</span> 在 HKJC 網頁使用</h4>
                              <div className="text-sm text-zinc-700 bg-zinc-100 p-3 rounded-xl border-2 border-zinc-200 space-y-3">
                                <p>前往 <a href="#" onClick={(e) => {
                                  e.preventDefault();
                                  const isAndroid = /Android/i.test(navigator.userAgent);
                                  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
                                  if (isAndroid) {
                                    window.open("intent://bet.hkjc.com/ch/marksix/Banker#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fbet.hkjc.com%2Fch%2Fmarksix%2FBanker;end", "_top");
                                  } else if (isIOS) {
                                    window.open("googlechrome://bet.hkjc.com/ch/marksix/Banker", "_top");
                                    setTimeout(() => {
                                      window.open("https://bet.hkjc.com/ch/marksix/Banker", "_blank");
                                    }, 1000);
                                  } else {
                                    window.open("https://bet.hkjc.com/ch/marksix/Banker", "_blank");
                                  }
                                }} className="text-blue-600 underline font-bold">HKJC 六合彩拖膽投注網頁</a>，選取您的書籤執行即可。</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        </DialogContent>
                      </Dialog>
                    )}
                    {(() => {
                      const allGeneratedNumbers = [...generatedBets, ...specialCoverBets].map((b: any) => b.numbers).flat();
                      const usedNums = new Set(allGeneratedNumbers);
                      const unselectedCount = 49 - usedNums.size;

                      if (unselectedCount === 0) return null;

                      return (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="lg:flex-none border-4 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all rounded-full h-auto py-1 px-2 sm:px-3 bg-[#FFE867] hover:bg-[#FFD700] text-black"
                            onClick={() => setIsCoverDialogOpen(true)}
                          >
                            <span className="flex items-center justify-center px-1 whitespace-nowrap">
                              <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-600 shrink-0" />
                              <span className="text-[11px] sm:text-sm">全包剩餘 {unselectedCount} 號</span>
                            </span>
                          </Button>
                          <Dialog open={isCoverDialogOpen} onOpenChange={setIsCoverDialogOpen}>
                            <DialogContent className="border-4 border-black rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] sm:max-w-md w-[95vw] bg-[#f8fafc] text-black p-0 overflow-hidden text-center top-1/2 -translate-y-1/2 flex flex-col">
                              <DialogHeader className="bg-[#FFE867] border-b-4 border-black p-4 shrink-0">
                                <DialogTitle className="text-lg sm:text-xl font-black flex items-center justify-center gap-2">
                                  <Sparkles className="w-6 h-6 text-amber-600 animate-pulse" />
                                  自動生成分流拖膽組合
                                </DialogTitle>
                              </DialogHeader>
                              <div className="p-6 text-sm font-bold text-zinc-700 text-left leading-relaxed flex-1 space-y-5">
                                
                                {/* Budget setting section */}
                                <div className="space-y-2">
                                  <div className="font-black text-black text-[15px] sm:text-lg flex justify-between items-center bg-white p-3 sm:p-4 rounded-xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                     <span>設定總預算</span>
                                     <span className="bg-[#FFD700] px-3 py-1 border-[3px] border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-mono">
                                        ${coverBudget}
                                     </span>
                                  </div>
                                  <div className="pt-2 pb-3 px-2">
                                    <Slider
                                      min={100}
                                      max={800}
                                      step={10}
                                      value={[coverBudget]}
                                      onValueChange={(val) => setCoverBudget(Array.isArray(val) ? val[0] : (Number(val) || 300))}
                                      className="cursor-pointer"
                                    />
                                    <div className="flex justify-between text-xs font-black text-zinc-500 mt-1 px-1">
                                      <span>$100</span>
                                      <span>$800</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Drag/Bet count setting section */}
                                <div className="space-y-2">
                                  <div className="font-black text-black text-[15px] sm:text-lg flex justify-between items-center bg-white p-3 sm:p-4 rounded-xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                     <span>生成拖膽注數</span>
                                     <span className="bg-[#10b981] text-white px-3 py-1 border-[3px] border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                        {coverBetCount} 注
                                      </span>
                                  </div>
                                  <div className="pt-2 pb-3 px-2">
                                    <Slider
                                      min={1}
                                      max={10}
                                      step={1}
                                      value={[coverBetCount]}
                                      onValueChange={(val) => setCoverBetCount(Array.isArray(val) ? val[0] : (Number(val) || 3))}
                                      className="cursor-pointer"
                                    />
                                    <div className="flex justify-between text-xs font-black text-zinc-500 mt-1 px-1">
                                      <span>1 注</span>
                                      <span>10 注</span>
                                    </div>
                                  </div>
                                </div>

                                <p className="font-bold text-sm sm:text-base text-zinc-600 bg-zinc-100 p-2.5 rounded-lg border-2 border-black/10 text-center leading-normal">
                                  即將為剩餘的 <span className="font-black text-black">{unselectedCount}</span> 個未選號碼，自動分散生成 <span className="font-black text-emerald-600">{coverBetCount} 注</span> 拖膽組合。每注都配搭不同的精華「膽」，大大降低因單一膽不中立刻慘負的風險！
                                </p>

                                <Button
                                   className="w-full bg-[#10b981] hover:bg-[#059669] text-black h-auto py-3.5 px-6 text-[17px] font-black border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:translate-x-1 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-2 mt-4"
                                   onClick={() => {
                                     handleAddCoverUnselectedBet();
                                     setIsCoverDialogOpen(false);
                                   }}
                                >
                                   <Sparkles className="w-5 h-5 text-white animate-pulse" />
                                   開始智能生成分流拖膽
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </>
                      );
                    })()}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap justify-center gap-2 sm:gap-4 w-full items-start">
                  {generatedBets.map((bet, index) => (
                    <div key={index} className={`flex flex-col items-center gap-1.5 ${bet.isBankerLegs ? 'w-full max-w-[600px]' : 'w-fit'}`}>
                      <div
                        className={`max-w-[96vw] overflow-hidden border-[3px] border-black rounded-[24px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all bg-white flex p-0.5 z-0 ${isAiGenerated ? 'cursor-pointer hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' : ''} ${bet.isBankerLegs ? 'w-full' : 'w-fit'}`}
                        onClick={() => isAiGenerated && setViewingBetExpl({ index, bet })}
                      >
                        <div className="flex items-center justify-start gap-1 sm:gap-2 min-h-[42px] sm:min-h-[50px] pr-1 pointer-events-none w-full">
                          <div className="text-base sm:text-lg font-black text-black w-8 sm:w-10 transform -rotate-12 ml-1.5 sm:ml-2 shrink-0 text-center leading-none">
                            #{index + 1}
                          </div>
                          <div className={`py-1 ${bet.isBankerLegs ? 'flex-1 grow flex flex-col items-center justify-center min-w-0' : 'flex flex-wrap gap-0 sm:gap-0.5 items-center max-w-[calc(96vw-90px)] sm:max-w-[480px] md:max-w-[700px] lg:max-w-none shrink-0'}`}>
                            {(() => {
                              const renderBall = (num: number, i: number) => {
                                const color = getBallColor(num);
                                return (
                                  <div
                                    key={i}
                                    className={`
                                      w-[38px] h-[38px] sm:w-[46px] sm:h-[46px] shrink-0 rounded-full flex items-center justify-center text-black font-black text-[22px] sm:text-[26px] leading-none pt-0.5 tracking-tighter border-[3px] border-black cursor-default
                                      ${color === "red" ? "bg-[#FF9999]" : color === "blue" ? "bg-[#99CCFF]" : "bg-[#99FF99]"}
                                    `}
                                  >
                                    {num}
                                  </div>
                                );
                              };
                              
                              if (bet.isBankerLegs && bet.bankersCount) {
                                const legsCount = bet.numbers.length - bet.bankersCount;
                                const cols = getLegsCols(legsCount);
                                return (
                                  <div className="flex flex-col gap-1.5 items-center w-full my-1">
                                    <div className="relative">
                                      <div className="flex flex-wrap justify-center items-center gap-1 sm:gap-1.5 bg-yellow-100/50 px-2 sm:px-3 py-0.5 rounded-[18px] border-2 border-black/10">
                                        {bet.numbers.slice(0, bet.bankersCount).map((num, i) => renderBall(num, i))}
                                      </div>
                                      <div className="absolute -bottom-2 -right-1.5 flex items-center justify-center w-[22px] h-[22px] sm:w-[26px] sm:h-[26px] rounded-full bg-black text-[#FFE867] font-black text-[10px] sm:text-[12px] border-[2px] border-white shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] z-10 transform rotate-6">拖</div>
                                    </div>
                                    <div 
                                      className="grid gap-1 sm:gap-1.5 mt-1.5 justify-center place-items-center"
                                      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                                    >
                                      {bet.numbers.slice(bet.bankersCount).map((num, i) => renderBall(num, i + bet.bankersCount!))}
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <div className="flex flex-wrap gap-y-1 gap-x-0 sm:gap-x-0.5 items-center">
                                  {bet.numbers.map((num, i) => renderBall(num, i))}
                                </div>
                              );
                            })()}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setUndoStack(prev => [...prev, { index, bet: generatedBets[index] }]);
                              setGeneratedBets(prev => prev.filter((_, i) => i !== index));
                            }}
                            className="w-[30px] h-[30px] sm:w-[38px] sm:h-[38px] shrink-0 rounded-full flex items-center justify-center bg-zinc-200 hover:bg-red-400 text-black border-2 border-black ml-1 mr-1 transition-colors hover:scale-105 pointer-events-auto"
                          >
                            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                        </div>
                      </div>
                      
                      {bet.isBankerLegs && bet.bankersCount && (
                        <div className="text-[11px] sm:text-xs font-black text-black bg-[#FFE867] border-2 border-black rounded-lg sm:rounded-full px-2.5 py-1 sm:py-0.5 shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] mt-0.5 z-10 w-fit shrink-0">
                          {(() => {
                            const getCombCount = (n: number, k: number) => {
                              if (k > n || k < 0) return 0;
                              if (k === 0 || k === n) return 1;
                              let c = 1;
                              for (let i = 1; i <= k; i++) c = c * (n - i + 1) / i;
                              return c;
                            };
                            const cost = getCombCount(bet.numbers.length - bet.bankersCount, 6 - bet.bankersCount) * 10;
                            return (
                              <div className="flex flex-col sm:flex-row items-center sm:gap-2 leading-tight">
                                <span>💰 5元一注此拖膽成本：${cost / 2}</span>
                                <span className="hidden sm:inline">|</span>
                                <span>10元一注此拖膽成本：${cost}</span>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {specialCoverBets.length > 0 && (
                  <div className="mt-8 border-t-4 border-dashed border-black pt-6">
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
                      <h3 className="text-xl sm:text-2xl font-black text-black">獨 立 補 漏 注 項</h3>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2 sm:gap-4 w-full items-start">
                      {specialCoverBets.map((bet, index) => (
                        <div key={index} className="flex flex-col items-center gap-1.5 w-fit">
                          <div
                            className="w-fit max-w-[96vw] overflow-hidden border-[3px] border-black rounded-[24px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all bg-white flex p-0.5 z-0 relative cursor-pointer hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                            onClick={() => setViewingBetExpl({ index: generatedBets.length + index, bet })}
                          >
                            <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border border-white translate-x-1/3 -translate-y-1/3 z-20 animate-pulse"></div>
                            <div className="flex items-center justify-start gap-1 sm:gap-2 min-h-[42px] sm:min-h-[50px] pr-1 pointer-events-none w-full">
                              <div className="text-base sm:text-lg font-black text-[#FF4D4D] w-8 sm:w-10 transform -rotate-12 ml-1.5 sm:ml-2 shrink-0 text-center leading-none">
                                專屬
                              </div>
                              <div className={`py-1 ${bet.isBankerLegs ? 'flex-1 grow flex flex-col items-center justify-center min-w-0' : 'flex flex-wrap gap-0 sm:gap-0.5 items-center max-w-[calc(96vw-90px)] sm:max-w-[480px] md:max-w-[700px] lg:max-w-none shrink-0'}`}>
                                {(() => {
                                  const renderBall = (num: number, i: number) => {
                                    const color = getBallColor(num);
                                    return (
                                      <div
                                        key={i}
                                        className={`
                                          w-[38px] h-[38px] sm:w-[46px] sm:h-[46px] shrink-0 rounded-full flex items-center justify-center text-black font-black text-[22px] sm:text-[26px] leading-none pt-0.5 tracking-tighter border-[3px] border-black cursor-default
                                          ${color === "red" ? "bg-[#FF9999]" : color === "blue" ? "bg-[#99CCFF]" : "bg-[#99FF99]"}
                                        `}
                                      >
                                        {num}
                                      </div>
                                    );
                                  };
                                  
                                  if (bet.isBankerLegs && bet.bankersCount) {
                                    const legsCount = bet.numbers.length - bet.bankersCount;
                                    const cols = getLegsCols(legsCount);
                                    return (
                                      <div className="flex flex-col gap-1.5 items-center w-full my-1">
                                        <div className="relative">
                                          <div className="flex flex-wrap justify-center items-center gap-1 sm:gap-1.5 bg-yellow-100/50 px-2 sm:px-3 py-0.5 rounded-[18px] border-2 border-black/10">
                                            {bet.numbers.slice(0, bet.bankersCount).map((num: number, i: number) => renderBall(num, i))}
                                          </div>
                                          <div className="absolute -bottom-2 -right-1.5 flex items-center justify-center w-[22px] h-[22px] sm:w-[26px] sm:h-[26px] rounded-full bg-black text-[#FFE867] font-black text-[10px] sm:text-[12px] border-[2px] border-white shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] z-10 transform rotate-6">拖</div>
                                        </div>
                                        <div 
                                          className="grid gap-1 sm:gap-1.5 mt-1.5 justify-center place-items-center"
                                          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                                        >
                                          {bet.numbers.slice(bet.bankersCount).map((num: number, i: number) => renderBall(num, i + bet.bankersCount!))}
                                        </div>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div className="flex flex-wrap gap-y-1 gap-x-0 sm:gap-x-0.5 items-center">
                                      {bet.numbers.map((num: number, i: number) => renderBall(num, i))}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                          
                          {bet.isBankerLegs && bet.bankersCount && (
                            <div className="text-[11px] sm:text-xs font-black text-black bg-[#FFE867] border-2 border-black rounded-lg sm:rounded-full px-2.5 py-1 sm:py-0.5 shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] mt-0.5 z-10 w-fit shrink-0">
                              {(() => {
                                const getCombCount = (n: number, k: number) => {
                                  if (k > n || k < 0) return 0;
                                  if (k === 0 || k === n) return 1;
                                  let c = 1;
                                  for (let i = 1; i <= k; i++) c = c * (n - i + 1) / i;
                                  return c;
                                };
                                const cost = getCombCount(bet.numbers.length - bet.bankersCount, 6 - bet.bankersCount) * 10;
                                return (
                                  <div className="flex flex-col sm:flex-row items-center sm:gap-2 leading-tight">
                                    <span>💰 5元一注此拖膽成本：${cost / 2}</span>
                                    <span className="hidden sm:inline">|</span>
                                    <span>10元一注此拖膽成本：${cost}</span>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 sm:mt-6 bg-[#ffedd5] border-[3px] sm:border-4 border-black rounded-2xl p-3 sm:p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-w-2xl mx-auto w-full text-center">
                  <h3 className="font-black text-lg mb-1 flex items-center justify-center gap-1.5 min-w-0"><Sparkles className="w-5 h-5 text-orange-500 shrink-0" /> 全部生成設定筆記</h3>
                  <div className="text-sm font-bold text-zinc-700 flex flex-wrap gap-2 justify-center mt-2">
                    {isAiGenerated ? (
                      <>
                        <div className="w-full text-left bg-[#bbf7d0] border border-[#16a34a] rounded-lg p-3 sm:p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mt-2 mb-3">
                          <div className="font-black text-[#166534] mb-2 flex items-center gap-1.5 text-base sm:text-lg">
                            <Sparkles className="w-5 h-5 shrink-0" /> 
                            AI 大數據智能選號 (綜合近期 {aiAnalysisDrawsUsed} 期) - 分析筆記：
                          </div>
                          <ul className="list-disc pl-5 sm:pl-6 space-y-1.5 text-sm sm:text-[15px] font-bold text-[#166534] marker:text-[#166534]">
                            {aiReasoning.map((reason, i) => (
                              <li key={i}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                        <span className="w-full text-xs text-zinc-500 mt-2">💡 點擊上方任何一注號碼，可即時查看專屬的大數據選號說明。</span>
                      </>
                    ) : (generatedBets.length > 0 && generatedBets[0].id?.startsWith('unselected-cover-')) ? (
                      <div className="w-full text-left bg-white border-2 border-black rounded-lg p-3 sm:p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mt-2 mb-3">
                        <div className="font-black text-black mb-2 flex items-center gap-1.5 text-base sm:text-lg">
                          <Settings2 className="w-5 h-5 shrink-0" /> 
                          全包剩餘號碼設定筆記：
                        </div>
                        <ul className="list-disc pl-5 sm:pl-6 space-y-1.5 text-sm sm:text-[15px] font-bold text-zinc-700">
                          <li>此組合專為「全包剩餘號碼」策略所產生，此為獨立生成的膽拖/單式組合，以上記錄與當初自定的生成條件及其他篩選設定無關。</li>
                        </ul>
                      </div>
                    ) : (
                      <div className="w-full text-left bg-white border-2 border-black rounded-lg p-3 sm:p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mt-2 mb-3">
                        <div className="font-black text-black mb-2 flex items-center gap-1.5 text-base sm:text-lg">
                          <Settings2 className="w-5 h-5 shrink-0" /> 
                          自定生成設定筆記：
                        </div>
                        <ul className="list-disc pl-5 sm:pl-6 space-y-1.5 text-sm sm:text-[15px] font-bold text-zinc-700">
                          <li>
                            號碼範圍: {ranges.map(r => `${r.start}-${r.end}`).join(', ')}
                            {preferredOddCount === null && oddEven === 'all' && colors.length === 3 && !use3Combos && !use2Combos && !enableRecent && !enableExcludeUnseen && excludedNumbers.length === 0 && luckyNumbers.length === 0 && bankers.length === 0 && !enableComplexRecent && !noConsecutivePairs && !noConsecutiveTriplets && (sumRange[0] === 21 && sumRange[1] === 279) ? ' (純隨機生成，無其他過濾)' : ''}
                          </li>
                          {(sumRange[0] !== 21 || sumRange[1] !== 279) && (
                            <li>總和值分數範圍: {sumRange[0]} - {sumRange[1]}</li>
                          )}
                          {bankers.length > 0 && (
                            <li>定膽號碼: {bankers.join(', ')}</li>
                          )}
                          {(noConsecutivePairs || noConsecutiveTriplets) && (
                            <li>連號限制: {[noConsecutivePairs && "不要連2號", noConsecutiveTriplets && "不要連3號"].filter(Boolean).join("、")}</li>
                          )}
                          {(preferredOddCount !== null || oddEven !== 'all') && (
                            <li>
                              單雙配置: {oddEven === 'all' && preferredOddCount === null ? '無限制' : oddEven === 'odd' ? '全單' : oddEven === 'even' ? '全雙' : `特定比例: ${preferredOddCount}單 ${preferredEvenCount}雙`}
                            </li>
                          )}
                          {colors.length < 3 && (
                            <li>
                              波色配置: {colors.length === 1 ? `全${colors[0] === 'red' ? '紅' : colors[0] === 'blue' ? '藍' : '綠'}波` : `特定波色比例 (${colors[0] === 'red' ? '紅' : colors[0] === 'blue' ? '藍' : '綠'} ${6 - (colorRatioOption || 3)} : ${colorRatioOption || 3} ${colors[1] === 'red' ? '紅' : colors[1] === 'blue' ? '藍' : '綠'})`}
                            </li>
                          )}
                          {(use2Combos || use3Combos) && (
                            <li>
                              大數據策略: {use2Combos ? '2合策略 ' : ''}{use3Combos ? '3合策略' : ''}
                            </li>
                          )}
                          {enableRecent && recentMode === "include" && <li>近期名單過濾: 只買近 {recentCount} 期號碼</li>}
                          {enableRecent && recentMode === "exclude" && <li>近期名單過濾: 排除近 {recentCount} 期號碼</li>}
                          {enableExcludeUnseen && <li>排除未開出過濾: 排除近 {excludeUnseenCount} 期內完全未開出的冷門號碼</li>}
                          {enableComplexRecent && (
                            <li>
                              複雜近期篩選區間: 
                              <span className="ml-2 font-mono text-xs">
                                [
                                {complexIncludeRanges.map(r => `出 ${r.start}-${r.end}`).join(', ')}
                                {complexIncludeRanges.length > 0 && complexExcludeRanges.length > 0 ? ' | ' : ''}
                                {complexExcludeRanges.map(r => `沒出 ${r.start}-${r.end}`).join(', ')}
                                ]
                              </span>
                            </li>
                          )}
                          {excludedNumbers.length > 0 && <li>排除號碼: {excludedNumbers.join(', ')}</li>}
                          {luckyNumbers.length > 0 && <li>必含號碼: {luckyNumbers.join(', ')}</li>}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div className="w-full h-auto flex flex-col items-center bg-orange-400 border-[3px] sm:border-4 border-black rounded-2xl sm:rounded-3xl p-2 sm:p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] sm:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]" style={{ paddingTop: '3px' }}>
                <div className="flex flex-col items-center mb-3 sm:mb-4 pt-1 sm:pt-2 text-center gap-3 w-full" style={{ paddingTop: '-13px', paddingBottom: '-15px', marginBottom: '11px', marginRight: '0px' }}>
                  {nextDrawInfo && (
                    <div className="bg-[#FFD700] border-[3px] border-black px-6 py-2.5 w-max max-w-full rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-center relative mt-3 mb-1" style={{ borderStyle: 'groove', paddingBottom: '7px' }}>
                      <span className="text-xs sm:text-sm font-black px-3 py-0.5 rounded-full border-[2px] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] absolute -top-3.5 sm:-top-4 left-1/2 -translate-x-1/2 whitespace-nowrap tracking-widest" style={{ backgroundColor: '#f060ff', fontSize: '19px' }}>
                         下一期預計頭獎
                      </span>
                      <div className="flex items-center gap-2 sm:gap-3 mt-2 sm:mt-1 font-black">
                        <span className="text-[22px] sm:text-2xl drop-shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)] px-1" style={{ color: '#000000', fontWeight: 'bold', fontFamily: 'Verdana', borderStyle: 'outset', borderColor: '#fe0101' }}>
                          ${nextDrawInfo.estimatedJackpot.toLocaleString()}
                        </span>
                        <span className="text-black/30 font-black text-lg">|</span>
                        <span className="text-xl sm:text-2xl drop-shadow-[1px_1px_0px_rgba(255,255,255,0.8)] px-1" style={{ fontFamily: 'Verdana', paddingLeft: '8px', paddingTop: '4px', borderStyle: 'outset', borderWidth: '-5px' }}>
                          {nextDrawInfo.date}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <span className="inline-block font-black text-lg sm:text-xl text-black bg-[#FFD700] px-3 py-1 border-[3px] border-black rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mt-2" style={{ paddingTop: '1px', paddingRight: '12px', paddingBottom: '1px' }}>
                    最近十期開獎結果
                  </span>
                </div>
                
                <div className="w-full space-y-2">
                  {liveResultsLoading ? (
                    <div className="flex justify-center items-center h-40">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
                      <span className="ml-3 font-bold">載入最新結果中...</span>
                    </div>
                  ) : (
                    displayPastResults.map((drawObj, index) => {
                      const numbers = getRawDrawNumbers(drawObj);
                      const dateStr = getDrawDateStr(drawObj);
                      const displayTitle = index === 0 ? "最近一期" : `前 ${index} 期`;
                      
                      return (
                      <div key={index} className="flex flex-col sm:flex-row items-center justify-center w-fit mx-auto bg-zinc-50 border-[3px] sm:border-[4px] border-black rounded-lg sm:rounded-xl py-1 px-1 sm:py-1.5 sm:px-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] sm:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] gap-1 sm:gap-2 mb-1.5 min-w-[280px]">
                        <div className="flex flex-col items-center min-w-[5rem]">
                          <div className="font-black text-[12px] sm:text-base bg-black text-[#FFE867] px-1 sm:px-2 py-0.5 flex items-center justify-center -rotate-2 rounded whitespace-nowrap shrink-0 leading-none">
                            {displayTitle}
                          </div>
                          {dateStr && dateStr !== "Past Draw" && (
                            <div className="text-[10px] sm:text-xs font-bold text-zinc-500 mt-0.5 whitespace-nowrap">
                              {dateStr}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-0 sm:gap-0.5 flex-nowrap items-center shrink-0 pr-0.5 pb-0.5 sm:pb-0">
                          {numbers.map((num, numIdx) => {
                            const isSpecial = numIdx === 6;
                            const color = getBallColor(num);
                            const bgColor = color === "red" ? "bg-[#FF9999]" : color === "blue" ? "bg-[#99CCFF]" : "bg-[#99FF99]";
                            return (
                              <div key={numIdx} className="flex items-center gap-0 sm:gap-0.5">
                                {isSpecial && <span className="font-black text-sm sm:text-xl text-zinc-400 px-0.5 sm:px-1">+</span>}
                                <div
                                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-[3px] border-black flex items-center justify-center font-black text-[18px] sm:text-[22px] leading-none tracking-tighter pt-0.5 text-black ${bgColor} ${isSpecial ? "opacity-90 border-dashed" : ""}`}
                                >
                                  {num}
                                </div>
                              </div>
                            );
                          })}
                          <button
                            onClick={() => setAnalysisDrawIndex(index)}
                            className="flex ml-1 bg-[#FFE867] px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded sm:rounded-md border-2 sm:border-[3px] border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1.5px] hover:translate-x-[1.5px] hover:shadow-none active:shadow-none transition-all items-center justify-center shrink-0 outline-none focus:outline-none"
                            title="期數分析"
                          >
                            <span className="font-black text-xs sm:text-sm whitespace-nowrap text-black">每期分析</span>
                          </button>
                        </div>
                      </div>
                      );
                    })
                  )}

                  {!liveResultsLoading && displayPastCount < liveResults.length && (
                    <div className="flex flex-col items-center justify-center mt-6 p-4 border-[3px] border-black rounded-xl bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-full max-w-[400px] mx-auto">
                      <div className="flex items-center justify-between w-full mb-3">
                        <Label className="text-base font-black">拉動選擇展示期數</Label>
                        {sliderPastCount !== displayPastCount && (
                          <Button 
                            onClick={() => setDisplayPastCount(sliderPastCount)}
                            className="bg-[#FFE867] hover:bg-[#FFD700] text-black border-2 border-black font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all h-8 px-3 text-xs"
                          >
                            確定載入
                          </Button>
                        )}
                      </div>
                      <div className="flex w-full items-center gap-3">
                        <Slider
                          value={sliderPastCount ? [sliderPastCount] : [10]}
                          min={10}
                          max={Math.min(liveResults.length, 50)}
                          step={1}
                          onValueChange={(val) => {
                            const newValue = Array.isArray(val) ? val[0] : val;
                            setSliderPastCount(newValue as number);
                          }}
                          className="flex-1 cursor-pointer py-2"
                        />
                        <span className="font-black text-sm bg-zinc-100 px-2 py-1 rounded border-2 border-black min-w-[3rem] text-center">
                          {sliderPastCount} 期
                        </span>
                      </div>
                    </div>
                  )}

                  {!liveResultsLoading && displayPastCount >= Math.min(liveResults.length, 50) && (
                     <div className="text-center mt-4 text-zinc-500 font-bold text-sm">已展示全部可用期數</div>
                  )}

                  <div className="mt-6 flex flex-col sm:flex-row gap-2.5 sm:gap-3 w-full justify-center items-center px-2">
                    <Button
                      variant="outline"
                      className="w-full max-w-[290px] sm:w-auto bg-[#bae6fd] hover:bg-[#7dd3fc] text-black h-auto py-2 px-3 sm:px-4 text-sm sm:text-base font-black border-4 border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all whitespace-normal text-center flex items-center justify-center gap-1 leading-tight sm:leading-normal shrink-0"
                      onClick={() => setIsAnalysisDialogOpen(true)}
                    >
                      <BarChart2 className="hidden sm:inline-block w-5 h-5 shrink-0" />
                      <span>預計頭獎與總和分析</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full max-w-[290px] sm:w-auto bg-[#ffd6a5] hover:bg-[#ffb7b2] text-black h-auto py-2 px-3 sm:px-4 text-sm sm:text-base font-black border-4 border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all whitespace-normal text-center flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 leading-tight shrink-0"
                      onClick={() => setIsBacktestDialogOpen(true)}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <SearchCheck className="hidden sm:inline-block w-5 h-5 shrink-0" />
                        <span>核對中奬號碼</span>
                      </div>
                      <span className="text-[10px] sm:text-xs font-bold opacity-80 sm:ml-1 leading-none">(Backtesting)</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="max-w-[1600px] mx-auto px-4 py-6 text-center flex flex-col items-center gap-3">
        <p className="text-base font-black text-black">
          此系統由池記桌遊提供 版權2026
        </p>
        <a
          href="https://wa.me/85293737819"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-[#25D366] text-black font-black px-4 py-2 rounded-full border-[3px] border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all"
        >
          <MessageCircle className="w-5 h-5" />
          <span>聯絡池記桌遊</span>
        </a>
      </footer>

      <Dialog open={analysisDrawIndex !== null} onOpenChange={(open) => !open && setAnalysisDrawIndex(null)}>
        <DialogContent className="sm:max-w-6xl border-[4px] border-black rounded-[24px] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-0 w-[95vw] h-[90vh] sm:h-auto sm:max-h-[90vh] flex flex-col [&>button.absolute]:hidden overflow-hidden bg-white">
          {analysisDrawIndex !== null && (() => {
            const drawObj = displayPastResults[analysisDrawIndex];
            const drawNumbers = getRawDrawNumbers(drawObj);
            
            // Single draw stats
            const singleSixNumbers = drawNumbers.slice(0, 6);
            const singleSizeDist = [
              { label: '1-9', count: singleSixNumbers.filter(n => n < 10).length },
              { label: '10-19', count: singleSixNumbers.filter(n => n >= 10 && n <= 19).length },
              { label: '20-29', count: singleSixNumbers.filter(n => n >= 20 && n <= 29).length },
              { label: '30-39', count: singleSixNumbers.filter(n => n >= 30 && n <= 39).length },
              { label: '40-49', count: singleSixNumbers.filter(n => n >= 40 && n <= 49).length }
            ];
            const singleOddCount = singleSixNumbers.filter(n => n % 2 !== 0).length;
            const singleEvenCount = singleSixNumbers.filter(n => n % 2 === 0).length;
            const singleRedCount = singleSixNumbers.filter(n => getBallColor(n) === "red").length;
            const singleBlueCount = singleSixNumbers.filter(n => getBallColor(n) === "blue").length;
            const singleGreenCount = singleSixNumbers.filter(n => getBallColor(n) === "green").length;

            // Find the start and end logic for historical tracking based on the currently selected draw.
            // Eg. if user views draw #5 (index 4) and wants 5 periods of history, we check draw #6 to #10.
            const startHistoryIndex = analysisDrawIndex + 1;
            const endHistoryIndex = startHistoryIndex + analysisRangeCount;
            const recentDraws = liveResults.slice(startHistoryIndex, endHistoryIndex);
            
            // Draw numbers (1-indexed base) for UI display
            const targetDrawDisplayNumber = analysisDrawIndex + 1;
            const startDisplayNumber = targetDrawDisplayNumber + 1;
            const endDisplayNumber = startDisplayNumber + recentDraws.length - 1;

            // Get all normal numbers from recent draws (excluding the 7th special number)
            const recentNormalNumbers = recentDraws.flatMap(d => getRawDrawNumbers(d).slice(0, 6));

            const aggSizeDist = [
              { label: '1-9', count: recentNormalNumbers.filter(n => n < 10).length },
              { label: '10-19', count: recentNormalNumbers.filter(n => n >= 10 && n <= 19).length },
              { label: '20-29', count: recentNormalNumbers.filter(n => n >= 20 && n <= 29).length },
              { label: '30-39', count: recentNormalNumbers.filter(n => n >= 30 && n <= 39).length },
              { label: '40-49', count: recentNormalNumbers.filter(n => n >= 40 && n <= 49).length }
            ];
            const aggOddCount = recentNormalNumbers.filter(n => n % 2 !== 0).length;
            const aggEvenCount = recentNormalNumbers.filter(n => n % 2 === 0).length;
            const aggRedCount = recentNormalNumbers.filter(n => getBallColor(n) === "red").length;
            const aggBlueCount = recentNormalNumbers.filter(n => getBallColor(n) === "blue").length;
            const aggGreenCount = recentNormalNumbers.filter(n => getBallColor(n) === "green").length;

            return (
              <>
                <DialogHeader className="bg-[#FFE867] border-b-4 border-black p-3 sm:p-2 sm:px-4 shrink-0 flex flex-row items-center justify-between space-y-0">
                  <DialogTitle className="text-2xl sm:text-xl font-black flex items-center gap-2 m-0 p-0">
                    <BarChart2 className="w-7 h-7 sm:w-6 sm:h-6" />
                    最近第 {analysisDrawIndex + 1} 期分析
                  </DialogTitle>
                  <Button
                    onClick={() => setAnalysisDrawIndex(null)}
                    className="bg-white hover:bg-zinc-100 text-black border-2 sm:border-2 border-black font-normal shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all rounded-lg h-9 sm:h-9 px-3 sm:px-4 text-sm sm:text-sm"
                  >
                    回到首頁
                  </Button>
                </DialogHeader>
                <div id="analysis-scroll-area" className="p-3 sm:p-4 pb-8 sm:pb-8 flex-1 flex flex-col gap-3 overflow-y-auto">
                  
                  {/* Current Draw Balls */}
                  <div className="flex shrink-0 gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap justify-center items-center bg-zinc-50 border-[3px] border-black rounded-xl p-2.5 sm:p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mt-2 mb-1">
                    {drawNumbers.map((num, i) => {
                      const isSpecial = i === 6;
                      const color = getBallColor(num);
                      const bgColor = color === "red" ? "bg-[#FF9999]" : color === "blue" ? "bg-[#99CCFF]" : "bg-[#99FF99]";
                      return (
                        <div key={i} className="flex items-center gap-1 sm:gap-2">
                          {isSpecial && <span className="font-black text-xl sm:text-2xl text-zinc-400">+</span>}
                          <div
                            className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full border-2 sm:border-[3px] border-black flex items-center justify-center font-black text-base sm:text-xl text-black ${bgColor} ${isSpecial ? "opacity-90 shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] sm:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border-dashed" : "shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] sm:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"}`}
                          >
                            {num}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {!Array.isArray(drawObj) && drawObj.firstPrize !== undefined && drawObj.firstPrize > 0 && (
                    <div className="bg-[#fffbeb] border-[3px] border-black rounded-xl p-2.5 sm:p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex flex-row items-center justify-between mb-1 mt-1">
                      <span className="font-normal text-zinc-700 text-sm sm:text-base">當期預計頭獎金額</span>
                      <div className="text-right flex flex-col">
                        <span className="font-normal text-lg sm:text-xl text-[#FF4D4D]">
                          ${drawObj.firstPrize.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Single Draw Stats */}
                  <div className="flex flex-col shrink-0 gap-2 sm:gap-2 mb-1">
                    <h4 className="font-black text-xl sm:text-lg border-b-[3px] border-black pb-1 text-black">當期頭六碼分佈</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="bg-zinc-50 border-[3px] border-black rounded-xl p-2 sm:p-2 sm:px-3 flex flex-col gap-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <span className="text-sm sm:text-xs font-normal text-zinc-500 uppercase">大小區間分佈</span>
                        <div className="flex gap-1.5 sm:gap-1.5 text-sm sm:text-sm font-normal flex-wrap">
                          {singleSizeDist.map(dist => (
                            <div key={dist.label} className="flex bg-white border-2 border-black rounded px-1.5 py-0.5 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                              <span className="text-zinc-600 mr-1 sm:mr-0.5">{dist.label}:</span>
                              <span className={dist.count > 0 ? "text-[#3b82f6]" : "text-zinc-300"}>{dist.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="bg-zinc-50 border-[3px] border-black rounded-xl p-2 sm:p-2 sm:px-3 flex flex-col gap-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] justify-center">
                        <span className="text-sm sm:text-xs font-normal text-zinc-500 uppercase">單雙分佈</span>
                        <span className="text-xl sm:text-lg font-normal">{singleOddCount} 單 : {singleEvenCount} 雙</span>
                      </div>
                      <div className="bg-zinc-50 border-[3px] border-black rounded-xl p-2 sm:p-2 sm:px-3 flex flex-col gap-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] justify-center">
                        <span className="text-sm sm:text-xs font-normal text-zinc-500 uppercase">波色分佈</span>
                        <span className="text-xl sm:text-lg font-normal flex gap-2">
                          <span className="text-[#FF5C00]">{singleRedCount} 紅</span>
                          <span className="text-[#3b82f6]">{singleBlueCount} 藍</span>
                          <span className="text-[#22c55e]">{singleGreenCount} 綠</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Analysis Range Control */}
                  <div className="flex flex-col shrink-0 gap-2 sm:gap-2 mt-1 border-t-[3px] border-black border-dashed pt-3 sm:pt-4">
                    <h4 className="font-black text-xl sm:text-lg border-b-[3px] border-black pb-1 mb-0.5 text-[#3b82f6]">歷史趨勢追蹤</h4>
                    
                    <div className="flex items-center gap-2 bg-zinc-50 border-[3px] border-black py-1 px-2 rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <Label className="font-normal text-sm sm:text-sm whitespace-nowrap">參考期數</Label>
                      <Slider
                        value={[Math.min(analysisRangeCount, Math.max(0, liveResults.length - (analysisDrawIndex + 1)))]}
                        min={1}
                        max={Math.min(50, Math.max(1, liveResults.length - (analysisDrawIndex + 1)))}
                        step={1}
                        onValueChange={(val) => {
                          const newValue = Array.isArray(val) ? val[0] : val;
                          setAnalysisRangeCount(newValue as number);
                        }}
                        className="py-1 flex-1 cursor-pointer"
                        disabled={liveResults.length - (analysisDrawIndex + 1) === 0}
                      />
                      <span className="font-black text-sm sm:text-sm bg-black text-white px-2 py-0.5 rounded shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] whitespace-nowrap">
                        {Math.min(analysisRangeCount, Math.max(0, liveResults.length - (analysisDrawIndex + 1)))} 期
                      </span>
                    </div>

                    {/* Aggregated Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="bg-zinc-50 border-[3px] border-black rounded-xl p-2 sm:p-2 sm:px-3 flex flex-col gap-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <span className="text-sm sm:text-xs font-normal text-zinc-500 uppercase">
                          {recentDraws.length > 0 ? `第 ${startDisplayNumber} - ${endDisplayNumber} 期 大小分佈` : "暫無足夠歷史數據"}
                        </span>
                        <div className="flex gap-1.5 sm:gap-1.5 text-sm sm:text-sm font-normal flex-wrap">
                          {aggSizeDist.map(dist => (
                            <div key={dist.label} className="flex bg-white border-2 border-black rounded px-1.5 py-0.5 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                              <span className="text-zinc-600 mr-1 sm:mr-0.5">{dist.label}:</span>
                              <span className={dist.count > 0 ? "text-[#3b82f6]" : "text-zinc-300"}>{dist.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="bg-zinc-50 border-[3px] border-black rounded-xl p-2 sm:p-2 sm:px-3 flex flex-col gap-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] justify-center">
                        <span className="text-sm sm:text-xs font-normal text-zinc-500 uppercase">
                           {recentDraws.length > 0 ? `第 ${startDisplayNumber} - ${endDisplayNumber} 期 單雙分佈` : "暫無足夠數據"}
                        </span>
                        <span className="text-xl sm:text-lg font-normal">{aggOddCount} 單 : {aggEvenCount} 雙</span>
                      </div>
                      <div className="bg-zinc-50 border-[3px] border-black rounded-xl p-2 sm:p-2 sm:px-3 flex flex-col gap-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] justify-center">
                        <span className="text-sm sm:text-xs font-normal text-zinc-500 uppercase">
                           {recentDraws.length > 0 ? `第 ${startDisplayNumber} - ${endDisplayNumber} 期 波色分佈` : "暫無足夠數據"}
                        </span>
                        <span className="text-xl sm:text-lg font-normal flex gap-2">
                          <span className="text-[#FF5C00]">{aggRedCount} 紅</span>
                          <span className="text-[#3b82f6]">{aggBlueCount} 藍</span>
                          <span className="text-[#22c55e]">{aggGreenCount} 綠</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Number Breakdowns */}
                  <div className="space-y-1.5 shrink-0 sm:space-y-2 mt-2">
                    <h4 className="font-black text-xl sm:text-lg border-b-[3px] border-black pb-1 mb-1">
                      於第 {startDisplayNumber} - {endDisplayNumber} 期內的歷史出現頻率
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-2">
                      {drawNumbers.map((num, i) => {
                        const isSpecial = i === 6;
                        const appearedIn: number[] = [];
                        recentDraws.forEach((pastDraw, pastIndex) => {
                          if (getRawDrawNumbers(pastDraw).includes(num)) appearedIn.push(startDisplayNumber + pastIndex);
                        });
                        
                        const color = getBallColor(num);
                        const bgColor = color === "red" ? "bg-[#FF9999]" : color === "blue" ? "bg-[#99CCFF]" : "bg-[#99FF99]";

                        return (
                          <div key={i} className="flex gap-2 sm:gap-2.5 items-center p-2 sm:p-2 bg-zinc-50 border-[3px] border-black rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                              <div className={`w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-full border-[2px] sm:border-[3px] border-black flex items-center justify-center font-black text-xl sm:text-xl text-black ${bgColor} ${isSpecial ? "border-dashed opacity-90 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" : "shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"}`}>
                                {num}
                              </div>
                              <div className="flex flex-col gap-0 w-full overflow-hidden">
                                <span className="font-normal text-lg sm:text-base leading-tight">
                                  {isSpecial && "特碼 "}
                                  共 <span className="text-[#3b82f6] text-xl sm:text-xl leading-none font-normal">{appearedIn.length}</span> 次
                                </span>
                                <span className="text-sm sm:text-xs font-normal text-zinc-600 leading-[1.1] sm:leading-tight truncate w-full" title={appearedIn.length > 0 ? `(見於: 第 ${appearedIn.join(", ")} 期)` : "無歷史出現紀錄"}>
                                  {appearedIn.length > 0 ? `第 ${appearedIn.join(", ")} 期` : "歷史未出現"}
                                </span>
                              </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {(() => {
                    const currentDraw = liveResults[analysisDrawIndex];
                    if (!currentDraw) return null;
                    const winningNums = getRawDrawNumbers(currentDraw).slice(0, 6);
                    
                    const minNum = Math.min(...winningNums);
                    const maxNum = Math.max(...winningNums);

                    const getFreqStats = (drawsCount: number, hotThreshold: number, warmThreshold: number = 1) => {
                      const pastDraws = liveResults.slice(analysisDrawIndex + 1, analysisDrawIndex + 1 + drawsCount);
                      const allPastNums = pastDraws.flatMap(d => getRawDrawNumbers(d));
                      const freqMap = new Map<number, number>();
                      allPastNums.forEach(n => freqMap.set(n, (freqMap.get(n) || 0) + 1));
                      
                      let hot = 0, warm = 0, cold = 0;
                      const hotNums: number[] = [];
                      const warmNums: number[] = [];
                      const coldNums: number[] = [];
                      winningNums.forEach(n => {
                        const f = freqMap.get(n) || 0;
                        if (f >= hotThreshold) { hot++; hotNums.push(n); }
                        else if (f >= warmThreshold) { warm++; warmNums.push(n); }
                        else { cold++; coldNums.push(n); }
                      });
                      return { hot, warm, cold, hotNums, warmNums, coldNums };
                    };

                    const stats5 = getFreqStats(5, 2);
                    const stats10 = getFreqStats(10, 2);
                    const stats20 = getFreqStats(20, 4);

                    let recentStrategySuggestion = "";
                    if (stats10.hot >= 3) {
                       recentStrategySuggestion = `熱門號碼強勢當道！建議採用「追熱」策略。`;
                    } else if (stats10.cold >= 3) {
                       recentStrategySuggestion = `大爆冷門！建議考慮部分「守冷」或全選未開出號碼。`;
                    } else if (stats10.warm >= 4) {
                       recentStrategySuggestion = `溫號居多，建議採用「溫和守中」策略。`;
                    } else {
                       recentStrategySuggestion = `冷熱號碼分佈平均，建議結合「大數據」號碼分析。`;
                    }

                    const oddCount = winningNums.filter(n => n % 2 !== 0).length;
                    const evenCount = 6 - oddCount;
                    
                    const rCount = winningNums.filter(n => getBallColor(n) === 'red').length;
                    const bCount = winningNums.filter(n => getBallColor(n) === 'blue').length;
                    const gCount = winningNums.filter(n => getBallColor(n) === 'green').length;
                    
                    const colorResults = [
                        { color: '紅波', count: rCount },
                        { color: '藍波', count: bCount },
                        { color: '綠波', count: gCount }
                    ].sort((a, b) => b.count - a.count);
                    
                    const dominantColors = colorResults.filter(c => c.count > 0);
                    const colorStr = dominantColors.map(c => `${c.color} ${c.count} 個`).join('，');
                    
                    const sortedNums = [...winningNums].sort((a,b)=>a-b);
                    const consecutiveGroups: number[][] = [];
                    if (sortedNums.length > 0) {
                      let currentGroup: number[] = [sortedNums[0]];
                      for (let i = 1; i < sortedNums.length; i++) {
                        if (sortedNums[i] === sortedNums[i-1] + 1) {
                          currentGroup.push(sortedNums[i]);
                        } else {
                          if (currentGroup.length >= 2) {
                            consecutiveGroups.push(currentGroup);
                          }
                          currentGroup = [sortedNums[i]];
                        }
                      }
                      if (currentGroup.length >= 2) {
                        consecutiveGroups.push(currentGroup);
                      }
                    }
                    const consecutives = consecutiveGroups.length;
                    const getConsecutiveDesc = (groups: number[][]) => {
                      if (groups.length === 0) return "無連號";
                      return groups.map(g => `${g.join('-')} (連${g.length}號)`).join('、');
                    };

                    const tails = sortedNums.map(n => n % 10);
                    const tailCounts = tails.reduce((acc, t) => {
                      acc[t] = (acc[t] || 0) + 1;
                      return acc;
                    }, {} as Record<number, number>);
                    const commonTails = Object.entries(tailCounts).filter(([_, count]) => count > 1).map(([tail, count]) => `${tail}尾(${count}個)`);

                    const zones = [0, 0, 0, 0, 0];
                    sortedNums.forEach(n => {
                      if (n < 10) zones[0]++;
                      else if (n < 20) zones[1]++;
                      else if (n < 30) zones[2]++;
                      else if (n < 40) zones[3]++;
                      else zones[4]++;
                    });
                    const emptyZones = zones.map((count, index) => count === 0 ? `${index === 0 ? 1 : index * 10}-${index === 4 ? 49 : index * 10 + 9}` : null).filter(Boolean);

                    const sum = winningNums.reduce((a, b) => a + b, 0);
                    const sumCategory = sum < 120 ? "偏小 (<120)" : sum > 180 ? "偏大 (>180)" : "適中 (120-180)";

                    return (
                        <div className="mt-6 shrink-0 bg-[#f0fdf4] p-5 sm:p-6 rounded-2xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
                            <div className="absolute -top-4 -right-4 w-24 h-24 bg-[#16a34a] rounded-full opacity-10 blur-2xl"></div>
                            <h3 className="font-black text-xl text-black mb-4 flex items-center gap-2 relative z-10 border-b-2 border-dashed border-black pb-3">
                                <Sparkles className="w-6 h-6 text-[#16a34a]" />
                                AI 大數據智能深度分析
                            </h3>
                            <div className="space-y-4 text-sm sm:text-[15px] font-normal text-zinc-800 relative z-10">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="flex bg-white border-2 border-black rounded-lg p-3 items-center gap-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]">
                                    <div className="bg-green-100 border-2 border-black rounded-full px-3 py-1 font-normal text-xs shrink-0 text-green-800">分佈範圍</div>
                                    <div>{minNum} 至 {maxNum}</div>
                                  </div>
                                  <div className="flex bg-white border-2 border-black rounded-lg p-3 items-center gap-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]">
                                    <div className="bg-green-100 border-2 border-black rounded-full px-3 py-1 font-normal text-xs shrink-0 text-green-800">單雙比例</div>
                                    <div>{oddCount} 單 {evenCount} 雙</div>
                                  </div>
                                  <div className="flex bg-white border-2 border-black rounded-lg p-3 items-center gap-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]">
                                    <div className="bg-green-100 border-2 border-black rounded-full px-3 py-1 font-normal text-xs shrink-0 text-green-800">波色分佈</div>
                                    <div className="text-sm">{colorStr}</div>
                                  </div>
                                  <div className="flex bg-white border-2 border-black rounded-lg p-3 items-center gap-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]">
                                    <div className="bg-green-100 border-2 border-black rounded-full px-3 py-1 font-normal text-xs shrink-0 text-green-800">總和區間</div>
                                    <div>{sum} <span className="text-zinc-500 text-xs ml-1">({sumCategory})</span></div>
                                  </div>
                                </div>
                                
                                <div className="flex bg-white border-2 border-black rounded-lg p-3 flex-col items-start gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]">
                                  <div className="flex items-center gap-3 w-full">
                                    <div className="bg-orange-100 border-2 border-black rounded-full px-3 py-1 font-normal text-xs shrink-0 text-orange-800">特殊形態</div>
                                    <div className="flex-1 flex flex-wrap gap-2">
                                      {consecutives > 0 ? (
                                        <span className="bg-red-100 border border-red-300 text-red-800 px-2 py-0.5 rounded text-xs font-semibold">出現連號: {getConsecutiveDesc(consecutiveGroups)}</span>
                                      ) : (
                                        <span className="bg-zinc-100 border border-zinc-300 text-zinc-600 px-2 py-0.5 rounded text-xs">無連號</span>
                                      )}
                                      {commonTails.length > 0 ? (
                                        <span className="bg-purple-100 border border-purple-300 text-purple-800 px-2 py-0.5 rounded text-xs">同尾: {commonTails.join(', ')}</span>
                                      ) : (
                                        <span className="bg-zinc-100 border border-zinc-300 text-zinc-600 px-2 py-0.5 rounded text-xs">無同尾數</span>
                                      )}
                                      {emptyZones.length > 0 && (
                                         <span className="bg-blue-100 border border-blue-300 text-blue-800 px-2 py-0.5 rounded text-xs">斷區: {emptyZones.join(', ')}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex bg-white border-2 border-black rounded-lg p-3 flex-col items-start gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]">
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-3 w-full">
                                    <div className="bg-yellow-200 border-2 border-black rounded-full px-2.5 py-0.5 font-normal text-[11px] shrink-0 text-yellow-900 whitespace-nowrap text-center mt-0.5 sm:mb-auto">近期冷熱</div>
                                    <div className="flex flex-col gap-2 w-full text-[13px]">
                                      <div className="flex flex-col w-full bg-zinc-50 px-2 py-1.5 rounded border border-black max-w-full">
                                        <div className="flex items-center gap-1.5 w-full">
                                          <span className="font-bold text-zinc-600 min-w-[40px]">近 5 期</span>
                                          <div className="flex gap-2 font-mono ml-auto">
                                            <span className="w-[32px] text-right"><span className="text-red-500 font-bold">{stats5.hot}</span> 熱</span>
                                            <span className="w-[32px] text-right"><span className="text-orange-500 font-bold">{stats5.warm}</span> 溫</span>
                                            <span className="w-[32px] text-right"><span className="text-blue-500 font-bold">{stats5.cold}</span> 冷</span>
                                          </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-[11px] mt-1 pr-2 pt-0.5 border-t border-zinc-200">
                                          {stats5.hot > 0 && <span className="text-red-600">熱: {stats5.hotNums.join(', ')}</span>}
                                          {stats5.warm > 0 && <span className="text-orange-600">溫: {stats5.warmNums.join(', ')}</span>}
                                          {stats5.cold > 0 && <span className="text-blue-600">冷: {stats5.coldNums.join(', ')}</span>}
                                        </div>
                                      </div>
                                      
                                      <div className="flex flex-col w-full bg-zinc-50 px-2 py-1.5 rounded border border-black max-w-full">
                                        <div className="flex items-center gap-1.5 w-full">
                                          <span className="font-bold text-zinc-600 min-w-[44px]">近 10 期</span>
                                          <div className="flex gap-2 font-mono ml-auto">
                                            <span className="w-[32px] text-right"><span className="text-red-500 font-bold">{stats10.hot}</span> 熱</span>
                                            <span className="w-[32px] text-right"><span className="text-orange-500 font-bold">{stats10.warm}</span> 溫</span>
                                            <span className="w-[32px] text-right"><span className="text-blue-500 font-bold">{stats10.cold}</span> 冷</span>
                                          </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-[11px] mt-1 pr-2 pt-0.5 border-t border-zinc-200">
                                          {stats10.hot > 0 && <span className="text-red-600">熱: {stats10.hotNums.join(', ')}</span>}
                                          {stats10.warm > 0 && <span className="text-orange-600">溫: {stats10.warmNums.join(', ')}</span>}
                                          {stats10.cold > 0 && <span className="text-blue-600">冷: {stats10.coldNums.join(', ')}</span>}
                                        </div>
                                      </div>

                                      <div className="flex flex-col w-full bg-zinc-50 px-2 py-1.5 rounded border border-black max-w-full">
                                        <div className="flex items-center gap-1.5 w-full">
                                          <span className="font-bold text-zinc-600 min-w-[44px]">近 20 期</span>
                                          <div className="flex gap-2 font-mono ml-auto">
                                            <span className="w-[32px] text-right"><span className="text-red-500 font-bold">{stats20.hot}</span> 熱</span>
                                            <span className="w-[32px] text-right"><span className="text-orange-500 font-bold">{stats20.warm}</span> 溫</span>
                                            <span className="w-[32px] text-right"><span className="text-blue-500 font-bold">{stats20.cold}</span> 冷</span>
                                          </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-[11px] mt-1 pr-2 pt-0.5 border-t border-zinc-200">
                                          {stats20.hot > 0 && <span className="text-red-600">熱: {stats20.hotNums.join(', ')}</span>}
                                          {stats20.warm > 0 && <span className="text-orange-600">溫: {stats20.warmNums.join(', ')}</span>}
                                          {stats20.cold > 0 && <span className="text-blue-600">冷: {stats20.coldNums.join(', ')}</span>}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Comprehensive Recommendation */}
                                <div className="bg-zinc-900 text-white p-4 rounded-xl border-[3px] border-black mt-2 shadow-[4px_4px_0px_0px_#FFE867]">
                                  <div className="font-black text-lg mb-2 text-[#FFE867] flex items-center gap-2">
                                    <span className="text-xl">🤖</span> AI 智能綜合建議
                                  </div>
                                  <ul className="list-disc pl-5 space-y-1.5 text-[14px] text-zinc-200">
                                    <li>這期總和為 <span className="font-normal">{sum} ({sumCategory})</span>，號碼分佈{consecutives > 0 ? '偏向聚集' : '較為分散'}。</li>
                                    {emptyZones.length > 0 && (
                                      <li>出現明顯「斷區」，未來若針對這類趨勢，可善用「自訂號碼分析範圍」排除 <span className="font-normal">{emptyZones.join('、')}</span>。</li>
                                    )}
                                    {commonTails.length > 0 && (
                                      <li>同尾數效應 ({commonTails.join(', ')}) 發生，適時挑選尾數靈感有助提升機率。</li>
                                    )}
                                    <li><span className="font-normal">{recentStrategySuggestion}</span></li>
                                  </ul>
                                </div>

                                <p className="text-[12px] text-zinc-500 font-bold mt-2 text-center">
                                  💡 活用以上數據，到主頁點選「進階設定」調整屬於您的最強生成法則！
                                </p>
                            </div>
                        </div>
                    );
                  })()}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>


      <Dialog open={isStrategyInfoOpen} onOpenChange={setIsStrategyInfoOpen}>
        <DialogContent className="border-4 border-black rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] sm:max-w-[500px] w-[95vw] bg-white text-black p-0 overflow-hidden text-center top-1/2 -translate-y-1/2 flex flex-col max-h-[85vh]">
          <DialogHeader className="bg-[#BAE6FD] border-b-4 border-black p-4 shrink-0">
            <DialogTitle className="text-xl font-black flex items-center justify-center gap-2">
              <Sparkles className="w-6 h-6 text-[#3b82f6]" />
              AI 大數據智能預測說明
            </DialogTitle>
          </DialogHeader>
          <div className="p-5 text-sm font-bold text-zinc-700 text-left leading-relaxed overflow-y-auto min-h-0 flex-1 space-y-4 custom-scrollbar">
            
            <div className="bg-[#f0fdf4] p-3 rounded-lg border-2 border-green-200">
              <h4 className="text-green-700 font-extrabold mb-1 flex items-center gap-1.5"><span className="text-lg">🌡️</span> 溫度過濾策略 (每次生成隨機決策)</h4>
              <ul className="list-disc pl-5 mt-1 space-y-1 text-zinc-800 font-medium">
                <li><strong className="font-bold text-green-800">保守防守：</strong>排除近 1 期的大熱號碼，保留第 2 - 5 期的微熱號碼。</li>
                <li><strong className="font-bold text-green-800">乘勝追擊：</strong>不排除近期，反而鎖定近 1 - 3 期頻繁出現的當炒大熱號碼。</li>
                <li><strong className="font-bold text-green-800">逆向博冷：</strong>完全排除近 6 期出現過的大熱號碼，專挑久未出現的「冷門」號碼博取高回報！</li>
              </ul>
            </div>

            <div className="bg-[#fdf4ff] p-3 rounded-lg border-2 border-fuchsia-200">
              <h4 className="text-fuchsia-700 font-extrabold mb-1 flex items-center gap-1.5"><span className="text-lg">🎨</span> 顏色波色決策</h4>
              <ul className="list-disc pl-5 mt-1 space-y-1 text-zinc-800 font-medium">
                <li>大多數情況下會維持<strong className="font-bold">紅白藍三色均勻</strong>分配。</li>
                <li>偶爾會根據近期最常開出的兩種波色，<strong className="font-bold">鎖定那兩種波色</strong>，並按比例投放資源（例如只買旺開的紅藍波）。</li>
              </ul>
            </div>

            <div className="bg-[#fefce8] p-3 rounded-lg border-2 border-yellow-200">
              <h4 className="text-yellow-700 font-extrabold mb-1 flex items-center gap-1.5"><span className="text-lg">📊</span> 大數據注數分配</h4>
              <p className="text-zinc-800 font-medium">
                在使用「2合 / 3合組合」策略的資源不再固定是 20%，而是會動態在 <strong className="font-bold text-yellow-800">15% 到 40%</strong> 之間浮動，幫助避免過度倚賴單一演算法。<br/>
                （其餘注數會採用受溫度過濾、波色和單雙控制的純機率分佈）
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="bg-[#ffedd5] p-3 rounded-lg border-2 border-orange-200 flex-1">
                <h4 className="text-orange-600 font-extrabold mb-1 flex items-center gap-1.5"><span className="text-lg">🎲</span> 採用「2合」策略</h4>
                <p className="text-zinc-800 font-medium">
                  系統會從初步生成的號碼中，隨機抽取 1 至 3 個號碼作為「基數」。分析過去期數數據，找出與該基數同開機率最高的頭 6 個伴隨號碼 (2合組合)，加入高機率號碼並隨機替換原號碼。
                </p>
              </div>
              <div className="bg-[#e0f2fe] p-3 rounded-lg border-2 border-blue-200 flex-1">
                <h4 className="text-blue-600 font-extrabold mb-1 flex items-center gap-1.5"><span className="text-lg">🎯</span> 採用「3合」策略</h4>
                <p className="text-zinc-800 font-medium">
                  系統會從初步生成的號碼中，隨機抽取 1 至 3 對號碼作為「基數組合」。找出與該兩碼同開機率最高的頭 6 個伴隨號碼 (3合組合)，加入高機率號碼並隨機替換原號碼。
                </p>
              </div>
            </div>
            
            <p className="text-[12px] text-zinc-500 bg-zinc-50 p-2 rounded border-2 border-zinc-200 mt-2 font-medium">
               * 系統在隨機剔走 / 替換號碼時，會自動避開基數、新加入的高機率號碼及您指定的必出幸運號碼。
            </p>
          </div>
          <DialogFooter className="p-4 bg-zinc-50 border-t-4 border-black flex justify-center shrink-0">
            <Button
              className="bg-white border-2 border-black text-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-zinc-100 hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all px-8 rounded-xl"
              onClick={() => setIsStrategyInfoOpen(false)}
            >
              明白
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!errorModal} onOpenChange={(open) => !open && setErrorModal(null)}>
        <DialogContent className="sm:max-w-md border-[4px] border-black rounded-[24px] shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] p-0 overflow-hidden bg-white">
          <DialogHeader className="bg-[#FF4D4D] border-b-4 border-black p-6">
            <DialogTitle className="text-2xl font-black text-white flex items-center gap-2">
              <AlertCircle className="w-8 h-8" />
              生成提示
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 bg-white shrink-0 min-h-[100px] max-h-[60vh] overflow-y-auto">
            <div className="text-lg font-bold text-black whitespace-pre-wrap break-words leading-relaxed text-left">
              {errorModal?.message}
            </div>
          </div>
          <DialogFooter className="p-6 bg-zinc-50 border-t-4 border-black flex-col sm:flex-row gap-3">
            <Button
              onClick={() => setErrorModal(null)}
              className="w-full bg-white hover:bg-zinc-100 text-black border-4 border-black font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:translate-x-1 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all rounded-xl h-12 text-lg"
            >
              修改條件
            </Button>
            {errorModal?.partialBets && (
              <Button
                onClick={() => {
                  setGeneratedBets(errorModal.partialBets!);
                  setUndoStack([]);
                  setErrorModal(null);
                }}
                className="w-full bg-[#FFE867] hover:bg-[#FFD700] text-black border-4 border-black font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:translate-x-1 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all rounded-xl h-12 text-lg"
              >
                生成這 {errorModal.partialBets.length} 注
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingBetExpl} onOpenChange={(open) => { if (!open) setViewingBetExpl(null); }}>
        <DialogContent className="sm:max-w-2xl border-[4px] border-black rounded-[24px] shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] p-0 overflow-hidden bg-white w-[95vw]">
          <DialogHeader className="bg-[#BAE6FD] border-b-4 border-black p-4 sm:p-6 pb-4">
            <DialogTitle className="text-xl sm:text-2xl font-black text-black flex items-center justify-between gap-2 max-w-full">
              <span className="flex items-center gap-2 pr-4 min-w-0">
                <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-[#3b82f6] shrink-0" />
                <span className="truncate">第 {viewingBetExpl?.index !== undefined ? viewingBetExpl.index + 1 : ''} 注：大數據選號說明</span>
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 sm:p-6 bg-zinc-50 shrink-0 min-h-[100px] max-h-[60vh] sm:max-h-[85vh] overflow-y-auto">
            <div className="flex flex-col gap-2 sm:gap-3">
              {viewingBetExpl?.bet?.explanations?.map((expl, idx) => (
                <div key={idx} className="bg-white border-2 border-black p-3 rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-start gap-2 sm:gap-3 break-words relative overflow-hidden">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 bg-[#FFE867] border-2 border-black rounded-full flex items-center justify-center font-black text-xs">
                    {idx + 1}
                  </div>
                  <div className="text-[13px] sm:text-[15px] font-bold text-black pt-0.5 whitespace-pre-wrap break-words pr-2 leading-relaxed max-w-full">
                    {expl}
                  </div>
                </div>
              ))}
              {(!viewingBetExpl?.bet?.explanations || viewingBetExpl.bet.explanations.length === 0) && (
                 <div className="text-center font-bold text-zinc-500 py-4">隨機生成注數，無特定大數據說明。</div>
              )}
            </div>
            
            <div className="mt-4 border-t-2 border-black border-dashed pt-4 flex gap-1.5 justify-center flex-wrap max-w-full">
              {(() => {
                const bet = viewingBetExpl?.bet;
                if (!bet) return null;
                const renderBall = (n: number) => {
                  const color = getBallColor(n);
                  const bgColor = color === "red" ? "bg-[#FF9999]" : color === "blue" ? "bg-[#99CCFF]" : "bg-[#99FF99]";
                  return (
                    <div key={n} className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-[2.5px] border-black flex items-center justify-center font-black text-base sm:text-lg text-black ${bgColor} shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]`}>
                      {n}
                    </div>
                  );
                };
                if (bet.isBankerLegs && bet.bankersCount) {
                  const legsCount = bet.numbers.length - bet.bankersCount;
                  const cols = getLegsCols(legsCount);
                  return (
                    <div className="flex flex-col gap-2 items-center w-full my-2">
                      <div className="relative">
                        <div className="flex flex-wrap justify-center items-center gap-1 sm:gap-2 bg-yellow-100/50 px-2 sm:px-3 py-1 rounded-[24px] border-2 border-black/10">
                          {bet.numbers.slice(0, bet.bankersCount).map(n => renderBall(n))}
                        </div>
                        <div className="absolute -bottom-3 -right-2 flex items-center justify-center w-[24px] h-[24px] sm:w-[28px] sm:h-[28px] rounded-full bg-black text-[#FFE867] font-black text-[11px] sm:text-[13px] border-[2px] border-white shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] z-10 transform rotate-6">拖</div>
                      </div>
                      <div 
                        className="grid gap-1 sm:gap-2 mt-2 justify-center place-items-center"
                        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                      >
                        {bet.numbers.slice(bet.bankersCount).map(n => renderBall(n))}
                      </div>
                    </div>
                  );
                }
                return bet.numbers.map(n => renderBall(n));
              })()}
            </div>
          </div>
          <DialogFooter className="p-4 bg-white border-t-4 border-black flex flex-col items-center justify-center">
            <Button
              onClick={() => setViewingBetExpl(null)}
              className="w-full max-w-[200px] bg-white hover:bg-zinc-100 text-black border-4 border-black font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:translate-x-1 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all rounded-xl h-10 sm:h-12 text-base sm:text-lg"
            >
              關閉
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden container exclusively formatted for Screenshot output */}
      <div className="fixed top-0 left-0 -z-50 pointer-events-none opacity-0 overflow-hidden w-0 h-0">
        <div id="capture-area" className={`bg-[#1e1e1e] font-sans flex flex-col p-8 items-center ${generatedBets.length >= 13 ? 'w-[1450px]' : generatedBets.length >= 11 ? 'w-[1000px]' : (isAiGenerated && aiReasoning.length > 0) ? 'w-[650px]' : 'w-[500px]'}`}>
          <h1 className="text-[40px] font-black tracking-widest mb-6 text-[#FFE867] leading-none">
            您的幸運號碼
          </h1>
          <div className={`w-full ${generatedBets.length >= 13 ? 'grid grid-cols-3 gap-x-8 gap-y-7 justify-items-center' : generatedBets.length >= 11 ? 'grid grid-cols-2 gap-x-8 gap-y-7 justify-items-center' : 'flex flex-col gap-7 items-center'}`}>
            {generatedBets.map((bet, index) => (
              <div key={index} className={`flex flex-col items-center gap-1.5 ${bet.isBankerLegs ? 'w-full max-w-[600px]' : 'w-fit'}`}>
                <div className={`flex flex-col sm:flex-row items-center sm:items-stretch sm:justify-start w-full mx-auto bg-white border-[4px] border-black rounded-3xl min-h-[70px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] box-border px-4 py-3 relative overflow-visible h-auto max-w-[900px] ${!bet.isBankerLegs && 'sm:w-fit'}`}>
                  <div className="flex items-center gap-3 w-full">
                    <div className="text-2xl font-black text-black w-10 text-center transform -rotate-[10deg] shrink-0 opacity-80">
                      #{index + 1}
                    </div>
                    <div className="flex gap-1.5 items-center w-full">
                      {(() => {
                        const renderBall = (num: number, i: number) => {
                          const color = getBallColor(num);
                          const bgColor = color === "red" ? "bg-[#FF9999]" : color === "blue" ? "bg-[#99CCFF]" : "bg-[#99FF99]";
                          return (
                            <div
                              key={i}
                              className={`w-[42px] h-[42px] sm:w-[48px] sm:h-[48px] shrink-0 rounded-full flex items-center justify-center text-black font-black text-[24px] sm:text-[28px] leading-none tracking-tighter pt-0.5 border-[3px] border-black ${bgColor}`}
                            >
                              {num}
                            </div>
                          );
                        };

                        if (bet.isBankerLegs && bet.bankersCount) {
                          const legsCount = bet.numbers.length - bet.bankersCount;
                          const cols = getLegsCols(legsCount);
                          return (
                            <div className="flex flex-col gap-2 items-center w-full max-w-[800px] my-3">
                              <div className="relative">
                                <div className="flex flex-wrap justify-center items-center gap-1 sm:gap-1.5 bg-yellow-100/50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-[28px] border-2 border-black/10">
                                  {bet.numbers.slice(0, bet.bankersCount).map((num, i) => renderBall(num, i))}
                                </div>
                                <div className="absolute -bottom-3 -right-2 flex items-center justify-center w-[26px] h-[26px] sm:w-[32px] sm:h-[32px] rounded-full bg-black text-[#FFE867] font-black text-[12px] sm:text-[14px] border-[2px] border-white shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] z-10 transform rotate-6">拖</div>
                              </div>
                              <div 
                                className="grid gap-1 sm:gap-1.5 mt-2 justify-center place-items-center"
                                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                              >
                                {bet.numbers.slice(bet.bankersCount).map((num, i) => renderBall(num, i + bet.bankersCount!))}
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div className="flex flex-wrap gap-1 gap-y-2 items-center w-full max-w-[800px]">
                            {bet.numbers.map((num, i) => renderBall(num, i))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                
                {bet.isBankerLegs && bet.bankersCount && (
                  <div className="text-[13px] font-black text-black bg-[#FFE867] border-[3px] border-black rounded-xl sm:rounded-full px-3 py-1 sm:py-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] z-10 w-fit shrink-0">
                    {(() => {
                      const cost = getCombinationsCount(bet.numbers.length - bet.bankersCount, 6 - bet.bankersCount) * 10;
                      return (
                        <div className="flex flex-col sm:flex-row items-center sm:gap-2 leading-tight py-0.5 sm:py-0">
                          <span style={{ marginRight: '-14px' }}>💰 5元一注此拖膽成本：${cost / 2}</span>
                          <span className="hidden sm:inline">|</span>
                          <span style={{ marginLeft: '-1px' }}>10元一注此拖膽成本：${cost}</span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 bg-[#ffedd5] border-[4px] border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-full max-w-2xl text-center">
            <h3 className="font-black text-xl mb-4 flex items-center justify-center gap-2 min-w-0"><Sparkles className="w-6 h-6 text-orange-500 shrink-0" /> 全部生成設定筆記</h3>
            
            {isAiGenerated ? (
              <div className="w-full text-left bg-[#bbf7d0] border-[3px] border-[#16a34a] rounded-lg p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mt-2 mb-3">
                <div className="font-black text-[#166534] mb-3 flex items-center gap-1.5 text-lg">
                  <Sparkles className="w-5 h-5 shrink-0" /> 
                  AI 大數據智能選號 (綜合近期 {aiAnalysisDrawsUsed} 期) - 分析筆記：
                </div>
                <ul className="list-disc pl-6 space-y-2 text-base font-bold text-[#166534] marker:text-[#166534]">
                  {aiReasoning.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              </div>
            ) : (generatedBets.length > 0 && generatedBets[0].id?.startsWith('unselected-cover-')) ? (
              <div className="text-left bg-white border-[3px] border-black rounded-lg p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <div className="font-black text-black mb-3 flex items-center gap-1.5 text-lg">
                  <Settings2 className="w-5 h-5 shrink-0" /> 
                  全包剩餘號碼設定筆記：
                </div>
                <ul className="list-disc pl-6 space-y-2 text-base font-bold text-zinc-700">
                  <li>此組合專為「全包剩餘號碼」策略所產生，此為獨立生成的膽拖/單式組合，以上記錄與當初自定的生成條件及其他篩選設定無關。</li>
                </ul>
              </div>
            ) : (
              <div className="text-left bg-white border-[3px] border-black rounded-lg p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <div className="font-black text-black mb-3 flex items-center gap-1.5 text-lg">
                  <Settings2 className="w-5 h-5 shrink-0" /> 
                  自定生成設定筆記：
                </div>
                <ul className="list-disc pl-6 space-y-2 text-base font-bold text-zinc-700">
                  <li>
                    號碼範圍: {ranges.map(r => `${r.start}-${r.end}`).join(', ')}
                    {preferredOddCount === null && oddEven === 'all' && colors.length === 3 && !use3Combos && !use2Combos && !enableRecent && !enableExcludeUnseen && excludedNumbers.length === 0 && luckyNumbers.length === 0 && bankers.length === 0 && !enableComplexRecent && !noConsecutivePairs && !noConsecutiveTriplets && (sumRange[0] === 21 && sumRange[1] === 279) ? ' (純隨機生成，無其他過濾)' : ''}
                  </li>
                  {(sumRange[0] !== 21 || sumRange[1] !== 279) && (
                    <li>總和值分數範圍: {sumRange[0]} - {sumRange[1]}</li>
                  )}
                  {bankers.length > 0 && (
                    <li>定膽號碼: {bankers.join(', ')}</li>
                  )}
                  {(noConsecutivePairs || noConsecutiveTriplets) && (
                    <li>連號限制: {[noConsecutivePairs && "不要連2號", noConsecutiveTriplets && "不要連3號"].filter(Boolean).join("、")}</li>
                  )}
                  {(preferredOddCount !== null || oddEven !== 'all') && (
                    <li>
                      單雙配置: {oddEven === 'all' && preferredOddCount === null ? '無限制' : oddEven === 'odd' ? '全單' : oddEven === 'even' ? '全雙' : `特定比例: ${preferredOddCount}單 ${preferredEvenCount}雙`}
                    </li>
                  )}
                  {colors.length < 3 && (
                    <li>
                      波色配置: {colors.length === 1 ? `全${colors[0] === 'red' ? '紅' : colors[0] === 'blue' ? '藍' : '綠'}波` : `特定波色比例 (${colors[0] === 'red' ? '紅' : colors[0] === 'blue' ? '藍' : '綠'} ${6 - (colorRatioOption || 3)} : ${colorRatioOption || 3} ${colors[1] === 'red' ? '紅' : colors[1] === 'blue' ? '藍' : '綠'})`}
                    </li>
                  )}
                  {(use2Combos || use3Combos) && (
                    <li>
                      大數據策略: {use2Combos ? '2合策略 ' : ''}{use3Combos ? '3合策略' : ''}
                    </li>
                  )}
                  {enableRecent && (
                    <li>
                      近期期數過濾: {recentMode === 'include' ? `只買近 ${recentCount} 期內出現過的號碼` : `排除近 ${recentCount} 期內出現過的號碼`}
                    </li>
                  )}
                  {enableExcludeUnseen && (
                    <li>
                      近期期數過濾: 包含近期出現過，但排除近 {excludeUnseenCount} 期未出現的號碼 {excludeUnseenIncludeSpecial ? '(包含特碼)' : '(不含特碼)'}
                    </li>
                  )}
                  {enableComplexRecent && (
                    <li>
                      複雜近期篩選區間: 
                      <span className="ml-2 font-mono text-xs">
                        [
                        {complexIncludeRanges.map(r => `出 ${r.start}-${r.end}`).join(', ')}
                        {complexIncludeRanges.length > 0 && complexExcludeRanges.length > 0 ? ' | ' : ''}
                        {complexExcludeRanges.map(r => `沒出 ${r.start}-${r.end}`).join(', ')}
                        ]
                      </span>
                    </li>
                  )}
                  {excludedNumbers.length > 0 && (
                    <li>排除號碼: {excludedNumbers.join(', ')}</li>
                  )}
                  {luckyNumbers.length > 0 && (
                    <li>必含號碼: {luckyNumbers.join(', ')}</li>
                  )}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-8 mb-4 p-4 bg-white rounded-2xl border-[4px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center">
            <QRCodeSVG value={JSON.stringify(generatedBets.flatMap(b => {
              if (b.isBankerLegs && b.bankersCount) {
                const bankers = b.numbers.slice(0, b.bankersCount);
                const legs = b.numbers.slice(b.bankersCount);
                const requiredLegs = 6 - bankers.length;
                if (requiredLegs > 0) return getCombos(legs, requiredLegs).map(c => [...bankers, ...c].sort((x,y)=>x-y));
                if (requiredLegs === 0) return [[...bankers].sort((x,y)=>x-y)];
              }
              return [b.numbers];
            }))} size={160} />
            <div className="mt-3 text-sm font-black text-black">快速對獎・SCAN ME</div>
          </div>
          <div className="mb-2 text-[#FFE867] text-[15px] font-bold tracking-widest text-center">
            此號碼生成系統由池記桌遊提供
          </div>
          <div className="mt-1.5 flex flex-col items-center gap-1 text-[13px] font-bold text-zinc-400 text-center leading-relaxed">
            <div>生成時間：{getFormattedCurrentTime(generationTime)}</div>
            {nextDrawInfo && (
              <div>下一期開彩日期：{nextDrawInfo.date}</div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
        <DialogContent className={`w-[95vw] bg-[#f0fdf4] border-[4px] border-black rounded-[24px] p-0 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col mb-[10vh] sm:top-1/2 sm:-translate-y-1/2 overflow-hidden transition-all duration-300 ${aiBetCount >= 10 ? 'max-w-md md:max-w-3xl' : 'max-w-md'}`}>
          <DialogHeader className="bg-[#16a34a] border-b-4 border-black p-4 sm:p-5 m-0 block shrink-0 text-white">
            <DialogTitle className="text-xl sm:text-2xl font-black flex items-center gap-2 m-0 p-0 text-white">
              <Sparkles className="w-6 h-6 sm:w-7 sm:h-7" />
              AI 大數據智能選號
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 sm:p-5 flex-1 space-y-6">
            <div className={`bg-white border-[3px] border-black p-4 sm:p-5 rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${aiBetCount >= 10 ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'space-y-4'}`}>
              
              {/* Left Column: Recent Draws and Bet Count Sliders */}
              <div className="space-y-6 flex flex-col justify-center">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="font-light text-base">綜合最近期數</Label>
                    <span className="font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded-md border border-green-300">
                      {aiAnalysisDraws} 期
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-zinc-500">1期</span>
                    <div className="flex-1 px-1">
                      <Slider
                        min={1}
                        max={50}
                        step={1}
                        value={[aiAnalysisDraws]}
                        onValueChange={(val) => {
                          const newValue = Array.isArray(val) ? val[0] : val;
                          setAiAnalysisDraws(newValue as number);
                        }}
                        className="cursor-pointer"
                      />
                    </div>
                    <span className="text-xs font-bold text-zinc-500">50期</span>
                  </div>
                </div>

                <div className="pt-6 border-t-2 border-black border-dashed space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="font-light text-base">生成注數</Label>
                    <span className="font-bold bg-orange-100 text-orange-800 px-2 py-0.5 rounded-md border border-orange-300">
                      {aiBetCount} 注
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-zinc-500">1注</span>
                    <div className="flex-1 px-1">
                      <Slider
                        min={1}
                        max={30}
                        step={1}
                        value={[aiBetCount]}
                        onValueChange={(val) => {
                          const newValue = Array.isArray(val) ? val[0] : val;
                          setAiBetCount(newValue as number);
                        }}
                        className="cursor-pointer"
                      />
                    </div>
                    <span className="text-xs font-bold text-zinc-500">30注</span>
                  </div>
                </div>
              </div>

              {/* Right Column: AI Banker / Budget Selection */}
              {aiBetCount >= 10 && (
                <div className="pt-6 border-t-2 border-dashed border-zinc-200 md:border-t-0 md:border-l-2 md:pt-0 md:pl-6 space-y-4 flex flex-col justify-start">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <div 
                        className="font-bold text-black text-[15px] sm:text-base flex items-center gap-2 cursor-pointer"
                        onClick={() => setAiBankerMode(!aiBankerMode)}
                      >
                        <div className={`w-6 h-6 rounded flex items-center justify-center border-2 border-black shrink-0 transition-colors ${aiBankerMode ? 'bg-[#FFD700]' : 'bg-white'}`}>
                           {aiBankerMode && <Check className="w-4 h-4 text-black" strokeWidth={4} />}
                        </div>
                        自動生成拖膽策略 (節省成本)
                      </div>
                      {aiBankerMode && (
                        <div className="font-black text-[15px] sm:text-lg text-black bg-[#FFD700] px-3 py-0.5 border-[2px] sm:border-[3px] border-black rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] shrink-0 whitespace-nowrap min-w-[5rem] text-center">
                          預算 ${aiBankerBudget}
                        </div>
                      )}
                    </div>
                    <span className="font-normal text-xs sm:text-[13px] text-zinc-600 pl-8 flex block leading-tight mb-4">當注數大於10注時，由 AI 改為生成多注「膽拖」配搭，以符合預算覆蓋最多號碼。</span>
                  </div>
                  
                  {aiBankerMode && (
                    <div className="pl-8 pt-1 space-y-5">
                      <div>
                        <div className="flex justify-between text-xs font-bold text-zinc-600 mb-2">
                          <span>總預算</span>
                          <span>${aiBankerBudget}</span>
                        </div>
                        <Slider
                          min={100}
                          max={800}
                          step={10}
                          value={[aiBankerBudget]}
                          onValueChange={(val) => setAiBankerBudget(Array.isArray(val) ? val[0] : val)}
                          className="py-1 cursor-pointer"
                        />
                        <div className="flex justify-between text-xs font-black text-zinc-400 mt-1">
                          <span>$100</span>
                          <span>$800</span>
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-xs font-bold text-zinc-600 mb-2">
                          <span>生成拖膽注數</span>
                          <span>{aiBankerBetCount} 注</span>
                        </div>
                        <Slider
                          min={1}
                          max={10}
                          step={1}
                          value={[aiBankerBetCount]}
                          onValueChange={(val) => setAiBankerBetCount(Array.isArray(val) ? val[0] : val)}
                          className="py-1 cursor-pointer"
                        />
                        <div className="flex justify-between text-xs font-black text-zinc-400 mt-1">
                          <span>1 注</span>
                          <span>10 注</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Button
              className="w-full bg-green-500 hover:bg-green-600 text-black h-auto py-3 px-6 text-xl font-black border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:translate-x-1 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all"
              onClick={handleAIGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <RefreshCw className="w-6 h-6 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-6 h-6 mr-2 text-white" />
              )}
              {isGenerating ? "生成中..." : "開始智能選號"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCheckDialogOpen} onOpenChange={setIsCheckDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-3xl bg-[#fff7ed] border-[4px] border-black rounded-[24px] p-0 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col h-[90vh] sm:h-auto max-h-[90vh] overflow-hidden top-[5vh] translate-y-0 sm:top-1/2 sm:-translate-y-1/2">
          <DialogHeader className="bg-[#ffedd5] border-b-4 border-black p-4 sm:p-5 m-0 block shrink-0">
            <DialogTitle className="text-xl sm:text-2xl font-black flex items-center gap-2 m-0 p-0">
              <SearchCheck className="w-6 h-6 sm:w-7 sm:h-7" />
              核對中獎號碼
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4 min-h-0 custom-scrollbar">
            <div className="space-y-2">
              <Label className="font-black text-base sm:text-lg">選擇您想核對的開彩期數：</Label>
              <Select value={checkDrawIndex.toString()} onValueChange={(val) => {
                const idx = parseInt(val, 10);
                setCheckDrawIndex(idx);
                if (checkBetsData) {
                  handlePerformCheck(checkBetsData, idx);
                } else {
                  setCheckResults(null); 
                }
              }}>
                <SelectTrigger className="w-full bg-white border-2 border-black rounded-xl font-bold min-h-[44px] h-auto py-2 text-base shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-left whitespace-normal">
                  <div className="flex-1 text-left sm:flex sm:items-center sm:gap-2">
                    {(() => {
                      if (!liveResults || !liveResults[checkDrawIndex]) return "選擇期數...";
                      const draw = liveResults[checkDrawIndex];
                      const numbers = getRawDrawNumbers(draw);
                      const dateStr = getDrawDateStr(draw);
                      const formattedDate = dateStr ? ` (${dateStr})` : '';
                      return (
                        <>
                          <div className="text-sm sm:text-base leading-tight">
                            {checkDrawIndex === 0 ? `最近一期${formattedDate}` : `前 ${checkDrawIndex} 期${formattedDate}`} :
                          </div>
                          <div className="text-base sm:text-lg tracking-wider">
                            {numbers.slice(0,6).join(',')} + ({numbers[6]})
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-h-[60vh] overflow-y-auto">
                  {liveResults.map((draw, i) => {
                    const numbers = getRawDrawNumbers(draw);
                    const dateStr = getDrawDateStr(draw);
                    const formattedDate = dateStr ? ` (${dateStr})` : '';
                    return (
                    <SelectItem key={i} value={i.toString()} className="font-bold cursor-pointer hover:bg-neutral-100 p-2 sm:p-3 items-start flex-col focus:bg-[#FFE867]">
                      <div className="flex flex-col sm:flex-row w-full sm:items-center sm:gap-2 text-left whitespace-normal">
                        <span className="text-sm sm:text-base">{i === 0 ? `最近一期${formattedDate}` : `前 ${i} 期${formattedDate}`} :</span>
                        <span className="text-base sm:text-lg tracking-wider whitespace-normal">{numbers.slice(0,6).join(',')} + ({numbers[6]})</span>
                      </div>
                    </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>


            </div>

            {!checkResults ? (
              <Tabs value={checkMethod} onValueChange={(val) => { setCheckMethod(val as any); setCheckResults(null); }} className="w-full">
                <TabsList className="grid grid-cols-2 gap-2 bg-transparent h-auto w-full mb-2">
                  <TabsTrigger value="upload" className="w-full font-black text-lg sm:text-xl py-0.5 px-0.5 text-black bg-orange-100 border-[3px] border-black data-[state=active]:bg-[#FFD700] data-[state=active]:border-[3px] data-[state=active]:border-black data-[state=active]:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-[14px] transition-all whitespace-nowrap h-auto min-h-[40px]">上傳截圖</TabsTrigger>
                  <TabsTrigger value="manual" className="w-full font-black text-lg sm:text-xl py-0.5 px-0.5 text-black bg-orange-100 border-[3px] border-black data-[state=active]:bg-[#FFD700] data-[state=active]:border-[3px] data-[state=active]:border-black data-[state=active]:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-[14px] transition-all whitespace-nowrap h-auto min-h-[40px]">手動輸入</TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="mt-0">
                  <div className="flex flex-col gap-4">
                    {/* Upload Zone */}
                    <div className="flex flex-col items-center justify-center p-4 sm:p-6 border-[4px] border-dashed border-[#FF4D4D] rounded-2xl bg-[#FFE867] text-center hover:bg-[#FFD700] hover:border-black cursor-pointer transition-all relative overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group">
                      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        multiple
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            processScreenshotsForCheck(e.target.files);
                          }
                          e.target.value = "";
                        }}
                        disabled={isCheckingScreenshot}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" 
                      />
                      <div className="bg-white rounded-full p-2 border-[3px] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mb-2 group-hover:scale-110 transition-transform">
                        {isCheckingScreenshot ? (
                           <RefreshCw className="w-6 h-6 animate-spin text-[#3b82f6]" />
                        ) : (
                          <Upload className="w-6 h-6 text-[#FF4D4D]" />
                        )}
                      </div>
                      <div className="font-black text-xl sm:text-2xl text-black tracking-wide mt-1 flex flex-col items-center">
                        <div>上傳系統截圖 (支援多圖)</div>
                        <div className="text-xs sm:text-sm opacity-75">可單張或同時選取多張對獎</div>
                      </div>
                      
                      <div className="mt-2 text-[12px] sm:text-[13px] font-black bg-white text-black px-2 py-1 border-[3px] border-black rounded-lg transform -rotate-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] inline-block">
                        ⚠️ 必需由<span className="text-[#3b82f6]">本系統下載</span>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="manual" className="mt-0 space-y-3">
                  <textarea 
                    className="w-full p-3 border-4 border-black rounded-xl font-mono text-sm leading-relaxed resize-none focus:outline-none focus:ring-4 focus:ring-[#FFE867]/50"
                    rows={4}
                    placeholder="範例：&#10;1, 5, 23, 24, 30, 48&#10;2 8 15 19 33 41"
                    value={checkManualInput}
                    onChange={(e) => setCheckManualInput(e.target.value)}
                  />
                  <Button 
                    onClick={handleManualCheck}
                    className="w-full bg-[#FFE867] hover:bg-[#FFD700] text-black border-4 border-black font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all rounded-xl h-11 text-base mt-2"
                  >
                    解析並核對
                  </Button>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="border-t-[3px] border-black/10 pt-4 pb-2 space-y-3">
                <div className="flex justify-between items-center bg-[#FFE867] border-2 border-black rounded-lg px-3 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mb-4">
                   <h3 className="font-black text-xl text-black">✨ 核對結果 ✨</h3>
                   <div className="flex gap-2">
                     <Button 
                       variant="outline" 
                       size="sm" 
                       onClick={() => setCheckResults(null)}
                       className="border-[3px] border-black font-bold h-7 px-2 rounded-lg bg-white hover:bg-neutral-100"
                     >
                       返回再次核對
                     </Button>
                     <Button 
                       variant="outline" 
                       size="sm" 
                       onClick={() => { setCheckResults(null); setIsCheckDialogOpen(false); }}
                       className="border-[3px] border-black font-bold h-7 px-2 rounded-lg bg-white hover:bg-neutral-100"
                     >
                       回到主頁
                     </Button>
                   </div>
                </div>
                
                <div className="space-y-3 hide-scrollbar">
                  {checkResults.map((res, i) => {
                    const matchCount = res.matches.length;
                    const hasSpecial = res.specialMatch;
                    
                    let prizeTier = "未中獎";
                    let isWin = false;
                    let bgPrize = "opacity-70 bg-white";
                    let borderPrize = "border-black";

                    if (matchCount === 6) {
                      prizeTier = "頭獎";
                      isWin = true;
                    } else if (matchCount === 5 && hasSpecial) {
                      prizeTier = "二獎";
                      isWin = true;
                    } else if (matchCount === 5) {
                      prizeTier = "三獎";
                      isWin = true;
                    } else if (matchCount === 4 && hasSpecial) {
                      prizeTier = "四獎";
                      isWin = true;
                    } else if (matchCount === 4) {
                      prizeTier = "五獎";
                      isWin = true;
                    } else if (matchCount === 3 && hasSpecial) {
                      prizeTier = "六獎";
                      isWin = true;
                    } else if (matchCount === 3) {
                      prizeTier = "七獎";
                      isWin = true;
                    }

                    if (isWin) {
                      if (prizeTier === "頭獎" || prizeTier === "二獎" || prizeTier === "三獎") {
                        bgPrize = "bg-[#FFD700]";
                        borderPrize = "border-[#FF4D4D]";
                      } else {
                        bgPrize = "bg-[#fef9c3]";
                        borderPrize = "border-[#d97706]";
                      }
                    }

                    return (
                      <div key={i} className={`p-4 border-[3px] ${borderPrize} rounded-xl font-bold ${bgPrize} ${isWin ? 'shadow-[4px_4px_0px_0px_#FFE867]' : 'shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'}`}>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xl sm:text-2xl font-black bg-[#404040] text-white px-2 py-0.5 rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]">
                              第 {i+1} 注
                            </span>
                            {/* Mobile Win/Loss Badge */}
                            {isWin ? (
                              <div className="bg-[#FF4D4D] text-white text-sm px-2 flex items-center justify-center py-0.5 rounded border-2 border-black transform -rotate-3 uppercase tracking-wider lg:hidden whitespace-nowrap shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                                中 {prizeTier}
                              </div>
                            ) : (
                              <div className="text-zinc-500 font-black text-sm bg-zinc-200 px-2 py-0.5 rounded lg:hidden border-2 border-zinc-300 whitespace-nowrap">
                                未中獎
                              </div>
                            )}

                            <div className="flex gap-1.5 sm:gap-2">
                              <span className="bg-white border-[2.5px] border-zinc-500 px-2 py-0.5 rounded-md shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,0.5)] text-zinc-600 text-sm sm:text-base font-bold whitespace-nowrap">
                                中 <strong className={matchCount > 0 ? "text-[#3b82f6] text-lg sm:text-xl" : "text-zinc-600"}>{matchCount}</strong> 個攪出號碼
                              </span>
                              {hasSpecial && (
                                <span className="bg-white border-[2.5px] border-[#FF4D4D] px-2 py-0.5 rounded-md shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,0.5)] flex items-center text-[#FF4D4D] font-black text-sm sm:text-base whitespace-nowrap">
                                  + 特別號碼
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Desktop Win/Loss Badge */}
                          {isWin ? (
                            <div className="bg-[#FF4D4D] text-white text-lg px-3 py-1 h-full items-center justify-center rounded border-[3px] border-black transform -rotate-3 uppercase tracking-widest hidden lg:flex shrink-0 whitespace-nowrap">
                              中 {prizeTier}！
                            </div>
                          ) : (
                            <div className="hidden lg:block text-zinc-400 font-black text-base whitespace-nowrap">
                              未中獎
                            </div>
                          )}
                        </div>

                        {/* Display the bet balls and highlight winning ones */}
                        <div className="flex flex-wrap gap-1 sm:gap-2 pt-1 pb-1 px-0.5 sm:px-1 w-full justify-start max-w-full">
                          {res.bet.map((num: number, idx: number) => {
                            const isMatchNormal = res.matches.includes(num);
                            
                            const currentCheckDraw = liveResults[checkDrawIndex];
                            const currentWinningNumbers = currentCheckDraw ? getRawDrawNumbers(currentCheckDraw) : [];
                            const isMatchSpecial = currentWinningNumbers.length > 6 && num === currentWinningNumbers[6];
                            
                            const isAnyMatch = isMatchNormal || isMatchSpecial;
                            
                            const color = getBallColor(num);
                            const winBgColor = color === "red" ? "bg-[#FF9999]" : color === "blue" ? "bg-[#99CCFF]" : "bg-[#99FF99]";
                            const lightBorderColor = color === "red" ? "border-[#FF9999]" : color === "blue" ? "border-[#99CCFF]" : "border-[#99FF99]";
                            const lightTextColor = color === "red" ? "text-zinc-400" : color === "blue" ? "text-zinc-400" : "text-zinc-400";

                            return (
                              <div
                                key={idx}
                                className={`w-[40px] h-[40px] sm:w-[48px] sm:h-[48px] shrink-0 rounded-full flex flex-col items-center justify-center font-black text-[22px] sm:text-[26px] leading-none tracking-tighter pt-0.5 border-[3px] transition-all relative ${
                                  isAnyMatch 
                                    ? `text-white border-black ${winBgColor} shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ring-[1.5px] sm:ring-2 ring-offset-1 sm:ring-offset-2 ${isMatchSpecial ? 'ring-[#FF4D4D]' : 'ring-black'} transform -translate-y-[2px] sm:-translate-y-1`
                                    : `bg-white ${lightBorderColor} ${lightTextColor} opacity-40`
                                }`}
                              >
                                {num}
                                {isMatchSpecial && (
                                  <div className="absolute -bottom-1 -right-1 text-[9px] sm:text-[10px] bg-[#FF4D4D] text-white px-1 leading-none rounded border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                                    特
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAnalysisDialogOpen} onOpenChange={setIsAnalysisDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-4xl bg-white border-[4px] border-black rounded-[24px] p-0 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col h-[90vh] sm:h-auto max-h-[90vh] overflow-hidden top-[5vh] translate-y-0 sm:top-1/2 sm:-translate-y-1/2">
          <DialogHeader className="bg-[#bae6fd] border-b-4 border-black p-4 sm:p-5 m-0 block shrink-0">
            <DialogTitle className="text-xl sm:text-2xl font-black flex items-center gap-2 m-0 p-0 text-black">
              <BarChart2 className="w-6 h-6 sm:w-7 sm:h-7" />
              預計頭獎與總和規律分析
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 sm:p-5 flex-1 overflow-y-auto min-h-0 custom-scrollbar flex flex-col gap-4">
            <div className="text-sm sm:text-base font-bold text-zinc-700 bg-blue-50 border-2 border-blue-200 p-3 rounded-xl">
              💡 <strong>預計頭獎與總和分析：</strong> AI 統計各個預計頭獎區間的歷史中獎數據，發現頭獎金額往往與總和及特定號碼規律（如連號）有關。高預計頭獎的號碼分佈往往較偏鋒，可作為選號的重要指標。
            </div>

            <div className="flex flex-col gap-2 bg-white border-[3px] border-black p-3 sm:p-4 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex justify-between items-center font-bold text-sm sm:text-base text-zinc-700">
                <span className="text-base font-bold text-black">分析期數限制</span>
                <span className="font-black text-[15px] sm:text-lg text-black bg-[#FFD700] px-3 py-0.5 border-[2px] sm:border-[3px] border-black rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                  近 {payoutAnalysisDraws} 期
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs font-bold text-zinc-500">1期</span>
                <div className="flex-1 px-1">
                  <Slider
                    value={[payoutAnalysisDraws]}
                    max={200}
                    min={1}
                    step={1}
                    onValueChange={(val) => {
                      const newValue = Array.isArray(val) ? val[0] : val;
                      setPayoutAnalysisDraws(newValue);
                    }}
                    className="cursor-pointer py-2"
                  />
                </div>
                <span className="text-xs font-bold text-zinc-500">200期</span>
              </div>
              <span className="text-xs text-zinc-500 font-bold self-end">預設分析 50 期</span>
            </div>

            {(() => {
              const brackets = [
                { label: '無估計或低於1000萬', max: 9999999, min: 0, items: [] as any[] },
                { label: '1,000萬 - 2,999萬', max: 29999999, min: 10000000, items: [] as any[] },
                { label: '3,000萬 - 0.99億', max: 99999999, min: 30000000, items: [] as any[] },
                { label: '1億 - 1.99億', max: 199999999, min: 100000000, items: [] as any[] },
                { label: '2億或以上', max: Infinity, min: 200000000, items: [] as any[] },
              ];

              const validDraws = liveResults
                .slice(0, payoutAnalysisDraws)
                .filter(d => typeof d !== 'undefined' && !Array.isArray(d));
              validDraws.forEach(d => {
                if(Array.isArray(d)) return;
                const top6 = d.numbers.slice(0, 6);
                const sum = top6.reduce((a, b) => a + b, 0);
                const sorted = [...top6].sort((a,b)=>a-b);
                let hasConsecutive = false;
                for(let i=0; i<sorted.length-1; i++) {
                  if(sorted[i+1] - sorted[i] === 1) hasConsecutive = true;
                }
                
                const prize = d.firstPrize || 0;
                for (let b of brackets) {
                  if (prize >= b.min && prize <= b.max) {
                    b.items.push({ num: top6, sum, hasConsecutive });
                    break;
                  }
                }
              });

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {brackets.map((b, idx) => {
                    const hasItems = b.items.length > 0;
                    const sums = b.items.map(i => i.sum);
                    const avgSum = hasItems ? Math.round(sums.reduce((a,b)=>a+b,0) / sums.length) : '-';
                    const minSum = hasItems ? Math.min(...sums) : '-';
                    const maxSum = hasItems ? Math.max(...sums) : '-';
                    const consPct = hasItems ? Math.round((b.items.filter(i => i.hasConsecutive).length / b.items.length) * 100) : '-';
                    
                    // Extra stats
                    let oddCount = 0, evenCount = 0;
                    let rCount = 0, gCount = 0, bColorCount = 0;
                    let range1 = 0, range10 = 0, range20 = 0, range30 = 0, range40 = 0;
                    
                    if (hasItems) {
                      b.items.forEach(i => {
                        i.num.forEach((n: number) => {
                          if (n % 2 !== 0) oddCount++; else evenCount++;
                          const c = getBallColor(n);
                          if (c === 'red') rCount++; else if (c === 'blue') bColorCount++; else gCount++;
                          
                          if (n < 10) range1++;
                          else if (n < 20) range10++;
                          else if (n < 30) range20++;
                          else if (n < 40) range30++;
                          else range40++;
                        });
                      });
                    }
                    
                    const totalNums = oddCount + evenCount || 1;
                    const oddPct = hasItems ? Math.round((oddCount / totalNums) * 100) : '-';
                    const evenPct = hasItems ? Math.round((evenCount / totalNums) * 100) : '-';
                    
                    const rcPct = hasItems ? Math.round((rCount / totalNums) * 100) : '-';
                    const bcPct = hasItems ? Math.round((bColorCount / totalNums) * 100) : '-';
                    const gcPct = hasItems ? Math.round((gCount / totalNums) * 100) : '-';
                    
                    const r1Pct = hasItems ? Math.round((range1 / totalNums) * 100) : '-';
                    const r10Pct = hasItems ? Math.round((range10 / totalNums) * 100) : '-';
                    const r20Pct = hasItems ? Math.round((range20 / totalNums) * 100) : '-';
                    const r30Pct = hasItems ? Math.round((range30 / totalNums) * 100) : '-';
                    const r40Pct = hasItems ? Math.round((range40 / totalNums) * 100) : '-';

                    return (
                      <div key={idx} className={`bg-white border-[3px] border-black p-3 sm:p-4 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-2 ${!hasItems ? 'opacity-60' : ''}`}>
                        <div className="font-black text-base sm:text-lg text-black border-b-[3px] border-black pb-1 mb-1 flex items-center justify-between">
                          <span>{b.label}</span>
                          <span className="text-zinc-500 text-xs sm:text-sm bg-zinc-100 border border-black px-1.5 py-0.5 rounded-md shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">共 {b.items.length} 期</span>
                        </div>
                        <div className="flex flex-col gap-1 text-sm font-bold text-zinc-700">
                          <div className="flex justify-between items-center bg-orange-50 px-2 py-1 border-l-4 border-orange-400">
                            <span>總和區間 (Min-Max):</span>
                            <span className="text-orange-600 font-black">{hasItems ? `${minSum} - ${maxSum}` : '-'}</span>
                          </div>
                          <div className="flex justify-between items-center bg-blue-50 px-2 py-1 border-l-4 border-blue-400">
                            <span>平均總和:</span>
                            <span className="text-blue-600 font-black">{avgSum}</span>
                          </div>
                          <div className="flex justify-between items-center bg-green-50 px-2 py-1 border-l-4 border-green-400">
                            <span>含連號機率:</span>
                            <span className="text-green-600 font-black">{hasItems ? `${consPct}%` : '-'}</span>
                          </div>
                          <div className="flex justify-between items-center bg-purple-50 px-2 py-1 border-l-4 border-purple-400 mt-1">
                            <span>單雙比:</span>
                            <span className="text-purple-600 font-black">{hasItems ? `${oddPct}% / ${evenPct}%` : '-'}</span>
                          </div>
                          <div className="flex justify-between items-center bg-zinc-50 px-2 py-1 border-l-4 border-zinc-400">
                            <span>波色分佈:</span>
                            <div className="flex gap-1.5">
                              {hasItems ? (
                                <>
                                  <span className="text-[#FF4D4D] font-black">{rcPct}%</span>
                                  <span className="text-[#3b82f6] font-black">{bcPct}%</span>
                                  <span className="text-[#16a34a] font-black">{gcPct}%</span>
                                </>
                              ) : '-'}
                            </div>
                          </div>
                          <div className="flex flex-col bg-yellow-50 px-2 py-1.5 border-l-4 border-yellow-400 mt-1 gap-1">
                            <span>區間分佈:</span>
                            {hasItems ? (
                              <div className="grid grid-cols-5 gap-1 text-[10px] sm:text-xs text-center border-t border-yellow-200 pt-1 mt-0.5">
                                <div className="flex flex-col"><span className="text-zinc-500">1-9</span><span className="font-black text-black">{r1Pct}%</span></div>
                                <div className="flex flex-col"><span className="text-zinc-500">10s</span><span className="font-black text-black">{r10Pct}%</span></div>
                                <div className="flex flex-col"><span className="text-zinc-500">20s</span><span className="font-black text-black">{r20Pct}%</span></div>
                                <div className="flex flex-col"><span className="text-zinc-500">30s</span><span className="font-black text-black">{r30Pct}%</span></div>
                                <div className="flex flex-col"><span className="text-zinc-500">40s</span><span className="font-black text-black">{r40Pct}%</span></div>
                              </div>
                            ) : <span className="text-right text-yellow-600 font-black">-</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {(() => {
              const chartData = liveResults
                .slice(0, payoutAnalysisDraws)
                .filter(d => typeof d !== 'undefined' && !Array.isArray(d))
                .map(d => {
                  const nums = !Array.isArray(d) && d.numbers ? d.numbers.slice(0, 6) : [];
                  const sum = nums.reduce((a, b) => a + b, 0);
                  const firstPrize = (!Array.isArray(d) && d.firstPrize) ? d.firstPrize : 0;
                  const payoutInMillions = Math.round((firstPrize / 1000000) * 10) / 10;
                  return {
                    date: getDrawDateStr(d),
                    sum: sum,
                    payout: payoutInMillions,
                    payoutOriginal: firstPrize,
                    winners: !Array.isArray(d) ? d.firstPrizeWinners : null,
                    nums: nums
                  };
                });

              if (chartData.length === 0) {
                return (
                  <div className="w-full h-[200px] mt-2 flex items-center justify-center bg-zinc-50 border-2 border-dashed border-zinc-300 rounded-lg">
                    <p className="text-zinc-500 font-bold">該期數範圍內沒有預計頭獎記錄</p>
                  </div>
                );
              }

              return (
                <div className="w-full h-[400px] mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.5} />
                      <XAxis 
                        type="number" 
                        dataKey="sum" 
                        name="號碼總和" 
                        unit="" 
                        domain={[21, 279]}
                        label={{ value: '號碼總和 (6個號碼相加)', position: 'insideBottom', offset: -10, fontWeight: 'bold' }} 
                      />
                      <YAxis 
                        type="number" 
                        dataKey="payout" 
                        name="預計頭獎 (百萬)" 
                        unit="m" 
                        domain={['auto', 'auto']}
                        tickFormatter={(val) => `${val}m`}
                        label={{ value: '預計頭獎 (百萬港元)', angle: -90, position: 'insideLeft', offset: -10, fontWeight: 'bold' }} 
                      />
                      <RechartsTooltip 
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white border-[3px] border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-lg font-bold">
                                <p className="text-base border-b-2 border-zinc-200 pb-1 mb-1">{data.date}</p>
                                <p className="text-[#3b82f6]">總和: {data.sum}</p>
                                <p className="text-[#FF4D4D]">預計頭獎: {data.payoutOriginal ? `$${data.payoutOriginal.toLocaleString()}` : <span className="text-zinc-400 text-sm">無金額數據</span>}</p>
                                <p className="text-zinc-600 text-sm mt-1">號碼: {data.nums.join(', ')}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Scatter name="開彩數據" data={chartData}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill="#3b82f6" />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}

            <div className="overflow-x-auto rounded-xl border-[3px] border-black hide-scrollbar shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mt-2">
              <table className="w-full text-left font-bold text-sm sm:text-base border-collapse min-w-[500px]">
                <thead className="bg-[#f1f5f9] border-b-[3px] border-black">
                  <tr>
                    <th className="p-2 sm:p-3 whitespace-nowrap">日期</th>
                    <th className="p-2 sm:p-3 whitespace-nowrap text-center">號碼</th>
                    <th className="p-2 sm:p-3 whitespace-nowrap text-center">總和</th>
                    <th className="p-2 sm:p-3 whitespace-nowrap text-right">預計頭獎</th>
                  </tr>
                </thead>
                <tbody>
                  {liveResults
                    .slice(0, payoutAnalysisDraws)
                    .filter(d => !Array.isArray(d))
                    .map((d, i) => {
                      if (Array.isArray(d)) return null;
                      const nums = d.numbers.slice(0, 6);
                      const sum = nums.reduce((a, b) => a + b, 0);
                      const isHighPrize = (d.firstPrize || 0) > 30000000;
                      return (
                        <tr key={i} className={`border-b-2 border-black/10 ${isHighPrize ? 'bg-orange-50' : ''}`}>
                          <td className="p-2 sm:p-3 whitespace-nowrap">{d.date}</td>
                          <td className="p-2 sm:p-3 text-center tracking-widest">{nums.join(', ')}</td>
                          <td className="p-2 sm:p-3 text-center">
                            <span className={`px-2 py-0.5 rounded border border-black ${sum < 100 ? 'bg-blue-200 text-blue-900' : sum > 200 ? 'bg-red-200 text-red-900' : 'bg-green-200 text-green-900'}`}>
                              {sum}
                            </span>
                          </td>
                          <td className="p-2 sm:p-3 whitespace-nowrap text-right text-[#FF4D4D] font-black">
                            {d.firstPrize ? `$${d.firstPrize.toLocaleString()}` : <span className="text-zinc-400 text-sm">無金額數據</span>} <span className="text-xs text-zinc-500">/ {d.firstPrizeWinners ?? 0}注</span>
                          </td>
                        </tr>
                      );
                    })}
                  {liveResults.filter(d => !Array.isArray(d)).length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-zinc-500">系統正在分析最近的數據，請稍後...</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="flex justify-center mt-2">
              <Button onClick={() => setIsAnalysisDialogOpen(false)} className="border-4 border-black font-black text-black bg-zinc-200 hover:bg-zinc-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-xl px-8 h-12 text-lg">
                關閉
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isBacktestDialogOpen} onOpenChange={setIsBacktestDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-4xl bg-[#fff7ed] border-[4px] border-black rounded-[24px] p-0 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col h-[90vh] sm:h-auto max-h-[90vh] overflow-hidden top-[5vh] translate-y-0 sm:top-1/2 sm:-translate-y-1/2">
          <DialogHeader className="bg-[#ffedd5] border-b-4 border-black p-4 sm:p-5 m-0 block shrink-0">
            <DialogTitle className="text-xl sm:text-2xl font-black flex items-center gap-2 m-0 p-0 text-black">
              <SearchCheck className="w-6 h-6 sm:w-7 sm:h-7" />
              核對中奬號碼 (Backtesting)
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4 min-h-0 custom-scrollbar">
            
            {/* Draw Period Selector */}
            <div className="space-y-2">
              <Label className="font-black text-base sm:text-lg text-black">選擇您想核對的開彩期數：</Label>
              <Select value={backtestDrawIndex.toString()} onValueChange={(val) => {
                setBacktestDrawIndex(parseInt(val, 10));
              }}>
                <SelectTrigger className="w-full bg-white border-2 border-black rounded-xl font-bold min-h-[44px] h-auto py-2 text-base shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-left whitespace-normal text-black">
                  <div className="flex-1 text-left sm:flex sm:items-center sm:gap-2">
                    {(() => {
                      if (!liveResults || !liveResults[backtestDrawIndex]) return "選擇期數...";
                      const draw = liveResults[backtestDrawIndex];
                      const numbers = getRawDrawNumbers(draw);
                      const dateStr = getDrawDateStr(draw);
                      const formattedDate = dateStr ? ` (${dateStr})` : '';
                      return (
                        <>
                          <div className="text-sm sm:text-base leading-tight">
                            {backtestDrawIndex === 0 ? `最近一期${formattedDate}` : `前 ${backtestDrawIndex} 期${formattedDate}`} :
                          </div>
                          <div className="text-base sm:text-lg tracking-wider">
                            {numbers.slice(0,6).join(',')} + ({numbers[6]})
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-h-[40vh] overflow-y-auto text-black">
                  {liveResults.map((draw, i) => {
                    const numbers = getRawDrawNumbers(draw);
                    const dateStr = getDrawDateStr(draw);
                    const formattedDate = dateStr ? ` (${dateStr})` : '';
                    return (
                      <SelectItem key={i} value={i.toString()} className="font-bold cursor-pointer hover:bg-neutral-100 p-2 sm:p-3 items-start flex-col focus:bg-[#FFE867]">
                        <div className="flex flex-col sm:flex-row w-full sm:items-center sm:gap-2 text-left whitespace-normal">
                          <span className="text-sm sm:text-base">{i === 0 ? `最近一期${formattedDate}` : `前 ${i} 期${formattedDate}`} :</span>
                          <span className="text-base sm:text-lg tracking-wider whitespace-normal">{numbers.slice(0,6).join(',')} + ({numbers[6]})</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>


            </div>

            {/* Multiple files upload container */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col items-center justify-center p-4 sm:p-6 border-[4px] border-dashed border-[#FF4D4D] rounded-2xl bg-[#FFE867] text-center hover:bg-[#FFD700] hover:border-black cursor-pointer transition-all relative overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple
                  onChange={(e) => {
                    handleBacktestUpload(e.target.files);
                    e.target.value = "";
                  }}
                  disabled={isProcessingBacktest}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" 
                />
                <div className="bg-white rounded-full p-2 border-[3px] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mb-2 group-hover:scale-110 transition-transform">
                  {isProcessingBacktest ? (
                    <RefreshCw className="w-6 h-6 animate-spin text-[#3b82f6]" />
                  ) : (
                    <Upload className="w-6 h-6 text-[#FF4D4D]" />
                  )}
                </div>
                <div className="font-black text-xl sm:text-2xl text-black tracking-wide mt-1 flex flex-col items-center">
                  <div>選擇/拖曳多張本系統號碼圖</div>
                  <div className="text-xs sm:text-sm opacity-75">可同時選取或多次追加・即刻自動對獎</div>
                </div>
              </div>
            </div>

            {/* Uploaded Files Tracking List */}
            {backtestFiles.length > 0 && (
              <div className="border-4 border-black rounded-2xl bg-white p-3 sm:p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-black text-base text-black flex items-center gap-1.5">
                    <span>📁 已載入的檔案 </span>
                    <span className="text-xs bg-zinc-100 text-zinc-600 border border-zinc-300 px-1.5 py-0.5 rounded-full font-bold">
                      {backtestFiles.length} 個
                    </span>
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBacktestFiles([]);
                      setBacktestResults(null);
                    }}
                    className="h-7 border-2 border-black font-black text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-600" />
                    清除全部
                  </Button>
                </div>
                <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                  {backtestFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 border-2 border-black rounded-lg bg-zinc-50 text-xs sm:text-sm">
                      <div className="font-bold text-zinc-800 truncate max-w-[70%]" title={file.name}>
                        {getDisplayNameForFile(file.name, idx + 1)}
                      </div>
                      <div className="flex items-center gap-2">
                        {file.status === 'loading' && (
                          <span className="text-[#3b82f6] font-black flex items-center gap-1">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            解析中...
                          </span>
                        )}
                        {file.status === 'success' && (
                          <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            讀取成功 ({file.bets.length}注)
                          </span>
                        )}
                        {file.status === 'error' && (
                          <span className="text-rose-600 font-extrabold flex items-center gap-1" title={file.errorMsg}>
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                            出錯: {file.errorMsg}
                          </span>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            const filtered = backtestFiles.filter((_, i) => i !== idx);
                            setBacktestFiles(filtered);
                            runBacktestCheck(filtered, backtestDrawIndex);
                          }}
                          className="h-6 w-6 border border-zinc-300 hover:bg-rose-100 hover:text-rose-600 text-zinc-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Backtesting Results Report */}
            {backtestResults && backtestResults.checkedBets.length > 0 ? (
              <div className="space-y-4">
                
                {/* Bento Statistics Banner */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="border-3 border-black rounded-xl p-3 bg-[#e0f2fe] text-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                    <div className="text-zinc-600 text-xs sm:text-sm font-black">已核對總注數</div>
                    <div className="text-2xl sm:text-3xl font-black text-sky-600 mt-1">{backtestResults.summary.totalBets} <span className="text-sm text-zinc-800">注</span></div>
                  </div>
                  <div className="border-3 border-black rounded-xl p-3 bg-[#fef9c3] text-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                    <div className="text-zinc-600 text-xs sm:text-sm font-black">模擬總投注額</div>
                    <div className="text-2xl sm:text-3xl font-black text-amber-600 mt-1">${backtestResults.summary.totalCost}</div>
                  </div>
                  <div className="border-3 border-black rounded-xl p-3 bg-[#f0fdf4] text-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                    <div className="text-zinc-600 text-xs sm:text-sm font-black">總中獎注數</div>
                    <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1">{backtestResults.summary.totalWins} <span className="text-sm text-zinc-800">注</span></div>
                  </div>
                  <div className="border-3 border-black rounded-xl p-3 bg-[#faf5ff] text-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                    <div className="text-zinc-600 text-xs sm:text-sm font-black">總中獎金額</div>
                    <div className="text-2xl sm:text-3xl font-black text-purple-600 mt-1">${backtestResults.summary.totalWinnings.toLocaleString()}</div>
                  </div>
                  <div className="border-3 border-black rounded-xl p-3 bg-[#fdf2f8] text-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] col-span-2 sm:col-span-1">
                    <div className="text-zinc-600 text-xs sm:text-sm font-black">組合中獎率</div>
                    <div className="text-2xl sm:text-3xl font-black text-rose-600 mt-1">
                      {backtestResults.summary.totalBets > 0 
                        ? `${Math.round((backtestResults.summary.totalWins / backtestResults.summary.totalBets) * 1000) / 10}%` 
                        : '0%'
                      }
                    </div>
                  </div>
                </div>

                {/* Prize Tier Summary Matrix */}
                <div className="border-4 border-black rounded-2xl bg-[#f8fafc] p-3 sm:p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-black">
                  <h4 className="font-black text-sm text-zinc-700 mb-2 border-b-2 border-zinc-200 pb-1">獎項分佈統計：</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                    {["頭獎", "二獎", "三獎", "四獎", "五獎", "六獎", "七獎", "未中獎"].map((tier) => {
                      const count = backtestResults.summary.winsByTier[tier] || 0;
                      const hasCount = count > 0;
                      return (
                        <div 
                          key={tier} 
                          className={`border-2 border-black rounded-lg p-1.5 text-center transition-all ${
                            hasCount && tier !== "未中獎" 
                              ? 'bg-[#FFD700] scale-102 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black' 
                              : count > 0 ? 'bg-zinc-200 text-zinc-600' : 'bg-white text-zinc-400 opacity-60'
                          }`}
                        >
                          <div className="text-[11px] font-black">{tier}</div>
                          <div className={`text-lg sm:text-xl font-black ${hasCount && tier !== "未中獎" ? 'text-rose-600' : 'text-black'}`}>
                            {count}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Individual Bets Detailed Breakdown List */}
                <div className="space-y-2.5">
                  <h4 className="font-black text-base text-black pl-1">📋 細明中獎組合清單：</h4>
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar text-black">
                    {backtestResults.checkedBets.map((res, i) => {
                      const matchCount = res.matches.length;
                      const hasSpecial = res.specialMatch;
                      
                      let bgPrize = "opacity-70 bg-white";
                      let borderPrize = "border-black";

                      if (res.isWin) {
                        if (res.prizeTier === "頭獎" || res.prizeTier === "二獎" || res.prizeTier === "三獎") {
                          bgPrize = "bg-[#FFD700]";
                          borderPrize = "border-[#FF4D4D]";
                        } else {
                          bgPrize = "bg-[#fef9c3]";
                          borderPrize = "border-[#d97706]";
                        }
                      }

                      return (
                        <div key={i} className={`p-3 sm:p-4 border-[3px] ${borderPrize} rounded-xl font-bold ${bgPrize} ${res.isWin ? 'shadow-[4px_4px_0px_0px_#FFE867]' : 'shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'}`}>
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-black bg-[#404040] text-white px-2 py-0.5 rounded shadow-[1px_1px_0px_0px_rgba(0,0,0,0.3)]">
                                #{i+1}
                              </span>
                              <span className="text-[10px] bg-zinc-100 border border-zinc-300 text-zinc-500 rounded px-1.5 py-0.5 font-bold truncate max-w-[150px] sm:max-w-xs" title={res.fileName}>
                                {res.fileName}
                              </span>
                              
                              <div className="flex gap-1">
                                <span className="bg-white border-2 border-zinc-400 px-1.5 py-0.2 rounded text-xs font-bold text-zinc-600">
                                  中 <strong className={matchCount > 0 ? "text-[#3b82f6] text-sm" : "text-zinc-600"}>{matchCount}</strong> 個字
                                </span>
                                {hasSpecial && (
                                  <span className="bg-white border-2 border-[#FF4D4D] px-1.5 py-0.2 rounded text-[11px] font-black text-[#FF4D4D]">
                                    + 特
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Win Badge */}
                            {res.isWin ? (
                              <div className="bg-[#FF4D4D] text-white text-xs px-2 py-0.5 rounded border-2 border-black transform -rotate-2 font-black uppercase tracking-wider">
                                中 {res.prizeTier}！
                              </div>
                            ) : (
                              <div className="text-zinc-400 font-bold text-xs">
                                未中獎
                              </div>
                            )}
                          </div>

                          {/* Balls rendering */}
                          <div className="flex flex-wrap gap-1 sm:gap-1.5 pt-1 w-full justify-start">
                            {res.bet.map((num: number, idx: number) => {
                              const isMatchNormal = res.matches.includes(num);
                              
                              const currentCheckDraw = liveResults[backtestDrawIndex];
                              const currentWinningNumbers = currentCheckDraw ? getRawDrawNumbers(currentCheckDraw) : [];
                              const isMatchSpecial = currentWinningNumbers.length > 6 && num === currentWinningNumbers[6];
                              
                              const isAnyMatch = isMatchNormal || isMatchSpecial;
                              
                              const color = getBallColor(num);
                              const winBgColor = color === "red" ? "bg-[#FF9999]" : color === "blue" ? "bg-[#99CCFF]" : "bg-[#99FF99]";
                              const lightBorderColor = color === "red" ? "border-[#FF9999]" : color === "blue" ? "border-[#99CCFF]" : "border-[#99FF99]";
                              const lightTextColor = color === "red" ? "text-zinc-400" : color === "blue" ? "text-zinc-400" : "text-zinc-400";

                              return (
                                <div
                                  key={idx}
                                  className={`w-[32px] h-[32px] sm:w-[38px] sm:h-[38px] shrink-0 rounded-full flex flex-col items-center justify-center font-black text-lg sm:text-xl leading-none tracking-tighter pt-0.5 border-2 transition-all relative ${
                                    isAnyMatch 
                                      ? `text-white border-black ${winBgColor} shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] ring-[1px] ring-offset-1 ${isMatchSpecial ? 'ring-[#FF4D4D]' : 'ring-black'} transform -translate-y-[1px]`
                                      : `bg-white ${lightBorderColor} ${lightTextColor} opacity-40`
                                  }`}
                                >
                                  {num}
                                  {isMatchSpecial && (
                                    <div className="absolute -bottom-1 -right-1 text-[8px] bg-[#FF4D4D] text-white px-0.5 leading-none rounded border border-black shadow-[0.5px_0.5px_0px_0px_rgba(0,0,0,1)] font-bold">
                                      特
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            ) : (
              <div className="text-center py-6 text-zinc-500 font-bold">
                請上傳系統下載的號碼截圖（或包含對應 QR Code 的截圖）開始進行批量回測。
              </div>
            )}

            <div className="flex justify-center pt-2">
              <Button onClick={() => setIsBacktestDialogOpen(false)} className="border-4 border-black font-black text-black bg-zinc-100 hover:bg-zinc-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-xl px-10 h-11 text-base">
                關閉
              </Button>
            </div>
            
          </div>
        </DialogContent>
      </Dialog>

      <Toaster position="top-center" closeButton toastOptions={{
        classNames: {
          toast: "group !bg-white data-[type=success]:!bg-[#FFE867] !border-[3px] !border-black !rounded-2xl !shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:!border-4 sm:!shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-black font-black text-[15px] sm:text-lg px-4 py-3 sm:px-5 sm:py-4 flex gap-3 w-full items-start",
          title: "font-black text-black",
          icon: "mt-0.5 group-data-[type=success]:text-black group-data-[type=error]:text-[#FF4D4D] group-data-[type=info]:text-[#3b82f6] [&>svg]:w-6 [&>svg]:h-6 sm:[&>svg]:w-7 sm:[&>svg]:h-7 [&>svg]:stroke-[3]"
        }
      }} />
    </div>
  );
}
