"use client";

import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { CharacterFace } from "@/components/CharacterFace";
import { SessionList } from "@/components/SessionList";

export default function ChatsPage() {
  return (
    <>
      {/* 모바일: 상담 목록 화면 */}
      <main className="pb-28 lg:hidden">
        <SessionList variant="page" />
        <BottomNav />
      </main>

      {/* PC: 목록은 왼쪽 사이드바에 있으니 여기는 상담을 고르라는 안내만 */}
      <main className="hidden h-dvh flex-col items-center justify-center gap-4 px-8 text-center lg:flex">
        <CharacterFace id="mongle" size={120} />
        <p className="font-display text-2xl">왼쪽에서 상담을 골라 줘</p>
        <p className="text-sm text-muted">새로운 고민이 있으면 바로 시작해도 좋아요</p>
        <Link href="/new" className="flex h-12 items-center rounded-full bg-accent px-6 text-[15px] font-bold text-white">
          새 상담 시작하기
        </Link>
      </main>
    </>
  );
}
