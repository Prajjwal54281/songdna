"use client";

import { useRef } from "react";
import type { TrackWithAnalysis } from "../lib/types";

function TagGroup({ label, tags }: { label: string; tags: { label: string; confidence: number }[] }) {
  return (
    <div className="tag-group">
      <div className="tag-group-label">{label}</div>
      {tags.map((tag) => (
        <div className="tag-row" key={tag.label}>
          <span className="tag-chip">{tag.label}</span>
          <div className="confidence-track">
            <div className="confidence-fill" style={{ width: `${Math.round(tag.confidence * 100)}%` }} />
          </div>
          <span className="confidence-value">{Math.round(tag.confidence * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

export function DnaCard({
  item,
  onReanalyze,
  isReanalyzing,
  onUploadAudio,
  isUploadingAudio,
}: {
  item: TrackWithAnalysis;
  onReanalyze: (trackId: string) => void;
  isReanalyzing: boolean;
  onUploadAudio: (trackId: string, file: File) => void;
  isUploadingAudio: boolean;
}) {
  const { track, analysis, audioFeatures } = item;
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onUploadAudio(track.id, file);
    e.target.value = ""; // allow re-selecting the same file later
  }

  return (
    <div className="panel track-card">
      <h3>
        {track.title} <span style={{ color: "var(--muted)", fontWeight: 400 }}>— {track.artist}</span>
      </h3>
      <div className="track-meta">
        {new Date(track.createdAt).toLocaleString()}
        {track.description ? ` · "${track.description.slice(0, 80)}${track.description.length > 80 ? "…" : ""}"` : ""}
      </div>

      {audioFeatures && (
        <div className="audio-features">
          <div className="tag-group-label">Measured from audio ({audioFeatures.filename})</div>
          <div className="audio-stat-grid">
            <div>
              Duration <strong>{audioFeatures.durationSec.toFixed(1)}s</strong>
            </div>
            <div>
              Tempo <strong>{audioFeatures.tempoBpm ? `${Math.round(audioFeatures.tempoBpm)} BPM` : "n/a"}</strong>
            </div>
            <div>
              Energy <strong>{Math.round(audioFeatures.rmsEnergy * 100)}%</strong>
            </div>
            <div>
              Brightness <strong>{Math.round(audioFeatures.spectralCentroidHz)}Hz</strong>
            </div>
          </div>
        </div>
      )}

      {!analysis && <div className="empty-state">No analysis yet.</div>}

      {analysis && (
        <>
          <TagGroup label="Genres" tags={analysis.dna.genres} />
          <TagGroup label="Moods" tags={analysis.dna.moods} />
          <TagGroup label="Instrumentation" tags={analysis.dna.instrumentation} />

          <div className="stat-row">
            <div>
              Tempo feel: <strong>{analysis.dna.tempo_feel}</strong>
            </div>
            <div>
              Energy: <strong>{Math.round(analysis.dna.energy * 100)}%</strong>
            </div>
          </div>

          <div className="summary">{analysis.dna.summary}</div>
        </>
      )}

      <div className="card-footer">
        <span className="model-badge">{analysis ? analysis.model : "unanalyzed"}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/wav,.wav"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <button
            className="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingAudio}
          >
            {isUploadingAudio ? "Analyzing audio…" : audioFeatures ? "Replace audio" : "Upload audio (.wav)"}
          </button>
          <button className="secondary" onClick={() => onReanalyze(track.id)} disabled={isReanalyzing}>
            {isReanalyzing ? "Analyzing…" : "Re-analyze"}
          </button>
        </div>
      </div>
    </div>
  );
}
