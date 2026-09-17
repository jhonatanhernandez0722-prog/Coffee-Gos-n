"use client";

import { useEffect, useRef } from "react";

const bellSoundStorageKey = "coffee_gosen_bell_sound_enabled";
const bellSoundPath = "/Campana%20Tibetana%20Mini.mp3";

type EnhancedAudioElement = HTMLAudioElement & {
  __coffeeBellGain?: GainNode;
  __coffeeBellContext?: AudioContext;
};

function ensureMaxVolume(audio: EnhancedAudioElement) {
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    audio.volume = 1;
    return;
  }

  if (!audio.__coffeeBellContext || !audio.__coffeeBellGain) {
    const context = new AudioContextCtor();
    const source = context.createMediaElementSource(audio);
    const gainNode = context.createGain();
    gainNode.gain.value = 3.5;
    source.connect(gainNode);
    gainNode.connect(context.destination);
    audio.__coffeeBellContext = context;
    audio.__coffeeBellGain = gainNode;
  }

  audio.volume = 1;
  if (audio.__coffeeBellContext.state === "suspended") {
    void audio.__coffeeBellContext.resume();
  }
}

function playBellSegment(audio: HTMLAudioElement, toneRate: number) {
  const enhancedAudio = audio as EnhancedAudioElement;
  ensureMaxVolume(enhancedAudio);
  const play = () => {
    const segmentLength = Math.min(2.4, audio.duration || 0.6);
    const maxStart = Math.max(0, (audio.duration || 0.6) - segmentLength);
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

    function handleNewAlert() {
      if (window.localStorage.getItem(bellSoundStorageKey) === "false") return;
      const audio = audioRef.current;
      if (audioUnlocked.current && audio) {
        playNextTone(audio);
      } else {
        pendingSound.current = true;
      }
    }

    window.addEventListener("coffee-gosen-new-alert", handleNewAlert);

    return () => {
      isCurrent = false;
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("coffee-gosen-new-alert", handleNewAlert);
    };
  }, []);

  return null;
}
