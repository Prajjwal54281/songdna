import Anthropic from "@anthropic-ai/sdk";
import { SongDnaSchema, type AudioFeatures, type SongDna, type TrackInput } from "../domain/types.js";
import type { Analyzer } from "./analyzer.js";
import { SONG_DNA_JSON_SCHEMA, buildSystemPrompt, buildUserContent } from "./prompt.js";

/** Real analyzer: calls Claude with a JSON-schema output constraint so the response is
 * guaranteed to parse as SongDna without prompt-engineering the model into emitting JSON. */
export class AnthropicAnalyzer implements Analyzer {
  readonly modelName: string;
  private readonly client: Anthropic;

  constructor(apiKey: string, model: string) {
    this.modelName = model;
    this.client = new Anthropic({ apiKey });
  }

  async analyze(track: TrackInput, audio?: AudioFeatures): Promise<SongDna> {
    const response = await this.client.messages.create({
      model: this.modelName,
      max_tokens: 1500,
      system: buildSystemPrompt(),
      output_config: {
        format: { type: "json_schema", schema: SONG_DNA_JSON_SCHEMA },
      },
      messages: [{ role: "user", content: buildUserContent(track, audio) }],
    });

    if (response.stop_reason === "refusal") {
      throw new Error("Analysis declined by the model's safety classifiers.");
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Model response contained no text content to parse.");
    }

    const parsed: unknown = JSON.parse(textBlock.text);
    return SongDnaSchema.parse(parsed);
  }
}
