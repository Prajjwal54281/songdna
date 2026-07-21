# Song DNA

A small, production-shaped service that decodes a track's actual audio signal and combines it
with LLM analysis of its metadata to produce a structured, confidence-scored "Song DNA" —
genre, mood, and instrumentation tags, plus a tempo feel and energy score. Built as a focused
weekend project to mirror the shape of Tunepact's own product (an AI platform for independent
musicians), not as a toy demo.

## Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript, plain CSS, no UI framework dependency
- **Backend:** Node.js + TypeScript + Express, hand-written SQL over `pg` (no ORM)
- **Database:** PostgreSQL — tracks, LLM analyses, and decoded audio features are separate
  tables, so re-analyzing a track (or re-uploading audio) keeps history instead of overwriting it
- **Audio pipeline:** a hand-written WAV (RIFF/PCM) decoder and DSP module — real tempo, RMS
  energy, spectral centroid, and zero-crossing rate extracted from decoded PCM samples, not
  guessed from metadata. See "The audio pipeline" below for what this does and doesn't do.
- **LLM integration:** two interchangeable providers (Anthropic, Google Gemini) behind one
  `Analyzer` interface, both using JSON-schema-constrained structured output (no
  prompt-engineered "respond with JSON" and hand-rolled parsing) — see "LLM providers" below
- **Containerization:** Docker + `docker-compose` — Postgres, a one-shot migration runner, the
  API, and the web app

## Architecture

```
apps/
  api/            Node/TypeScript backend
    src/
      domain/     Zod schemas + shared types (Track, SongDna, AudioFeatures)
      audio/      WAV decoder (wav.ts) + DSP feature extraction (dsp.ts)
      analysis/   Analyzer interface, prompt.ts (shared schema/prompt builder),
                  and three implementations (Anthropic, Gemini, Mock)
      repo/       Postgres queries (tracksRepo.ts)
      http/       Express router (incl. multipart audio upload)
    migrations/   Hand-written SQL migrations, applied by src/migrate.ts
  web/            Next.js frontend
    app/          Pages + the DnaCard component
    lib/          API client + shared types
docker-compose.yml
```

### The audio pipeline

`POST /tracks/:id/audio` accepts a WAV file upload. `src/audio/wav.ts` is a hand-written
RIFF/WAVE parser (supports PCM 8/16/24/32-bit and 32-bit float, mono or stereo, decoded to
normalized mono samples) — written against the format spec rather than pulled in as a
dependency, since WAV is small and well-defined and this is the one place in the project where
"decode the actual bytes" is the whole point. `src/audio/dsp.ts` then computes, from the real
decoded samples:

- **RMS energy** (loudness), **zero-crossing rate** (noisiness/percussiveness proxy)
- **Spectral centroid** ("brightness") via a hand-rolled radix-2 FFT — commodity math, not the
  interesting part of this project, so implementing it directly was more appropriate than
  pulling in a dependency for ~30 lines of standard algorithm
- **Tempo (BPM)** via autocorrelation of a half-wave-rectified onset envelope

These measured features are stored (`audio_features` table) and — when present — fed into the
LLM prompt as ground truth, so the model's `energy` and `tempo_feel` are grounded in a real
measurement instead of inferred from text. The `MockAnalyzer` does the same blending without
an LLM at all (see below).

**Honest limitation, found by actually testing this**: the tempo estimator is naive — no phase
alignment, no octave correction, no meter detection like a real beat tracker (librosa/essentia/
madmom) implements. In live testing against a synthetic 128 BPM click track, it locked onto 64
BPM — the textbook half-tempo/octave error for autocorrelation-based tempo detection. This is a
known, expected limitation of the approach (documented in the code), not a bug I chased down and
"fixed" by tuning against one test signal.

**Also out of scope, deliberately:** compressed audio formats (MP3, AAC, OGG, FLAC). A real
product would transcode those via `ffmpeg` before this step; adding a native/ffmpeg dependency
was a scope cut. Only uncompressed WAV is accepted today.

### LLM providers

`src/analysis/analyzer.ts` defines a one-method `Analyzer` interface. Three implementations
share the same prompt and JSON Schema (`src/analysis/prompt.ts`), so switching providers is a
config change, not a rewrite:

- **`AnthropicAnalyzer`** — Claude (`claude-opus-4-8` by default) via `output_config.format:
  json_schema`. Handles the `refusal` stop reason explicitly.
- **`GeminiAnalyzer`** — Google Gemini (`gemini-flash-latest` by default) via
  `responseMimeType: "application/json"` + `responseJsonSchema`. This is the **default local-dev
  and demo path**: Gemini's free tier (aistudio.google.com/apikey) needs no card, so it's what
  runs when you clone this repo and just want to see real model-driven analysis without paying
  for Anthropic — a deliberate budget-conscious choice for prototyping, not a downgrade.
- **`MockAnalyzer`** — a deterministic, dependency-free fallback. It hashes the track's
  title/artist/description for a stable pseudo-random text-based fingerprint, but when real
  audio features are present it grounds `energy` and `tempo_feel` in the actual measurements
  instead of the hash. This exists so the entire app — build, tests, Docker compose, a live demo
  — runs end-to-end with zero external dependencies and zero API cost when no LLM key is set. It
  is clearly labeled (`model: "mock-v1"`) everywhere it surfaces, including in the UI, so it's
  never mistaken for a real result.

`createAnalyzer()` in `src/analysis/index.ts` selects a provider at startup via `LLM_PROVIDER`
(`auto` | `anthropic` | `gemini` | `mock`) — `auto` prefers Anthropic if configured, else Gemini,
else mock. The rest of the codebase (router, repo, tests) only ever depends on the `Analyzer`
interface.

## Deploying

