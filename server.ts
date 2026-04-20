import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfExtract = require("pdf-parse");

async function startServer() {
  const app = express();
  const PORT = 3000;
  const upload = multer({ storage: multer.memoryStorage() });

  app.use(express.json());

  // API to extract text from PDF
  app.post("/api/extract-text", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      console.log("File received:", req.file.originalname, "Mime:", req.file.mimetype);

      if (req.file.mimetype === "application/pdf") {
        // With pdf-parse 1.1.1, it should be a direct function or .default
        const extractFunc = typeof pdfExtract === 'function' ? pdfExtract : pdfExtract.default;
        
        if (typeof extractFunc !== 'function') {
          console.error("PDF parser resolution failed after downgrade. type:", typeof extractFunc);
          return res.status(500).json({ error: "PDF parser initialization failed" });
        }

        try {
          const data = await extractFunc(req.file.buffer);
          if (!data || typeof data.text !== 'string') {
            console.error("PDF extraction returned invalid data:", data);
            return res.status(500).json({ error: "Failed to extract text from PDF content" });
          }
          // Basic text cleaning - normalize line endings and double spaces
          const cleanedText = data.text
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .replace(/[ \t]+/g, " ");

          return res.json({ text: cleanedText });
        } catch (extError) {
          console.error("Internal PDF extraction error:", extError);
          return res.status(500).json({ error: "PDF engine failed to process the file" });
        }
      } else {
        const text = req.file.buffer.toString("utf-8");
        return res.json({ text });
      }
    } catch (error) {
      console.error("Extraction error:", error);
      res.status(500).json({ error: "Failed to extract text from document" });
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
