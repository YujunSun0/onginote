import type { CharacterId } from "@/lib/types";

/** 캐릭터 얼굴. 프로토타입용 단순 SVG라서 실서비스에서는 일러스트로 교체한다. */
export function CharacterFace({ id, size = 48, talking = false }: { id: CharacterId; size?: number; talking?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {id === "mongle" && (
        <>
          <circle cx="22" cy="30" r="10" fill="#9C6F4B" />
          <circle cx="78" cy="30" r="10" fill="#9C6F4B" />
          <circle cx="50" cy="54" r="38" fill="#B98A63" />
          <ellipse cx="50" cy="66" rx="22" ry="17" fill="#F3DCC4" />
          <circle cx="37" cy="50" r="4" fill="#2B1A12" />
          <circle cx="63" cy="50" r="4" fill="#2B1A12" />
          <ellipse cx="50" cy="60" rx="6" ry="4.5" fill="#2B1A12" />
          {talking ? (
            <ellipse cx="50" cy="71" rx="5" ry="3.5" fill="#C4491B" />
          ) : (
            <path d="M44 68q6 5 12 0" stroke="#2B1A12" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          )}
          <circle cx="27" cy="62" r="5" fill="#F4A58A" />
          <circle cx="73" cy="62" r="5" fill="#F4A58A" />
        </>
      )}
      {id === "yeoul" && (
        <>
          <path d="M18 12L40 34L16 44Z" fill="#D9702A" />
          <path d="M82 12L60 34L84 44Z" fill="#D9702A" />
          <path d="M50 92C26 92 12 72 12 52C12 36 26 26 50 26C74 26 88 36 88 52C88 72 74 92 50 92Z" fill="#E8833A" />
          <path d="M50 92C38 92 28 82 26 68C34 66 44 70 50 78C56 70 66 66 74 68C72 82 62 92 50 92Z" fill="#FFF4EA" />
          <path d="M31 54q5 -4 10 0" stroke="#2B1A12" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M59 54q5 -4 10 0" stroke="#2B1A12" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <circle cx="50" cy="76" r="4" fill="#2B1A12" />
          {talking && <ellipse cx="50" cy="84" rx="4" ry="2.5" fill="#C4491B" />}
        </>
      )}
      {id === "olly" && (
        <>
          <path d="M20 18L36 34L22 38Z" fill="#62728A" />
          <path d="M80 18L64 34L78 38Z" fill="#62728A" />
          <circle cx="50" cy="56" r="38" fill="#7C8DA6" />
          <ellipse cx="50" cy="82" rx="18" ry="8" fill="#9DACC0" />
          <circle cx="35" cy="50" r="14" fill="#FFF8F1" />
          <circle cx="65" cy="50" r="14" fill="#FFF8F1" />
          <circle cx="35" cy="50" r="6" fill="#2B1A12" />
          <circle cx="65" cy="50" r="6" fill="#2B1A12" />
          <path d={talking ? "M44 64L50 75L56 64Z" : "M45 64L50 72L55 64Z"} fill="#F0A13A" />
        </>
      )}
      {id === "daon" && (
        <>
          <circle cx="50" cy="50" r="40" fill="#5A3A2B" />
          <ellipse cx="50" cy="58" rx="30" ry="32" fill="#F6D2B8" />
          <path d="M20 50C20 26 34 16 50 16C66 16 80 26 80 50C70 40 60 34 50 34C42 40 30 46 20 50Z" fill="#5A3A2B" />
          <path d="M36 60q4 -4 8 0" stroke="#2B1A12" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M56 60q4 -4 8 0" stroke="#2B1A12" strokeWidth="3" fill="none" strokeLinecap="round" />
          {talking ? (
            <ellipse cx="50" cy="74" rx="5" ry="4" fill="#C4491B" />
          ) : (
            <path d="M44 72q6 6 12 0" stroke="#C4491B" strokeWidth="3" fill="none" strokeLinecap="round" />
          )}
          <circle cx="31" cy="68" r="4.5" fill="#F4A58A" />
          <circle cx="69" cy="68" r="4.5" fill="#F4A58A" />
        </>
      )}
    </svg>
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