Split across two hosts, each doing what it's best at: **Vercel** for the Next.js frontend (same
team builds both — zero config), **Render** for the API + Postgres (Vercel's serverless model
doesn't fit a stateful Express app well: its free-tier request body limit is 4.5MB, well under
this app's 20MB audio upload cap, and Vercel doesn't host a database at all). This is the
standard split real teams use, not a compromise.

### 1. API + Postgres → Render

`render.yaml` at the repo root is a [Render Blueprint](https://render.com/docs/blueprint-spec) —
provisions Postgres and the API from one file, reusing the same Dockerfile as local Docker
Compose. No CLI, free tier requires no credit card.

1. In the [Render dashboard](https://dashboard.render.com): **New → Blueprint**, pick this repo.
   Render reads `render.yaml` and creates `songdna-db` (Postgres) and `songdna-api`.
2. On the **songdna-api** service, set `GEMINI_API_KEY` (free, from aistudio.google.com/apikey)
   or `ANTHROPIC_API_KEY` — left blank in the blueprint on purpose since secrets shouldn't be
   committed.
3. Once deployed, copy songdna-api's assigned URL from its service page (e.g.
   `https://songdna-api-xxxx.onrender.com`) — you'll need it for step 2 below.

### 2. Web app → Vercel

1. At [vercel.com/new](https://vercel.com/new), import this GitHub repo.
2. Set **Root Directory** to `apps/web` (Vercel auto-detects Next.js from there — it builds
   natively, not via `apps/web/Dockerfile`, which exists only for local Docker Compose).
3. Add an environment variable: `NEXT_PUBLIC_API_URL` = `https://<songdna-api's-url>/api`
   (the URL from step 1.3, with `/api` appended).
4. Deploy. Vercel's assigned URL is the live link.

**Free-tier tradeoffs, so they don't look like bugs:** Render's free web service spins down
after 15 minutes idle — the first request after that takes ~30-60s to wake back up. Render's
free Postgres is auto-deleted after 30 days unless upgraded to a paid plan. Vercel's free tier
has no such sleep/expiry for the frontend. Fine for a portfolio demo you're actively sending
links to; not a permanent hosting solution.

## Pushing to your own GitHub

```sh
git init
git add .
git commit -m "Initial commit"
gh repo create songdna --public --source=. --remote=origin --push
```

`.env` (with real keys) is gitignored and won't be committed — only `.env.example` (placeholders)
is tracked.

## Running it

### With Docker (recommended)

```sh
cp apps/api/.env.example apps/api/.env   # set GEMINI_API_KEY (free) or ANTHROPIC_API_KEY (paid)
docker compose up --build
```

- Web: http://localhost:3000
- API: http://localhost:4000/api/health
- Postgres: localhost:5432 (user/pass/db: `songdna`)

The `migrate` service runs once against Postgres before `api` starts (via
`depends_on: condition: service_completed_successfully`), applying both migrations.

Without any LLM key set, the API logs a warning and serves the deterministic mock analyzer —
the app still works fully, which is deliberate: you can clone this repo and see it running in
under a minute with no secrets configured at all.

### Without Docker

```sh
# Postgres running locally on 5432 with a songdna/songdna/songdna user/pass/db
cd apps/api && npm install && npm run migrate && npm run dev   # :4000
cd apps/web && npm install && npm run dev                       # :3000
```

`apps/api` loads `.env` automatically (via `dotenv`) for local runs; docker-compose injects env
vars directly and doesn't need it.

### Tests

```sh
cd apps/api && npm test
```

24 tests: Zod schema validation, mock-analyzer determinism/shape, the WAV decoder round-tripping
synthetic PCM buffers, and the DSP module recovering known signal properties (e.g. tempo from a
generated click train, spectral centroid tracking a pure tone's frequency) — all pure and free,
no database or network required. One additional test (`geminiAnalyzer.integration.test.ts`) makes
a real call to the live Gemini API and is automatically skipped unless `GEMINI_API_KEY` is set
(e.g. in a local `.env`), so CI and other contributors' machines stay green without a secret.

### What was actually verified end-to-end (not just unit-tested)

This project was run for real, not just built and unit-tested: a local PostgreSQL instance, the
actual Express API, and the actual Next.js dev server, driven through a real browser. Confirmed
live:

- Submitting the form creates a track and runs analysis, rendered correctly in the UI
- Uploading a real WAV file through `POST /tracks/:id/audio` decodes it and stores real measured
  features (this is what surfaced the tempo octave-error limitation above)
- Re-analyzing a track with audio attached measurably changes the output — `tempo_feel` and
  `energy` shift from hash-derived guesses to values grounded in the real measurement
- The live Gemini API, called for real (not mocked), returns schema-valid structured output that
  visibly reasons over both the measured audio features and the text description together
- Error paths: malformed audio → 400, unknown track → 404, oversized upload → 413

## Known follow-ups (not done, and why)

- **No auth / multi-tenancy.** A real product needs accounts and per-artist scoping; out of
  scope for this project.
- **Next.js pinned to the 14.2 LTS-style line**, not the current major — the App Router surface
  used here (`app/`, server/client component split) is stable there, and jumping to a new major
  mid-build risked breaking changes I couldn't verify without a slower, more careful migration.
  Worth revisiting before this becomes anything more than a portfolio piece.
- **No rate limiting / retry-with-backoff** around either LLM call beyond what each SDK does by
  default — fine for a demo, not for production traffic.
- **Analyses and audio features are never deleted** — there's no retention policy. Fine at demo
  scale, not at real scale.
- **WAV only, no compressed-format transcoding** — see "The audio pipeline" above.
- **Tempo estimation has no octave correction** — see "The audio pipeline" above; a real product
  would use a proper beat-tracking library instead of the hand-rolled autocorrelation here.
