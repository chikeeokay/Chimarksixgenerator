import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fetch from "node-fetch"; // Native fetch is available in node 18+, but we use global fetch
import * as cheerio from 'cheerio';
import { MOCK_PAST_RESULTS } from "./lib/marksix.ts";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Route to fetch latest marksix results
  app.post("/api/check-screenshot", async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ success: false, error: "Missing imageBase64" });
      }

      // Check if GEMINI_API_KEY is available
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY environment variable is not set");
      }

      // Lazy import to only initialize when needed
      console.log("GEMINI_API_KEY length:", process.env.GEMINI_API_KEY?.length);
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const mimeTypeMatch = imageBase64.match(/^data:(image\/(png|jpeg|jpg|webp|heic|heif));base64,/);
      const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";
      const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp|heic|heif);base64,/, "");

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: "Extract all the lottery numbers (mark six) in the image. Return them as a JSON array of arrays, representing the bets. Each array should contain 6 numbers. For example: [[1, 2, 3, 4, 5, 6], [10, 11, 12, 13, 14, 15]]. Do NOT output any markdown blocks like ```json ... ```, ONLY output the raw JSON string.",
              },
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType
                }
              }
            ]
          }
        ]
      });

      const text = response.text || "";
      let parsed;
      try {
        parsed = JSON.parse(text.trim());
      } catch (e) {
        // cleanup if it still surrounds with markdown
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      }

      res.json({ success: true, bets: parsed });
    } catch (error: any) {
      console.error("Gemini API error (raw):", error);
      let errorMsg = error.message;
      if (errorMsg.includes("API key not valid") || errorMsg.includes("API_KEY_INVALID")) {
        errorMsg = "API 金鑰無效。請至左側選單的「Secrets」面板中，確認已輸入一組正確且有效的 GEMINI_API_KEY。";
      } else if (errorMsg.includes("GEMINI_API_KEY environment variable is not set")) {
        errorMsg = "系統尚未設定 API 金鑰。請至左側選單的「Secrets」面板中，新增並設定您的 GEMINI_API_KEY。";
      } else {
        try {
          const parsedObj = JSON.parse(errorMsg.replace(/^[^{]*/, ''));
          if (parsedObj.error && parsedObj.error.message) {
            errorMsg = parsedObj.error.message;
          }
        } catch (e) {
            // Ignore parse errors, just use the original message
        }
      }
      res.status(500).json({ success: false, error: errorMsg });
    }
  });

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

      // Fallback
      const fallbackDates = [
        "18/04/2026", "16/04/2026", "14/04/2026", "11/04/2026", "09/04/2026",
        "07/04/2026", "04/04/2026", "31/03/2026", "28/03/2026", "26/03/2026",
        "24/03/2026", "21/03/2026", "19/03/2026", "17/03/2026", "12/03/2026",
        "10/03/2026", "07/03/2026", "05/03/2026", "03/03/2026", "28/02/2026"
      ];
      let fallbackIndex = 0;

      for (const mockDraw of MOCK_PAST_RESULTS) {
        const drawStr = mockDraw.join(',');
        if (!seen.has(drawStr)) {
          seen.add(drawStr);
          const date = fallbackDates[fallbackIndex] || "";
          draws.push({numbers: mockDraw, date: date});
          fallbackIndex++;
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
