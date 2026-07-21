-- Song DNA schema.
--
-- A "track" is a piece of metadata submitted for analysis (title, artist,
-- optional lyrics/description text). A "analysis" is one LLM-produced Song
-- DNA result for a track, kept as its own row (not just a column on track)
-- so re-analyzing a track preserves history and lets the UI show confidence
-- drift across model/prompt versions.

CREATE TABLE IF NOT EXISTS tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    description TEXT,       -- freeform notes / lyrics excerpt / artist blurb
    source_url TEXT,        -- optional link (e.g. streaming URL) for reference
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    model TEXT NOT NULL,              -- e.g. "claude-opus-4-8" or "mock-v1"
    genres JSONB NOT NULL,            -- [{ "label": string, "confidence": number }]
    moods JSONB NOT NULL,             -- [{ "label": string, "confidence": number }]
    instrumentation JSONB NOT NULL,   -- [{ "label": string, "confidence": number }]
    tempo_feel TEXT NOT NULL,         -- e.g. "driving", "laid-back", "frantic"
    energy NUMERIC(3,2) NOT NULL,     -- 0.00–1.00 overall energy score
    summary TEXT NOT NULL,            -- one-paragraph human-readable rationale
    raw_response JSONB,               -- full structured LLM output, for audit/debug
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analyses_track_id_idx ON analyses (track_id);
CREATE INDEX IF NOT EXISTS tracks_created_at_idx ON tracks (created_at DESC);
