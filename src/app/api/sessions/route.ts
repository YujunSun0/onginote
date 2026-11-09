import { CHARACTERS } from "@/lib/characters";
import { getDb, newId, updateDb } from "@/lib/db";
import { josa, splitBubbles } from "@/lib/format";
import { summaryState, type CharacterId, type Session } from "@/lib/types";

export async function GET() {
  const db = await getDb();
  return Response.json(
    db.sessions.map((s) => ({
      id: s.id,
      characterId: s.characterId,
      personId: s.personId,
      createdAt: s.createdAt,
      title: s.summary?.title,
      summaryState: summaryState(s),
      followUp: s.followUp,
      lastText: s.messages.at(-1) ? splitBubbles(s.messages.at(-1)!.text).join(" ") : undefined,
      lastAt: s.messages.at(-1)?.at ?? s.createdAt,
      userMessages: s.messages.filter((m) => m.role === "user").length,
    })),
  );
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    characterId: CharacterId;
    personId: string | null;
    voice?: boolean;
    /** 선톡에서 이어갈 때: 캐릭터가 먼저 보낸 안부 메시지로 대화를 시작한다 */
    fromFollowUpOf?: string;
  };
  const character = CHARACTERS[body.characterId];
  if (!character) return Response.json({ error: "캐릭터를 골라 주세요." }, { status: 400 });

  const db = await getDb();
  const person = body.personId ? db.persons.find((p) => p.id === body.personId) : null;
  const prev = body.fromFollowUpOf ? db.sessions.find((s) => s.id === body.fromFollowUpOf) : undefined;

  const greeting = prev?.followUp?.message || openingLine(body.characterId, person?.name ?? null);

  const session: Session = {
    id: newId(),
    characterId: body.characterId,
    personId: person?.id ?? null,
    voice: Boolean(body.voice),
    mode: "listen",
    planOfferedAt: null,
    messages: [{ role: "assistant", text: greeting, mode: "listen", at: new Date().toISOString() }],
    createdAt: new Date().toISOString(),
  };
  await updateDb((d) => {
    d.sessions.push(session);
    const p = prev && d.sessions.find((s) => s.id === prev.id);
    if (p?.followUp) p.followUp.dismissed = true;
  });
  return Response.json(session);
}

function openingLine(id: CharacterId, name: string | null): string {
  const withName = name ? josa(name, "이랑", "랑") : "";
  switch (id) {
    case "mongle":
      return name ? `왔구나. ${withName} 무슨 일 있었어? 천천히 얘기해 줘.` : "왔구나. 오늘은 어떤 하루였어? 천천히 얘기해 줘.";
    case "yeoul":
      return name ? `왔네. ${name} 얘기야? 있었던 일부터 말해 봐.` : "왔네. 무슨 일이야? 있었던 일부터 말해 봐.";
    case "olly":
      return name ? `어서 오세요. ${name} 님과 어떤 일이 있었는지 들려주세요.` : "어서 오세요. 어떤 고민이 있는지 들려주세요.";
    case "daon":
      return name ? `야 왔어? ${withName} 또 뭔 일 있었어?` : "야 왔어? 뭔 일 있었어?";
  }
}
