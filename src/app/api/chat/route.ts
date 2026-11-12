import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { CHARACTERS } from "@/lib/characters";
import { MissingKeyError, ROUTER_MODEL, apiErrorMessage, getClient } from "@/lib/claude";
import { requireUser } from "@/lib/auth";
import { type Ctx, appendMessage, getPerson, getSession, loadImageData, updateSession } from "@/lib/db";
import {
  ROUTER_SYSTEM,
  buildSystemPrompt,
  modeInstruction,
  transcript,
} from "@/lib/prompts";
import {
  MAX_IMAGES,
  MAX_INPUT_CHARS,
  messageImages,
  type ChatImage,
  type ChatMessage,
  type MessageSources,
  type Mode,
  type Session,
} from "@/lib/types";
import { budgetExceededMessage, getAllowance, getUsageStatus, recordUsage } from "@/lib/usage";

/** AI·결제 응답을 기다리는 시간 (Vercel 함수 최대 실행 시간, 초) */
export const maxDuration = 300;

const RouterSchema = z.object({
  mode: z.enum(["chat", "listen", "explore", "interpret", "react", "offer_plan", "plan"]),
  reason: z.string(),
  need_search: z.boolean(),
  search_queries: z.array(z.string()),
  crisis: z.boolean(),
});
type RouterResult = z.infer<typeof RouterSchema>;

const MAX_IMAGE_BASE64 = 5 * 1024 * 1024 * 1.37; // 약 5MB 이미지

interface ChatRequest {
  sessionId: string;
  text: string;
  images?: ChatImage[];
  /** 입력창 위 칩("그냥 들어줘", "보낼 말 써줘")처럼 사용자가 모드를 직접 고른 경우 */
  forceMode?: Mode;
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { ctx } = auth;
  const body = (await request.json()) as ChatRequest;
  const text = body.text?.trim() ?? "";
  // 브라우저가 보낸 사진은 base64 만 받는다 (경로를 보내 남의 파일을 가리키지 못하게)
  const images: ChatImage[] = (body.images ?? [])
    .filter((img) => typeof img.data === "string" && img.data.length > 0)
    .map((img) => ({ mediaType: img.mediaType, data: img.data }));
  if (!text && images.length === 0) return Response.json({ error: "메시지를 입력해 주세요." }, { status: 400 });
  if (images.length > MAX_IMAGES) {
    return Response.json({ error: `사진은 한 번에 ${MAX_IMAGES}장까지 보낼 수 있어요.` }, { status: 400 });
  }
  if (images.some((img) => (img.data?.length ?? 0) > MAX_IMAGE_BASE64)) {
    return Response.json({ error: "이미지가 너무 커요. 한 장에 5MB 이하로 올려 주세요." }, { status: 400 });
  }
  if (text.length > MAX_INPUT_CHARS) {
    return Response.json({ error: `메시지는 ${MAX_INPUT_CHARS.toLocaleString()}자까지 보낼 수 있어요.` }, { status: 400 });
  }

  const session = await getSession(ctx, body.sessionId);
  if (!session) return Response.json({ error: "상담을 찾을 수 없어요." }, { status: 404 });
  const usage = await getAllowance(ctx.userId);
  const chatModel = usage.limits.chatModel;
  if (usage.exceeded) {
    return Response.json({ error: budgetExceededMessage(usage), limit: "daily" }, { status: 429 });
  }
  if (session.userMessageCount >= usage.sessionMessages) {
    return Response.json(
      { error: "이 상담은 충분히 길어졌어요. 정리하고 새 상담으로 이어가 주세요.", limit: "session" },
      { status: 400 },
    );
  }
  const person = session.personId ? await getPerson(ctx, session.personId) : null;
  const character = CHARACTERS[session.characterId];

  const userMessage: ChatMessage = {
    role: "user",
    text: text || "(대화 캡처를 보냈어요)",
    images: images.length ? images : undefined,
    at: new Date().toISOString(),
  };
  let meta = await appendMessage(ctx, session, userMessage);
  const history = await withRecentImageData(ctx, [...session.messages, userMessage]);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

