import { requireUser } from "@/lib/auth";
import { createPerson, listPersons } from "@/lib/db";
import type { Person } from "@/lib/types";

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  return Response.json(await listPersons(auth.ctx));
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const body = (await request.json()) as Partial<Person>;
  if (!body.name?.trim()) {
    return Response.json({ error: "이름(별명)을 입력해 주세요." }, { status: 400 });
  }
  const person = await createPerson(auth.ctx, {
    name: body.name.trim(),
    relation: body.relation?.trim() || "썸",
    mbti: body.mbti?.trim().toUpperCase() || undefined,
    age: body.age?.trim() || undefined,
    birthday: body.birthday?.trim() || undefined,
  });
  return Response.json(person);
}
