"use client";

import { useEffect, useRef } from "react";
import { apiUrl } from "@/lib/api";

const bellSoundStorageKey = "coffee_gosen_bell_sound_enabled";
const bellSoundPath = "/Campana%20Tibetana%20Mini.mp3";
const alertPollInterval = 30000;

type AlertsResponse = { unread_count: number };

function playBellSegment() {
  const audio = new Audio(bellSoundPath);
  audio.volume = 0.65;
  audio.addEventListener("loadedmetadata", () => {
    const segmentLength = Math.min(2.4, audio.duration);
    const maxStart = Math.max(0, audio.duration - segmentLength);
    audio.currentTime = Math.random() * maxStart;
    void audio.play().catch(() => undefined);
  }, { once: true });
}

export function AlertSoundMonitor() {
  const previousUnreadAlerts = useRef<number | null>(null);

  useEffect(() => {
    let isCurrent = true;

    async function checkAlerts() {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      if (!token) {
        previousUnreadAlerts.current = null;
        return;
      }

      try {
        const response = await fetch(`${apiUrl}/dashboard/alerts`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok || !isCurrent) return;
        const result = await response.json() as AlertsResponse;
        const soundEnabled = window.localStorage.getItem(bellSoundStorageKey) !== "false";
        if (soundEnabled && previousUnreadAlerts.current !== null && result.unread_count > previousUnreadAlerts.current) {
          playBellSegment();
        }
        previousUnreadAlerts.current = result.unread_count;
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
    };
  }, []);

  return null;
}
