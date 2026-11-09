"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CharacterAvatar } from "@/components/CharacterFace";
import { BackIcon, ImageIcon, MicIcon, PanelIcon, SendIcon, SpeakerIcon, XIcon } from "@/components/Icons";
import { PersonPanel } from "@/components/PersonPanel";
import { CHARACTERS } from "@/lib/characters";
import { josa, splitBubbles } from "@/lib/format";
import { listenOnce, speak, speechRecognitionSupported, stopSpeaking } from "@/lib/speech";
import {
  MAX_IMAGES,
  MAX_INPUT_CHARS,
  MAX_USER_MESSAGES,
  WARN_USER_MESSAGES,
  messageImages,
  type ChatImage,
  type ChatMessage,
  type Mode,
  type Person,
  type Session,
} from "@/lib/types";

const MODE_LABEL: Record<Mode, string> = {
  listen: "지금은 들어주는 중",
  explore: "상황을 알아가는 중",
  interpret: "상황을 풀어보는 중",
  react: "네 생각을 듣는 중",
  offer_plan: "정리할 준비가 됐어요",
  plan: "방법 찾는 중",
};

const CHIPS: { label: string; text: string; mode: Mode }[] = [
  { label: "그냥 들어줘", text: "해결책 말고 그냥 들어줘.", mode: "listen" },
  { label: "이제 해결책 볼래", text: "이제 어떻게 하면 좋을지 알려줘.", mode: "plan" },
  { label: "보낼 말 써줘", text: "상대한테 보낼 메시지 써줘.", mode: "plan" },
];

/** 사진만 보냈을 때 저장되는 글 (화면에는 말풍선 없이 사진만 보인다) */
const IMAGE_ONLY_TEXT = "(대화 캡처를 보냈어요)";

const LINE_HEIGHT = 20; // leading-5
const MAX_LINES = 6;
const INPUT_PADDING_Y = 24; // py-3

/** 아래에 아직 못 본 내용이 있는지. 답변 자리로 비워 둔 공간은 내용으로 치지 않는다. */
function isAtBottom(el: HTMLElement, end: HTMLElement | null) {
  if (!end) return el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  return end.getBoundingClientRect().top - el.getBoundingClientRect().bottom < 40;
}

/** 터치 기기(폰)에서는 엔터가 줄바꿈, PC에서는 엔터가 전송 (카카오톡과 같은 방식) */
function enterSends() {
  return typeof window !== "undefined" && !window.matchMedia("(pointer: coarse)").matches;
}

