import { FinishReason, GoogleGenAI } from "@google/genai";
import { SongDnaSchema, type AudioFeatures, type SongDna, type TrackInput } from "../domain/types.js";
import type { Analyzer } from "./analyzer.js";
import { SONG_DNA_JSON_SCHEMA, buildSystemPrompt, buildUserContent } from "./prompt.js";

/**
 * Free-tier analyzer for budget-conscious prototyping: Google's Gemini API has a
 * genuinely free developer tier (aistudio.google.com), which is why this project
 * defaults to it for local development and demos rather than the paid Anthropic
 * path. Same Analyzer interface, same output schema, same downstream code.
 * Swapping providers is a config change (LLM_PROVIDER=gemini|anthropic), not a
 * rewrite. That interchangeability is the point: Song DNA's LLM boundary is one
 * seam, not scattered through the codebase.
 */
export class GeminiAnalyzer implements Analyzer {
  readonly modelName: string;
  private readonly client: GoogleGenAI;

  constructor(apiKey: string, model: string) {
    this.modelName = model;
    this.client = new GoogleGenAI({ apiKey });
  }

  async analyze(track: TrackInput, audio?: AudioFeatures): Promise<SongDna> {
    const response = await this.client.models.generateContent({
      model: this.modelName,
      contents: buildUserContent(track, audio),
      config: {
        systemInstruction: buildSystemPrompt(),
        responseMimeType: "application/json",
        responseJsonSchema: SONG_DNA_JSON_SCHEMA,
      },
    });

    const finishReason = response.candidates?.[0]?.finishReason;
    const blockedReasons: FinishReason[] = [
      FinishReason.SAFETY,
      FinishReason.PROHIBITED_CONTENT,
      FinishReason.BLOCKLIST,
      FinishReason.SPII,
      FinishReason.RECITATION,
    ];
    if (finishReason && blockedReasons.includes(finishReason)) {
      throw new Error(`Analysis declined by Gemini safety filters (${finishReason}).`);
    }

    const text = response.text;
    if (!text) {
      throw new Error(`Gemini returned no text content (finishReason: ${finishReason ?? "unknown"}).`);
    }

    const parsed: unknown = JSON.parse(text);
    return SongDnaSchema.parse(parsed);
  }
}
