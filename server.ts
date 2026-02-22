import express from "express";
import { createServer as createViteServer } from "vite";
import { AnalysisService } from "./src/lib/services/AnalysisService";
import { AnalysisJobSchema } from "./src/lib/types";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const analysisService = new AnalysisService();

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      const input = AnalysisJobSchema.parse(req.body);
      const jobId = await analysisService.createJob(input);
      res.status(202).json({ id: jobId, status: "pending", message: "Analysis job created and processing asynchronously." });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Invalid input" });
    }
  });

  app.get("/api/analysis/:id", (req, res) => {
    const job = analysisService.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: "Analysis not found" });
    }
    res.json(job);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Visibility Platform Server running on http://localhost:${PORT}`);
  });
}

startServer();