export default function ChatClient({ id }: { id: string }) {
  // 상담 목록이나 프로필에서 들어왔으면 뒤로 가기도 그쪽으로
  const from = useSearchParams().get("from");
  const [session, setSession] = useState<Session | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<Mode>("listen");
  const [input, setInput] = useState("");
  const [images, setImages] = useState<ChatImage[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false); // 답변이 끝날 때까지 true
  const [usage, setUsage] = useState<number | null>(null); // 오늘 사용량 % (하루 한도 대비)
  // PC 오른쪽 인물 패널 (넓은 화면에서만 보임). 패널은 상담을 불러온 뒤에만 그려서 서버 화면과 어긋나지 않는다.
  const [panelOpen, setPanelOpen] = useState(() => {
    try {
      return typeof window === "undefined" || localStorage.getItem("onginote:personPanel") !== "closed";
    } catch {
      return true;
    }
  });
  function togglePanel() {
    setPanelOpen((open) => {
      try {
        localStorage.setItem("onginote:personPanel", open ? "closed" : "open");
      } catch {}
      return !open;
    });
  }
  const [unlocked, setUnlocked] = useState(false); // 정리된 상담을 이어서 얘기하기로 연 경우
  const [error, setError] = useState<string | null>(null);
  const [voiceOn, setVoiceOn] = useState(false);
  const [listening, setListening] = useState(false);
  const stopListenRef = useRef<() => void>(() => {});
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const turnRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null); // 실제 내용의 끝 (답변용 빈 공간은 제외)
  // 방금 보낸 내 메시지의 위치. 이 메시지부터 아래를 화면 높이만큼 비워 두고 답변이 그 안에 채워진다.
  const [anchor, setAnchor] = useState<number | null>(null);
  const [viewH, setViewH] = useState(0);
  const [atBottom, setAtBottom] = useState(true);
  const loadedRef = useRef(false);

  useEffect(() => {
    fetch(`/api/sessions/${id}`)
      .then((r) => r.json())
      .then(({ session, person }: { session: Session; person: Person | null }) => {
        setSession(session);
        setPerson(person);
        setMessages(session.messages);
        setMode(session.mode);
        setVoiceOn(session.voice);
      });
    fetch("/api/usage")
      .then((r) => r.json())
      .then((u: { percent: number }) => setUsage(u.percent))
      .catch(() => {});
    return () => stopSpeaking();
  }, [id]);

  // 스크롤 영역 높이(입력창이 커지면 줄어든다)와, 아래에 더 볼 내용이 있는지 추적
  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    const ro = new ResizeObserver(() => {
      setViewH(el.clientHeight);
      setAtBottom(isAtBottom(el, endRef.current));
    });
    ro.observe(el);
    ro.observe(content);
    return () => ro.disconnect();
  }, [session]);

  // 처음 열었을 때는 맨 아래로
  useLayoutEffect(() => {
    if (loadedRef.current || messages.length === 0 || !scrollRef.current) return;
    loadedRef.current = true;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // 메시지를 보내면 내 메시지를 화면 위쪽으로 올려서 답변 자리를 미리 확보한다
  useLayoutEffect(() => {
    if (anchor === null || !scrollRef.current || !turnRef.current) return;
    scrollRef.current.scrollTo({ top: turnRef.current.offsetTop - 12, behavior: "smooth" });
  }, [anchor]);

  // 입력창 높이: 6줄까지 늘어나고 그 뒤로는 안에서 스크롤
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = LINE_HEIGHT * MAX_LINES + INPUT_PADDING_Y;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [input, session]);

  if (!session) return <main className="p-6 text-muted">불러오는 중…</main>;
  const character = CHARACTERS[session.characterId];
  const busy = pending;
  const backHref = from === "chats" ? "/chats" : from === "person" && session.personId ? `/people/${session.personId}` : "/";
  // 정리한 뒤로 새 메시지가 없으면 "정리 보기", 이어서 얘기했으면 "다시 정리"
  const summarizedAt = session.summary ? (session.summary.messageCount ?? session.messages.length) : null;
  const summaryState: "none" | "done" | "stale" =
    summarizedAt === null ? "none" : messages.length > summarizedAt ? "stale" : "done";
  const locked = summaryState === "done" && !unlocked;
  // 사용 제한: 상담 하나의 길이와 하루 사용량
  const userCount = messages.filter((m) => m.role === "user").length;
  const remaining = MAX_USER_MESSAGES - userCount;
  const sessionFull = remaining <= 0;
  const dailyOut = usage !== null && usage >= 100;
  const blocked = sessionFull || dailyOut;

  async function send(text: string, forceMode?: Mode) {
    if (busy || blocked || (!text.trim() && images.length === 0)) return;
    stopSpeaking();
    setError(null);
    const userMsg: ChatMessage = { role: "user", text: text.trim() || IMAGE_ONLY_TEXT, images: images.length ? images : undefined, at: new Date().toISOString() };
    setAnchor(messages.length);
    setMessages((m) => [...m, userMsg]);
    setInput("");
    const sentImages = images;
    setImages([]);
    setStatus(`${josa(character.name, "이", "가")} 생각하는 중…`);
    setPending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: id, text, images: sentImages.length ? sentImages : undefined, forceMode }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        // 서버가 받기 전에 거절했으니 보낸 메시지를 입력창으로 되돌린다
        setMessages((m) => m.slice(0, -1));
        setAnchor(null);
        setInput(text);
        setImages(sentImages);
        if (j.limit === "daily") setUsage(100);
        throw new Error(j.error || "메시지를 보내지 못했어요.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let replyMode: Mode = mode;
      let reply = "";
      let started = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "mode") {
            replyMode = ev.mode;
            setMode(ev.mode);
          } else if (ev.type === "searching") {
            setStatus("비슷한 사례를 찾아보는 중…");
          } else if (ev.type === "text") {
            reply += ev.delta;
            if (!started) {
              started = true;
              setStatus(null);
              setMessages((m) => [...m, { role: "assistant", text: reply, mode: replyMode, at: new Date().toISOString() }]);
            } else {
              setMessages((m) => [...m.slice(0, -1), { ...m[m.length - 1], text: reply }]);
            }
          } else if (ev.type === "done") {
            if (typeof ev.usage === "number") setUsage(ev.usage);
          } else if (ev.type === "error") {
            throw new Error(ev.message);
          }
        }
      }
      setStatus(null);
      if (voiceOn && reply) speak(splitBubbles(reply).join("\n"), character.voice);
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : "오류가 났어요.");
    } finally {
      setPending(false);
      // PC 사이드바의 상담 목록과 사용량을 새로 고친다
      window.dispatchEvent(new Event("onginote:sessions"));
    }
  }

  function toggleMic() {
    if (listening) {
      stopListenRef.current();
      return;
    }
    stopSpeaking();
    setListening(true);
    stopListenRef.current = listenOnce({
      onInterim: (t) => setInput(t.slice(0, MAX_INPUT_CHARS)),
      onFinal: (t) => send(t.slice(0, MAX_INPUT_CHARS)),
      onEnd: () => setListening(false),
      onError: (msg) => setError(msg),
    });
  }

  async function onPickImages(list: FileList | null) {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
    if (fileRef.current) fileRef.current.value = ""; // 같은 사진을 다시 고를 수 있게
    if (files.length === 0) return;
    const room = MAX_IMAGES - images.length;
    if (files.length > room) setError(`사진은 한 번에 ${MAX_IMAGES}장까지 보낼 수 있어요.`);
    try {
      const shrunk = await Promise.all(files.slice(0, Math.max(0, room)).map(shrinkImage));
      setImages((prev) => [...prev, ...shrunk].slice(0, MAX_IMAGES));
    } catch {
      setError("이미지를 불러오지 못했어요.");
    }
  }

  const last = messages[messages.length - 1];
  const showOfferButtons = !busy && !locked && last?.role === "assistant" && last.mode === "offer_plan";

  function renderMessage(m: ChatMessage, i: number) {
    const prevMode = messages.slice(0, i).reverse().find((x) => x.role === "assistant")?.mode;
    const divider =
      m.role === "assistant" && prevMode && m.mode !== prevMode
        ? m.mode === "plan"
          ? "방법 찾기로 바뀌었어요"
          : prevMode === "plan" && m.mode === "listen"
            ? "다시 들어주기로 돌아왔어요"
            : null
        : null;
    const showAvatar = m.role === "assistant" && messages[i - 1]?.role !== "assistant";
    return (
      <Fragment key={i}>
        {divider && (
          <div className="flex items-center gap-2.5 py-1.5">
            <span className="h-px flex-1 bg-line-strong" />
            <span className="rounded-xl bg-teal-bg px-3 py-1 text-xs font-medium text-teal">{divider}</span>
            <span className="h-px flex-1 bg-line-strong" />
          </div>
        )}
        {m.role === "assistant" ? (
          splitBubbles(m.text).map((part, j) => (
            <div key={j} className="flex max-w-[85%] items-start gap-2">
              {showAvatar && j === 0 ? <CharacterAvatar id={character.id} tint={character.tint} size={32} /> : <span className="w-8 shrink-0" />}
              <div className="rounded-[4px_18px_18px_18px] border border-line bg-white px-3.5 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap">
                <RichText text={part} />
              </div>
            </div>
          ))
        ) : (
          <div className="flex max-w-[78%] flex-col items-end gap-1.5 self-end">
            <SentImages images={messageImages(m)} />
            {!(m.text === IMAGE_ONLY_TEXT && messageImages(m).length > 0) && (
              <div className="rounded-[18px_4px_18px_18px] bg-bubble px-3.5 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-ink">
                {m.text}
              </div>
            )}
          </div>
        )}
      </Fragment>
    );
  }

  const splitAt = anchor ?? messages.length;
  const tail = (
    <>
      {messages.slice(splitAt).map((m, j) => renderMessage(m, splitAt + j))}
      {showOfferButtons && (
        <div className="flex gap-2 pl-10">
          <button onClick={() => send("응, 정리해 줘.", "plan")} className="h-11 flex-1 rounded-full bg-accent text-sm font-bold text-white">
            응, 정리해 줘
          </button>
          <button onClick={() => send("조금 더 얘기하고 싶어.", "listen")} className="h-11 flex-1 rounded-full border border-line-strong bg-white text-sm">
            조금 더 얘기할래
          </button>
        </div>
      )}
      {status && (
        <div className="flex items-center gap-2 pl-10 text-xs text-muted" aria-live="polite">
          <span className="h-2 w-2 animate-pulse rounded-full bg-bubble" />
          {status}
        </div>
      )}
      {error && <p className="rounded-xl bg-[#FDECEA] px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
      <div ref={endRef} />
    </>
  );

  return (
    <div className="flex h-dvh">
    <main className="flex h-dvh min-w-0 flex-1 flex-col">
      <header className="z-10 flex shrink-0 items-center gap-2 rounded-b-[28px] bg-peach px-3 pb-3 pt-3 lg:rounded-none lg:px-6">
        {/* PC에서는 왼쪽에 상담 목록이 있어서 뒤로 가기가 필요 없다 */}
        <Link href={backHref} aria-label="뒤로" className="flex h-11 w-11 items-center justify-center lg:hidden">
          <BackIcon />
        </Link>
        <CharacterAvatar id={character.id} tint="#FFFFFF" size={44} />
        <div className="flex-1">
          <p className="font-display text-lg leading-tight">{character.name}</p>
          <p className="text-xs text-muted">{person ? `${person.name} 이야기 중 · 프로필 기억 중` : "내 이야기"}</p>
        </div>
        <button
          aria-pressed={voiceOn}
          aria-label={voiceOn ? "음성으로 듣기 끄기" : "음성으로 듣기 켜기"}
          onClick={() => {
            if (voiceOn) stopSpeaking();
            setVoiceOn((v) => !v);
          }}
          className={`flex h-11 w-11 items-center justify-center rounded-full ${voiceOn ? "bg-teal text-white" : "bg-white text-muted"}`}
        >
          <SpeakerIcon />
        </button>
        <Link
          href={`/chat/${id}/summary`}
          className={`flex h-11 items-center rounded-full px-3.5 text-sm font-bold ${
            summaryState === "done" ? "bg-white/60 text-muted" : "bg-white text-accent-text"
          }`}
        >
          {summaryState === "none" ? "정리하기" : summaryState === "done" ? "정리 보기" : "다시 정리"}
        </Link>
        {person && (
          <button
            aria-pressed={panelOpen}
            aria-label={panelOpen ? `${person.name} 프로필 패널 닫기` : `${person.name} 프로필 패널 열기`}
            onClick={togglePanel}
            className={`hidden h-11 w-11 items-center justify-center rounded-full xl:flex ${panelOpen ? "bg-ink text-white" : "bg-white text-muted"}`}
          >
            <PanelIcon />
          </button>
        )}
      </header>

      <div className="flex shrink-0 justify-center py-2.5">
        <span className="flex items-center gap-1.5 rounded-full bg-peach px-3 py-1.5 text-xs font-medium text-accent-text" aria-live="polite">
          <span className={`h-1.5 w-1.5 rounded-full ${locked ? "bg-line-strong" : "bg-accent"}`} />
          {locked ? "정리된 상담" : MODE_LABEL[mode]}
        </span>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={(e) => {
            setAtBottom(isAtBottom(e.currentTarget, endRef.current));
          }}
          className="relative h-full overflow-y-auto overscroll-contain [overflow-anchor:none]"
        >
          <div ref={contentRef} className="flex flex-col gap-2.5 px-4 pb-4 lg:mx-auto lg:max-w-3xl lg:px-8">
            {messages.slice(0, splitAt).map((m, i) => renderMessage(m, i))}
            {anchor === null ? (
              tail
            ) : (
              // 답변이 들어올 자리를 화면 한 칸만큼 미리 비워 둔다
              <div ref={turnRef} className="flex flex-col gap-2.5" style={{ minHeight: Math.max(0, viewH - 28) }}>
                {tail}
              </div>
            )}
          </div>
        </div>
        {!atBottom && (
          <button
            onClick={() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })}
            className="absolute bottom-3 left-1/2 flex h-9 -translate-x-1/2 items-center gap-1 rounded-full border border-line-strong bg-white px-3.5 text-xs font-medium text-muted shadow-sm"
          >
            {busy ? "답변 이어 보기" : "아래로"} ↓
          </button>
        )}
      </div>

      {locked ? (
        <div className="flex shrink-0 items-center gap-3 rounded-t-3xl border-t border-line bg-white px-4 pb-5 pt-4">
          <p className="flex-1 text-sm">
            정리가 끝난 상담이에요
            <span className="block text-xs text-muted">이어서 얘기하면 나중에 다시 정리할 수 있어요</span>
          </p>
          <button
            onClick={() => setUnlocked(true)}
            className="h-11 shrink-0 rounded-full border border-accent px-4 text-sm font-bold text-accent-text"
          >
            이어서 얘기하기
          </button>
        </div>
      ) : sessionFull ? (
        <div className="flex shrink-0 items-center gap-3 rounded-t-3xl border-t border-line bg-white px-4 pb-5 pt-4">
          <p className="flex-1 text-sm">
            이 상담은 충분히 길어졌어요
            <span className="block text-xs text-muted">정리해 두고 새 상담에서 이어서 얘기해요</span>
          </p>
          <Link
            href={`/chat/${id}/summary`}
            className="flex h-11 shrink-0 items-center rounded-full bg-accent px-4 text-sm font-bold text-white"
          >
            정리하기
          </Link>
        </div>
      ) : dailyOut ? (
        <div className="flex shrink-0 items-center gap-3 rounded-t-3xl border-t border-line bg-white px-4 pb-5 pt-4">
          <UsageMeter percent={100} />
          <p className="flex-1 text-sm">
            오늘 대화량을 다 썼어요
            <span className="block text-xs text-muted">내일 다시 이야기해요. 정리하기는 지금도 할 수 있어요</span>
          </p>
        </div>
      ) : (
      <div className="shrink-0 rounded-t-3xl border-t border-line bg-white px-3 pb-5 pt-2.5 lg:rounded-none lg:px-8 lg:*:mx-auto lg:*:max-w-3xl">
        {(remaining <= MAX_USER_MESSAGES - WARN_USER_MESSAGES || (usage !== null && usage >= 80)) && (
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-cream px-3 py-2 text-xs text-ink-soft">
            {usage !== null && usage >= 80 && <UsageMeter percent={usage} />}
            <span className="flex-1">
              {remaining <= MAX_USER_MESSAGES - WARN_USER_MESSAGES
                ? `이 상담에서 ${remaining}번 더 이야기할 수 있어요`
                : `오늘 대화량의 ${usage}%를 썼어요`}
              {remaining <= MAX_USER_MESSAGES - WARN_USER_MESSAGES && usage !== null && usage >= 80 ? ` · 오늘 ${usage}% 사용` : ""}
            </span>
          </div>
        )}
        <div className="flex gap-1.5 overflow-x-auto pb-2.5">
          {CHIPS.map((c) => (
            <button
              key={c.label}
              disabled={busy}
              onClick={() => send(c.text, c.mode)}
              className="h-8.5 shrink-0 rounded-full border border-line-strong bg-cream px-3 text-[13px] disabled:opacity-50"
            >
              {c.label}
            </button>
          ))}
        </div>
        {images.length > 0 && (
          <div className="mb-2 flex items-center gap-2 overflow-x-auto rounded-xl bg-cream p-2">
            {images.map((img, i) => (
              <div key={i} className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`data:${img.mediaType};base64,${img.data}`} alt={`첨부할 사진 ${i + 1}`} className="h-14 w-14 rounded-lg object-cover" />
                <button
                  aria-label={`사진 ${i + 1} 빼기`}
                  onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white"
                >
                  <XIcon size={12} />
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <button
                type="button"
                aria-label="사진 더 넣기"
                onClick={() => fileRef.current?.click()}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-line-strong text-xl text-muted"
              >
                +
              </button>
            )}
            <span className="ml-auto shrink-0 pr-1 text-xs text-muted">
              {images.length}/{MAX_IMAGES}
            </span>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-1.5"
        >
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onPickImages(e.target.files)} />
          <button type="button" aria-label="사진 보내기" onClick={() => fileRef.current?.click()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cream text-muted">
            <ImageIcon />
          </button>
          <button
            type="button"
            aria-label={listening ? "듣기 멈추기" : "음성으로 말하기"}
            aria-pressed={listening}
            disabled={busy || !speechRecognitionSupported()}
            onClick={toggleMic}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-50 ${listening ? "animate-pulse bg-teal text-white" : "bg-cream text-muted"}`}
          >
            <MicIcon />
          </button>
          <label htmlFor="chat-input" className="sr-only">메시지 입력</label>
          <textarea
            id="chat-input"
            ref={inputRef}
            rows={1}
            value={input}
            maxLength={MAX_INPUT_CHARS}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // 한글 조합 중 엔터는 무시해야 마지막 글자가 중복되지 않는다
              if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing || !enterSends()) return;
              e.preventDefault();
              send(input);
            }}
            placeholder={listening ? "듣고 있어요…" : `${character.name}에게 말하기`}
            className="min-w-0 flex-1 resize-none rounded-[22px] border border-line-strong bg-cream px-4 py-3 text-sm leading-5 outline-none focus:border-accent"
          />
          <button
            type="submit"
            aria-label="보내기"
            disabled={busy || (!input.trim() && images.length === 0)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:bg-line-strong"
          >
            <SendIcon />
          </button>
        </form>
        {input.length > MAX_INPUT_CHARS * 0.8 && (
          <p className={`pr-14 pt-1 text-right text-[11px] ${input.length >= MAX_INPUT_CHARS ? "font-bold text-accent-text" : "text-muted"}`}>
            {input.length.toLocaleString()}/{MAX_INPUT_CHARS.toLocaleString()}자
          </p>
        )}
      </div>
      )}
    </main>
    {/* 넓은 화면(xl 이상): 상담 중인 사람의 프로필을 옆에 띄워 둔다 */}
    {person && panelOpen && <PersonPanel person={person} onClose={togglePanel} />}
    </div>
  );
}

/** 오늘 사용량을 보여주는 작은 원형 게이지 */
function UsageMeter({ percent }: { percent: number }) {
  const r = 8;
  const c = 2 * Math.PI * r;
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" role="img" aria-label={`오늘 사용량 ${percent}%`} className="shrink-0 -rotate-90">
      <circle cx="10" cy="10" r={r} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="3" />
      <circle
        cx="10" cy="10" r={r} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, percent) / 100)}
        className="text-accent"
      />
    </svg>
  );
}

/** 보낸 사진들: 1장은 크게, 여러 장은 2열 격자 */
function SentImages({ images }: { images: ChatImage[] }) {
  if (images.length === 0) return null;
  const src = (img: ChatImage) => `data:${img.mediaType};base64,${img.data}`;
  if (images.length === 1) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src(images[0])} alt="보낸 대화 캡처" className="max-h-64 rounded-2xl border border-line" />;
  }
  return (
    <div className="grid w-56 grid-cols-2 gap-1 overflow-hidden rounded-2xl">
      {images.map((img, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={src(img)}
          alt={`보낸 대화 캡처 ${i + 1}`}
          className={`w-full object-cover ${images.length % 2 === 1 && i === 0 ? "col-span-2 aspect-[2/1]" : "aspect-square"}`}
        />
      ))}
    </div>
  );
}

/** **굵게** 정도만 처리하는 아주 작은 마크다운 */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p.replace(/^#+\s/gm, "")}</Fragment>,
      )}
    </>
  );
}

/** 업로드 전에 이미지를 1280px 이하 JPEG로 줄인다 (토큰 비용과 전송량 절약). */
async function shrinkImage(file: File): Promise<ChatImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { mediaType: "image/jpeg", data: dataUrl.split(",")[1] };
}
