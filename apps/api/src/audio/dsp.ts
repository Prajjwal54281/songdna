import type { AudioFeatures } from "../domain/types.js";
import type { DecodedAudio } from "./wav.js";

/**
 * In-place iterative radix-2 Cooley-Tukey FFT. `re`/`im` must have a
 * power-of-two length. This is the one place a hand-rolled implementation of
 * a well-known algorithm is the right call: FFT correctness is commodity, and
 * the value of this project is the pipeline architecture around it, not
 * proving the FFT itself from scratch — but pulling in a dependency for ~30
 * lines of standard math would be adding a dependency for no real benefit.
 */
function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n <= 1) return;

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
        const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + len / 2] = uRe - vRe;
        im[i + k + len / 2] = uIm - vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        const nextIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
        curIm = nextIm;
      }
    }
  }
}

export function rmsEnergy(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) sumSquares += samples[i] * samples[i];
  return Math.sqrt(sumSquares / samples.length);
}

export function zeroCrossingRate(samples: Float32Array): number {
  if (samples.length < 2) return 0;
  let crossings = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i - 1] >= 0) !== (samples[i] >= 0)) crossings++;
  }
  return crossings / (samples.length - 1);
}

/** Weighted-average frequency of the magnitude spectrum ("brightness"),
 * averaged across a handful of Hann-windowed frames spread through the
 * track for stability against a single noisy frame. */
export function spectralCentroidHz(samples: Float32Array, sampleRate: number): number {
  const windowSize = 2048;
  if (samples.length < windowSize) return 0;

  const frameCount = 8;
  const hann = new Float64Array(windowSize);
  for (let i = 0; i < windowSize; i++) {
    hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (windowSize - 1));
  }

  let centroidSum = 0;
  let framesUsed = 0;

  for (let f = 0; f < frameCount; f++) {
    const start = Math.floor(((f + 0.5) / frameCount) * (samples.length - windowSize));
    const re = new Float64Array(windowSize);
    const im = new Float64Array(windowSize);
    for (let i = 0; i < windowSize; i++) re[i] = samples[start + i] * hann[i];
    fftInPlace(re, im);

    let weighted = 0;
    let magSum = 0;
    for (let bin = 0; bin < windowSize / 2; bin++) {
      const mag = Math.hypot(re[bin], im[bin]);
      const freq = (bin * sampleRate) / windowSize;
      weighted += freq * mag;
      magSum += mag;
    }
    if (magSum > 1e-6) {
      centroidSum += weighted / magSum;
      framesUsed++;
    }
  }

  return framesUsed > 0 ? centroidSum / framesUsed : 0;
}

/**
 * Naive tempo estimate via autocorrelation of a half-wave-rectified onset
 * envelope. This is not a real beat tracker (no phase alignment, no
 * dynamic-programming beat sequence, no meter detection like
 * librosa/essentia/madmom implement) — it finds the strongest periodicity in
 * the energy envelope within a plausible tempo range and reports that. Good
 * enough to ground "tempo_feel" in a real measurement; not a replacement for
 * a dedicated beat-tracking algorithm. Returns null when the track is too
 * short or too quiet to produce a confident estimate.
 */
export function estimateTempoBpm(samples: Float32Array, sampleRate: number): number | null {
  const frameSize = 1024;
  const hop = 512;
  const minBpm = 60;
  const maxBpm = 200;

  const frameCount = Math.floor((samples.length - frameSize) / hop);
  if (frameCount < 20) return null; // too short for a meaningful periodicity estimate

  const envelope = new Float64Array(frameCount);
  for (let f = 0; f < frameCount; f++) {
    const start = f * hop;
    let sumSquares = 0;
    for (let i = 0; i < frameSize; i++) {
      const s = samples[start + i];
      sumSquares += s * s;
    }
    envelope[f] = Math.sqrt(sumSquares / frameSize);
  }

  const onset = new Float64Array(frameCount);
  for (let i = 1; i < frameCount; i++) {
    onset[i] = Math.max(0, envelope[i] - envelope[i - 1]);
  }

  const mean = onset.reduce((a, b) => a + b, 0) / onset.length;
  if (mean < 1e-5) return null; // effectively silent — no onsets to lock onto

  const minLag = Math.max(1, Math.round((60 / maxBpm) * (sampleRate / hop)));
  const maxLag = Math.min(frameCount - 1, Math.round((60 / minBpm) * (sampleRate / hop)));
  if (minLag >= maxLag) return null;

  let bestLag = -1;
  let bestScore = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let score = 0;
    for (let i = 0; i + lag < frameCount; i++) {
      score += onset[i] * onset[i + lag];
    }
    score /= frameCount - lag;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  if (bestLag <= 0 || bestScore < 1e-8) return null;
  const bpm = 60 / ((bestLag * hop) / sampleRate);
  return Math.round(bpm * 10) / 10;
}

/** Normalizes RMS energy against a loud-but-not-clipping reference so the
 * 0-1 scale reads sensibly for typical mastered music rather than saturating
 * near 0 for anything that isn't full-scale white noise. */
function normalizeEnergy(rawRms: number): number {
  const referenceRms = 0.3; // ~typical loud mastered mix
  return Math.max(0, Math.min(1, rawRms / referenceRms));
}

export function extractAudioFeatures(audio: DecodedAudio, filename: string): AudioFeatures {
  const { samples, sampleRate, channels } = audio;
  return {
    filename,
    durationSec: samples.length / sampleRate,
    sampleRate,
    channels,
    tempoBpm: estimateTempoBpm(samples, sampleRate),
    rmsEnergy: normalizeEnergy(rmsEnergy(samples)),
    spectralCentroidHz: spectralCentroidHz(samples, sampleRate),
    zeroCrossingRate: zeroCrossingRate(samples),
  };
}
