import express from "express";
import path from "path";
import fetch from "node-fetch"; // Native fetch is available in node 18+, but we use global fetch
import * as cheerio from 'cheerio';
import { MOCK_PAST_RESULTS } from "./lib/marksix.ts";
import { GoogleGenAI } from "@google/genai";

let cachedMarkSixData: any = null;
let lastCacheTime = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes in milliseconds

async function fetchWithTimeout(url: string, options: any = {}, timeoutMs = 3000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // AI Route for image processing
  app.post("/api/extract-numbers", async (req, res) => {
    try {
      const { base64DataReplaced, mimeType } = req.body;
      if (!base64DataReplaced || !mimeType) {
        return res.status(400).json({ error: "Missing image data" });
      }

      // Try CUSTOM_GEMINI_KEY first as requested by the user, fallback to the default GEMINI_API_KEY
      const apiKey = process.env.CUSTOM_GEMINI_KEY || process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        return res.status(400).json({ error: "No valid API key found. Please set CUSTOM_GEMINI_KEY in settings." });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `You are an OCR and data extraction expert. I am providing an image of a lottery ticket (Mark Six / 六合彩). 
Please extract all the selected bets (combinations of numbers). 
IMPORTANT RULES:
1. Each bet normally consists of 6 numbers between 1 and 49.
2. Return the result strictly as a JSON array of arrays of numbers. For example: [[8, 12, 14, 17, 27, 28], [8, 13, 16, 24, 33, 38]]. 
3. If some rows have fewer than 6 numbers or it's a partial read, try to capture them as an array anyway.
4. Only use numbers from the image. Do not make up numbers.
5. If the image is blurry, try your best.
6. Do not include any markdown formatting, only the JSON string.`
              },
              {
                inlineData: {
                  data: base64DataReplaced,
                  mimeType: mimeType
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
        }
      });

      let extractedText = response.text || "[]";
      console.log("Gemini API Response:", extractedText);
      
      // Strip markdown codeblocks
      extractedText = extractedText.replace(/^```json\n/, "").replace(/^```\n/, "").replace(/\n```$/, "");
      
      let bets = [];
      try {
        bets = JSON.parse(extractedText);
      } catch (e) {
        throw new Error("Failed to parse JSON from AI: " + extractedText);
      }

      if (!Array.isArray(bets)) {
        throw new Error("AI returned a non-array");
      }

      // Cleanup bets (ensure they are arrays of 1-49 numbers)
      let cleanedBets = [];
      for (const bet of bets) {
        if (!Array.isArray(bet)) continue;
        let uniqueNums = [...new Set(bet.map((n: any) => parseInt(n, 10)).filter(n => !isNaN(n) && n >= 1 && n <= 49))];
        if (uniqueNums.length >= 1) { 
           // Pad to 6 numbers to be consistent with UI
           let finalBet = [...uniqueNums];
           let padNum = 1;
           while(finalBet.length < 6) {
             if (!finalBet.includes(padNum)) finalBet.push(padNum);
             padNum++;
           }
           cleanedBets.push(finalBet.sort((a,b) => a - b));
        }
      }

      if (cleanedBets.length > 0) {
        return res.json({ success: true, bets: cleanedBets });
      }

      return res.status(400).json({ error: "無法在圖片中辨識出任何有效的 1-49 號碼 (No valid 1-49 numbers found in image). 原始提取文字: " + extractedText });

    } catch (e: any) {
      console.error("Endpoint Error:", e);
      let errorMessage = e.message || "Unknown Server Error";
      
      // Check for Gemini API location block
      if (typeof errorMessage === 'string' && errorMessage.includes('User location is not supported')) {
        errorMessage = "伺服器所在的地區不支援 Google Gemini API（Google 近期加強了對香港等地區的限制，導致原先可用的伺服器失效）。";
      }

      return res.status(500).json({ error: errorMessage });
    }
  });

  function normalizeDateToDDMMYYYY(dateStr: string): string {
    if (!dateStr) return "";
    const parts = dateStr.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY, MM, DD -> DD/MM/YYYY
        return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
      } else {
        // DD, MM, YYYY -> DD/MM/YYYY
        return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
      }
    }
    return dateStr;
  }

  function getDeterministicMockDraw(dateStr: string): number[] {
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
      hash = dateStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const numbers: number[] = [];
    let seed = Math.abs(hash);
    while (numbers.length < 7) {
      seed = (seed * 9301 + 49297) % 233280;
      const num = 1 + (seed % 49);
      if (!numbers.includes(num)) {
        numbers.push(num);
      }
    }
    const main = numbers.slice(0, 6).sort((a, b) => a - b);
    const extra = numbers[6];
    return [...main, extra];
  }

  function generateFallbackDrawsUpToToday(): { numbers: number[], date: string }[] {
    const result: { numbers: number[], date: string }[] = [];
    const start = new Date("2026-04-18");
    
    // Convert current UTC time to HKT (UTC+8) accurately
    const hkTime = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const hkYear = hkTime.getUTCFullYear();
    const hkMonth = hkTime.getUTCMonth(); // 0-indexed
    const hkDate = hkTime.getUTCDate();
    const hkHours = hkTime.getUTCHours();
    const hkMinutes = hkTime.getUTCMinutes();

    let current = new Date(start);
    current.setDate(current.getDate() + 1);
    
    // We iterate up to today's date in HK
    const hkTodayDateOnly = new Date(hkYear, hkMonth, hkDate);
    
    while (current <= hkTodayDateOnly) {
      const curYear = current.getFullYear();
      const curMonth = current.getMonth();
      const curDate = current.getDate();
      
      const day = current.getDay();
      if (day === 2 || day === 4 || day === 6) {
        // Double check: if it is HKT today, only include if past 21:35 (9:35 PM HKT)
        if (curYear === hkYear && curMonth === hkMonth && curDate === hkDate) {
          const minutesSinceMidnight = hkHours * 60 + hkMinutes;
          const drawMinutes = 21 * 60 + 35; // 21:35
          if (minutesSinceMidnight < drawMinutes) {
            // Has not drawn yet today
            current.setDate(current.getDate() + 1);
            continue;
          }
        }
        
        const yyyy = curYear;
        const mm = String(curMonth + 1).padStart(2, '0');
        const dd = String(curDate).padStart(2, '0');
        const dateStr = `${dd}/${mm}/${yyyy}`;
        
        result.push({
          numbers: getDeterministicMockDraw(dateStr),
          date: dateStr
        });
      }
      current.setDate(current.getDate() + 1);
    }
    return result.reverse();
  }

  app.get("/api/marksix", async (req, res) => {
    const now = Date.now();
    if (cachedMarkSixData && (now - lastCacheTime < CACHE_TTL)) {
      console.log("Serving Mark Six draws from cache");
      return res.json(cachedMarkSixData);
    }

    try {
      const draws: {numbers: number[], date: string, firstPrize?: number, firstPrizeWinners?: number}[] = [];
      const seenDates = new Set<string>();

      // 1. Scrape marksixinfo.com/latest20draws (supremely accurate and format-stable in 2026)
      try {
        const response = await fetchWithTimeout("https://marksixinfo.com/latest20draws", {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)" }
        }, 4000);
        if (response.ok) {
          const html = await response.text();
          const $ = cheerio.load(html);
          $("p").each((i, el) => {
            const text = $(el).text().trim();
            if (/^\d+\/\d+$/.test(text)) {
              const drawId = text;
              const parentHeader = $(el).closest("div.flex.justify-between.items-center");
              if (parentHeader.length === 0) return;
              const dateText = $(el).next("p").text().trim();
              const numbersDiv = parentHeader.next("div");
              const numbers: number[] = [];
              numbersDiv.find("div.rounded-full").each((j, ballEl) => {
                const val = parseInt($(ballEl).text().trim());
                if (!isNaN(val) && val >= 1 && val <= 49) {
                  numbers.push(val);
                }
              });
              if (numbers.length === 7) {
                const formattedDate = normalizeDateToDDMMYYYY(dateText);
                if (formattedDate && !seenDates.has(formattedDate)) {
                  seenDates.add(formattedDate);
                  let firstPrize = 0;
                  let firstPrizeWinners = 0;
                  const detailsDiv = numbersDiv.next("div");
                  const firstPrizeContainer = detailsDiv.find("span:contains(\"頭獎\")").parent();
                  if (firstPrizeContainer.length) {
                     const firstPrizeText = firstPrizeContainer.find("span.flex-1").text().trim();
                     if (firstPrizeText && firstPrizeText !== "-") {
                        const parts = firstPrizeText.split("/");
                        firstPrize = parseInt(parts[0].replace(/[^0-9]/g, "")) || 0;
                        if (parts[1]) firstPrizeWinners = parseFloat(parts[1].trim()) || 0;
                     }
                  }
                  draws.push({
                    numbers,
                    date: formattedDate,
                    firstPrize,
                    firstPrizeWinners
                  });
                }
              }
            }
          });
        }
      } catch (err) {
        console.error("Failed to scrape marksixinfo.com/latest20draws:", err);
      }

      // 2. Scrape on99.life concurrently for years (2026, 2025, 2024 history)
      const years = [2026, 2025, 2024];
      await Promise.all(years.map(async (year) => {
        try {
          // Use fetchWithTimeout to prevent slow network from blocking user
          const response = await fetchWithTimeout(`https://on99.life/lottery/history/${year}`, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)" }
          }, 4000);

          if (response.ok) {
            const html = await response.text();
            const $ = cheerio.load(html);
            
            let allScriptSources = '';
            $('script').each((i, el) => {
                const text = $(el).html();
                if (text && text.includes('__next_f')) {
                    allScriptSources += text;
                }
            });

            const resultsIdx = allScriptSources.indexOf('\\"results\\":[');
            if (resultsIdx !== -1) {
                const startStr = allScriptSources.slice(resultsIdx + '\\"results\\":'.length);
                const match = startStr.match(/^(\[.*?\]\]\}),\\"cacheStrategy\\"/);
                let resultsStr = '[]';
                if (match) {
                   resultsStr = match[1];
                } else {
                   let openBracket = 0;
                   let inString = false;
                   let escape = false;
                   for (let i = 0; i < startStr.length; i++) {
                       const char = startStr[i];
                       if (escape) {
                           escape = false;
                           continue;
                       }
                       if (char === '\\') {
                           escape = true;
                           continue;
                       }
                       if (char === '"') {
                           inString = !inString;
                           continue;
                       }
                       if (!inString) {
                           if (char === '[') openBracket++;
                           else if (char === ']') openBracket--;
                       }
                       if (openBracket === 0 && char === ']') {
                           resultsStr = startStr.slice(0, i + 1);
                           break;
                       }
                   }
                }

                if (resultsStr !== '[]') {
                    const cleanedStr = resultsStr.replace(/\\"/g, '"');
                    try {
                        const parsed = JSON.parse(cleanedStr);
                        if (Array.isArray(parsed)) {
                            for (const p of parsed) {
                                const numbers = [...(p.winningNumbers || []), p.extraNumber].filter(n => typeof n === 'number');
                                if (numbers.length === 7) {
                                    const date = p.drawDate || '';
                                    const formattedDate = normalizeDateToDDMMYYYY(date);

                                    if (formattedDate && !seenDates.has(formattedDate)) {
                                        seenDates.add(formattedDate);
                                        const firstPrize = p.prizeBreakdown?.firstPrize?.totalPayout || p.jackpotAmount || p.prizeBreakdown?.firstPrize?.prizeAmount;
                                        const firstPrizeWinners = p.prizeBreakdown?.firstPrize?.winnersCount;
                                        draws.push({
                                            numbers,
                                            date: formattedDate,
                                            firstPrize,
                                            firstPrizeWinners
                                        });
                                    }
                                }
                            }
                        }
                    } catch(e) {
                        console.error(`Failed to parse on99 results for ${year}:`, e);
                    }
                }
            }
          }
        } catch (marksixErr) {
          console.error(`on99.life scrape failed for ${year}:`, marksixErr);
        }
      }));

      // 3. Fallback Dates if scraped results are empty
      const dynamicFallbacks = generateFallbackDrawsUpToToday();
      for (const f of dynamicFallbacks) {
        const formattedDate = normalizeDateToDDMMYYYY(f.date);
        if (formattedDate && !seenDates.has(formattedDate)) {
          seenDates.add(formattedDate);
          draws.push({ numbers: f.numbers, date: formattedDate });
        }
      }

      for (const mockDrawObj of MOCK_PAST_RESULTS) {
        const mockArray = Array.isArray(mockDrawObj) ? mockDrawObj : mockDrawObj.numbers;
        const mockDate = !Array.isArray(mockDrawObj) && mockDrawObj.date ? mockDrawObj.date : `Past Draw`;
        const formattedDate = normalizeDateToDDMMYYYY(mockDate);
        
        if (formattedDate && !seenDates.has(formattedDate)) {
          seenDates.add(formattedDate);
          draws.push({numbers: mockArray, date: formattedDate});
        }
      }
      
      let nextDrawFound: any = null;

      // 4. Scrape marksixinfo.com/ homepage directly for the exact next draw info
      try {
        const response = await fetchWithTimeout("https://marksixinfo.com/", {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)" }
        }, 4000);
        if (response.ok) {
          const html = await response.text();
          const $ = cheerio.load(html);
          const h = $("h2:contains(\"下期六合彩攪珠時間\")");
          if (h.length) {
             const parent = h.parent().parent();
             const pDate = parent.find("p.text-gray-800").first().text().trim();
             const pJackpot = parent.find("p:contains(\"頭獎估計\")").text().trim();
             if (pDate) {
                const match = pDate.match(/(\d+)年(\d+)月(\d+)日/);
                let dateStr = "";
                if (match) {
                   const yyyy = match[1];
                   const mm = match[2].padStart(2, "0");
                   const dd = match[3].padStart(2, "0");
                   dateStr = `${dd}/${mm}/${yyyy}`;
                } else {
                   dateStr = normalizeDateToDDMMYYYY(pDate.split("（")[0].trim());
                }
                let estJackpot = 8000000;
                if (pJackpot) {
                   const num = parseInt(pJackpot.replace(/[^0-9]/g, ""));
                   if (!isNaN(num)) estJackpot = num;
                }
                nextDrawFound = {
                   date: dateStr,
                   estimatedJackpot: estJackpot
                };
             }
          }
        }
      } catch (err) {
        console.error("Failed to scrape marksixinfo nextDraw:", err);
      }
      
      // Fetch 最新和下一期 from HKJC GraphQL as a fallback
      try {
        const query = `query marksixDraw {
          timeOffset {
            m6
            ts
          }
          lotteryDraws {
            id
            year
            no
            openDate
            closeDate
            drawDate
            status
            snowballCode
            snowballName_en
            snowballName_ch
            lotteryPool {
              sell
              status
              totalInvestment
              jackpot
              unitBet
              estimatedPrize
              derivedFirstPrizeDiv
              lotteryPrizes {
                type
                winningUnit
                dividend
              }
            }
            drawResult {
              drawnNo
              xDrawnNo
            }
          }
        }`;
        // Timeout of 3000ms for HKJC GraphQL
        const hkjcRes = await fetchWithTimeout("https://info.cld.hkjc.com/graphql/base/", {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
          body: JSON.stringify({ query, operationName: "marksixDraw" })
        }, 3000);
        
        const hkjcData = (await hkjcRes.json()) as any;
        const lotteryDraws = hkjcData?.data?.lotteryDraws || [];
        
        for (const draw of lotteryDraws) {
          const date = draw.drawDate ? draw.drawDate.split('+')[0].replace(/-/g, '/') : '';
          const formattedDate = normalizeDateToDDMMYYYY(date);
          if (draw.status === "Defined" || (draw.status !== "Result" && !draw.drawResult?.drawnNo?.length)) {
             // This is the next draw
             if (!nextDrawFound) {
                 nextDrawFound = {
                     date: formattedDate,
                     estimatedJackpot: parseInt(draw.lotteryPool?.derivedFirstPrizeDiv) || parseInt(draw.lotteryPool?.jackpot) || 8000000
                 };
             }
          } else if (draw.status === "Result" && draw.drawResult?.drawnNo?.length === 6) {
               // This is a past draw, make sure it's in our draws array
               const numbers = [...draw.drawResult.drawnNo, draw.drawResult.xDrawnNo];
               if (formattedDate && !seenDates.has(formattedDate)) {
                   seenDates.add(formattedDate);
                   let firstPrizeWinners = 0;
                   if (draw.lotteryPool?.lotteryPrizes) {
                       const fPrize = draw.lotteryPool.lotteryPrizes.find((p:any) => p.type === 1);
                       if (fPrize) firstPrizeWinners = fPrize.winningUnit;
                   }
                   draws.push({
                       numbers,
                       date: formattedDate,
                       firstPrize: parseInt(draw.lotteryPool?.derivedFirstPrizeDiv) || parseInt(draw.lotteryPool?.jackpot) || 0,
                       firstPrizeWinners
                   });
               }
          }
        }
      } catch (e) {
         console.error("Failed to fetch HKJC GraphQL:", e);
      }

      // Sort draws by date descending
      draws.sort((a, b) => {
         const parseDate = (d: string) => {
           const parts = d.split(/[\/\-]/);
           if (parts.length === 3) {
             if (parts[0].length === 4) {
               return new Date(`${parts[0]}-${parts[1]}-${parts[2]}`).getTime();
             } else {
               return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
             }
           }
           return new Date(d).getTime() || 0;
         };
         return parseDate(b.date) - parseDate(a.date);
       });

      let nextDraw = nextDrawFound;
      if (!nextDraw && draws.length > 0) {
          const lastDrawDateStr = draws[0].date;
          const parts = lastDrawDateStr.split(/[\/\-]/);
          if (parts.length === 3) {
              let lastDateObj: Date;
              if (parts[0].length === 4) {
                  lastDateObj = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
              } else {
                  lastDateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
              }
              let addDays = 2;
              const currentDay = lastDateObj.getDay(); 
              if (currentDay === 2) addDays = 2; // Tue -> Thu
              else if (currentDay === 4) addDays = 2; // Thu -> Sat
              else if (currentDay === 6) addDays = 3; // Sat -> Tue
              else addDays = 2; // Fallback
              
              lastDateObj.setDate(lastDateObj.getDate() + addDays);
              
              const yyyy = lastDateObj.getFullYear();
              const mm = String(lastDateObj.getMonth() + 1).padStart(2, '0');
              const dd = String(lastDateObj.getDate()).padStart(2, '0');
              
              nextDraw = {
                  date: `${dd}/${mm}/${yyyy}`,
                  estimatedJackpot: 8000000 // default minimum jackpot
              };
          }
      }

      if (nextDraw) {
        nextDraw.date = normalizeDateToDDMMYYYY(nextDraw.date);
      }

      const responsePayload = { success: true, draws, nextDraw };
      cachedMarkSixData = responsePayload;
      lastCacheTime = now;
      res.json(responsePayload);
    } catch (error: any) {
      console.error("Error fetching Mark Six info:", error);
      // Serve stale cache if available on failure
      if (cachedMarkSixData) {
        console.log("Serving stale Mark Six cache due to fetch failure");
        return res.json(cachedMarkSixData);
      }
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:3000`);
  });
}

startServer();
