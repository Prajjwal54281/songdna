import { z } from "zod";

/** A single tagged attribute with a model confidence score in [0, 1]. */
export const TagSchema = z.object({
  label: z.string().min(1),
  confidence: z.number().min(0).max(1),
});
export type Tag = z.infer<typeof TagSchema>;

/**
 * The "Song DNA" produced by analysis: a structured, confidence-scored
 * fingerprint of a track's genre, mood, and instrumentation, plus a
 * qualitative tempo feel and energy score. This is the shape both the
 * real Claude analyzer and the deterministic mock analyzer must produce.
 */
export const SongDnaSchema = z.object({
  genres: z.array(TagSchema).min(1).max(5),
  moods: z.array(TagSchema).min(1).max(5),
  instrumentation: z.array(TagSchema).min(1).max(8),
  tempo_feel: z.string().min(1),
  energy: z.number().min(0).max(1),
  summary: z.string().min(1),
});
export type SongDna = z.infer<typeof SongDnaSchema>;

/** Input a client submits for analysis: metadata only. Audio (if any) is a separate upload. */
export const TrackInputSchema = z.object({
  title: z.string().min(1).max(200),
  artist: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  sourceUrl: z.string().url().max(500).optional(),
});
export type TrackInput = z.infer<typeof TrackInputSchema>;

export interface Track extends TrackInput {
  id: string;
  createdAt: string;
}

export interface Analysis {
  id: string;
  trackId: string;
  model: string;
  dna: SongDna;
  createdAt: string;
}

/**
 * Objective signal features extracted by actually decoding an uploaded WAV
 * file's PCM samples, not metadata, not an LLM guess. See
 * src/audio/{wav,dsp}.ts for how each of these is computed. `tempoBpm` is a
 * naive autocorrelation-based estimate (not full beat-tracking) and may be
 * null for very short or ambiguous audio.
 */
export const AudioFeaturesSchema = z.object({
  filename: z.string().min(1),
  durationSec: z.number().nonnegative(),
  sampleRate: z.number().int().positive(),
  channels: z.number().int().positive(),
  tempoBpm: z.number().positive().nullable(),
  rmsEnergy: z.number().min(0).max(1),
  spectralCentroidHz: z.number().nonnegative(),
  zeroCrossingRate: z.number().min(0).max(1),
});
export type AudioFeatures = z.infer<typeof AudioFeaturesSchema>;

export interface AudioFeaturesRecord extends AudioFeatures {
  id: string;
  trackId: string;
  createdAt: string;
}