      try {
        const client = getClient();

        // 1) 이번 턴의 모드 판단
        const route = body.forceMode
          ? forcedRoute(body.forceMode)
          : await decideMode(client, ctx.userId, session, history, character.planEagerness);
        send({ type: "mode", mode: route.mode });

        // 2) 캐릭터 답변 스트리밍
        const deep = route.mode === "plan" || route.mode === "interpret";
        // 검색은 해석·플랜에서 필요할 때, 그리고 수다 중에 사용자가 직접 찾아 달라고 했을 때
        // 오늘 검색 횟수를 다 썼으면 검색 없이 답하고, 그 사실을 한마디로 밝힌다
        const wantsSearch = (deep || route.mode === "chat") && route.need_search;
        const searched = wantsSearch && usage.searchesLeft > 0;
        let instruction = modeInstruction(route.mode, searched, countMode(history, "interpret"), countStreak(history, "chat"));
        if (searched && route.search_queries.length > 0) {
          instruction += `\n필요하면 web_search 도구로 이런 검색어를 찾아봐: ${route.search_queries.join(", ")}`;
        }
        if (wantsSearch && !searched) {
          instruction += `\n- 오늘은 검색 횟수를 다 써서 검색할 수 없어. 검색 없이 아는 범위에서 답하고, "오늘은 검색을 다 써서 아는 만큼만 말해 볼게"처럼 한마디로 자연스럽게 밝혀. 최신 정보가 꼭 필요한 부분은 확실하지 않다고 말해.`;
        }
        if (route.crisis) {
          instruction = `[위기 신호 감지] 모드와 상관없이, 사용자의 안전을 먼저 걱정해 주고 자살예방상담전화 109, 정신건강위기상담 1577-0199, 위급하면 112/119를 꼭 안내해.`;
        }

        // 캐시가 깨지지 않게: 요청 전체의 effort 는 low 로 고정하고, 깊게 생각할 턴만
        // 모드 지시 메시지에서 올린다 (top-level 값을 바꾸면 대화 기록 캐시가 처음부터 다시 쓰인다)
        let messages: Anthropic.Beta.BetaMessageParam[] = [
          ...toApiMessages(history),
          { role: "system", content: instruction, output_config: { effort: deep ? "medium" : "low" } },
        ];

        let fullText = "";
        const sources = new SourceCollector();
        for (let turn = 0; turn < 4; turn++) {
          const reply = getClient().beta.messages.stream({
            model: chatModel,
            max_tokens: 16000,
            betas: ["server-side-fallback-2026-07-01", "mid-conversation-output-config-2026-07-01"],
            fallbacks: "default",
            output_config: { effort: "low" },
            system: [
              { type: "text", text: buildSystemPrompt(character, person), cache_control: { type: "ephemeral" } },
            ],
            messages,
            ...(searched
              ? { tools: [{ type: webSearchType(chatModel), name: "web_search" as const, max_uses: Math.min(3, usage.searchesLeft) }] }
              : {}),
          });

          for await (const event of reply) {
            if (event.type === "content_block_start" && event.content_block.type === "server_tool_use") {
              send({ type: "searching" });
            } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              fullText += event.delta.text;
              send({ type: "text", delta: event.delta.text });
            }
          }
          const final = await reply.finalMessage();
          sources.add(final.content);
          await recordUsage(ctx.userId, "chat", final.model ?? chatModel, final.usage, session.id);
          if (final.stop_reason === "pause_turn") {
            // 웹 검색이 길어져 서버가 잠시 멈춘 경우: 이어서 진행
            messages = [...messages, { role: "assistant", content: final.content }];
            continue;
          }
          if (final.stop_reason === "refusal" && !fullText) {
            fullText = "이 이야기는 내가 제대로 도와주기 어려울 것 같아. 다른 방향으로 같이 얘기해 볼까?";
            send({ type: "text", delta: fullText });
          }
          break;
        }

