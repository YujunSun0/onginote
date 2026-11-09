import { getDb, newId, updateDb } from "@/lib/db";
import type { Person } from "@/lib/types";

export async function GET() {
  const db = await getDb();
  return Response.json(db.persons);
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<Person>;
  if (!body.name?.trim()) {
    return Response.json({ error: "이름(별명)을 입력해 주세요." }, { status: 400 });
  }
  const person: Person = {
    id: newId(),
    name: body.name.trim(),
    relation: body.relation?.trim() || "썸",
    mbti: body.mbti?.trim().toUpperCase() || undefined,
    age: body.age?.trim() || undefined,
    birthday: body.birthday?.trim() || undefined,
    likes: [],
    dislikes: [],
    notes: [],
    timeline: [],
    createdAt: new Date().toISOString(),
  };
  await updateDb((db) => {
    db.persons.push(person);
  });
  return Response.json(person);
}
