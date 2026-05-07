import express from "express";
import path from "path";
import fetch from "node-fetch"; // Native fetch is available in node 18+, but we use global fetch
import * as cheerio from 'cheerio';
import { MOCK_PAST_RESULTS } from "./lib/marksix.ts";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

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
        errorMessage = "伺服器所在的地區不支援 Google Gemini API（Google 近期加強了對香港等地區的限制，導致原先可用的伺服器失效）。\n\n解決方案：\n1. 請在 Render 上「建立一個全新的 Web Service」，於 Region 選擇美國 (Oregon/Ohio) 或歐洲 (Frankfurt)。\n2. 將您的自訂網域綁定到新服務，這樣您的用戶就完全不受網址改變影響！\n\n【在 Render 設定 custom domain 教學】\n- 前往新 Web Service 的「Settings」頁面，找到「Custom Domains」板塊。\n- 輸入您的網域 `chikeechi.com` 並點擊「Add Domain」。\n- Render 會提供一組 DNS 紀錄（通常是 CNAME 或 A Record）。\n- 登入您的網域供應商 (例如 Cloudflare, GoDaddy 等)，在 DNS 設定中加入該組紀錄。\n- 等待生效後，您就可以繼續用原來的網址運作了！\n\n(註：只要伺服器位於支援地區，香港本地用戶即可正常使用，完全不需要 VPN！)";
      } else if (typeof errorMessage === 'string' && (errorMessage.includes('429') || errorMessage.includes('Quota exceeded') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('Too Many Requests'))) {
        errorMessage = "Google Gemini API 請求配額已達上限。\n\n目前的 Google 帳號免費額度（每日或每分鐘）已經用盡。請稍後（約 1 分鐘後）再試！若頻繁出現此錯誤，可能需要更換 API 密鑰。";
      }

      return res.status(500).json({ error: errorMessage });
    }
  });

  // API Route to fetch latest marksix results
  app.get("/api/marksix", async (req, res) => {
    try {
      const draws: {numbers: number[], date: string}[] = [];
      const seen = new Set<string>();

      try {
        const iconv = await import("iconv-lite");
        const lottoRes = await fetch("https://www.lotto-8.com/listltohk.asp", {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          }
        });
        if (lottoRes.ok) {
          const buffer = await lottoRes.arrayBuffer();
          const lottoHtml = iconv.default.decode(Buffer.from(buffer), 'big5');
          const $ = cheerio.load(lottoHtml);
          
          let currentDate = "";
          let currentNums: number[] = [];
          
          // Parse lotto-8 layout
          // They use table rows or divs containing the date and then the numbers
          $('*').each((i, el) => {
             const t = $(el).text().trim();
             // Match date like 2026/05/07
             if (/^\d{4}\/\d{2}\/\d{2}$/.test(t) && $(el).children().length === 0) {
                 if (currentNums.length === 7 && currentDate) {
                     const drawStr = currentNums.join(',');
                     if (!seen.has(drawStr)) {
                         seen.add(drawStr);
                         draws.push({ numbers: currentNums, date: currentDate });
                     }
                 }
                 currentDate = t;
                 currentNums = [];
             } else if (/^\d{2}$/.test(t) && currentDate && $(el).children().length === 0) {
                 const n = parseInt(t, 10);
                 if (n >= 1 && n <= 49) {
                     currentNums.push(n);
                 }
                 if (currentNums.length === 7) {
                     const drawStr = currentNums.join(',');
                     if (!seen.has(drawStr)) {
                         seen.add(drawStr);
                         draws.push({ numbers: currentNums, date: currentDate });
                     }
                     currentDate = "";
                     currentNums = [];
                 }
             }
          });
        }
      } catch(lottoErr) {
        console.error("Lotto-8 scrape failed:", lottoErr);
      }

      // Try fetching from marksixinfo.com as fallback
      try {
        const response = await fetch('https://marksixinfo.com/latest20draws');
        if (response.ok) {
          const html = await response.text();
          const $ = cheerio.load(html);
          
          const numDivs: number[] = [];
          $('*').each((i, el) => {
            const text = $(el).text().trim();
            if (/^\d{1,2}$/.test(text) && $(el).children().length === 0) {
              const num = parseInt(text, 10);
              if (num >= 1 && num <= 49) {
                numDivs.push(num);
              }
            }
          });
          
          const dateTextRegex = /\d{4}-\d{2}-\d{2}/;
          const allTexts = $('*').map((i, el) => $(el).text().trim()).get();
          const dates = allTexts.filter(text => dateTextRegex.test(text)).filter(text => text.length === 10); // Find YYYY-MM-DD
          const uniqueDates = [...new Set(dates)].map(d => {
            const parts = d.split('-');
            if (parts.length === 3) return `${parts[0]}/${parts[1]}/${parts[2]}`; // Changed to YYYY/MM/DD format to match lotto-8
            return d;
          });

          for (let i = 0; i < numDivs.length; i += 7) {
            if (i + 7 <= numDivs.length) {
              const draw = numDivs.slice(i, i + 7);
              const drawStr = draw.join(',');
              if (!seen.has(drawStr)) {
                seen.add(drawStr);
                // Math index based roughly relative to how many we parsed, but uniqueDates should align if we assume first goes with first
                const dateIdx = (i/7);
                const date = uniqueDates[dateIdx] || "";
                draws.push({numbers: draw, date});
              }
            }
          }
        }
      } catch (marksixErr) {
        console.error("Marksixinfo scrape failed:", marksixErr);
      }

      // Fallback Dates
      for (const mockDrawObj of MOCK_PAST_RESULTS) {
        // Handle both older structures if any mapping changed, but now it's an object array
        const mockArray = Array.isArray(mockDrawObj) ? mockDrawObj : mockDrawObj.numbers;
        const mockDate = !Array.isArray(mockDrawObj) && mockDrawObj.date ? mockDrawObj.date : `Past Draw`;
        
        const drawStr = mockArray.join(',');
        if (!seen.has(drawStr)) {
          seen.add(drawStr);
          draws.push({numbers: mockArray, date: mockDate});
        }
      }
      
      // Sort draws by date descending
      draws.sort((a, b) => {
         const parseDate = (d: string) => {
           const parts = d.split(/[/|-]/);
           if (parts.length === 3) {
             if (parts[0].length === 4) {
               // YYYY/MM/DD
               return new Date(`${parts[0]}-${parts[1]}-${parts[2]}`).getTime();
             } else {
               // DD/MM/YYYY
               return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
             }
           }
           return new Date(d).getTime() || 0;
         };
         return parseDate(b.date) - parseDate(a.date);
      });

      res.json({ success: true, draws });
    } catch (error: any) {
      console.error("Error fetching Mark Six info:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