        const assistantMessage: ChatMessage = {
          role: "assistant",
          text: fullText.trim(),
          mode: route.mode,
          sources: sources.result(),
          at: new Date().toISOString(),
        };
        if (assistantMessage.sources) send({ type: "sources", sources: assistantMessage.sources });
        meta = await appendMessage(ctx, meta, assistantMessage);
        await updateSession(ctx, session.id, {
          mode: route.mode,
          ...(route.mode === "offer_plan" ? { planOfferedAt: meta.messageCount - 1 } : {}),
        });
        send({ type: "done", mode: route.mode, usage: (await getUsageStatus(ctx.userId)).percent });
      } catch (err) {
        console.error(err);
        send({ type: "error", message: apiErrorMessage(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" },
  });
}

/**
 * 새 웹 검색 도구(20260209)는 Opus/Sonnet 전용이다. Haiku 에 주면 오류 없이 검색만 조용히 실패해서,
 * Haiku 일 때는 이전 버전을 쓴다.
 */
function webSearchType(model: string) {
  return model.includes("haiku") ? ("web_search_20250305" as const) : ("web_search_20260209" as const);
}

function forcedRoute(mode: Mode): RouterResult {
  return { mode, reason: "사용자가 직접 선택", need_search: mode === "plan" || mode === "interpret", search_queries: [], crisis: false };
}

async function decideMode(
  client: Anthropic,
  userId: string,
  session: Session,
  history: ChatMessage[],
  planEagerness: number,
): Promise<RouterResult> {
  const exploreStreak = countStreak(history, "explore");
  const interpretCount = countMode(history, "interpret");
  const turnsSinceOffer =
    session.planOfferedAt === null ? "없음" : `${history.length - 1 - session.planOfferedAt}개 메시지 전`;
  try {
    const res = await client.messages.parse({
      model: ROUTER_MODEL,
      max_tokens: 16000,
      output_config: { effort: "low", format: zodOutputFormat(RouterSchema) },
      system: ROUTER_SYSTEM,
      messages: [
        {
          role: "user",
          content: `캐릭터 플랜 성향: ${planEagerness}\n현재 모드: ${session.mode}\n연속 알아가기: ${exploreStreak}번\n이전 해석 횟수: ${interpretCount}번\n플랜 제안: ${turnsSinceOffer}\n\n[대화]\n${transcript(history)}`,
        },
      ],
    });
    await recordUsage(userId, "router", res.model ?? ROUTER_MODEL, res.usage, session.id);
    const out = res.parsed_output;
    if (out) {
      // 질문만 계속하지 않도록: 알아가기는 연속 2번까지만
      if (out.mode === "explore" && exploreStreak >= 2) out.mode = "interpret";
      return out;
    }
  } catch (err) {
    // 인증 오류 같은 건 위로 올려서 사용자에게 보여준다
    if (err instanceof Anthropic.AuthenticationError || err instanceof MissingKeyError) throw err;
    console.error("router failed, keeping current mode", err);
  }
  return { mode: session.mode, reason: "판단 실패", need_search: false, search_queries: [], crisis: false };
}

/**
 * 응답에서 웹 검색어와 참고한 글을 모은다. 블록 모양은 검색 도구 버전마다 조금 달라서 느슨하게 읽는다.
 */
class SourceCollector {
  private queries: string[] = [];
  private cited = new Map<string, string>();
  private found = new Map<string, string>();

  add(content: unknown[]) {
    for (const block of content as Record<string, unknown>[]) {
      if (block.type === "server_tool_use" && block.name === "web_search") {
        const q = (block.input as { query?: unknown } | undefined)?.query;
        if (typeof q === "string" && q.trim() && !this.queries.includes(q.trim())) this.queries.push(q.trim());
      } else if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const r of block.content as Record<string, unknown>[]) this.keep(this.found, r.url, r.title);
      } else if (block.type === "text" && Array.isArray(block.citations)) {
        for (const c of block.citations as Record<string, unknown>[]) this.keep(this.cited, c.url, c.title);
      }
    }
  }

  private keep(into: Map<string, string>, url: unknown, title: unknown) {
    if (typeof url !== "string" || !/^https?:\/\//.test(url) || into.has(url)) return;
    into.set(url, typeof title === "string" && title.trim() ? title.trim() : new URL(url).hostname);
  }

  result(): MessageSources | undefined {
    if (this.queries.length === 0 && this.found.size === 0) return undefined;
    // 답변에 인용된 글이 있으면 그것만 (검색 결과엔 상관없는 글도 섞여 있다). 인용 정보가 없으면 검색 결과 위쪽 5개.
    const links = this.cited.size > 0 ? [...this.cited].slice(0, 8) : [...this.found].slice(0, 5);
    return { queries: this.queries, links: links.map(([url, title]) => ({ url, title })) };
  }
}

