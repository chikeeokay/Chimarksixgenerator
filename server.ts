import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fetch from "node-fetch"; // Native fetch is available in node 18+, but we use global fetch
import * as cheerio from 'cheerio';
import { MOCK_PAST_RESULTS } from "./lib/marksix.ts";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  app.use(express.json({ limit: '10mb' }));

  // AI Route for image processing
  app.post("/api/extract-numbers", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key is missing on the server. Please check environment variables." });
      }
      
      const { base64DataReplaced, mimeType } = req.body;
      if (!base64DataReplaced || !mimeType) {
        return res.status(400).json({ error: "Missing image data" });
      }

      const ai = new GoogleGenAI({ apiKey });
      
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
                  mimeType: mimeType,
                  data: base64DataReplaced
                }
              }
            ]
          }
        ]
      });

      let extractedText = response.text;
      if (extractedText) {
        extractedText = extractedText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const bets = JSON.parse(extractedText);
        return res.json({ success: true, bets });
      }
      res.status(500).json({ error: "No response text from Gemini" });
    } catch (e: any) {
      console.error("AI Extraction Error:", e);
      res.status(500).json({ error: e.message || "Unknown error during AI processing" });
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
