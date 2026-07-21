import { env } from "../env.js";
import type { Analyzer } from "./analyzer.js";
import { AnthropicAnalyzer } from "./anthropicAnalyzer.js";
import { GeminiAnalyzer } from "./geminiAnalyzer.js";
import { MockAnalyzer } from "./mockAnalyzer.js";

/**
 * Selects the analyzer implementation at startup based on LLM_PROVIDER (see
 * env.ts). Default "auto" prefers Anthropic when configured, falls back to
 * Gemini's free tier (the budget-conscious default for local dev/demos),
 * and finally the deterministic mock so the service always runs end-to-end
 * with zero external dependencies.
 *
 * Every implementation shares the same Analyzer interface and the same
 * SONG_DNA_JSON_SCHEMA (analysis/prompt.ts) — swapping providers is a config
 * change, not a rewrite of the analysis pipeline.
 */
export function createAnalyzer(): Analyzer {
  const hasAnthropic = env.anthropicApiKey.trim().length > 0;
  const hasGemini = env.geminiApiKey.trim().length > 0;

  const provider =
    env.llmProvider === "auto"
      ? hasAnthropic
        ? "anthropic"
        : hasGemini
          ? "gemini"
          : "mock"
      : env.llmProvider;

  switch (provider) {
    case "anthropic":
      if (!hasAnthropic) throw new Error("LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set.");
      return new AnthropicAnalyzer(env.anthropicApiKey, env.anthropicModel);
    case "gemini":
      if (!hasGemini) throw new Error("LLM_PROVIDER=gemini but GEMINI_API_KEY is not set.");
      return new GeminiAnalyzer(env.geminiApiKey, env.geminiModel);
    case "mock":
    default:
      console.warn(
        "[songdna] No LLM provider configured — using the deterministic mock analyzer. " +
          "Set GEMINI_API_KEY (free tier: aistudio.google.com/apikey) or ANTHROPIC_API_KEY " +
          "in .env for real model-driven Song DNA analysis.",
      );
      return new MockAnalyzer();
  }
}

export type { Analyzer } from "./analyzer.js";
