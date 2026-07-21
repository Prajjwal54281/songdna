/** Test helper: encodes a mono 16-bit PCM WAV buffer from a sample generator
 * function, so DSP tests can exercise the real decode path against known
 * signals (silence, a pure tone, a click train) instead of needing fixture
 * audio files checked into the repo. */
export function encodeWav16(samples: Float32Array, sampleRate: number): Buffer {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // audio format: PCM
  buf.writeUInt16LE(1, 22); // channels: mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * bytesPerSample, 28); // byte rate
  buf.writeUInt16LE(bytesPerSample, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(clamped * 32767), 44 + i * bytesPerSample);
  }

  return buf;
}

export function sineWave(freqHz: number, durationSec: number, sampleRate: number, amplitude = 0.5): Float32Array {
  const n = Math.floor(durationSec * sampleRate);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    samples[i] = amplitude * Math.sin((2 * Math.PI * freqHz * i) / sampleRate);
  }
  return samples;
}

/** A periodic click train at the given tempo — a simple, unambiguous signal
 * for exercising the tempo estimator. */
export function clickTrain(bpm: number, durationSec: number, sampleRate: number): Float32Array {
  const n = Math.floor(durationSec * sampleRate);
  const samples = new Float32Array(n);
  const periodSamples = Math.round((60 / bpm) * sampleRate);
  const clickLength = Math.round(0.005 * sampleRate); // 5ms click
  for (let start = 0; start < n; start += periodSamples) {
    for (let i = 0; i < clickLength && start + i < n; i++) {
      // Decaying click, not a hard impulse — closer to a real percussive onset.
      samples[start + i] = 0.9 * (1 - i / clickLength);
    }
  }
  return samples;
}
