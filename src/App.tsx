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
} from "lucide-react";
import { toPng } from "html-to-image";
import {
  generateBets,
  getBallColor,
  BallColor,
  MOCK_PAST_RESULTS,
  PartialGenerationError,
} from "@/lib/marksix";

export default function App() {
  const [betCount, setBetCount] = useState<number>(6);
  const [ranges, setRanges] = useState<{start: number, end: number}[]>([{start: 1, end: 49}]);
  const [oddEven, setOddEven] = useState<"all" | "odd" | "even">("all");
  const [colors, setColors] = useState<BallColor[]>(["red", "blue", "green"]);
  const [enableRecent, setEnableRecent] = useState(false);
  const [recentMode, setRecentMode] = useState<"exclude" | "include" | "">("");
  const [recentCount, setRecentCount] = useState<number>(5);
  const [includeSpecial, setIncludeSpecial] = useState(false);
  const [generatedBets, setGeneratedBets] = useState<number[][]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [analysisDrawIndex, setAnalysisDrawIndex] = useState<number | null>(null);
  const [analysisRangeCount, setAnalysisRangeCount] = useState<number>(5);
  const [bankers, setBankers] = useState<number[]>([]);
  const [excludedLegs, setExcludedLegs] = useState<number[]>([]);

  // Check Results State
  const [isCheckDialogOpen, setIsCheckDialogOpen] = useState(false);
  const [checkDrawIndex, setCheckDrawIndex] = useState<number>(0);
  const [checkMethod, setCheckMethod] = useState<"current" | "upload" | "manual">("current");
  const [checkManualInput, setCheckManualInput] = useState("");
  const [checkResults, setCheckResults] = useState<{ matches: number[], specialMatch: boolean }[] | null>(null);
  const [isCheckingScreenshot, setIsCheckingScreenshot] = useState(false);

  useEffect(() => {
    setBankers([]);
    setExcludedLegs([]);
  }, [generatedBets]);

  const [liveResults, setLiveResults] = useState<{ numbers: number[], date: string }[] | number[][]>([]);
  const [liveResultsLoading, setLiveResultsLoading] = useState(true);

  // Fetch live results on mount
  useEffect(() => {
    async function fetchLiveResults() {
      try {
        const res = await fetch('/api/marksix');
        const data = await res.json();
        if (data.success && data.draws && data.draws.length > 0) {
          setLiveResults(data.draws);
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

  const getDrawDateStr = (draw: number[] | { numbers: number[], date: string }): string => {
    return Array.isArray(draw) ? "" : draw.date;
  };

  const getDisplayPastResults = () => {
    let results = [...liveResults];
    return results.slice(0, 10);
  };
  const displayPastResults = getDisplayPastResults();

  const [hkjcUsername, setHkjcUsername] = useState("");
  const [hkjcPassword, setHkjcPassword] = useState("");
  const [isHkjcDialogOpen, setIsHkjcDialogOpen] = useState(false);
  const [savedCredentials, setSavedCredentials] = useState(false);
  const [errorModal, setErrorModal] = useState<{ message: string; partialBets?: number[][] } | null>(null);

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

  const handleGenerate = () => {
    if (enableRecent && recentMode === "") {
      toast.error("請選擇「排除近期號碼」或「只買近期號碼」");
      return;
    }

    setIsGenerating(true);
    try {
      // For generateBets, recentDraws needs to be number[][]
      const rawRecentDraws = liveResults.map(getRawDrawNumbers);
      const bets = generateBets({
        count: betCount,
        ranges,
        onlyOdd: oddEven === "odd",
        onlyEven: oddEven === "even",
        colors,
        recentMode: enableRecent ? (recentMode as "exclude" | "include") : "none",
        recentCount,
        recentDraws: rawRecentDraws,
        includeSpecial,
      });

      setTimeout(() => {
        setGeneratedBets(bets);
        setIsGenerating(false);
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
      .map((bet, index) => `注 ${index + 1}: ${bet.map((n) => n.toString().padStart(2, "0")).join(", ")}`)
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

  const handlePerformCheck = (betsToCheck: number[][]) => {
    if (!liveResults[checkDrawIndex]) {
      toast.error("找不到該期開彩結果");
      return;
    }
    const drawObj = liveResults[checkDrawIndex];
    const draw = getRawDrawNumbers(drawObj);
    const winningNumbers = draw.slice(0, 6);
    const specialNumber = draw[6];

    const results = betsToCheck.map(bet => {
      const matches = bet.filter(n => winningNumbers.includes(n));
      const specialMatch = bet.includes(specialNumber);
      return { matches, specialMatch };
    });
    setCheckResults(results);
    toast.success("核對完成！");
  };

  const handleManualCheck = () => {
    try {
      const betsStr = checkManualInput.split(/\n|,|;/).map(s => s.trim()).filter(s => s);
      const parsedBets: number[][] = [];
      let currentBet: number[] = [];
      for (const s of betsStr) {
        const n = parseInt(s, 10);
        if (!isNaN(n)) {
          currentBet.push(n);
          if (currentBet.length === 6) {
            parsedBets.push(currentBet);
            currentBet = [];
          }
        }
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

  const handleScreenshotUploadForCheck = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCheckingScreenshot(true);
    toast.loading("正在解析圖片中的號碼...", { id: "check-screenshot" });

    try {
      const base64data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/check-screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64data })
      });
      
      const data = await res.json();
      if (data.success && Array.isArray(data.bets)) {
        const validBets = data.bets.filter((b: any) => Array.isArray(b) && b.length === 6 && b.every((n: any) => typeof n === 'number' && n >= 1 && n <= 49));
        if (validBets.length > 0) {
          handlePerformCheck(validBets);
          toast.success("成功解析圖片號碼！", { id: "check-screenshot" });
        } else {
          throw new Error("找不到有效的六合彩號碼格式 (6個數字一組)");
        }
      } else {
        throw new Error(data.error || "解析失敗");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "圖片解析失敗，請手動輸入", { id: "check-screenshot" });
    } finally {
      setIsCheckingScreenshot(false);
      e.target.value = ""; // reset input
    }
  };

  const handleCaptureScreenshot = async () => {
    const captureArea = document.getElementById('capture-area');
    if (!captureArea) return;
    
    toast.loading("準備圖片中...", { id: "capture-toast" });

    try {
      let expectedWidth = 500;
      if (generatedBets.length >= 13) {
        expectedWidth = 1450;
      } else if (generatedBets.length === 12) {
        expectedWidth = 1000;
      }

      const options = {
        pixelRatio: 2, // High resolution
        backgroundColor: '#1e1e1e',
        width: expectedWidth,
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
      a.download = `marksix-lucky-numbers-${new Date().toISOString().slice(0,10)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast.success("成功儲存圖片！", { id: "capture-toast" });
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
          .red { background: #FF4D4D; }
          .blue { background: #3b82f6; }
          .green { background: #22c55e; }
        </style>
      </head>
      <body>
        <h3>您的幸運號碼</h3>
        ${generatedBets.map((bet, i) => `
          <div class="bet">
            <div class="index">#${i + 1}</div>
            <div class="balls">
              ${bet.map(n => {
                const color = getBallColor(n);
                const colorClass = color === 'red' ? 'red' : color === 'blue' ? 'blue' : 'green';
                return `<div class="ball ${colorClass}">${n}</div>`;
              }).join('')}
            </div>
          </div>
        `).join('')}
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

  const getBookmarkletCode = (isDesktop: boolean = false) => {
    const betsJson = JSON.stringify(generatedBets);
    if (isDesktop) {
      const script = `(async function(){
        const bets = ${betsJson};
        if (!bets || bets.length === 0) { alert("沒有生成號碼！"); return; }
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const getFrames = (win) => {
          let res = [];
          try { if(win.document) res.push({w: win, d: win.document}); } catch(e){}
          try {
            for(let i=0; i<win.frames.length; i++){
              res = res.concat(getFrames(win.frames[i]));
            }
          } catch(e){}
          return res;
        };
        const triggerClick = (el, win) => {
          el.click();
          if(win.MouseEvent){
            el.dispatchEvent(new win.MouseEvent('mousedown', {bubbles: true}));
            el.dispatchEvent(new win.MouseEvent('mouseup', {bubbles: true}));
          }
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
                    const xp = "//*[(normalize-space(text())='"+str+"' or normalize-space(text())='"+pad+"') and not(*)] | //img[@alt='"+str+"' or @alt='"+pad+"' or contains(@src, '"+pad+".')] | //*[(normalize-space(@title)='"+str+"' or normalize-space(@title)='"+pad+"')] | //*[@class and contains(@class, 'ball') and (normalize-space()='"+str+"' or normalize-space()='"+pad+"')]";
                    const els = d.evaluate(xp, d, null, 7, null);
                    for(let i=0; i<els.snapshotLength; i++){
                      const el = els.snapshotItem(i);
                      const rect = el.getBoundingClientRect();
                      if(rect.width > 0 && rect.height > 0){ 
                        triggerClick(el, w); 
                        clicked = true;
                        break; 
                      }
                    }
                    if(clicked) break;
                } catch(e){}
            }
            if (!clicked) console.log("找不到號碼: " + str);
            await sleep(150);
          }
          await sleep(500);
          
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
          await sleep(1500);
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
          el.click();
          el.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
          el.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
          if (window.PointerEvent) {
            el.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
            el.dispatchEvent(new PointerEvent('pointerup', {bubbles: true}));
          }
        };
        let count = 0;
        for(const bet of bets){
          for(const num of bet){
            const str = num.toString();
            const pad = num < 10 ? '0'+num : str;
            const xp = "//*[(normalize-space(.)='"+str+"' or normalize-space(.)='"+pad+"') and not(*)]";
            const els = document.evaluate(xp, document, null, 7, null);
            let clicked = false;
            for(let i=0; i<els.snapshotLength; i++){
              const el = els.snapshotItem(i);
              const rect = el.getBoundingClientRect();
              if(rect.width > 0 && rect.height > 0){ 
                triggerClick(el); 
                clicked = true;
                break; 
              }
            }
            if (!clicked) console.log("找不到號碼: " + str);
            await sleep(150);
          }
          await sleep(500);
          
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
          await sleep(1500);
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
      <header className="bg-white border-b-4 border-black sticky top-0 z-10 shadow-[0px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="max-w-5xl mx-auto px-2 sm:px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 sm:shrink sm:flex-1 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#FF4D4D] border-[3px] sm:border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center font-black transform -rotate-6 shrink-0">
              <span className="text-[#FFE867] text-xl sm:text-[26px] leading-none mb-[1px]" style={{ WebkitTextStroke: '1.5px black' }}>
                $
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 min-w-0 pb-0.5 sm:flex-1">
              <div className="flex flex-col sm:flex-row sm:items-end sm:gap-2 min-w-0 shrink-0">
                <h1 className="text-base sm:text-2xl font-black tracking-tight uppercase whitespace-nowrap leading-tight truncate sm:overflow-visible">
                  池要中六合彩
                </h1>
                <span className="text-[9px] sm:text-sm font-bold text-zinc-500 whitespace-nowrap leading-none sm:pb-[2px] truncate sm:overflow-visible">
                  此系統由池記桌遊提供
                </span>
              </div>
              <div className="hidden sm:flex flex-1 justify-between gap-x-3 gap-y-10 flex-wrap overflow-hidden px-4 pl-8 self-center max-h-[44px] pt-0.5">
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
              className="border-[3px] border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] sm:border-4 sm:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 sm:hover:translate-y-1 sm:hover:translate-x-1 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all rounded-full h-auto py-1 px-2 sm:py-1.5 sm:px-3 text-xs sm:text-sm bg-white"
              onClick={() => {
                setGeneratedBets([]);
                setBankers([]);
                setAnalysisDrawIndex(null);
                setExcludedLegs([]);
              }}
            >
              <span className="hidden sm:inline">回到首頁</span>
              <span className="inline sm:hidden"><Home className="w-3.5 h-3.5" /></span>
            </Button>
            <Button
              variant="outline"
              className="border-[3px] border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] sm:border-4 sm:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 sm:hover:translate-y-1 sm:hover:translate-x-1 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all rounded-full h-auto py-1 px-2 sm:py-1.5 sm:px-3 text-xs sm:text-sm bg-black text-white hover:bg-black hover:text-white"
              onClick={() =>
                window.open("https://bet.hkjc.com/ch/marksix/home", "_blank")
              }
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1 sm:mr-1.5" />
              <span>前往 HKJC</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-2 sm:px-4 pt-0 pb-2 sm:pt-0 sm:pb-2">
        <div className={`grid grid-cols-1 ${generatedBets.length === 0 ? "lg:grid-cols-12" : ""} gap-1.5 sm:gap-4`}>
          {/* Left Column: Settings */}
          {generatedBets.length === 0 && (
            <div className="lg:col-span-5 space-y-2">
            <Card className="border-[3px] sm:border-4 border-black rounded-2xl sm:rounded-3xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden p-0 gap-0">
              <CardHeader className="flex flex-col sm:flex-row sm:items-end sm:gap-2 space-y-0 bg-[#ffedd5] border-b-[3px] sm:border-b-4 border-black px-3 py-2 sm:px-4 sm:py-3 m-0 rounded-none w-full !grid-cols-1 sm:!flex">
                <CardTitle className="flex items-center gap-1.5 text-base sm:text-xl font-black shrink-0">
                  <Settings2 className="w-4 h-4 sm:w-5 sm:h-5 sm:mb-[1px]" />
                  號碼生成設定
                </CardTitle>
                <CardDescription className="text-black font-bold opacity-80 text-[11px] sm:text-[15px] leading-none mt-0.5 sm:mt-0 sm:pb-[2px] truncate">
                  自訂您的幸運選號策略 ✨
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5 px-3 pb-3 pt-2 sm:space-y-2 sm:px-4 sm:pb-4 sm:pt-3">
                {/* Bet Count */}
                <div className="space-y-0.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-bold">生成注數</Label>
                    <span className="font-black text-lg text-[#FF4D4D] bg-[#FFE867] px-2 py-0.5 border-2 border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transform rotate-2">
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs border-2 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all"
                      onClick={() => {
                        if (ranges.length === 1) {
                          setRanges([...ranges, {start: 1, end: 49}]);
                        } else {
                          setRanges([ranges[0]]);
                        }
                      }}
                    >
                      {ranges.length === 1 ? "+ 新增範圍" : "- 移除範圍"}
                    </Button>
                  </div>
                  {ranges.map((range, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex justify-end items-center">
                        {ranges.length > 1 && <span className="text-sm font-bold text-zinc-500 mr-auto">範圍 {index + 1}</span>}
                        <span className="font-black text-[15px] text-[#FF4D4D] bg-[#FFE867] px-2 py-0 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transform -rotate-2">
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

                {/* Odd/Even */}
                <div className="space-y-0.5">
                  <Label className="text-base font-bold">單雙號碼</Label>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setOddEven("all")}
                      className={`px-3 py-1 border-4 border-black rounded-full font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${oddEven === "all" ? "bg-[#FFE867] translate-y-0.5 translate-x-0.5 shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]" : "bg-white hover:bg-zinc-50"}`}
                    >
                      全部
                    </button>
                    <button
                      onClick={() => setOddEven("odd")}
                      className={`px-3 py-1 border-4 border-black rounded-full font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${oddEven === "odd" ? "bg-[#FFE867] translate-y-0.5 translate-x-0.5 shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]" : "bg-white hover:bg-zinc-50"}`}
                    >
                      單數
                    </button>
                    <button
                      onClick={() => setOddEven("even")}
                      className={`px-3 py-1 border-4 border-black rounded-full font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${oddEven === "even" ? "bg-[#FFE867] translate-y-0.5 translate-x-0.5 shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]" : "bg-white hover:bg-zinc-50"}`}
                    >
                      雙數
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
                      className={`px-3 py-1 border-4 border-black rounded-full font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${colors.includes("red") && colors.length < 3 ? "bg-[#FF4D4D] text-black translate-y-0.5 translate-x-0.5 shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]" : "bg-white hover:bg-red-50 text-black/50"}`}
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
                      className={`px-3 py-1 border-4 border-black rounded-full font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${colors.includes("blue") && colors.length < 3 ? "bg-[#3b82f6] text-black translate-y-0.5 translate-x-0.5 shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]" : "bg-white hover:bg-blue-50 text-black/50"}`}
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
                      className={`px-3 py-1 border-4 border-black rounded-full font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${colors.includes("green") && colors.length < 3 ? "bg-[#22c55e] text-black translate-y-0.5 translate-x-0.5 shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]" : "bg-white hover:bg-green-50 text-black/50"}`}
                    >
                      包含綠波
                    </button>
                  </div>
                </div>

                {/* Past Results */}
                <div className="space-y-1 pt-1 border-t-[3px] border-black border-dashed">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <Checkbox 
                        id="enable-recent"
                        checked={enableRecent}
                        onCheckedChange={(checked) => setEnableRecent(checked as boolean)}
                        className="w-4 h-4 border-[3px] border-black rounded-sm data-[state=checked]:bg-[#FF4D4D] data-[state=checked]:text-white"
                      />
                      <Label htmlFor="enable-recent" className="text-[15px] font-bold cursor-pointer">啟用近期號碼策略</Label>
                    </div>
                  </div>
                  
                  {enableRecent && (
                    <div className="space-y-1 mt-0.5 flex flex-col gap-0.5">
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
                          <span className="font-bold text-xs flex-1 select-none">排除近期號碼</span>
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
                          <span className="font-bold text-xs flex-1 select-none">只買近期號碼</span>
                        </label>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="flex items-center gap-1.5 bg-white border-[3px] border-black py-0.5 px-1.5 rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] w-fit cursor-pointer hover:bg-zinc-50 relative active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all">
                          <input 
                            type="checkbox" 
                            checked={includeSpecial} 
                            onChange={(e) => setIncludeSpecial(e.target.checked)} 
                            className="w-3 h-3 accent-[#3b82f6] cursor-pointer"
                          />
                          <span className="font-bold text-[11px] sm:text-xs whitespace-nowrap select-none">連特別號碼一齊考慮</span>
                        </label>
                        <div className="flex items-center gap-1.5 w-full bg-white border-[3px] border-black py-0.5 px-1.5 rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-zinc-50 transition-colors">
                          <Slider
                            value={recentCount}
                            min={1}
                            max={50}
                            step={1}
                            onValueChange={(val) => {
                              const newValue = Array.isArray(val) ? val[0] : val;
                              setRecentCount(newValue as number);
                            }}
                            className="py-1 cursor-pointer flex-1"
                          />
                          <span className="font-black text-xs bg-[#FFE867] px-1.5 py-0.5 border-2 border-black rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transform rotate-2 whitespace-nowrap select-none">
                            參考 {recentCount || 0} 期
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="bg-zinc-100 border-t-[3px] border-black py-2 px-3 sm:py-3 sm:px-4 m-0 rounded-none w-full flex flex-col justify-center gap-3 mt-auto">
                <Button
                  className="w-fit bg-[#FF4D4D] hover:bg-[#FF3333] text-black h-auto py-1.5 px-6 text-lg font-black border-4 border-black rounded-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:translate-x-1 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all mx-auto"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <RefreshCw className="w-6 h-6 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-6 h-6 mr-2" />
                  )}
                  {isGenerating ? "生成中..." : "生成號碼"}
                </Button>

                <Button
                  variant="outline"
                  className="w-fit bg-white hover:bg-zinc-50 text-black h-auto py-1.5 px-4 text-base font-black border-4 border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all mx-auto"
                  onClick={() => setIsCheckDialogOpen(true)}
                >
                  <SearchCheck className="w-5 h-5 mr-1" />
                  核對中獎號碼
                </Button>
              </CardFooter>
            </Card>
          </div>
          )}

          {/* Right Column: Results */}
          <div className={generatedBets.length === 0 ? "lg:col-span-7 space-y-4" : "max-w-2xl mx-auto w-full space-y-1 sm:space-y-2"}>
            {generatedBets.length > 0 ? (
              <div className="space-y-1 sm:space-y-2">
                <div className="flex flex-col gap-1">
                  <div className="bg-white border-4 border-black py-0.5 px-2 sm:py-1 sm:px-3 rounded-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-fit flex-shrink-0">
                    <h2 className="text-lg sm:text-xl font-black flex items-center gap-1.5 sm:gap-2 px-2">
                      <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
                      成功生成 {generatedBets.length} 注號碼！ 🎉
                    </h2>
                  </div>
                  
                  {(() => {
                    const allGeneratedNumbers = generatedBets.flat();
                    
                    const freqMap = new Map<number, number>();
                    allGeneratedNumbers.forEach(n => freqMap.set(n, (freqMap.get(n) || 0) + 1));
                    
                    const recentDrawsToConsider = liveResults.slice(0, recentCount);
                    const historicalFreqMap = new Map<number, number>();
                    Array.from(freqMap.keys()).forEach(n => {
                      historicalFreqMap.set(n, recentDrawsToConsider.filter(draw => draw.includes(n)).length);
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
                    const isHighlyRepeated = generatedBets.length >= 3 && uniqueGeneratedNumbers.length > 6 && uniqueGeneratedNumbers.length <= 16;

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
                      <div className="bg-[#dcfce7] border-4 border-black rounded-2xl p-3 sm:p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-2 relative mt-1 sm:mt-2 mb-2">
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
                                const pastRecentFreq = liveResults.slice(0, recentCount).filter(draw => draw.includes(num)).length;
                                
                                const color = getBallColor(num);
                                let baseBgClass = "bg-white text-black border-black";
                                let textColor = "text-black";
                                if (color === "red") {
                                  baseBgClass = "bg-[#FF4D4D]";
                                  textColor = "text-white";
                                } else if (color === "blue") {
                                  baseBgClass = "bg-[#3b82f6]";
                                  textColor = "text-white";
                                } else if (color === "green") {
                                  baseBgClass = "bg-[#22c55e]";
                                  textColor = "text-white";
                                }

                                return (
                                  <div key={num} className="flex flex-col items-center gap-1">
                                    <div className="text-[10px] sm:text-[11px] font-bold text-center leading-[1] whitespace-nowrap bg-zinc-100 border-2 border-zinc-300 rounded px-1 py-0.5 text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,0.2)] mb-0.5">
                                      {pastRecentFreq}次
                                    </div>
                                    <button
                                      onClick={() => handleToggleBanker(num)}
                                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-[3px] border-black font-black text-sm sm:text-base flex items-center justify-center transition-all shrink-0 ${baseBgClass} ${textColor} ${isSelected ? 'shadow-none translate-y-0.5 translate-x-0.5 opacity-100 ring-2 ring-offset-2 ring-black' : excludedLegs.includes(num) ? 'opacity-30' : 'shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]'}`}
                                    >
                                      {num.toString().padStart(2, "0")}
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
                                    let borderColor = color === "red" ? "border-red-300" : color === "blue" ? "border-blue-300" : "border-green-300";
                                    let textColor = color === "red" ? "text-red-600" : color === "blue" ? "text-blue-600" : "text-green-600";
                                    
                                    if (isExcluded) {
                                      return (
                                        <button
                                          key={num}
                                          onClick={() => handleToggleExcludedLeg(num)}
                                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-[3px] border-zinc-300 font-black text-sm sm:text-base flex items-center justify-center transition-all bg-zinc-100 text-zinc-400 relative`}
                                        >
                                          {num.toString().padStart(2, "0")}
                                          <div className="absolute inset-x-1 top-1/2 h-[3px] bg-zinc-400 transform -translate-y-1/2 rotate-45"></div>
                                        </button>
                                      )
                                    }
                                    
                                    return (
                                      <button
                                        key={num}
                                        onClick={() => handleToggleExcludedLeg(num)}
                                        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-[3px] ${borderColor} font-black ${textColor} text-sm sm:text-base flex items-center justify-center transition-all bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] hover:bg-zinc-100`}
                                      >
                                        {num.toString().padStart(2, "0")}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            
                              <div className="flex flex-col gap-1.5 mt-1">
                                <div className="text-sm sm:text-base font-bold text-black flex flex-wrap gap-x-3 gap-y-1 bg-zinc-50 border-2 border-black rounded-lg p-2.5">
                                  <span className="flex items-center gap-1.5">
                                    <span className="bg-black text-white px-1.5 py-0.5 rounded text-xs">膽</span> 
                                    <span className="font-black text-[#FF4D4D]">{bankers.map(n => n.toString().padStart(2, '0')).join(', ')}</span>
                                    <span className="text-xs text-zinc-500">({bankers.length})</span>
                                  </span>
                                  <span className="flex items-center gap-1.5 flex-wrap">
                                    <span className="bg-black text-white px-1.5 py-0.5 rounded text-xs">有效配腳</span>
                                    <span className="font-black">{activeLegs.map(n => n.toString().padStart(2, '0')).join(', ')}</span>
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
                      className="border-4 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all rounded-full h-auto py-1 px-3 bg-white"
                      onClick={() => {
                        setGeneratedBets([]);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      <Home className="w-3.5 h-3.5 mr-1" />
                      回到首頁
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-4 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all rounded-full h-auto py-1 px-3"
                      onClick={() => {
                        setGeneratedBets([]);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      <Settings2 className="w-3.5 h-3.5 mr-1" />
                      更改設定
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-[#FFE867] text-black hover:bg-[#FFD700] border-4 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all rounded-full h-auto py-1 px-3"
                      onClick={handleGenerate}
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1" />
                      重新生成
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-4 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all rounded-full h-auto py-1 px-3 bg-white"
                      onClick={handleCopyBets}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      複製號碼
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-4 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all rounded-full h-auto py-1 px-3 bg-[#a855f7] text-white"
                      onClick={handleCaptureScreenshot}
                    >
                      <ImageIcon className="w-3.5 h-3.5 mr-1" />
                      儲存生成結果圖片
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-4 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all rounded-full h-auto py-1 px-3 bg-[#4ade80] text-black"
                      onClick={handleFloatingWindow}
                    >
                      <MonitorUp className="w-3.5 h-3.5 mr-1" />
                      懸浮顯示 (免切換)
                    </Button>
                    <Dialog>
                      <DialogTrigger render={
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-4 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all rounded-full h-auto py-1 px-3 bg-[#a5b4fc] text-black"
                        />
                      }>
                        <Sparkles className="w-3.5 h-3.5 mr-1" />
                        自動點擊 HKJC
                      </DialogTrigger>
                      <DialogContent className="border-4 border-black rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] sm:max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="text-xl font-black">自動點擊 HKJC 教學</DialogTitle>
                          <DialogDescription className="font-bold text-black/80">
                            由於瀏覽器安全限制，我們無法直接控制 HKJC 網頁。請使用以下「自動點擊腳本」來代替手動按球。
                          </DialogDescription>
                        </DialogHeader>
                        
                        <Tabs defaultValue={typeof window !== 'undefined' && window.innerWidth < 768 ? "mobile" : "desktop"} className="w-full mt-2">
                          <TabsList className="grid w-full grid-cols-2 border-2 border-black rounded-xl p-1 bg-zinc-100 mb-4 h-auto gap-1">
                            <TabsTrigger value="desktop" className="font-bold text-sm rounded-lg border-2 border-transparent data-[state=active]:bg-white data-[state=active]:border-black data-[state=active]:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] py-1.5 transition-all">💻 電腦版</TabsTrigger>
                            <TabsTrigger value="mobile" className="font-bold text-sm rounded-lg border-2 border-transparent data-[state=active]:bg-white data-[state=active]:border-black data-[state=active]:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] py-1.5 transition-all">📱 手機版</TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="desktop" className="space-y-4">
                            <div className="space-y-2">
                              <h4 className="font-black text-base flex items-center gap-2"><span className="bg-black text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span> 複製腳本</h4>
                              <Button 
                                className="w-full border-4 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:translate-x-1 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all bg-[#FFE867] text-black hover:bg-[#FFD700] h-auto py-2"
                                onClick={() => {
                                  const script = decodeURIComponent(getBookmarkletCode(true).replace('javascript:', ''));
                                  navigator.clipboard.writeText(script);
                                  toast.success("腳本已複製！");
                                }}
                              >
                                <Copy className="w-4 h-4 mr-2" />
                                點擊複製自動點擊腳本
                              </Button>
                            </div>
                            <div className="space-y-2">
                              <h4 className="font-black text-base flex items-center gap-2"><span className="bg-black text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span> 在 HKJC 網頁執行</h4>
                              <ol className="list-decimal list-inside space-y-1.5 font-bold text-sm text-zinc-700">
                                <li>前往 HKJC 六合彩投注網頁。</li>
                                <li>按下鍵盤 <kbd className="bg-zinc-200 px-1.5 py-0.5 rounded border-2 border-black text-black">F12</kbd> 打開開發者工具。</li>
                                <li>切換到 <strong>Console (控制台)</strong> 標籤。</li>
                                <li>貼上剛剛複製的腳本，然後按下 <kbd className="bg-zinc-200 px-1.5 py-0.5 rounded border-2 border-black text-black">Enter</kbd>。</li>
                                <li className="text-[#FF4D4D]">程式就會自動幫您點擊號碼球和「添加到投注區」！</li>
                              </ol>
                            </div>
                            <div className="pt-3 border-t-4 border-black border-dashed">
                              <p className="text-xs font-bold text-zinc-500 mb-2">或者，您可以將下方按鈕拖曳到書籤列，在 HKJC 網頁點擊該書籤：</p>
                              <a
                                ref={(el) => { if (el) el.setAttribute("href", getBookmarkletCode(true)); }}
                                onClick={(e) => e.preventDefault()}
                                className="w-full flex items-center justify-center border-4 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:translate-x-1 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all bg-white cursor-grab active:cursor-grabbing text-black text-sm h-auto py-2 px-4 rounded-md mb-2"
                              >
                                <Link2 className="w-4 h-4 mr-2" />
                                拖曳至書籤 (自動點擊)
                              </a>
                              <p className="text-[11px] font-bold text-[#FF4D4D] bg-[#FF4D4D]/10 p-1.5 rounded-md border border-[#FF4D4D]/20">
                                ⚠️ 注意：書籤的號碼是固定的！每次重新生成號碼後，您必須刪除舊書籤，並「重新拖曳」一次新的按鈕到書籤列。
                              </p>
                            </div>
                          </TabsContent>

                          <TabsContent value="mobile" className="space-y-4">
                            <div className="bg-[#FFE867] border-4 border-black rounded-xl p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                              <h4 className="font-black text-base mb-2 flex items-center gap-2">
                                🌟 推薦做法：建立手機書籤
                              </h4>
                              <p className="text-sm font-bold text-zinc-700 mb-2">
                                這是最方便的方法，以後只要點擊書籤就能自動輸入，不需要每次複製貼上。
                              </p>
                              <Button 
                                className="w-full border-4 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:translate-x-1 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all bg-white text-black hover:bg-zinc-100 h-auto py-2 mb-3"
                                onClick={() => {
                                  navigator.clipboard.writeText(getBookmarkletCode());
                                  toast.success("完整腳本書籤已複製！");
                                }}
                              >
                                <Copy className="w-4 h-4 mr-2" />
                                1. 點擊複製完整書籤腳本
                              </Button>
                              <ol className="list-decimal list-inside space-y-1.5 font-bold text-sm text-zinc-700">
                                <li>在手機瀏覽器打開 HKJC 投注網頁。</li>
                                <li>將該網頁<strong className="text-black">加入書籤</strong> (或加到我的最愛)。</li>
                                <li><strong className="text-black">編輯</strong>剛剛新增的書籤：
                                  <ul className="list-disc list-inside ml-4 mt-1 text-xs">
                                    <li>名稱改為「自動點擊 HKJC」</li>
                                    <li>網址 (URL) 清空，並<strong className="text-[#FF4D4D]">貼上剛剛複製的腳本</strong>。</li>
                                  </ul>
                                </li>
                                <li>儲存書籤。</li>
                                <li>留在 HKJC 網頁，打開書籤選單點擊「自動點擊 HKJC」即可！</li>
                              </ol>
                              <p className="text-[11px] font-bold text-[#FF4D4D] mt-2">
                                ⚠️ 注意：每次重新生成號碼後，您必須重新複製腳本，並「編輯更新」您的手機書籤網址。
                              </p>
                            </div>

                            <div className="pt-2 border-t-4 border-black border-dashed">
                              <h4 className="font-black text-base flex items-center gap-2 mb-3">
                                備用做法：透過網址列執行
                              </h4>
                              <div className="space-y-3">
                                <Button 
                                  className="w-full border-4 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:translate-x-1 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all bg-white text-black hover:bg-zinc-100 h-auto py-2"
                                  onClick={() => {
                                    const script = decodeURIComponent(getBookmarkletCode().replace('javascript:', ''));
                                    navigator.clipboard.writeText(script);
                                    toast.success("腳本已複製！");
                                  }}
                                >
                                  <Copy className="w-4 h-4 mr-2" />
                                  1. 點擊複製腳本 (不含 javascript:)
                                </Button>
                                
                                <div className="bg-[#FF4D4D]/10 border-2 border-[#FF4D4D] rounded-xl p-3">
                                  <p className="text-sm font-bold text-[#FF4D4D] mb-1">⚠️ 為什麼不能直接複製貼上 javascript: ？</p>
                                  <p className="text-xs font-bold text-zinc-700">
                                    手機瀏覽器（Safari/Chrome）基於安全機制，<strong className="text-black">會自動刪除貼上的 `javascript:`</strong>，所以貼上會變成空白！
                                  </p>
                                </div>

                                <ol className="list-decimal list-inside space-y-1.5 font-bold text-sm text-zinc-700">
                                  <li>在手機瀏覽器打開 HKJC 網頁並登入。</li>
                                  <li>點擊瀏覽器的<strong>網址列</strong>。</li>
                                  <li>
                                    <span className="text-[#FF4D4D]">必須「手動輸入」</span> <kbd className="bg-zinc-200 px-1.5 py-0.5 rounded border-2 border-black text-black">javascript:</kbd> (注意最後有英文冒號)。
                                  </li>
                                  <li>在冒號後面，<strong>貼上</strong>您剛剛複製的腳本。</li>
                                  <li>按下手機鍵盤上的「前往」或「Enter」即可自動點擊！</li>
                                </ol>
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                <div className="flex flex-col sm:grid sm:grid-cols-2 gap-2 sm:gap-3 items-center sm:items-start w-full overflow-hidden">
                  {generatedBets.map((bet, index) => (
                    <div
                      key={index}
                      className="w-fit max-w-full overflow-x-auto hide-scrollbar border-4 border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all bg-white flex mx-auto sm:mx-0"
                    >
                      <div className="flex items-center p-0 pr-0.5 gap-0.5 sm:gap-1 min-w-max h-9 sm:h-11">
                        <div className="text-base sm:text-lg font-black text-black w-8 sm:w-10 transform -rotate-12 ml-1.5 sm:ml-2 shrink-0 text-center leading-none">
                          #{index + 1}
                        </div>
                        <div className="flex flex-nowrap gap-0 sm:gap-0.5">
                          {bet.map((num, i) => {
                            const color = getBallColor(num);
                            return (
                              <div
                                key={i}
                                className={`
                                  w-9 h-9 sm:w-11 sm:h-11 shrink-0 rounded-full flex items-center justify-center text-black font-black text-base sm:text-xl border-[3px] border-black cursor-default
                                  ${
                                    color === "red"
                                      ? "bg-[#FF4D4D]"
                                      : ""
                                  }
                                  ${
                                    color === "blue"
                                      ? "bg-[#3b82f6]"
                                      : ""
                                  }
                                  ${
                                    color === "green"
                                      ? "bg-[#22c55e]"
                                      : ""
                                  }
                                `}
                              >
                                {num.toString().padStart(2, "0")}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            ) : (
              <div className="h-full min-h-[500px] flex flex-col items-center bg-white border-[3px] sm:border-4 border-black rounded-2xl sm:rounded-3xl p-2 sm:p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] sm:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex flex-col items-center mb-3 sm:mb-4 text-center">
                  <h3 className="text-xl sm:text-2xl font-black">最近十期開獎結果</h3>
                </div>
                
                <div className="w-full flex-1 overflow-y-auto pr-1 space-y-2">
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
                        <div className="flex flex-col items-center">
                          <div className="font-black text-[12px] sm:text-base bg-black text-white px-1 sm:px-2 py-0.5 flex items-center justify-center -rotate-2 rounded whitespace-nowrap shrink-0 leading-none">
                            {displayTitle}
                          </div>
                          {dateStr && (
                            <div className="text-[10px] sm:text-xs font-bold text-zinc-500 mt-0.5 whitespace-nowrap">
                              {dateStr}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-0 sm:gap-0.5 flex-nowrap items-center shrink-0 pr-0.5 pb-0.5 sm:pb-0">
                          {numbers.map((num, numIdx) => {
                            const isSpecial = numIdx === 6;
                            const color = getBallColor(num);
                            const bgColor = color === "red" ? "bg-[#FF4D4D]" : color === "blue" ? "bg-[#3b82f6]" : "bg-[#22c55e]";
                            return (
                              <div key={numIdx} className="flex items-center gap-0 sm:gap-0.5">
                                {isSpecial && <span className="font-black text-sm sm:text-xl text-zinc-400 px-0.5 sm:px-1">+</span>}
                                <div
                                  className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full border-[3px] border-black flex items-center justify-center font-black text-xs sm:text-base text-black ${bgColor} ${isSpecial ? "opacity-90 border-dashed" : ""}`}
                                >
                                  {num}
                                </div>
                              </div>
                            );
                          })}
                          <button
                            onClick={() => setAnalysisDrawIndex(index)}
                            className="ml-0.5 sm:ml-1 bg-[#FFE867] p-1 sm:px-2 sm:py-1 rounded sm:rounded-md border-2 sm:border-[3px] border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1.5px] hover:translate-x-[1.5px] hover:shadow-none active:shadow-none transition-all flex items-center justify-center shrink-0"
                            title="期數分析"
                          >
                            <BarChart2 className="w-4 h-4 sm:hidden text-black" />
                            <span className="hidden sm:inline font-black text-sm whitespace-nowrap">分析</span>
                          </button>
                        </div>
                      </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="max-w-5xl mx-auto px-4 py-6 text-center">
        <p className="text-base font-black text-black">
          此系統由池記桌遊提供 版權2026
        </p>
      </footer>

      <Dialog open={analysisDrawIndex !== null} onOpenChange={(open) => !open && setAnalysisDrawIndex(null)}>
        <DialogContent className="sm:max-w-5xl border-4 border-black rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-0 overflow-hidden w-[95vw] max-h-[90vh] [&>button.absolute]:hidden">
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

            return (
              <>
                <DialogHeader className="bg-[#FFE867] border-b-4 border-black p-3 sm:p-4 shrink-0 flex flex-row items-center justify-between space-y-0">
                  <DialogTitle className="text-2xl sm:text-3xl font-black flex items-center gap-2 m-0 p-0">
                    <BarChart2 className="w-7 h-7 sm:w-8 sm:h-8" />
                    最近第 {analysisDrawIndex + 1} 期分析
                  </DialogTitle>
                  <Button
                    onClick={() => setAnalysisDrawIndex(null)}
                    className="bg-white hover:bg-zinc-100 text-black border-2 sm:border-[3px] border-black font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all rounded-lg h-9 sm:h-12 px-3 sm:px-6 text-sm sm:text-lg"
                  >
                    回到首頁
                  </Button>
                </DialogHeader>
                <div id="analysis-scroll-area" className="p-3 sm:p-4 flex flex-col gap-3 overflow-y-auto max-h-[65vh]">
                  
                  {/* Current Draw Balls */}
                  <div className="flex gap-1.5 sm:gap-4 flex-wrap sm:flex-nowrap justify-center items-center bg-zinc-50 border-[3px] border-black rounded-xl p-2.5 sm:p-5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mb-1">
                    {drawNumbers.map((num, i) => {
                      const isSpecial = i === 6;
                      const color = getBallColor(num);
                      const bgColor = color === "red" ? "bg-[#FF4D4D]" : color === "blue" ? "bg-[#3b82f6]" : "bg-[#22c55e]";
                      return (
                        <div key={i} className="flex items-center gap-1 sm:gap-4">
                          {isSpecial && <span className="font-black text-xl sm:text-3xl text-zinc-400">+</span>}
                          <div
                            className={`w-9 h-9 sm:w-16 sm:h-16 rounded-full border-2 sm:border-[4px] border-black flex items-center justify-center font-black text-base sm:text-3xl text-black ${bgColor} ${isSpecial ? "opacity-90 shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] sm:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] border-dashed" : "shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] sm:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"}`}
                          >
                            {num}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Single Draw Stats */}
                  <div className="flex flex-col gap-2 sm:gap-3 mb-1">
                    <h4 className="font-black text-xl sm:text-2xl border-b-[3px] border-black pb-1 text-black">當期頭六碼分佈</h4>
                    <div className="bg-zinc-50 border-[3px] border-black rounded-xl p-2 sm:p-3 flex flex-col gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <span className="text-sm font-bold text-zinc-500 uppercase">大小區間分佈</span>
                      <div className="flex gap-2 text-sm sm:text-lg font-black flex-wrap">
                        {singleSizeDist.map(dist => (
                          <div key={dist.label} className="flex bg-white border-2 border-black rounded px-1.5 py-0.5 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                            <span className="text-zinc-600 mr-1">{dist.label}:</span>
                            <span className={dist.count > 0 ? "text-[#3b82f6]" : "text-zinc-300"}>{dist.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-zinc-50 border-[3px] border-black rounded-xl p-2 sm:p-3 flex flex-col gap-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <span className="text-sm font-bold text-zinc-500 uppercase">單雙分佈</span>
                      <span className="text-xl sm:text-2xl font-black">{singleOddCount} 單 : {singleEvenCount} 雙</span>
                    </div>
                  </div>

                  {/* Analysis Range Control */}
                  <div className="flex flex-col gap-3 mt-1 border-t-[3px] border-black border-dashed pt-4">
                    <h4 className="font-black text-xl sm:text-2xl border-b-[3px] border-black pb-1 mb-1 text-[#3b82f6]">歷史趨勢追蹤</h4>
                    
                    <div className="flex items-center gap-2 bg-zinc-50 border-[3px] border-black py-1 px-2 rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <Label className="font-bold text-sm sm:text-base whitespace-nowrap">參考期數</Label>
                      <Slider
                        value={[analysisRangeCount]}
                        min={5}
                        max={50}
                        step={1}
                        onValueChange={(val) => {
                          const newValue = Array.isArray(val) ? val[0] : val;
                          setAnalysisRangeCount(newValue as number);
                        }}
                        className="py-1 flex-1 cursor-pointer"
                      />
                      <span className="font-black text-sm sm:text-base bg-black text-white px-2 py-0.5 rounded shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                        {analysisRangeCount} 期
                      </span>
                    </div>

                    {/* Aggregated Stats */}
                    <div className="flex flex-col gap-2 sm:gap-3">
                      <div className="bg-zinc-50 border-[3px] border-black rounded-xl p-2 sm:p-3 flex flex-col gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <span className="text-sm font-bold text-zinc-500 uppercase">
                          {recentDraws.length > 0 ? `第 ${startDisplayNumber} - ${endDisplayNumber} 期 總體大小分佈` : "暫無足夠歷史數據"}
                        </span>
                        <div className="flex gap-2 text-sm sm:text-lg font-black flex-wrap">
                          {aggSizeDist.map(dist => (
                            <div key={dist.label} className="flex bg-white border-2 border-black rounded px-1.5 py-0.5 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                              <span className="text-zinc-600 mr-1">{dist.label}:</span>
                              <span className={dist.count > 0 ? "text-[#3b82f6]" : "text-zinc-300"}>{dist.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="bg-zinc-50 border-[3px] border-black rounded-xl p-2 sm:p-3 flex flex-col gap-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <span className="text-sm font-bold text-zinc-500 uppercase">
                           {recentDraws.length > 0 ? `第 ${startDisplayNumber} - ${endDisplayNumber} 期 總體單雙分佈` : "暫無足夠歷史數據"}
                        </span>
                        <span className="text-xl sm:text-2xl font-black">{aggOddCount} 單 : {aggEvenCount} 雙</span>
                      </div>
                    </div>
                  </div>

                  {/* Number Breakdowns */}
                  <div className="space-y-2">
                    <h4 className="font-black text-xl sm:text-2xl border-b-[3px] border-black pb-1 mb-1">
                      於第 {startDisplayNumber} - {endDisplayNumber} 期內的歷史出現頻率
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      {drawNumbers.map((num, i) => {
                        const isSpecial = i === 6;
                        const appearedIn: number[] = [];
                        recentDraws.forEach((pastDraw, pastIndex) => {
                          if (pastDraw.includes(num)) appearedIn.push(startDisplayNumber + pastIndex);
                        });
                        
                        const color = getBallColor(num);
                        const bgColor = color === "red" ? "bg-[#FF4D4D]" : color === "blue" ? "bg-[#3b82f6]" : "bg-[#22c55e]";

                        return (
                          <div key={i} className="flex gap-2 sm:gap-3 items-center p-2 sm:p-3 bg-zinc-50 border-[3px] border-black rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                              <div className={`w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full border-[3px] border-black flex items-center justify-center font-black text-xl sm:text-2xl text-black ${bgColor} ${isSpecial ? "border-dashed opacity-90 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" : "shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"}`}>
                                {num}
                              </div>
                              <div className="flex flex-col gap-0">
                                <span className="font-black text-lg sm:text-xl">
                                  {isSpecial && "特碼 "}
                                  過去 <span className="text-[#3b82f6]">{recentDraws.length}</span> 期中出現 <span className="text-[#3b82f6] text-2xl">{appearedIn.length}</span> 次
                                </span>
                                <span className="text-sm sm:text-base font-bold text-zinc-600 leading-tight">
                                  {appearedIn.length > 0 ? `(見於: 第 ${appearedIn.join(", ")} 期)` : "無歷史出現紀錄"}
                                </span>
                              </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!errorModal} onOpenChange={(open) => !open && setErrorModal(null)}>
        <DialogContent className="sm:max-w-md border-4 border-black rounded-3xl shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] p-0 overflow-hidden">
          <DialogHeader className="bg-[#FF4D4D] border-b-4 border-black p-6">
            <DialogTitle className="text-2xl font-black text-white flex items-center gap-2">
              <AlertCircle className="w-8 h-8" />
              生成提示
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 bg-white">
            <div className="text-lg font-bold text-black whitespace-pre-line leading-relaxed">
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

      {/* Hidden container exclusively formatted for Screenshot output */}
      <div className="fixed top-0 left-0 -z-50 pointer-events-none opacity-0 overflow-hidden w-0 h-0">
        <div id="capture-area" className={`bg-[#1e1e1e] font-sans flex flex-col p-8 items-center ${generatedBets.length >= 13 ? 'w-[1450px]' : generatedBets.length >= 11 ? 'w-[1000px]' : 'w-[500px]'}`}>
          <h1 className="text-[40px] font-black tracking-widest mb-6 text-[#FFE867] leading-none">
            您的幸運號碼
          </h1>
          <div className={`w-full ${generatedBets.length >= 13 ? 'grid grid-cols-3 gap-x-8 gap-y-5' : generatedBets.length >= 11 ? 'grid grid-cols-2 gap-x-8 gap-y-5' : 'flex flex-col gap-5'}`}>
            {generatedBets.map((bet, index) => (
              <div key={index} className="flex items-center w-full bg-white border-[4px] border-black rounded-3xl h-[70px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] box-border px-4 py-2 relative overflow-visible">
                <div className="flex items-center gap-1 w-full justify-between pr-2">
                  <div className="text-2xl font-black text-black w-12 text-center transform -rotate-[10deg] shrink-0">
                    #{index + 1}
                  </div>
                  <div className="flex gap-2.5">
                    {bet.map((num, i) => {
                      const color = getBallColor(num);
                      const bgColor = color === "red" ? "bg-[#FF4D4D]" : color === "blue" ? "bg-[#3b82f6]" : "bg-[#22c55e]";
                      return (
                        <div
                          key={i}
                          className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-black font-black text-2xl border-[3px] border-black ${bgColor}`}
                        >
                          {num.toString().padStart(2, "0")}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 mb-2 text-zinc-400 text-[15px] font-bold tracking-widest">
            此號碼生成系統由池記桌遊提供
          </div>
        </div>
      </div>

      <Dialog open={isCheckDialogOpen} onOpenChange={setIsCheckDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-2xl bg-[#fff7ed] border-4 border-black rounded-3xl p-0 overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <DialogHeader className="bg-[#ffedd5] border-b-4 border-black p-4 sm:p-5 m-0 relative">
            <DialogTitle className="text-xl sm:text-2xl font-black flex items-center gap-2">
              <SearchCheck className="w-6 h-6 sm:w-7 sm:h-7" />
              核對中獎號碼
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 sm:p-5 space-y-4">
            <div className="space-y-2">
              <Label className="font-black text-base sm:text-lg">選擇您想核對的開彩期數：</Label>
              <Select value={checkDrawIndex.toString()} onValueChange={(val) => {
                setCheckDrawIndex(parseInt(val, 10));
                setCheckResults(null); 
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

            <Tabs value={checkMethod} onValueChange={(val) => { setCheckMethod(val as any); setCheckResults(null); }} className="w-full">
              <TabsList className="grid grid-cols-3 gap-2 bg-transparent h-auto w-full mb-2">
                <TabsTrigger value="current" className="w-full font-bold text-xs sm:text-sm py-2 px-1 bg-zinc-200 border-2 border-black data-[state=active]:bg-[#FFE867] data-[state=active]:border-2 data-[state=active]:border-black data-[state=active]:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-xl transition-all whitespace-normal h-auto min-h-[44px]">當前號碼</TabsTrigger>
                <TabsTrigger value="upload" className="w-full font-bold text-xs sm:text-sm py-2 px-1 bg-zinc-200 border-2 border-black data-[state=active]:bg-[#FFE867] data-[state=active]:border-2 data-[state=active]:border-black data-[state=active]:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-xl transition-all whitespace-normal h-auto min-h-[44px]">上傳截圖</TabsTrigger>
                <TabsTrigger value="manual" className="w-full font-bold text-xs sm:text-sm py-2 px-1 bg-zinc-200 border-2 border-black data-[state=active]:bg-[#FFE867] data-[state=active]:border-2 data-[state=active]:border-black data-[state=active]:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-xl transition-all whitespace-normal h-auto min-h-[44px]">手動輸入</TabsTrigger>
              </TabsList>

              <TabsContent value="current" className="mt-0">
                {generatedBets.length > 0 ? (
                  <Button 
                    onClick={() => handlePerformCheck(generatedBets)}
                    className="w-full bg-[#FFE867] hover:bg-[#FFD700] text-black border-4 border-black font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all rounded-xl h-11 text-base mt-2"
                  >
                    核對當前生成的 {generatedBets.length} 注號碼
                  </Button>
                ) : (
                  <p className="text-zinc-500 font-bold text-center mt-4">請先生成號碼，或選擇其他核對方式。</p>
                )}
              </TabsContent>

              <TabsContent value="upload" className="mt-0">
                <div className="flex flex-col items-center justify-center p-6 border-4 border-dashed border-zinc-300 rounded-2xl bg-white text-center hover:border-black hover:bg-zinc-50 cursor-pointer transition-all relative">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleScreenshotUploadForCheck}
                    disabled={isCheckingScreenshot}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                  />
                  {isCheckingScreenshot ? (
                    <RefreshCw className="w-8 h-8 mb-2 animate-spin text-zinc-500" />
                  ) : (
                    <Upload className="w-8 h-8 mb-2 text-zinc-500" />
                  )}
                  <p className="font-black text-black">點擊或拖曳上傳截圖</p>
                  <p className="text-xs font-bold text-zinc-500 mt-1">系統將自動辨識號碼</p>
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

            {checkResults && (
              <div className="mt-6 pt-6 border-t-4 border-dashed border-black/20 space-y-3">
                <h3 className="font-black text-lg text-black text-center mb-4">✨ 核對結果 ✨</h3>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 hide-scrollbar">
                  {checkResults.map((res, i) => {
                    const matchCount = res.matches.length;
                    const hasSpecial = res.specialMatch;
                    const isWin = matchCount >= 3 || (matchCount >= 2 && hasSpecial); // Simplified winning rule concept

                    return (
                      <div key={i} className={`flex items-center justify-between p-3 border-[3px] border-black rounded-xl font-bold bg-white ${isWin ? 'shadow-[4px_4px_0px_0px_#FFE867] border-[#FF4D4D]' : 'opacity-80'}`}>
                        <div className="flex flex-col">
                          <span className="text-sm">註 #{i+1}</span>
                          <span className="text-xs text-zinc-500">
                            中 {matchCount} 個正碼 
                            {hasSpecial && <span className="text-[#FF4D4D] ml-1 font-black">+ 特別號碼</span>}
                          </span>
                        </div>
                        {isWin ? (
                          <div className="bg-[#FF4D4D] text-white text-xs px-2 py-1 rounded-md border-2 border-black transform rotate-3">
                            中獎！
                          </div>
                        ) : (
                          <span className="text-sm text-zinc-400">未中獎</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Toaster position="top-center" toastOptions={{
        classNames: {
          toast: "group !bg-white data-[type=success]:!bg-[#FFE867] !border-[3px] !border-black !rounded-2xl !shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:!border-4 sm:!shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-black font-black text-[15px] sm:text-lg px-4 py-3 sm:px-5 sm:py-4 flex gap-3 w-full items-start",
          title: "font-black text-black",
          icon: "mt-0.5 group-data-[type=success]:text-black group-data-[type=error]:text-[#FF4D4D] group-data-[type=info]:text-[#3b82f6] [&>svg]:w-6 [&>svg]:h-6 sm:[&>svg]:w-7 sm:[&>svg]:h-7 [&>svg]:stroke-[3]"
        }
      }} />
    </div>
  );
}
