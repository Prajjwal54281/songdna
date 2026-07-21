import type { Pool } from "pg";
import type { Analysis, AudioFeatures, AudioFeaturesRecord, SongDna, Track, TrackInput } from "../domain/types.js";

interface TrackRow {
  id: string;
  title: string;
  artist: string;
  description: string | null;
  source_url: string | null;
  created_at: Date;
}

interface AnalysisRow {
  id: string;
  track_id: string;
  model: string;
  genres: SongDna["genres"];
  moods: SongDna["moods"];
  instrumentation: SongDna["instrumentation"];
  tempo_feel: string;
  energy: string; // NUMERIC comes back as string from node-postgres
  summary: string;
  created_at: Date;
}

function toTrack(row: TrackRow): Track {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    description: row.description ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    createdAt: row.created_at.toISOString(),
  };
}

interface AudioFeaturesRow {
  id: string;
  track_id: string;
  filename: string;
  duration_sec: string;
  sample_rate: number;
  channels: number;
  tempo_bpm: string | null;
  rms_energy: string;
  spectral_centroid_hz: string;
  zero_crossing_rate: string;
  created_at: Date;
}

function toAudioFeaturesRecord(row: AudioFeaturesRow): AudioFeaturesRecord {
  return {
    id: row.id,
    trackId: row.track_id,
    filename: row.filename,
    durationSec: Number(row.duration_sec),
    sampleRate: row.sample_rate,
    channels: row.channels,
    tempoBpm: row.tempo_bpm === null ? null : Number(row.tempo_bpm),
    rmsEnergy: Number(row.rms_energy),
    spectralCentroidHz: Number(row.spectral_centroid_hz),
    zeroCrossingRate: Number(row.zero_crossing_rate),
    createdAt: row.created_at.toISOString(),
  };
}

function toAnalysis(row: AnalysisRow): Analysis {
  return {
    id: row.id,
    trackId: row.track_id,
    model: row.model,
    dna: {
      genres: row.genres,
      moods: row.moods,
      instrumentation: row.instrumentation,
      tempo_feel: row.tempo_feel,
      energy: Number(row.energy),
      summary: row.summary,
    },
    createdAt: row.created_at.toISOString(),
  };
}

/** Postgres-backed persistence for tracks and their Song DNA analyses. Plain
 * parameterized SQL rather than an ORM. The query surface here is small
 * enough that an ORM would add indirection without saving real code. */
export class TracksRepo {
  constructor(private readonly pool: Pool) {}

  async createTrack(input: TrackInput): Promise<Track> {
    const { rows } = await this.pool.query<TrackRow>(
      `INSERT INTO tracks (title, artist, description, source_url)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.title, input.artist, input.description ?? null, input.sourceUrl ?? null],
    );
    return toTrack(rows[0]);
  }

  async listTracks(): Promise<Track[]> {
    const { rows } = await this.pool.query<TrackRow>(
      `SELECT * FROM tracks ORDER BY created_at DESC LIMIT 200`,
    );
    return rows.map(toTrack);
  }

  async getTrack(id: string): Promise<Track | null> {
    const { rows } = await this.pool.query<TrackRow>(
      `SELECT * FROM tracks WHERE id = $1`,
      [id],
    );
    return rows[0] ? toTrack(rows[0]) : null;
  }

  async saveAnalysis(trackId: string, model: string, dna: SongDna): Promise<Analysis> {
    const { rows } = await this.pool.query<AnalysisRow>(
      `INSERT INTO analyses
         (track_id, model, genres, moods, instrumentation, tempo_feel, energy, summary, raw_response)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        trackId,
        model,
        JSON.stringify(dna.genres),
        JSON.stringify(dna.moods),
        JSON.stringify(dna.instrumentation),
        dna.tempo_feel,
        dna.energy,
        dna.summary,
        JSON.stringify(dna),
      ],
    );
    return toAnalysis(rows[0]);
  }

  async latestAnalysis(trackId: string): Promise<Analysis | null> {
    const { rows } = await this.pool.query<AnalysisRow>(
      `SELECT * FROM analyses WHERE track_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [trackId],
    );
    return rows[0] ? toAnalysis(rows[0]) : null;
  }

  async listAnalyses(trackId: string): Promise<Analysis[]> {
    const { rows } = await this.pool.query<AnalysisRow>(
      `SELECT * FROM analyses WHERE track_id = $1 ORDER BY created_at DESC`,
      [trackId],
    );
    return rows.map(toAnalysis);
  }

  async saveAudioFeatures(trackId: string, features: AudioFeatures): Promise<AudioFeaturesRecord> {
    const { rows } = await this.pool.query<AudioFeaturesRow>(
      `INSERT INTO audio_features
         (track_id, filename, duration_sec, sample_rate, channels, tempo_bpm, rms_energy, spectral_centroid_hz, zero_crossing_rate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        trackId,
        features.filename,
        features.durationSec,
        features.sampleRate,
        features.channels,
        features.tempoBpm,
        features.rmsEnergy,
        features.spectralCentroidHz,
        features.zeroCrossingRate,
      ],
    );
    return toAudioFeaturesRecord(rows[0]);
  }

  async latestAudioFeatures(trackId: string): Promise<AudioFeaturesRecord | null> {
    const { rows } = await this.pool.query<AudioFeaturesRow>(
      `SELECT * FROM audio_features WHERE track_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [trackId],
    );
    return rows[0] ? toAudioFeaturesRecord(rows[0]) : null;
  }
}