/** Claude 에 사진을 함께 보내는 최근 메시지 수 (toApiMessages 와 맞춘다) */
const IMAGE_WINDOW = 6;

/** 최근 메시지의 사진만 Storage 에서 내려받아 base64 를 채운다. 오래된 사진은 텍스트로만 언급한다. */
async function withRecentImageData(ctx: Ctx, history: ChatMessage[]): Promise<ChatMessage[]> {
  return Promise.all(
    history.map(async (m, i) =>
      i >= history.length - IMAGE_WINDOW && m.images?.some((img) => !img.data)
        ? { ...m, images: await loadImageData(ctx, m.images) }
        : m,
    ),
  );
}

/** 이 상담에서 캐릭터가 해당 모드로 답한 횟수 */
function countMode(history: ChatMessage[], mode: Mode): number {
  return history.filter((m) => m.role === "assistant" && m.mode === mode).length;
}

/** 마지막부터 거꾸로 세어, 캐릭터가 연속으로 이 모드였던 횟수 (첫 인사는 세지 않는다) */
function countStreak(history: ChatMessage[], mode: Mode): number {
  let n = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.role === "user") continue;
    if (m.mode !== mode) break;
    n++;
  }
  return n;
}

/**
 * 최근 대화를 API 메시지로 바꾼다. 이미지는 최근 것만 보낸다.
 *
 * 프롬프트 캐시는 앞부분이 똑같을 때만 맞는다. 그래서
 * - 보내는 범위를 매번 한 칸씩 밀지 않고 10개 단위로 민다 (30~39개를 보냄)
 * - 이번 사용자 메시지 끝에 캐시 지점을 둔다. 다음 턴에는 여기까지가 1/10 가격으로 읽힌다.
 */
function toApiMessages(history: ChatMessage[]): Anthropic.Beta.BetaMessageParam[] {
  const start = history.length > 30 ? Math.floor((history.length - 30) / 10) * 10 : 0;
  const recent = history.slice(start);
  // API의 첫 메시지는 user여야 한다 (첫 인사는 assistant라서 앞에 맥락을 붙인다)
  const out: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: "(상담을 시작했어요)" }];
  recent.forEach((m, i) => {
    if (m.role === "assistant") {
      out.push({ role: "assistant", content: m.text || "…" });
      return;
    }
    const imgs = messageImages(m);
    const keepImages = imgs.length > 0 && i >= recent.length - IMAGE_WINDOW && imgs.every((img) => img.data);
    out.push({
      role: "user",
      content: keepImages
        ? [
            ...imgs.map((img) => ({
              type: "image" as const,
              source: { type: "base64" as const, media_type: img.mediaType, data: img.data! },
            })),
            { type: "text" as const, text: imgs.length > 1 ? `(캡처 ${imgs.length}장, 순서대로)
${m.text}` : m.text },
          ]
        : m.text + (imgs.length ? ` [이전에 대화 캡처 ${imgs.length}장을 보냈음]` : ""),
    });
  });
  markCacheBreakpoint(out[out.length - 1]);
  return out;
}

function markCacheBreakpoint(msg: Anthropic.Beta.BetaMessageParam | undefined) {
  if (!msg || msg.role !== "user") return;
  if (typeof msg.content === "string") {
    msg.content = [{ type: "text", text: msg.content, cache_control: { type: "ephemeral" } }];
    return;
  }
  const lastBlock = msg.content[msg.content.length - 1];
  if (lastBlock && lastBlock.type === "text") lastBlock.cache_control = { type: "ephemeral" };
}
