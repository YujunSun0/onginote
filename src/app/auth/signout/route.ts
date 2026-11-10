import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** 로그아웃. 폼 POST 로만 받는다 (링크 미리보기 등으로 실수로 로그아웃되지 않게). */
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
