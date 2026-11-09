"use client";

/**
 * 프로토타입용 음성 기능: 브라우저 내장 Web Speech API (무료, Chrome/Edge 권장).
 * 실서비스에서는 STT(예: Clova Speech, Whisper)와 캐릭터 전용 TTS(예: 타입캐스트, ElevenLabs)로 교체한다.
 */

export function speak(text: string, opts: { rate: number; pitch: number }, onEnd?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  // 마크다운 기호는 읽지 않게 지운다
  const clean = text.replace(/[*#>`_]/g, "").replace(/\n+/g, " ");
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = "ko-KR";
  u.rate = opts.rate;
  u.pitch = opts.pitch;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("ko"));
  if (voice) u.voice = voice;
  if (onEnd) u.onend = onEnd;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}

export function speechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/** 한 번 말한 내용을 받아 적는다. 반환값은 멈추는 함수. */
export function listenOnce(handlers: {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onEnd: () => void;
  onError: (msg: string) => void;
}): () => void {
  const w = window as unknown as Record<string, new () => RecognitionLike>;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) {
    handlers.onError("이 브라우저는 음성 인식을 지원하지 않아요. Chrome이나 Edge를 써 주세요.");
    return () => {};
  }
  const rec = new Ctor();
  rec.lang = "ko-KR";
  rec.interimResults = true;
  rec.continuous = false;
  let finalText = "";
  rec.onresult = (e) => {
    let interim = "";
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    handlers.onInterim(finalText + interim);
  };
  rec.onerror = (e) => {
    if (e.error !== "no-speech" && e.error !== "aborted") handlers.onError(`음성 인식 오류: ${e.error}`);
  };
  rec.onend = () => {
    if (finalText.trim()) handlers.onFinal(finalText.trim());
    handlers.onEnd();
  };
  rec.start();
  return () => rec.stop();
}
