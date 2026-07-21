/**
 * Minimal WAV (RIFF/WAVE) decoder, hand-written against the format spec
 * rather than pulled in as a dependency, since the format is small and
 * well-defined and this is the one place in the project where "decode the
 * actual bytes" is the whole point. Supports uncompressed PCM (8/16/24/32-bit
 * integer) and 32-bit IEEE float, mono or stereo (downmixed to mono for
 * feature extraction, see audio/dsp.ts).
 *
 * Deliberately out of scope: compressed formats (MP3, AAC, OGG, FLAC). A
 * real product would transcode those via ffmpeg before this step; adding a
 * native/ffmpeg dependency was a scope cut for this project. See README.
 */

export class UnsupportedAudioError extends Error {}

export interface DecodedAudio {
  sampleRate: number;
  channels: number;
  /** Mono-downmixed samples, normalized to [-1, 1]. */
  samples: Float32Array;
}

function readChunkId(buf: Buffer, offset: number): string {
  return buf.toString("ascii", offset, offset + 4);
}

export function decodeWav(buf: Buffer): DecodedAudio {
  if (buf.length < 44 || readChunkId(buf, 0) !== "RIFF" || readChunkId(buf, 8) !== "WAVE") {
    throw new UnsupportedAudioError(
      "Not a valid WAV file (missing RIFF/WAVE header). Only uncompressed WAV is supported.",
    );
  }

  let offset = 12;
  let audioFormat: number | null = null;
  let numChannels: number | null = null;
  let sampleRate: number | null = null;
  let bitsPerSample: number | null = null;
  let dataStart: number | null = null;
  let dataSize: number | null = null;

  while (offset + 8 <= buf.length) {
    const id = readChunkId(buf, offset);
    const size = buf.readUInt32LE(offset + 4);
    const bodyStart = offset + 8;

    if (id === "fmt ") {
      audioFormat = buf.readUInt16LE(bodyStart);
      numChannels = buf.readUInt16LE(bodyStart + 2);
      sampleRate = buf.readUInt32LE(bodyStart + 4);
      bitsPerSample = buf.readUInt16LE(bodyStart + 14);
    } else if (id === "data") {
      dataStart = bodyStart;
      dataSize = Math.min(size, buf.length - bodyStart);
    }

    // Chunks are word-aligned: odd-sized chunk bodies have one padding byte.
    offset = bodyStart + size + (size % 2);
  }

  if (audioFormat === null || numChannels === null || sampleRate === null || bitsPerSample === null) {
    throw new UnsupportedAudioError("WAV file is missing a valid 'fmt ' chunk.");
  }
  if (dataStart === null || dataSize === null || dataSize <= 0) {
    throw new UnsupportedAudioError("WAV file has no 'data' chunk.");
  }
  if (audioFormat !== 1 && audioFormat !== 3) {
    throw new UnsupportedAudioError(
      `Unsupported WAV audio format code ${audioFormat}. Only PCM (1) and IEEE float (3) are supported.`,
    );
  }

  const bytesPerSample = bitsPerSample / 8;
  const frameCount = Math.floor(dataSize / (bytesPerSample * numChannels));
  const mono = new Float32Array(frameCount);

  for (let frame = 0; frame < frameCount; frame++) {
    let sum = 0;
    for (let ch = 0; ch < numChannels; ch++) {
      const sampleOffset = dataStart + (frame * numChannels + ch) * bytesPerSample;
      sum += readSample(buf, sampleOffset, bitsPerSample, audioFormat);
    }
    mono[frame] = sum / numChannels;
  }

  return { sampleRate, channels: numChannels, samples: mono };
}

function readSample(buf: Buffer, offset: number, bitsPerSample: number, audioFormat: number): number {
  if (audioFormat === 3 && bitsPerSample === 32) {
    return buf.readFloatLE(offset);
  }
  switch (bitsPerSample) {
    case 8:
      // 8-bit PCM is unsigned, centered at 128.
      return (buf.readUInt8(offset) - 128) / 128;
    case 16:
      return buf.readInt16LE(offset) / 32768;
    case 24: {
      const b0 = buf[offset];
      const b1 = buf[offset + 1];
      const b2 = buf[offset + 2];
      let value = (b2 << 16) | (b1 << 8) | b0;
      if (value & 0x800000) value -= 0x1000000; // sign-extend 24-bit
      return value / 8388608;
    }
    case 32:
      return buf.readInt32LE(offset) / 2147483648;
    default:
      throw new UnsupportedAudioError(`Unsupported bit depth: ${bitsPerSample}-bit.`);
  }
}
