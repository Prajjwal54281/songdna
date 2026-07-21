import type { AudioFeatures, TrackInput } from "../domain/types.js";

const TAG_SCHEMA = {
  type: "object",
  properties: {
    label: { type: "string" },
    confidence: { type: "number" },
  },
  required: ["label", "confidence"],
  additionalProperties: false,
} as const;

/** JSON Schema mirror of SongDnaSchema, shared by every structured-output LLM
 * analyzer (Anthropic, Gemini). Kept in lockstep by hand since the shape is
 * small and stable. If it grows, switch to a zod-to-json-schema generator. */
export const SONG_DNA_JSON_SCHEMA = {
  type: "object",
  properties: {
    genres: { type: "array", items: TAG_SCHEMA, minItems: 1, maxItems: 5 },
    moods: { type: "array", items: TAG_SCHEMA, minItems: 1, maxItems: 5 },
    instrumentation: { type: "array", items: TAG_SCHEMA, minItems: 1, maxItems: 8 },
    tempo_feel: { type: "string" },
    energy: { type: "number" },
    summary: { type: "string" },
  },
  required: ["genres", "moods", "instrumentation", "tempo_feel", "energy", "summary"],
  additionalProperties: false,
} as const;

export function buildSystemPrompt(): string {
  return `You are a music analyst for Song DNA, a platform that helps independent \
musicians understand how their music reads to listeners and platforms. Given a track's title, \
artist, optional description or lyric excerpt, and (when available) objective audio signal \
measurements extracted by decoding the actual waveform, produce a structured "Song DNA" \
fingerprint:

- genres: 1-5 genre tags, each with a confidence score in [0,1]. Order by confidence, descending.
- moods: 1-5 mood/emotional-tone tags with confidence scores.
- instrumentation: 1-8 likely instrumentation/production elements with confidence scores.
- tempo_feel: a short phrase describing the rhythmic feel (e.g. "driving", "laid-back", "frantic").
- energy: overall energy level in [0,1], where 0 is very low-energy/ambient and 1 is maximally intense.
- summary: one paragraph in plain language explaining the reasoning, written for the artist, not a
  developer. Reference specific cues from the input rather than restating the tags. Write the
  summary in plain punctuation: commas and periods, not em dashes.

When measured audio features are provided, treat them as ground truth for anything they cover
(e.g. tempo, energy) and raise your confidence accordingly. Don't second-guess a measured tempo
against a text-based hunch. When only text metadata is available, confidence scores reflect
genuine uncertainty from limited signal. Do not default everything to high confidence. If the
input is sparse, say so in the summary and keep confidence scores modest.`;
}

function describeAudioFeatures(audio: AudioFeatures): string {
  const tempoLine = audio.tempoBpm
    ? `Estimated tempo: ~${Math.round(audio.tempoBpm)} BPM (autocorrelation-based estimate, not full beat-tracking)`
    : "Estimated tempo: inconclusive from the decoded signal";
  return [
    "Measured audio features (extracted by decoding the uploaded waveform):",
    `- Duration: ${audio.durationSec.toFixed(1)}s (${audio.sampleRate}Hz, ${audio.channels}ch)`,
    `- ${tempoLine}`,
    `- RMS energy (loudness proxy, 0-1 normalized): ${audio.rmsEnergy.toFixed(3)}`,
    `- Spectral centroid (brightness proxy): ${Math.round(audio.spectralCentroidHz)}Hz`,
    `- Zero-crossing rate (noisiness/percussiveness proxy, 0-1): ${audio.zeroCrossingRate.toFixed(3)}`,
  ].join("\n");
}

export function buildUserContent(track: TrackInput, audio?: AudioFeatures): string {
  const lines = [
    `Title: ${track.title}`,
    `Artist: ${track.artist}`,
    track.description ? `Description / lyric excerpt: ${track.description}` : null,
    audio ? "" : null,
    audio ? describeAudioFeatures(audio) : null,
  ].filter((line): line is string => line !== null);
  return lines.join("\n");
}
