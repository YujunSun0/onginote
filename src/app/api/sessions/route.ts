import { requireUser } from "@/lib/auth";
import { CHARACTERS } from "@/lib/characters";
import { appendMessage, createSession, getPerson, getSessionMeta, listSessions, updateSession } from "@/lib/db";
import { josa } from "@/lib/format";
import { summaryState, type CharacterId } from "@/lib/types";

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const sessions = await listSessions(auth.ctx);
  return Response.json(
    sessions.map((s) => ({
      id: s.id,
      characterId: s.characterId,
      personId: s.personId,
      createdAt: s.createdAt,
      title: s.summary?.title,
      summaryState: summaryState(s.summary, s.messageCount),
      followUp: s.followUp,
      lastText: s.lastText ?? undefined,
      lastAt: s.lastAt ?? s.createdAt,
      userMessages: s.userMessageCount,
      todos: s.summary?.todo.map((text, i) => ({ text, done: Boolean(s.summary!.todoDone?.[i]) })),
    })),
  );
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { ctx } = auth;
  const body = (await request.json()) as {
    characterId: CharacterId;
    personId: string | null;
    voice?: boolean;
    /** 선톡에서 이어갈 때: 캐릭터가 먼저 보낸 안부 메시지로 대화를 시작한다 */
    fromFollowUpOf?: string;
  };
  const character = CHARACTERS[body.characterId];
  if (!character) return Response.json({ error: "캐릭터를 골라 주세요." }, { status: 400 });

  const person = body.personId ? await getPerson(ctx, body.personId) : null;
  const prev = body.fromFollowUpOf ? await getSessionMeta(ctx, body.fromFollowUpOf) : null;
  const greeting = prev?.followUp?.message || openingLine(body.characterId, person?.name ?? null);

  let session = await createSession(ctx, { characterId: body.characterId, personId: person?.id ?? null, voice: Boolean(body.voice) });
  const first = { role: "assistant" as const, text: greeting, mode: "listen" as const, at: new Date().toISOString() };
  session = await appendMessage(ctx, session, first);
  if (prev?.followUp) await updateSession(ctx, prev.id, { followUp: { ...prev.followUp, dismissed: true } });

  return Response.json({ ...session, messages: [first] });
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
