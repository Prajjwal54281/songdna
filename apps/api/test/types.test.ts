import { describe, expect, it } from "vitest";
import { SongDnaSchema, TrackInputSchema } from "../src/domain/types.js";

describe("TrackInputSchema", () => {
  it("accepts a minimal valid track", () => {
    const result = TrackInputSchema.safeParse({ title: "Song", artist: "Artist" });
    expect(result.success).toBe(true);
  });

  it("rejects a track missing a title", () => {
    const result = TrackInputSchema.safeParse({ artist: "Artist" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid sourceUrl", () => {
    const result = TrackInputSchema.safeParse({
      title: "Song",
      artist: "Artist",
      sourceUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});

describe("SongDnaSchema", () => {
  const validDna = {
    genres: [{ label: "indie folk", confidence: 0.8 }],
    moods: [{ label: "nostalgic", confidence: 0.7 }],
    instrumentation: [{ label: "acoustic guitar", confidence: 0.9 }],
    tempo_feel: "laid-back",
    energy: 0.4,
    summary: "A gentle, reflective track.",
  };

  it("accepts a well-formed Song DNA object", () => {
    expect(() => SongDnaSchema.parse(validDna)).not.toThrow();
  });

  it("rejects a confidence score outside [0, 1]", () => {
    const bad = { ...validDna, genres: [{ label: "indie folk", confidence: 1.5 }] };
    expect(() => SongDnaSchema.parse(bad)).toThrow();
  });

  it("rejects an empty genres array", () => {
    const bad = { ...validDna, genres: [] };
    expect(() => SongDnaSchema.parse(bad)).toThrow();
  });
});
