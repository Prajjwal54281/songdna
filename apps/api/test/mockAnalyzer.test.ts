import { describe, expect, it } from "vitest";
import { MockAnalyzer } from "../src/analysis/mockAnalyzer.js";
import { SongDnaSchema } from "../src/domain/types.js";

describe("MockAnalyzer", () => {
  const analyzer = new MockAnalyzer();

  it("produces output matching the SongDna schema", async () => {
    const dna = await analyzer.analyze({ title: "Midnight Drive", artist: "The Wires" });
    expect(() => SongDnaSchema.parse(dna)).not.toThrow();
    expect(dna.genres.length).toBeGreaterThan(0);
    expect(dna.moods.length).toBeGreaterThan(0);
    expect(dna.instrumentation.length).toBeGreaterThan(0);
    expect(dna.energy).toBeGreaterThanOrEqual(0);
    expect(dna.energy).toBeLessThanOrEqual(1);
  });

  it("is deterministic for the same track input", async () => {
    const input = { title: "Midnight Drive", artist: "The Wires", description: "a slow burner" };
    const first = await analyzer.analyze(input);
    const second = await analyzer.analyze(input);
    expect(first).toEqual(second);
  });

  it("produces different fingerprints for different tracks", async () => {
    const a = await analyzer.analyze({ title: "Midnight Drive", artist: "The Wires" });
    const b = await analyzer.analyze({ title: "Sunday Light", artist: "Paper Moons" });
    expect(a).not.toEqual(b);
  });

  it("orders tags by descending confidence", async () => {
    const dna = await analyzer.analyze({ title: "Static Bloom", artist: "Halide" });
    const confidences = dna.genres.map((g) => g.confidence);
    const sorted = [...confidences].sort((x, y) => y - x);
    expect(confidences).toEqual(sorted);
  });
});
