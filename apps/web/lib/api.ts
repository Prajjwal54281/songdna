import type { AudioFeatures, Analysis, Track, TrackWithAnalysis } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export interface CreateTrackInput {
  title: string;
  artist: string;
  description?: string;
}

export function listTracks(): Promise<{ items: TrackWithAnalysis[] }> {
  return request("/tracks");
}

export function createTrack(
  input: CreateTrackInput,
): Promise<{ track: Track; analysis: Analysis | null; analysisError?: string }> {
  return request("/tracks", { method: "POST", body: JSON.stringify(input) });
}

export function reanalyzeTrack(trackId: string): Promise<{ analysis: Analysis }> {
  return request(`/tracks/${trackId}/analyze`, { method: "POST" });
}

export async function uploadAudio(
  trackId: string,
  file: File,
): Promise<{ audioFeatures: AudioFeatures }> {
  const formData = new FormData();
  formData.append("file", file);
  // No Content-Type header here. The browser sets the multipart boundary itself.
  const res = await fetch(`${API_URL}/tracks/${trackId}/audio`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<{ audioFeatures: AudioFeatures }>;
}
