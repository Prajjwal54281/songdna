-- Objective signal features extracted by decoding an uploaded WAV file's
-- actual PCM samples (see src/audio/wav.ts + src/audio/dsp.ts). Distinct
-- from `analyses`, which holds the LLM's qualitative interpretation. A track
-- can have audio uploaded, re-analyzed metadata, both, or neither.

CREATE TABLE IF NOT EXISTS audio_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    duration_sec NUMERIC(8,2) NOT NULL,
    sample_rate INT NOT NULL,
    channels INT NOT NULL,
    tempo_bpm NUMERIC(6,1),                  -- nullable: inconclusive for very short/quiet audio
    rms_energy NUMERIC(6,4) NOT NULL,        -- normalized 0-1 loudness proxy
    spectral_centroid_hz NUMERIC(8,2) NOT NULL,
    zero_crossing_rate NUMERIC(6,4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audio_features_track_id_idx ON audio_features (track_id);
