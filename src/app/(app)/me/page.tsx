"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";

interface Me {
  nickname: string | null;
  email: string | null;
  provider: string | null;
  avatarUrl: string | null;
  joinedAt: string | null;
  counts: { persons: number; sessions: number; summaries: number };
  usagePercent: number;
  plan: {
    id: "free" | "plus";
    until: string | null;
    status: "active" | "canceled" | "past_due" | null;
    periodCapped: boolean;
    sessionMessages: number;
    monthlySessions: number | null;
    sessionsLeftMonth: number | null;
  };
}

const PROVIDER_LABEL: Record<string, string> = { kakao: "카카오", google: "구글" };
const NICKNAME_MAX = 20;

function dateLabel(iso: string | null) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 9 * 3600e3);
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}

function PlanCard({ plan }: { plan: Me["plan"] }) {
  const plus = plan.id === "plus";
  const note = !plus
    ? plan.monthlySessions !== null && plan.sessionsLeftMonth !== null
      ? `이번 달 상담 ${plan.monthlySessions - plan.sessionsLeftMonth}/${plan.monthlySessions}개를 썼어요. 상담 하나에 메시지는 ${plan.sessionMessages}개까지예요.`
      : `상담 하나에 메시지 ${plan.sessionMessages}개까지 쓸 수 있어요.`
    : plan.status === "canceled"
      ? `해지했어요. ${dateLabel(plan.until)}까지 온기 패스로 쓸 수 있어요.`
      : plan.status === "past_due"
        ? "결제가 안 돼서 다시 시도하고 있어요. 결제 수단을 확인해 주세요."
        : `다음 결제일은 ${dateLabel(plan.until)}이에요.`;
  return (
    <section className="rounded-3xl border border-line bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg">내 요금제</h2>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${plus ? "bg-accent text-white" : "bg-cream text-ink-soft"}`}>
          {plus ? "온기 패스" : "무료"}
        </span>
      </div>
      <p className="pt-2 text-sm text-ink-soft">{note}</p>
      <Link
        href="/plus"
        className={`mt-3 flex h-11 items-center justify-center rounded-full text-sm font-bold ${plus ? "border border-line-strong bg-white" : "bg-accent text-white"}`}
      >
        {plus ? "구독 관리" : "온기 패스 알아보기"}
      </Link>
      {plus && plan.periodCapped && (
        <p className="mt-2 rounded-xl bg-cream px-3 py-2 text-xs text-ink-soft">
          이번 달 온기 패스 사용량을 다 써서, 다음 결제일까지는 하루 대화량과 검색이 무료와 같은 수준이에요. 상담 수와 길이는 그대로예요.
        </p>
      )}
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-white p-5">
      <h2 className="pb-3 font-display text-lg">{title}</h2>
      {children}
    </section>
  );
}

export default function MyPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setMe)
      .catch(() => setLoadError(true));
  }, []);

  return (
    <main className="px-5 pb-28 pt-6 lg:mx-auto lg:max-w-3xl lg:px-10 lg:pb-12 lg:pt-9">
      <h1 className="font-display text-[26px]">마이페이지</h1>

      {loadError && <p className="mt-6 text-sm text-danger">정보를 불러오지 못했어요. 새로고침해 주세요.</p>}
      {!me && !loadError && <p className="mt-6 text-sm text-muted">불러오는 중…</p>}

      {me && (
        <div className="mt-5 flex flex-col gap-4">
          <ProfileCard me={me} onSaved={(nickname) => setMe({ ...me, nickname })} />

          <PlanCard plan={me.plan} />

          <Card title="오늘 사용량">
            <div className="flex items-center gap-3">
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-line">
                <span
                  className={`block h-full rounded-full ${me.usagePercent >= 80 ? "bg-accent" : "bg-teal"}`}
                  style={{ width: `${Math.max(me.usagePercent, 2)}%` }}
                />
              </span>
              <span className="text-sm font-bold tabular-nums">{me.usagePercent}%</span>
            </div>
            <p className="pt-2 text-xs text-muted">하루에 나눌 수 있는 대화량 중 오늘 쓴 만큼이에요. 한국 시간 자정에 다시 채워져요.</p>
          </Card>

          <Card title="내 기록">
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                ["사람", me.counts.persons],
                ["상담", me.counts.sessions],
                ["정리", me.counts.summaries],
              ].map(([label, n]) => (
                <div key={label} className="rounded-2xl bg-cream py-3">
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="font-display text-2xl">{n}</dd>
                </div>
              ))}
            </dl>
            <a
              href="/me/print"
              target="_blank"
              className="mt-3 flex h-11 items-center justify-center rounded-full border border-line-strong text-sm font-bold text-ink-soft hover:bg-cream"
            >
              내 기록 PDF로 받기
            </a>
            <p className="pt-2 text-xs text-muted">
              사람, 상담 내용, 정리, 사진을 보기 좋게 정리해 보여줘요. 인쇄 창에서 &lsquo;PDF로 저장&rsquo;을 고르면 돼요.
            </p>
            <a href="/api/me/export" className="mt-1 inline-block text-xs text-muted underline underline-offset-2">
              다른 서비스로 옮길 때 쓰는 데이터 파일(JSON) 받기
            </a>
          </Card>

          <Card title="약관 및 정책">
            <ul className="flex flex-col text-sm text-ink-soft">
              {[
                ["개인정보 처리방침", "/privacy"],
                ["이용약관", "/terms"],
                ["AI 답변 안내", "/ai-notice"],
              ].map(([t, href]) => (
                <li key={href} className="border-b border-line last:border-0">
                  <Link href={href} className="flex justify-between py-2.5 hover:text-ink">
                    <span className={href === "/privacy" ? "font-bold" : undefined}>{t}</span>
                    <span aria-hidden="true" className="text-muted">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <form action="/auth/signout" method="post">
            <button type="submit" className="h-12 w-full rounded-full border border-line-strong bg-white text-[15px] font-bold text-ink-soft hover:bg-cream">
              로그아웃
            </button>
          </form>

          <WithdrawSection />
        </div>
      )}
      <BottomNav />
    </main>
  );
}

function ProfileCard({ me, onSaved }: { me: Me; onSaved: (nickname: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(me.nickname ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = value.trim();

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: trimmed }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(body.error ?? "저장하지 못했어요.");
    onSaved(body.nickname);
    setEditing(false);
  }

  return (
    <Card title="내 정보">
      <div className="flex items-center gap-4">
        {me.avatarUrl ? (
          // 카카오/구글 프로필 사진 (외부 주소라 next/image 대신 img)
          // eslint-disable-next-line @next/next/no-img-element
          <img src={me.avatarUrl} alt="" className="h-16 w-16 shrink-0 rounded-full border border-line object-cover" />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-peach font-display text-2xl text-accent-text">
            {(me.nickname ?? "나").slice(0, 1)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (trimmed) save();
              }}
              className="flex gap-2"
            >
              <label className="sr-only" htmlFor="nickname">닉네임</label>
              <input
                id="nickname"
                autoFocus
                value={value}
                maxLength={NICKNAME_MAX}
                onChange={(e) => setValue(e.target.value)}
                className="h-10 min-w-0 flex-1 rounded-xl border border-line-strong px-3 text-[15px]"
              />
              <button type="submit" disabled={!trimmed || saving} className="h-10 shrink-0 rounded-xl bg-accent px-4 text-sm font-bold text-white disabled:opacity-50">
                {saving ? "저장 중" : "저장"}
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <p className="truncate text-lg font-bold">{me.nickname ?? "닉네임 없음"}</p>
              <button
                type="button"
                onClick={() => {
                  setValue(me.nickname ?? "");
                  setEditing(true);
                }}
                className="shrink-0 rounded-lg px-2 py-1 text-xs text-accent-text hover:bg-cream"
              >
                수정
              </button>
            </div>
          )}
          {editing && (
            <p className="pt-1 text-xs text-muted">
              홈 화면에서 이 이름으로 불러 줘요. {trimmed.length}/{NICKNAME_MAX}
              <button type="button" onClick={() => setEditing(false)} className="ml-2 underline">취소</button>
            </p>
          )}
          {error && <p role="alert" className="pt-1 text-xs text-danger">{error}</p>}
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted">이메일</dt>
        <dd className="truncate">{me.email}</dd>
        <dt className="text-muted">로그인</dt>
        <dd>{(me.provider && PROVIDER_LABEL[me.provider]) ?? me.provider}</dd>
        <dt className="text-muted">가입일</dt>
        <dd>{dateLabel(me.joinedAt)}</dd>
      </dl>
    </Card>
  );
}

function WithdrawSection() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/me", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: confirm.trim() }),
    });
    if (res.ok) {
      router.replace("/login?withdrawn=1");
      return;
    }
    const body = await res.json().catch(() => ({}));
    setError(body.error ?? "탈퇴를 처리하지 못했어요.");
    setPending(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mx-auto px-3 py-2 text-xs text-muted underline underline-offset-2">
        회원 탈퇴
      </button>
    );
  }

  return (
    <section aria-labelledby="withdraw-title" className="rounded-3xl border border-danger/30 bg-white p-5">
      <h2 id="withdraw-title" className="font-display text-lg text-danger">정말 탈퇴할까요?</h2>
      <ul className="list-disc space-y-1 pl-5 pt-3 text-sm leading-relaxed text-ink-soft">
        <li>등록한 사람, 상담 내용, 정리, 올린 사진이 <b>모두 바로 지워지고 되돌릴 수 없어요.</b></li>
        <li>필요하면 먼저 위의 &lsquo;내 기록 내려받기&rsquo;로 저장해 두세요.</li>
        <li>탈퇴 후 30일 동안은 같은 이메일로 다시 가입할 수 없어요.</li>
      </ul>
      <label htmlFor="withdraw-confirm" className="block pt-4 text-sm">
        계속하려면 <b>탈퇴</b>라고 적어 주세요.
      </label>
      <input
        id="withdraw-confirm"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="mt-2 h-11 w-full rounded-xl border border-line-strong px-3 text-[15px]"
        autoComplete="off"
      />
      {error && <p role="alert" className="pt-2 text-sm text-danger">{error}</p>}
      <div className="flex gap-2 pt-4">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setConfirm("");
          }}
          className="h-11 flex-1 rounded-full border border-line-strong text-sm font-bold text-ink-soft"
        >
          그만두기
        </button>
        <button
          type="button"
          onClick={withdraw}
          disabled={confirm.trim() !== "탈퇴" || pending}
          className="h-11 flex-1 rounded-full bg-danger text-sm font-bold text-white disabled:opacity-40"
        >
          {pending ? "지우는 중…" : "탈퇴하기"}
        </button>
      </div>
    </section>
  );
}
