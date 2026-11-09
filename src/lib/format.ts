/** 이름 뒤 조사: josa("몽글", "이", "가") → "몽글이" / josa("올리", "이", "가") → "올리가" */
export function josa(name: string, withBatchim: string, withoutBatchim: string): string {
  const code = name.charCodeAt(name.length - 1);
  const isHangul = code >= 0xac00 && code <= 0xd7a3;
  const batchim = isHangul && (code - 0xac00) % 28 !== 0;
  return name + (batchim ? withBatchim : withoutBatchim);
}

/** 생일("MM-DD")까지 남은 날 */
export function daysUntilBirthday(mmdd?: string): number | null {
  if (!mmdd || !/^\d{2}-\d{2}$/.test(mmdd)) return null;
  const [m, d] = mmdd.split("-").map(Number);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), m - 1, d);
  if (next < today) next = new Date(now.getFullYear() + 1, m - 1, d);
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

export function birthdayLabel(mmdd?: string): string | null {
  if (!mmdd || !/^\d{2}-\d{2}$/.test(mmdd)) return null;
  const [m, d] = mmdd.split("-").map(Number);
  return `${m}월 ${d}일`;
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 0) {
    const days = Math.ceil(-diff / 86400000);
    return `${days}일 뒤`;
  }
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.round(h / 24)}일 전`;
}

export function todayLabel(ts: number): string {
  return new Date(ts).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" });
}

/** 답변을 말풍선 단위로 나눈다 (모델이 --- 한 줄로 구분한다). */
export function splitBubbles(text: string): string[] {
  return text
    .split(/^[ \t]*-{3,}[ \t]*$/m)
    .map((t) => t.trim())
    .filter(Boolean);
}
