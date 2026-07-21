// Load .env before any other import touches process.env — docker-compose
// injects env vars directly and doesn't need this, but local `npm run dev`
// does. quiet:true keeps a missing .env (e.g. in CI) from logging a warning.
import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { env } from "./env.js";
import { pool } from "./db.js";
import { createAnalyzer } from "./analysis/index.js";
import { TracksRepo } from "./repo/tracksRepo.js";
import { createRouter } from "./http/router.js";

const app = express();
app.use(cors());
app.use(express.json());

const repo = new TracksRepo(pool);
const analyzer = createAnalyzer();

app.use("/api", createRouter(repo, analyzer));

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    res.status(status).json({ error: "upload_error", details: err.message });
    return;
  }
  console.error("Unhandled error", err);
  res.status(500).json({ error: "internal_error" });
});

app.listen(env.port, () => {
  console.log(`songdna-api listening on :${env.port} (analyzer: ${analyzer.modelName})`);
});
