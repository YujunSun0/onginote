import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BusinessInfo } from "@/components/BusinessInfo";
import { CharacterAvatar } from "@/components/CharacterFace";
import { CHARACTER_LIST } from "@/lib/characters";
import { PLANS, PLUS_PRICE_KRW, REFUND_DAYS } from "@/lib/plans";

/**
 * 처음 온 사람에게 보여 주는 소개 화면. 로그인하지 않고 / 로 오면 proxy.ts 가 이 화면으로 바꿔 끼운다.
 * 앱은 시작 주소가 /login 이라 이 화면을 거치지 않는다.
 */
export const metadata: Metadata = {
  title: "온기노트 · 사람 때문에 고민될 때, 털어놓고 정리까지",
  alternates: { canonical: "/" },
};

const price = `${PLUS_PRICE_KRW.toLocaleString("ko-KR")}원`;
const dailyRatio = Math.round(PLANS.plus.dailyUsd / PLANS.free.dailyUsd);

const FEATURES = [
  {
    icon: "💬",
    title: "지금 필요한 말부터",
    desc: "하소연할 땐 들어주고, 헷갈릴 땐 상황을 읽어 주고, 움직일 때가 되면 할 일을 같이 정해요. 메시지마다 대화 흐름을 보고 답하는 방식을 바꿔요.",
  },
  {
    icon: "📷",
    title: "카톡 캡처도 같이 읽어요",
    desc: "대화 캡처를 올리면 말투와 대화 흐름까지 보고, 그 사람이 어떤 마음일지 함께 해석해요.",
  },
  {
    icon: "📝",
    title: "끝나면 한 장으로 정리",
    desc: "상황, 해석, 할 것, 하지 말 것을 정리 카드로 남겨요. 며칠 뒤에는 캐릭터가 먼저 \"그 뒤로 어떻게 됐어?\" 하고 물어봐요.",
  },
  {
    icon: "👤",
    title: "그 사람 기록이 쌓여요",
    desc: "좋아하는 것, 연락 스타일, 생일처럼 대화에서 알게 된 정보가 인물 프로필에 모여요. 다음 상담에서 캐릭터가 기억하고 참고해요.",
  },
];

const SHOWCASE = [
  {
    src: "/landing/m-chat.png",
    alt: "캐릭터와 상담하는 화면",
    eyebrow: "상담",
    title: "친구한테 말하듯 편하게",
    desc: "말풍선을 나눠서 짧게, 친구처럼 답해요. 답장이 늦어진 이유, 다시 물어봐도 될지 같은 고민을 같이 정리해요.",
  },
  {
    src: "/landing/m-summary.png",
    alt: "상담 정리 카드 화면",
    eyebrow: "정리 카드",
    title: "흩어진 대화를 한 장으로",
    desc: "긴 대화를 다시 읽지 않아도 돼요. 오늘 무엇을 알게 됐고 다음에 뭘 하면 되는지만 남겨요.",
  },
  {
    src: "/landing/m-person.png",
    alt: "인물 프로필 화면",
    eyebrow: "인물 기록",
    title: "\"하린이 뭐 좋아했더라?\"",
    desc: "기억 안 나는 건 물어보면 돼요. 쌓아 둔 기록과 지난 상담을 보고 답해 줘요.",
  },
];

const TRUST = [
  { title: "나만 볼 수 있어요", desc: "상담과 인물 기록은 본인만 볼 수 있게 데이터베이스에서부터 막아 뒀어요." },
  { title: "언제든 내려받고 지울 수 있어요", desc: "모든 기록을 PDF와 파일로 받을 수 있고, 탈퇴하면 상담 기록은 바로 지워져요." },
  { title: "AI라는 걸 숨기지 않아요", desc: "답변은 AI가 만들어요. 전문 상담을 대신하지 않고, 힘든 순간엔 상담 전화를 안내해요." },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh break-keep bg-cream text-ink">
      <Header />
      <main>
        <Hero />
        <Characters />
        <Features />
        <Showcase />
        <Desktop />
        <Pricing />
        <Trust />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-cream/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="font-display text-xl text-accent-text">
          온기노트
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-line-strong bg-white px-4 py-1.5 text-sm font-medium hover:border-accent"
        >
          로그인
        </Link>
      </div>
    </header>
  );
}

function StartButton({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/login"
      className={`inline-flex h-13 items-center justify-center rounded-full bg-accent px-8 text-base font-bold text-white shadow-[0_6px_20px_rgba(196,73,27,0.25)] hover:brightness-105 ${className}`}
    >
      무료로 시작하기
    </Link>
  );
}

