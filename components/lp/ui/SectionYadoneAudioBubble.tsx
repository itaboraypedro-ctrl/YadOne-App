"use client";

import { useEffect, useRef, useState } from "react";

// Same dense bar pattern as the hero audio bubble so they read as siblings.
const BARS = [
  14, 20, 24, 26, 20, 16, 10, 5, 14, 20,
  24, 16, 5, 10, 20, 24, 26, 20, 5, 8,
  16, 24, 20, 10, 5, 14, 20, 24, 16, 10,
  5, 16, 20, 14, 8, 5,
];

export function SectionYadoneAudioBubble() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState("0:12");

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onLoaded = () => {
      if (!isFinite(a.duration)) return;
      const mins = Math.floor(a.duration / 60);
      const secs = Math.floor(a.duration % 60).toString().padStart(2, "0");
      setDuration(`${mins}:${secs}`);
    };
    const onEnded = () => setIsPlaying(false);
    const onPause = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);

    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("ended", onEnded);
    a.addEventListener("pause", onPause);
    a.addEventListener("play", onPlay);

    return () => {
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("play", onPlay);
    };
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().catch(() => {});
    } else {
      a.pause();
    }
  };

  return (
    <div className="bubble in yadone-audio dark">
      <audio ref={audioRef} src="/yadone/voz-section.mp3" preload="metadata" />

      <div className="who">
        <span className="av">F</span>
        FARMÁCIA
      </div>

      <div className="audio-row">
        <button
          type="button"
          onClick={toggle}
          className="play-btn-circle"
          aria-label={isPlaying ? "Pausar áudio" : "Reproduzir áudio"}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="2" y="1" width="3" height="12" rx="0.5" />
              <rect x="9" y="1" width="3" height="12" rx="0.5" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M3 1.5 L12.5 7 L3 12.5 Z" />
            </svg>
          )}
        </button>
        <div className={`waveform-flat ${isPlaying ? "playing" : ""}`}>
          {BARS.map((h, i) => (
            <span key={i} style={{ height: `${h}px` }} />
          ))}
        </div>
        <span className="duration">{duration}</span>
      </div>

      <p className="transcript">
        Oi Ana! Seu antibiótico acaba em 3 dias. Quer que a gente já separe a próxima caixa?
      </p>

      <span className="time">14:00</span>
    </div>
  );
}
