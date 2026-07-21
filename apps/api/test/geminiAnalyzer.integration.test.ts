import "dotenv/config";
import { describe, expect, it } from "vitest";
import { GeminiAnalyzer } from "../src/analysis/geminiAnalyzer.js";
import { SongDnaSchema } from "../src/domain/types.js";

/**
 * Real integration test against the live Gemini API — not mocked. Runs only
 * when GEMINI_API_KEY is present (e.g. in a local .env), so CI and other
 * contributors' machines stay green without needing a secret. This is the
 * one test in the suite that costs an actual API call; everything else
 * (schemas, mock analyzer, DSP, WAV decode) is pure and free.
 */
const hasKey = !!process.env.GEMINI_API_KEY;

describe.skipIf(!hasKey)("GeminiAnalyzer (live)", () => {
  it("returns schema-valid Song DNA grounded in provided audio features", async () => {
    const analyzer = new GeminiAnalyzer(
      process.env.GEMINI_API_KEY!,
      process.env.GEMINI_MODEL ?? "gemini-flash-latest",
    );

    const dna = await analyzer.analyze(
      {
        title: "Midnight Drive",
        artist: "The Wires",
        description: "A slow-burning breakup song about driving away from a small town at 2am.",
      },
      {
        filename: "test.wav",
        durationSec: 10,
        sampleRate: 44100,
        channels: 1,
        tempoBpm: 64,
        rmsEnergy: 0.18,
        spectralCentroidHz: 3678,
        zeroCrossingRate: 0,
      },
    );

    expect(() => SongDnaSchema.parse(dna)).not.toThrow();
    expect(dna.genres.length).toBeGreaterThan(0);
    // A real model given a measured low-energy, ~64bpm track shouldn't call
    // it high-energy — this is the actual value of grounding the prompt in
    // decoded signal rather than letting the LLM guess from text alone.
    expect(dna.energy).toBeLessThan(0.5);
  }, 30000);
});
