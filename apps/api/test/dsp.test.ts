import { describe, expect, it } from "vitest";
import {
  estimateTempoBpm,
  extractAudioFeatures,
  rmsEnergy,
  spectralCentroidHz,
  zeroCrossingRate,
} from "../src/audio/dsp.js";
import { clickTrain, sineWave } from "./testWav.js";

const SAMPLE_RATE = 44100;

describe("rmsEnergy", () => {
  it("is zero for silence", () => {
    expect(rmsEnergy(new Float32Array(1000))).toBe(0);
  });

  it("is higher for a louder tone than a quieter one", () => {
    const quiet = sineWave(440, 0.2, SAMPLE_RATE, 0.1);
    const loud = sineWave(440, 0.2, SAMPLE_RATE, 0.8);
    expect(rmsEnergy(loud)).toBeGreaterThan(rmsEnergy(quiet));
  });
});

describe("zeroCrossingRate", () => {
  it("is near zero for a constant DC signal", () => {
    const dc = new Float32Array(1000).fill(0.5);
    expect(zeroCrossingRate(dc)).toBe(0);
  });

  it("is higher for a high-frequency tone than a low-frequency one", () => {
    const low = sineWave(110, 0.2, SAMPLE_RATE);
    const high = sineWave(4000, 0.2, SAMPLE_RATE);
    expect(zeroCrossingRate(high)).toBeGreaterThan(zeroCrossingRate(low));
  });
});

describe("spectralCentroidHz", () => {
  it("is higher for a high-frequency tone than a low-frequency one", () => {
    const low = sineWave(110, 1.0, SAMPLE_RATE);
    const high = sineWave(4000, 1.0, SAMPLE_RATE);
    expect(spectralCentroidHz(high, SAMPLE_RATE)).toBeGreaterThan(spectralCentroidHz(low, SAMPLE_RATE));
  });

  it("roughly tracks the frequency of a pure sine tone", () => {
    const freq = 1000;
    const tone = sineWave(freq, 1.0, SAMPLE_RATE);
    const centroid = spectralCentroidHz(tone, SAMPLE_RATE);
    // A pure tone's centroid should land close to its own frequency.
    expect(centroid).toBeGreaterThan(freq * 0.7);
    expect(centroid).toBeLessThan(freq * 1.3);
  });
});

describe("estimateTempoBpm", () => {
  it("recovers the tempo of a clean click train", () => {
    const bpm = estimateTempoBpm(clickTrain(120, 8, SAMPLE_RATE), SAMPLE_RATE);
    expect(bpm).not.toBeNull();
    expect(bpm!).toBeGreaterThan(110);
    expect(bpm!).toBeLessThan(130);
  });

  it("returns null for silence", () => {
    expect(estimateTempoBpm(new Float32Array(SAMPLE_RATE * 5), SAMPLE_RATE)).toBeNull();
  });

  it("returns null for audio too short to estimate from", () => {
    const shortClip = sineWave(440, 0.1, SAMPLE_RATE);
    expect(estimateTempoBpm(shortClip, SAMPLE_RATE)).toBeNull();
  });
});

describe("extractAudioFeatures", () => {
  it("produces a fully-populated, schema-shaped feature set", () => {
    const audio = { samples: clickTrain(128, 6, SAMPLE_RATE), sampleRate: SAMPLE_RATE, channels: 1 };
    const features = extractAudioFeatures(audio, "test.wav");

    expect(features.filename).toBe("test.wav");
    expect(features.sampleRate).toBe(SAMPLE_RATE);
    expect(features.channels).toBe(1);
    expect(features.durationSec).toBeCloseTo(6, 0);
    expect(features.tempoBpm).not.toBeNull();
    expect(features.rmsEnergy).toBeGreaterThanOrEqual(0);
    expect(features.rmsEnergy).toBeLessThanOrEqual(1);
    expect(features.zeroCrossingRate).toBeGreaterThanOrEqual(0);
    expect(features.spectralCentroidHz).toBeGreaterThanOrEqual(0);
  });
});
