import { describe, expect, it } from "vitest";
import { decodeWav, UnsupportedAudioError } from "../src/audio/wav.js";
import { encodeWav16, sineWave } from "./testWav.js";

describe("decodeWav", () => {
  it("decodes a mono 16-bit PCM WAV back to normalized samples", () => {
    const sampleRate = 44100;
    const original = sineWave(440, 0.5, sampleRate, 0.5);
    const buf = encodeWav16(original, sampleRate);

    const decoded = decodeWav(buf);

    expect(decoded.sampleRate).toBe(sampleRate);
    expect(decoded.channels).toBe(1);
    expect(decoded.samples.length).toBe(original.length);
    // 16-bit quantization introduces small error; allow a generous tolerance.
    expect(Math.abs(decoded.samples[100] - original[100])).toBeLessThan(0.01);
  });

  it("throws UnsupportedAudioError on garbage input", () => {
    const garbage = Buffer.from("not a wav file at all, just text");
    expect(() => decodeWav(garbage)).toThrow(UnsupportedAudioError);
  });

  it("throws UnsupportedAudioError when the data chunk is missing", () => {
    const buf = Buffer.alloc(44);
    buf.write("RIFF", 0, "ascii");
    buf.writeUInt32LE(36, 4);
    buf.write("WAVE", 8, "ascii");
    buf.write("fmt ", 12, "ascii");
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(44100, 24);
    buf.writeUInt32LE(88200, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    expect(() => decodeWav(buf)).toThrow(UnsupportedAudioError);
  });
});
