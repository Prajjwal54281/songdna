import type { AudioFeatures, SongDna, TrackInput } from "../domain/types.js";

/** Analyzer contract: turn track metadata (plus optional decoded audio
 * features) into a scored Song DNA fingerprint. `audio` is omitted for
 * metadata-only tracks. Every implementation must handle that case. */
export interface Analyzer {
  readonly modelName: string;
  analyze(track: TrackInput, audio?: AudioFeatures): Promise<SongDna>;
}
