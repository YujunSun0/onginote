import type { CharacterId } from "@/lib/types";

/**
 * 캐릭터 얼굴. scripts/character-faces.mjs 가 만든 이미지(public/characters)를 보여 준다.
 * SVG를 직접 그리면 브라우저의 강제 다크 모드가 도형 색을 하나씩 바꿔 눈·코가 사라져서 이미지로 쓴다.
 */
export function CharacterFace({ id, size = 48 }: { id: CharacterId; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 2~3KB짜리 고정 이미지라 최적화가 필요 없다
    <img
      src={`/characters/${id}.png`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      draggable={false}
      decoding="async"
      className="shrink-0 select-none"
      style={{ width: size, height: size }}
    />
  );
}

export function CharacterAvatar({ id, tint, size = 48 }: { id: CharacterId; tint: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: tint }}
    >
      <CharacterFace id={id} size={Math.round(size * 0.84)} />
    </span>
  );
}
