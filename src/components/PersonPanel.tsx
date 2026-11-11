import Link from "next/link";
import { XIcon } from "@/components/Icons";
import { birthdayLabel, daysUntilBirthday } from "@/lib/format";
import type { Person } from "@/lib/types";

/** PC 채팅 오른쪽 패널: 이번 상담에서 캐릭터가 참고하는 인물 정보 (xl 이상에서만 보임) */
export function PersonPanel({ person, onClose }: { person: Person; onClose: () => void }) {
  const dday = daysUntilBirthday(person.birthday);
  const story = [...person.timeline].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const meta = [person.relation, person.mbti, person.age && `${person.age}세`].filter(Boolean).join(" · ");
  const empty =
    !person.birthday && !person.contactStyle && person.likes.length + person.dislikes.length + person.notes.length + story.length === 0;

  return (
    <aside
      aria-label={`${person.name} 프로필`}
      className="hidden h-dvh w-[340px] shrink-0 flex-col gap-4.5 overflow-y-auto border-l border-line bg-white p-5 xl:flex"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-muted">이번 상담에서 참고하는 정보</p>
        <button
          onClick={onClose}
          aria-label="프로필 패널 닫기"
          className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-line text-muted hover:bg-cream"
        >
          <XIcon size={14} />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-bubble bg-white font-display text-2xl text-accent-text">
          {person.name.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="font-display text-[22px] leading-tight">{person.name}</p>
          <p className="text-xs text-muted">{meta}</p>
        </div>
      </div>

      {(person.birthday || person.contactStyle) && (
        <dl className="grid grid-cols-2 gap-2">
          <div className="rounded-[14px] bg-cream px-3 py-2.5">
            <dt className="text-[11px] text-muted">생일</dt>
            <dd className="text-sm font-bold">
              {person.birthday ? birthdayLabel(person.birthday) : "아직 몰라요"}
              {dday !== null && <span className="ml-1 text-xs text-accent-text">D-{dday}</span>}
            </dd>
          </div>
          <div className="rounded-[14px] bg-cream px-3 py-2.5">
            <dt className="text-[11px] text-muted">연락 스타일</dt>
            <dd className="text-sm font-bold">{person.contactStyle || "아직 몰라요"}</dd>
          </div>
        </dl>
      )}

      {person.likes.length > 0 && (
        <ChipGroup title="좋아하는 것" items={person.likes} className="bg-peach text-accent-text" />
      )}
      {person.dislikes.length > 0 && (
        <ChipGroup title="싫어하는 것" items={person.dislikes} className="border border-line-strong bg-cream text-ink" />
      )}
      {person.notes.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-bold text-ink-soft">메모</p>
          <ul className="flex list-disc flex-col gap-1 pl-4.5 text-[13px] leading-relaxed text-ink-soft">
            {person.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </div>
      )}

      {story.length > 0 && (
        <div className="rounded-[18px] bg-teal-bg p-3.5">
          <p className="mb-2.5 text-[13px] font-bold text-teal">우리 이야기</p>
          <ol className="flex flex-col gap-2.5">
            {story.map((t, i) => (
              <li key={`${t.date}-${i}`} className="flex gap-2.5">
                <span className="w-10 shrink-0 text-[11px] text-teal">{t.date.slice(5).replace("-", ".")}</span>
                <span className="text-[13px] leading-normal">{t.text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {empty && (
        <p className="rounded-2xl bg-cream px-3.5 py-3 text-[13px] leading-relaxed text-muted">
          아직 기록된 정보가 없어요. 상담을 정리하면 알게 된 내용을 여기에 쌓아 둘게요.
        </p>
      )}

      <Link
        href={`/people/${person.id}`}
        className="mt-auto flex h-10.5 shrink-0 items-center justify-center rounded-full border border-line-strong text-[13px] font-bold hover:bg-cream"
      >
        프로필 전체 보기
      </Link>
    </aside>
  );
}

function ChipGroup({ title, items, className }: { title: string; items: string[]; className: string }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold text-ink-soft">{title}</p>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((v) => (
          <li key={v} className={`rounded-full px-2.5 py-1 text-xs ${className}`}>{v}</li>
        ))}
      </ul>
    </div>
  );
}