function Phone({ src, alt, className = "", priority = false }: { src: string; alt: string; className?: string; priority?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-[2rem] border-[6px] border-white bg-white shadow-[0_20px_50px_rgba(43,26,18,0.16)] ${className}`}>
      <Image src={src} alt={alt} width={390} height={844} sizes="(min-width: 1024px) 280px, 60vw" priority={priority} className="h-auto w-full" />
    </div>
  );
}

function Hero() {
  return (
    <section className="overflow-hidden bg-gradient-to-b from-peach/70 to-cream">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-12 lg:grid-cols-[1.1fr_1fr] lg:pb-24 lg:pt-20">
        <div className="text-center lg:text-left">
          <p className="mb-3 inline-block rounded-full bg-white/80 px-3 py-1 text-[13px] font-medium text-accent-text">
            AI 캐릭터 관계 고민 상담
          </p>
          <h1 className="font-display text-[clamp(1.6rem,8.2vw,2.1rem)] leading-[1.25] sm:text-5xl lg:text-[3.4rem]">
            사람 때문에 고민될 때,
            <br />
            털어놓고 <span className="text-accent">정리까지</span>
          </h1>
          <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-ink-soft sm:text-base lg:mx-0">
            썸, 연애, 친구, 가족, 직장 사람까지. 마음 쓰이는 관계 이야기를 성격이 다른 캐릭터에게 편하게 털어놓아 보세요. 들어주고, 상황을 읽어 주고, 다음에 할 일까지 남겨 줘요.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 lg:items-start">
            <StartButton />
            <p className="text-[13px] text-muted">카카오·구글 계정으로 바로 시작해요</p>
          </div>
        </div>
        <div className="relative mx-auto flex w-full max-w-[420px] justify-center lg:max-w-none">
          <Phone src="/landing/m-home.png" alt="온기노트 홈 화면" priority className="relative z-10 w-[58%] max-w-[270px] lg:-translate-x-16" />
          <Phone
            src="/landing/m-chat.png"
            alt="상담 화면"
            className="absolute right-0 top-10 w-[46%] max-w-[220px] rotate-[5deg] opacity-95 sm:right-4 lg:right-6"
          />
        </div>
      </div>
    </section>
  );
}

function SectionTitle({ eyebrow, title, desc }: { eyebrow: string; title: string; desc?: string }) {
  return (
    <div className="mx-auto mb-10 max-w-xl text-center">
      <p className="text-[13px] font-bold tracking-wide text-accent-text">{eyebrow}</p>
      <h2 className="mt-2 font-display text-[1.8rem] leading-snug sm:text-4xl">{title}</h2>
      {desc && <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{desc}</p>}
    </div>
  );
}

function Characters() {
  return (
    <section className="px-5 py-16 lg:py-24">
      <SectionTitle eyebrow="캐릭터" title="오늘은 누구랑 얘기할까요?" desc="같은 고민이어도 듣고 싶은 말은 그날그날 달라요. 상담마다 골라요." />
      <ul className="mx-auto grid max-w-5xl grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {CHARACTER_LIST.map((c) => (
          <li key={c.id} className="flex flex-col items-center rounded-3xl border border-line bg-white px-4 pb-6 pt-7 text-center">
            <CharacterAvatar id={c.id} tint={c.tint} size={76} />
            <p className="mt-3 font-display text-xl">{c.name}</p>
            <p className="mt-1 rounded-full bg-peach px-2.5 py-0.5 text-xs font-medium text-accent-text">{c.style}</p>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">&ldquo;{c.tagline}&rdquo;</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Features() {
  return (
    <section className="bg-white px-5 py-16 lg:py-24">
      <SectionTitle eyebrow="이런 게 달라요" title="들어주는 데서 끝나지 않게" />
      <ul className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <li key={f.title} className="rounded-3xl bg-cream p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl" aria-hidden>
              {f.icon}
            </span>
            <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{f.desc}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Showcase() {
  return (
    <section className="px-5 py-16 lg:py-24">
      <div className="mx-auto flex max-w-5xl flex-col gap-16 lg:gap-24">
        {SHOWCASE.map((s, i) => (
          <div key={s.src} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
            <div className={`text-center lg:text-left ${i % 2 === 1 ? "lg:order-2" : ""}`}>
              <p className="text-[13px] font-bold tracking-wide text-accent-text">{s.eyebrow}</p>
              <h3 className="mt-2 font-display text-[1.7rem] leading-snug sm:text-[2rem]">{s.title}</h3>
              <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-ink-soft lg:mx-0">{s.desc}</p>
            </div>
            <Phone src={s.src} alt={s.alt} className="mx-auto w-[62%] max-w-[280px]" />
          </div>
        ))}
      </div>
    </section>
  );
}

function Desktop() {
  return (
    <section className="bg-peach/60 px-5 py-16 lg:py-24">
      <SectionTitle eyebrow="PC에서도" title="넓은 화면으로 차분하게" desc="상담 목록, 대화, 그 사람 프로필을 한 화면에서 같이 보면서 이야기해요." />
      <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border-[6px] border-white bg-white shadow-[0_20px_50px_rgba(43,26,18,0.14)]">
        <Image
          src="/landing/d-chat.png"
          alt="PC 화면: 상담 목록, 채팅, 상대방 프로필"
          width={1440}
          height={900}
          sizes="(min-width: 1024px) 1000px, 100vw"
          className="h-auto w-full"
        />
      </div>
      <p className="mt-4 text-center text-xs text-muted">화면의 인물과 대화는 예시예요.</p>
    </section>
  );
}

function Pricing() {
  const rows = [
    { label: "캐릭터 4명과 상담", free: "✓", plus: "✓" },
    { label: "정리 카드 · 인물 기록", free: "✓", plus: "✓" },
    { label: "하루 대화량", free: "기본", plus: `${dailyRatio}배` },
    { label: "상담 하나에 보낼 수 있는 메시지", free: `${PLANS.free.sessionMessages}개`, plus: `${PLANS.plus.sessionMessages}개` },
    { label: "하루 웹 검색", free: `${PLANS.free.dailySearches}번`, plus: `${PLANS.plus.dailySearches}번` },
  ];
  return (
    <section className="px-5 py-16 lg:py-24">
      <SectionTitle
        eyebrow="요금"
        title="무료로 충분히 써 보세요"
        desc="답변은 무료와 Plus 모두 같은 캐릭터가 같은 방식으로 만들어요. Plus는 더 많이 이야기하고 싶을 때 골라요."
      />
      <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-line bg-white p-6">
          <p className="font-bold">무료</p>
          <p className="mt-1 font-display text-3xl">0원</p>
          <p className="mt-2 text-[13px] text-muted">가입하면 바로</p>
        </div>
        <div className="rounded-3xl border-2 border-accent bg-white p-6">
          <p className="font-bold text-accent-text">Plus</p>
          <p className="mt-1 font-display text-3xl">
            {price}
            <span className="ml-1 font-sans text-sm font-normal text-muted">/ 월</span>
          </p>
          <p className="mt-2 text-[13px] text-muted">언제든 해지 · 결제 후 {REFUND_DAYS}일 안에 상담 전이면 전액 환불</p>
        </div>
      </div>
      <table className="mx-auto mt-6 w-full max-w-3xl overflow-hidden rounded-2xl bg-white text-[14px]">
        <thead>
          <tr className="border-b border-line text-left text-[13px] text-muted">
            <th className="px-4 py-3 font-medium">비교</th>
            <th className="w-20 px-2 py-3 text-center font-medium sm:w-28">무료</th>
            <th className="w-20 px-2 py-3 text-center font-medium text-accent-text sm:w-28">Plus</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-line last:border-0">
              <td className="px-4 py-3">{r.label}</td>
              <td className="px-2 py-3 text-center text-ink-soft">{r.free}</td>
              <td className="px-2 py-3 text-center font-bold">{r.plus}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Trust() {
  return (
    <section className="bg-teal-bg px-5 py-16 lg:py-24">
      <SectionTitle eyebrow="안심하고" title="민감한 이야기라서 더 조심해요" />
      <ul className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-3">
        {TRUST.map((t) => (
          <li key={t.title} className="rounded-3xl bg-white p-6">
            <h3 className="font-bold text-teal">{t.title}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{t.desc}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-5 py-20 text-center lg:py-28">
      <h2 className="font-display text-[1.9rem] leading-snug sm:text-4xl">
        혼자 끙끙 앓던 그 고민,
        <br />
        오늘은 털어놔 봐요
      </h2>
      <StartButton className="mt-8" />
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line bg-white px-5 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
          <span className="font-display text-base text-accent-text">온기노트</span>
          <Link href="/terms" className="text-ink-soft hover:underline">
            이용약관
          </Link>
          <Link href="/privacy" className="font-bold text-ink-soft hover:underline">
            개인정보 처리방침
          </Link>
          <Link href="/ai-notice" className="text-ink-soft hover:underline">
            AI 답변 안내
          </Link>
        </div>
        <BusinessInfo />
      </div>
    </footer>
  );
}
