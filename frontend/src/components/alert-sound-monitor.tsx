"use client";

import { useEffect, useRef } from "react";
import { apiUrl } from "@/lib/api";

const bellSoundStorageKey = "coffee_gosen_bell_sound_enabled";
const bellSoundPath = "/Campana%20Tibetana%20Mini.mp3";
const alertPollInterval = 1000;

type AlertItem = { id: string };
type AlertsResponse = { alerts: AlertItem[] };

function playBellSegment(audio: HTMLAudioElement, toneRate: number) {
  const play = () => {
    const segmentLength = Math.min(2.4, audio.duration);
    const maxStart = Math.max(0, audio.duration - segmentLength);
    audio.currentTime = Math.random() * maxStart;
    audio.playbackRate = toneRate;
    audio.volume = 1;
    void audio.play().catch(() => undefined);
  };
  if (audio.readyState >= 1) {
    play();
  } else {
    audio.addEventListener("loadedmetadata", play, { once: true });
    audio.load();
  }
}

export function AlertSoundMonitor() {
  const knownAlertIds = useRef<Set<string> | null>(null);
  const pendingSound = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlocked = useRef(false);
  const toneIndex = useRef(0);

  function playNextTone(audio: HTMLAudioElement) {
    const toneRates = [0.78, 0.92, 1.08, 1.24];
    const toneRate = toneRates[toneIndex.current % toneRates.length];
    toneIndex.current += 1;
    playBellSegment(audio, toneRate);
  }

  useEffect(() => {
    let isCurrent = true;

    function unlockAudio() {
      if (audioUnlocked.current) return;
      const audio = audioRef.current ?? new Audio(bellSoundPath);
      audioRef.current = audio;
      audio.volume = 1;
      audio.muted = true;
      void audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        audioUnlocked.current = true;
        if (pendingSound.current && window.localStorage.getItem(bellSoundStorageKey) !== "false") {
          pendingSound.current = false;
          playNextTone(audio);
        }
      }).catch(() => {
        audio.muted = false;
      });
    }

    window.addEventListener("pointerdown", unlockAudio, { once: false });
    window.addEventListener("keydown", unlockAudio, { once: false });

    async function checkAlerts() {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      if (!token) {
        knownAlertIds.current = null;
        return;
      }

      try {
        const response = await fetch(`${apiUrl}/dashboard/alerts`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok || !isCurrent) return;
        const result = await response.json() as AlertsResponse;
        const currentAlertIds = new Set(result.alerts.map((alert) => alert.id));
        if (knownAlertIds.current === null) {
          knownAlertIds.current = currentAlertIds;
          return;
        }
        const hasNewAlert = result.alerts.some((alert) => !knownAlertIds.current?.has(alert.id));
        knownAlertIds.current = currentAlertIds;
        if (hasNewAlert && window.localStorage.getItem(bellSoundStorageKey) !== "false") {
          const audio = audioRef.current;
          if (audioUnlocked.current && audio) {
            playNextTone(audio);
          } else {
            pendingSound.current = true;
          }
        }
      } catch {
        // Alert polling is secondary and must not interrupt the current screen.
      }
    }

    void checkAlerts();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void checkAlerts();
    }, alertPollInterval);

    return () => {
      isCurrent = false;
      window.clearInterval(interval);
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  return null;
}
