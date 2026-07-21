// Mirrors the API's domain types (apps/api/src/domain/types.ts). Kept as a
// small hand-written duplicate rather than a shared package. The two apps
// are simple enough that a shared-types package would be more scaffolding
// than the project needs; if this grows, promote it to a workspace package.

export interface Tag {
  label: string;
  confidence: number;
}

export interface SongDna {
  genres: Tag[];
  moods: Tag[];
  instrumentation: Tag[];
  tempo_feel: string;
  energy: number;
  summary: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  description?: string;
  sourceUrl?: string;
  createdAt: string;
}

export interface Analysis {
  id: string;
  trackId: string;
  model: string;
  dna: SongDna;
  createdAt: string;
}

/** Objective signal features extracted from an uploaded WAV file's decoded
 * PCM samples. See apps/api/src/audio/{wav,dsp}.ts. */
export interface AudioFeatures {
  id: string;
  trackId: string;
  filename: string;
  durationSec: number;
  sampleRate: number;
  channels: number;
  tempoBpm: number | null;
  rmsEnergy: number;
  spectralCentroidHz: number;
  zeroCrossingRate: number;
  createdAt: string;
}

export interface TrackWithAnalysis {
  track: Track;
  analysis: Analysis | null;
  audioFeatures: AudioFeatures | null;
}
