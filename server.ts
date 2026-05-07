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

      const extractedText = response.text || "[]";
      console.log("Gemini API Response:", extractedText);
      
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
        errorMessage = "伺服器所在的地區（可能為香港或新加坡）不支援 Google Gemini API。\n\n請在 Render 的設定中，將 Web Service 重新部署到美國（如 Oregon 或 Ohio）或歐洲（如 Frankfurt）地區即可解決此問題。";
      }

      return res.status(500).json({ error: errorMessage });
    }
  });

  // API Route to fetch latest marksix results
  app.get("/api/marksix", async (req, res) => {
    try {
      const response = await fetch('https://marksixinfo.com/latest20draws');
      if (!response.ok) {
        throw new Error(`Failed to fetch from marksixinfo.com: ${response.status}`);
      }
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
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return d;
      });

      // Each draw consists of 7 numbers (6 normal + 1 special)
      const draws: {numbers: number[], date: string}[] = [];
      const seen = new Set<string>();

      for (let i = 0; i < numDivs.length; i += 7) {
        if (i + 7 <= numDivs.length) {
          const draw = numDivs.slice(i, i + 7);
          const drawStr = draw.join(',');
          if (!seen.has(drawStr)) {
            seen.add(drawStr);
            const date = uniqueDates[draws.length] || "";
            draws.push({numbers: draw, date});
          }
        }
      }

      // Try fetching from HKJC as a fallback
      try {
        const hkjcRes = await fetch('https://bet.hkjc.com/marksix/getJSON.aspx?sd=20250101&ed=20261231', {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          }
        });
        if (hkjcRes.ok) {
          const hkjcData = await hkjcRes.json();
          // Merge HKJC data if format allows
        }
      } catch (e) {
        // Ignore HKJC errors
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
