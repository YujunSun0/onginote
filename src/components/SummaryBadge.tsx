import { CheckIcon } from "@/components/Icons";
import type { SummaryState } from "@/lib/types";

/** 상담 목록에서 정리 여부를 보여 주는 작은 표시 */
export function SummaryBadge({ state }: { state?: SummaryState }) {
  if (state === "done") {
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-teal-bg px-2 py-1 text-[11px] font-bold text-teal">
        <CheckIcon size={12} />
        정리됨
      </span>
    );
  }
  if (state === "stale") {
    return (
      <span className="shrink-0 rounded-full bg-peach px-2 py-1 text-[11px] font-bold text-accent-text">
        정리 후 이어짐
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full border border-line-strong px-2 py-1 text-[11px] text-muted">
      대화 중
    </span>
  );
}
