"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voice I/O for the interview room, built on browser-native APIs:
 *  - Speech-to-text: Web Speech API (SpeechRecognition) — Chrome/Edge/Safari.
 *  - Text-to-speech: speechSynthesis.
 *
 * Design notes:
 *  - `supported` is false on browsers without SpeechRecognition; the UI hides
 *    the mic and the app stays fully usable as text-only.
 *  - Recognition runs in continuous mode with interim results; the caller gets
 *    a live transcript to render inside the composer.
 *  - Speaking is sentence-buffered: the caller feeds streamed chunks via
 *    `speakChunk`, and we flush complete sentences to the synthesizer so the
 *    interviewer starts talking before the full reply has arrived.
 */
export function useVoice() {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState("");

  const recRef = useRef(null);
  const finalRef = useRef("");
  const onFinalRef = useRef(null);
  const bufferRef = useRef("");

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        !!(window.SpeechRecognition || window.webkitSpeechRecognition) &&
        !!window.speechSynthesis
    );
    return () => {
      try {
        recRef.current?.abort();
        window.speechSynthesis?.cancel();
      } catch {}
    };
  }, []);

  /** Start dictation. onFinal(text) fires with accumulated text when stopped. */
  const startListening = useCallback((onFinal) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || recRef.current) return;

    // The interviewer must not talk over the candidate.
    window.speechSynthesis?.cancel();
    setSpeaking(false);

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    finalRef.current = "";
    onFinalRef.current = onFinal;

    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript + " ";
        else interimText += r[0].transcript;
      }
      setInterim((finalRef.current + interimText).trim());
    };
    rec.onerror = () => stopListening();
    rec.onend = () => {
      // Fires on natural silence timeout as well as manual stop.
      recRef.current = null;
      setListening(false);
      const text = finalRef.current.trim();
      setInterim("");
      if (text && onFinalRef.current) onFinalRef.current(text);
    };

    recRef.current = rec;
    setListening(true);
    setInterim("");
    rec.start();
  }, []);

  const stopListening = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {}
  }, []);

  /** Feed a streamed text chunk; complete sentences are spoken as they form. */
  const speakChunk = useCallback((text) => {
    bufferRef.current += text;
    // Flush everything up to the last sentence boundary.
    const match = bufferRef.current.match(/^[\s\S]*[.!?…](?=\s|$)/);
    if (match) {
      const sentence = match[0];
      bufferRef.current = bufferRef.current.slice(sentence.length);
      speakNow(sentence, setSpeaking);
    }
  }, []);

  /** Flush any remaining buffered text (call when the stream is done). */
  const speakFlush = useCallback(() => {
    const rest = bufferRef.current.trim();
    bufferRef.current = "";
    if (rest) speakNow(rest, setSpeaking);
  }, []);

  const stopSpeaking = useCallback(() => {
    bufferRef.current = "";
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  return {
    supported,
    listening,
    speaking,
    interim,
    startListening,
    stopListening,
    speakChunk,
    speakFlush,
    stopSpeaking,
  };
}

/** Strip markdown/tokens so the synthesizer reads natural prose. */
function toSpeakable(text) {
  return text
    .replace(/<<END_INTERVIEW>>/g, "")
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function speakNow(text, setSpeaking) {
  const clean = toSpeakable(text);
  if (!clean || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(clean);
  u.rate = 1.04;
  u.pitch = 1;
  // Prefer a natural-sounding local voice when available.
  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find((v) => /Samantha|Google US English|Microsoft Aria/i.test(v.name)) ||
    voices.find((v) => v.lang?.startsWith("en") && v.localService);
  if (preferred) u.voice = preferred;
  u.onstart = () => setSpeaking(true);
  u.onend = () => {
    if (!window.speechSynthesis.pending && !window.speechSynthesis.speaking) {
      setSpeaking(false);
    }
  };
  window.speechSynthesis.speak(u);
}
