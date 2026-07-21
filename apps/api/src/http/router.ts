import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { TrackInputSchema } from "../domain/types.js";
import type { Analyzer } from "../analysis/analyzer.js";
import type { TracksRepo } from "../repo/tracksRepo.js";
import { decodeWav, UnsupportedAudioError } from "../audio/wav.js";
import { extractAudioFeatures } from "../audio/dsp.js";
import { env } from "../env.js";

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxAudioUploadBytes },
});

export function createRouter(repo: TracksRepo, analyzer: Analyzer): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ status: "ok", analyzer: analyzer.modelName });
  });

  // Create a track and immediately run analysis on it, returning both.
  router.post(
    "/tracks",
    asyncHandler(async (req, res) => {
      const parsed = TrackInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
        return;
      }

      const track = await repo.createTrack(parsed.data);

      try {
        const dna = await analyzer.analyze(parsed.data);
        const analysis = await repo.saveAnalysis(track.id, analyzer.modelName, dna);
        res.status(201).json({ track, analysis });
      } catch (err) {
        // Track is already persisted; analysis failure shouldn't 500 the whole
        // request — the client can retry analysis via POST /tracks/:id/analyze.
        console.error("Analysis failed for track", track.id, err);
        res.status(201).json({
          track,
          analysis: null,
          analysisError: err instanceof Error ? err.message : "unknown_error",
        });
      }
    }),
  );

  router.get(
    "/tracks",
    asyncHandler(async (_req, res) => {
      const tracks = await repo.listTracks();
      const withAnalyses = await Promise.all(
        tracks.map(async (track) => ({
          track,
          analysis: await repo.latestAnalysis(track.id),
          audioFeatures: await repo.latestAudioFeatures(track.id),
        })),
      );
      res.json({ items: withAnalyses });
    }),
  );

  router.get(
    "/tracks/:id",
    asyncHandler(async (req, res) => {
      const track = await repo.getTrack(req.params.id);
      if (!track) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const [analyses, audioFeatures] = await Promise.all([
        repo.listAnalyses(track.id),
        repo.latestAudioFeatures(track.id),
      ]);
      res.json({ track, analyses, audioFeatures });
    }),
  );

  // Upload a WAV file for a track: decodes the actual PCM samples and stores
  // objective signal features (tempo/energy/brightness/noisiness). Does not
  // itself trigger LLM re-analysis — call POST /tracks/:id/analyze afterward
  // to fold the measured features into a fresh Song DNA.
  router.post(
    "/tracks/:id/audio",
    upload.single("file"),
    asyncHandler(async (req, res) => {
      const track = await repo.getTrack(req.params.id);
      if (!track) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "missing_file", details: "Expected a 'file' field with a WAV upload." });
        return;
      }

      try {
        const decoded = decodeWav(req.file.buffer);
        const features = extractAudioFeatures(decoded, req.file.originalname);
        const record = await repo.saveAudioFeatures(track.id, features);
        res.status(201).json({ audioFeatures: record });
      } catch (err) {
        if (err instanceof UnsupportedAudioError) {
          res.status(400).json({ error: "unsupported_audio", details: err.message });
          return;
        }
        throw err;
      }
    }),
  );

  // Re-run analysis on an existing track (e.g. after a transient LLM failure,
  // after uploading audio, or to compare confidence drift across analyzer
  // versions). Automatically incorporates the latest decoded audio features,
  // if any have been uploaded for this track.
  router.post(
    "/tracks/:id/analyze",
    asyncHandler(async (req, res) => {
      const track = await repo.getTrack(req.params.id);
      if (!track) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const audioFeatures = await repo.latestAudioFeatures(track.id);
      const dna = await analyzer.analyze(track, audioFeatures ?? undefined);
      const analysis = await repo.saveAnalysis(track.id, analyzer.modelName, dna);
      res.status(201).json({ analysis });
    }),
  );

  return router;
}
