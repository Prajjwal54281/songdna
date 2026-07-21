function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required(
    "DATABASE_URL",
    "postgres://songdna:songdna@localhost:5432/songdna",
  ),

  // "auto" (default) picks Anthropic if configured, else Gemini's free tier,
  // else the deterministic mock. Set explicitly to force a provider.
  llmProvider: (process.env.LLM_PROVIDER ?? "auto") as "auto" | "anthropic" | "gemini" | "mock",

  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8",

  // Free tier via Google AI Studio (aistudio.google.com/apikey), no card
  // required for the free quota. Used for budget-conscious prototyping and
  // as the default local-dev LLM path. "gemini-flash-latest" is Google's own
  // rolling alias. Pin-dated model IDs (e.g. "gemini-2.5-flash") have been
  // observed returning 404 "no longer available to new users" within months
  // of release, so the alias is the safer default here.
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-flash-latest",

  // Max size (bytes) of an uploaded audio file for signal analysis.
  maxAudioUploadBytes: Number(process.env.MAX_AUDIO_UPLOAD_BYTES ?? 20 * 1024 * 1024),
};
