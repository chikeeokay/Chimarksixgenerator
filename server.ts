import express from "express";
import path from "path";
import fetch from "node-fetch"; // Native fetch is available in node 18+, but we use global fetch
import * as cheerio from 'cheerio';
import { MOCK_PAST_RESULTS } from "./lib/marksix.ts";
import { GoogleGenAI } from "@google/genai";

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

  app.get("/api/marksix", async (req, res) => {
    try {
      const draws: {numbers: number[], date: string, firstPrize?: number, firstPrizeWinners?: number}[] = [];
      const seen = new Set<string>();

      const years = [2026, 2025, 2024];
      for (const year of years) {
        try {
          const response = await fetch(`https://on99.life/lottery/history/${year}`);
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
                                    const firstPrize = p.prizeBreakdown?.firstPrize?.totalPayout || p.jackpotAmount || p.prizeBreakdown?.firstPrize?.prizeAmount;
                                    const firstPrizeWinners = p.prizeBreakdown?.firstPrize?.winnersCount;
                                    const formattedDate = date.includes('-') ? date.split('-').join('/') : date;

                                    const drawStr = numbers.join(',');
                                    if (!seen.has(drawStr)) {
                                        seen.add(drawStr);
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
      }

      // Fallback Dates
      for (const mockDrawObj of MOCK_PAST_RESULTS) {
        const mockArray = Array.isArray(mockDrawObj) ? mockDrawObj : mockDrawObj.numbers;
        const mockDate = !Array.isArray(mockDrawObj) && mockDrawObj.date ? mockDrawObj.date : `Past Draw`;
        
        const drawStr = mockArray.join(',');
        if (!seen.has(drawStr)) {
          seen.add(drawStr);
          draws.push({numbers: mockArray, date: mockDate});
        }
      }
      
      let nextDrawFound: any = null;
      // Fetch 最新和下一期 from HKJC GraphQL
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
        const hkjcRes = await fetch("https://info.cld.hkjc.com/graphql/base/", {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
          body: JSON.stringify({ query, operationName: "marksixDraw" })
        });
        const hkjcData = await hkjcRes.json();
        const lotteryDraws = hkjcData?.data?.lotteryDraws || [];
        
        for (const draw of lotteryDraws) {
          const date = draw.drawDate ? draw.drawDate.split('+')[0].replace(/-/g, '/') : '';
          if (draw.status === "Defined" || (draw.status !== "Result" && !draw.drawResult?.drawnNo?.length)) {
             // This is the next draw
             if (!nextDrawFound) {
                 nextDrawFound = {
                     date,
                     estimatedJackpot: parseInt(draw.lotteryPool?.derivedFirstPrizeDiv) || parseInt(draw.lotteryPool?.jackpot) || 8000000
                 };
             }
          } else if (draw.status === "Result" && draw.drawResult?.drawnNo?.length === 6) {
             // This is a past draw, make sure it's in our draws array
             const numbers = [...draw.drawResult.drawnNo, draw.drawResult.xDrawnNo];
             const drawStr = numbers.join(',');
             if (!seen.has(drawStr)) {
                 seen.add(drawStr);
                 let firstPrizeWinners = 0;
                 if (draw.lotteryPool?.lotteryPrizes) {
                     const fPrize = draw.lotteryPool.lotteryPrizes.find((p:any) => p.type === 1);
                     if (fPrize) firstPrizeWinners = fPrize.winningUnit;
                 }
                 draws.push({
                     numbers,
                     date,
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
              const currentDay = lastDateObj.getDay(); // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat
              if (currentDay === 2) addDays = 2; // Tue -> Thu
              else if (currentDay === 4) addDays = 2; // Thu -> Sat
              else if (currentDay === 6) addDays = 3; // Sat -> Tue
              else addDays = 2; // Fallback
              
              lastDateObj.setDate(lastDateObj.getDate() + addDays);
              
              const yyyy = lastDateObj.getFullYear();
              const mm = String(lastDateObj.getMonth() + 1).padStart(2, '0');
              const dd = String(lastDateObj.getDate()).padStart(2, '0');
              
              nextDraw = {
                  date: `${yyyy}/${mm}/${dd}`,
                  estimatedJackpot: 8000000 // default minimum jackpot
              };
          }
      }

      res.json({ success: true, draws, nextDraw });
    } catch (error: any) {
      console.error("Error fetching Mark Six info:", error);
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
