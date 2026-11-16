// 연말 결산: 열리는 조건(상담 5개·3일), 12/31 이후 기록 제외, 시즌마다 하나, 남의 결산·DB 직접 조회, 공유되는 값에 이름 없음.
import { SKIP_AI, admin, check, makeUser, skip } from "./_lib.mjs";

const kst = (s) => new Date(`${s}+09:00`).toISOString();

export default async function testRecap() {
  const A = await makeUser("recap-a");
  const Bu = await makeUser("recap-b");

  try {
    const person = (await A.api("/api/persons", "POST", { name: "검증민지", relation: "썸" })).body;
    const addSession = async (day, { personId = person.id, n = 2, summary = true } = {}) => {
      const { data: s, error } = await admin
        .from("sessions")
        .insert({
          user_id: A.id,
          person_id: personId,
          character_id: "mongle",
          created_at: kst(`${day}T23:00:00`),
          summary: summary
            ? { title: "검증민지 답장 고민", situation: "민지가 답장을 늦게 해서 서운했어", interpretation: "i", todo: ["먼저 말 걸기"], todoDone: [true], dont: [], suggestions: [], applied: false }
            : null,
        })
        .select("id")
        .single();
      if (error) throw error;
      const rows = [];
      for (let i = 0; i < n; i++) {
        rows.push({ session_id: s.id, user_id: A.id, role: "user", text: "민지가 답장을 늦게 해서 서운했어", created_at: kst(`${day}T23:${10 + i}:00`) });
        rows.push({ session_id: s.id, user_id: A.id, role: "assistant", text: "그랬구나", mode: i ? "interpret" : "listen", created_at: kst(`${day}T23:${10 + i}:30`) });
      }
      const { error: e2 } = await admin.from("messages").insert(rows);
      if (e2) throw e2;
    };

    let d = (await A.api("/api/recap")).body;
    check("처음: 조건 0/5, 0/3, 결산 없음", d.progress?.sessions === 0 && d.progress.days === 0 && d.recap === null && d.need?.sessions === 5 && d.need.days === 3, JSON.stringify(d).slice(0, 200));

    // 상담 5개를 이틀에 몰아서 → 날 수가 모자람
    for (const day of ["2026-11-20", "2026-11-20", "2026-11-20", "2026-11-21", "2026-11-21"]) await addSession(day);
    // 1월 상담은 세지 않는다
    await addSession("2027-01-03", { summary: false });
    d = (await A.api("/api/recap")).body;
    check("상담 5개·2일: 아직 안 열림 (1월 상담 제외)", d.progress?.sessions === 5 && d.progress.days === 2 && d.progress.ok === false, JSON.stringify(d.progress));

    const state = d.state;
    if (state !== "open") {
      // 배포 서버(npm run start)는 날짜를 따른다. 12/15 전이면 만들 수 없어야 한다
      check(`기간 밖(${state}): 만들기 403`, (await A.api("/api/recap", "POST")).status === 403);
      skip("결산 만들기 (기간 밖 서버 · 개발 서버에서는 열림)");
      return;
    }
    check("조건 전 만들기 400", (await A.api("/api/recap", "POST")).status === 400);

    await addSession("2026-12-01", { personId: null });
    d = (await A.api("/api/recap")).body;
    check("상담 6개·3일: 열림", d.progress?.ok === true, JSON.stringify(d.progress));

    // ── 만들기
    let recapId;
    if (SKIP_AI) {
      skip("AI 로 결산 만들기");
      const { data, error } = await admin
        .from("reports")
        .insert({
          user_id: A.id,
          kind: "recap",
          source_count: 6,
          model: "test",
          content: {
            season: "2026",
            stats: {
              firstDay: "2026-11-20",
              sessions: 6,
              activeDays: 3,
              summarized: 5,
              people: 1,
              topPerson: { personId: person.id, relation: "썸", sessions: 5 },
              hours: { dawn: 0, morning: 0, afternoon: 0, evening: 0, night: 12 },
              topBucket: "night",
              wants: { listen: 6, think: 6, plan: 0 },
              todos: { total: 5, done: 5 },
              character: { id: "mongle", sessions: 6 },
              longestDay: { day: "2026-11-20", messages: 6 },
            },
            topics: [{ name: "답장 고민", count: 5 }],
            headline: "답장 하나에도 마음을 다 쓴 겨울",
            letter: "편지",
          },
        })
        .select("id")
        .single();
      if (error) throw error;
      recapId = data.id;
    } else {
      const made = await A.api("/api/recap", "POST");
      check("결산 만들기 200", made.status === 200 && !!made.body.recap?.id, JSON.stringify(made.body).slice(0, 200));
      const r = made.body.recap ?? {};
      if (process.env.SHOW_REPORT) console.log(JSON.stringify(r, null, 1));
      console.log("   └", r.headline, "·", (r.topics ?? []).map((t) => `${t.name}(${t.count})`).join(", "));
      check("숫자: 상담 6개·3일, 1월 제외", r.stats?.sessions === 6 && r.stats.activeDays === 3, JSON.stringify(r.stats).slice(0, 160));
      check("숫자: 밤 시간대, 할 일 6/6", r.stats?.topBucket === "night" && r.stats.todos?.done === 6 && r.stats.todos.total === 6, JSON.stringify(r.stats?.todos));
      check("가장 많이 이야기한 사람: 이름은 화면용으로만", r.topPersonName === "검증민지" && r.stats?.topPerson?.relation === "썸");
      check("AI 가 쓴 한 줄·편지·주제에 이름 없음", !JSON.stringify({ h: r.headline, l: r.letter, t: r.topics }).includes("민지"), r.headline);
      check("고민 주제 1~3개", (r.topics ?? []).length >= 1 && r.topics.length <= 3);
      const used = await admin.from("usage").select("model").eq("user_id", A.id).eq("kind", "report");
      check("결산은 Haiku 로 한 번", used.data?.length === 1 && used.data[0].model.includes("haiku"), JSON.stringify(used.data));
      recapId = r.id;
    }

    d = (await A.api("/api/recap")).body;
    check("다시 열면 같은 결산", d.recap?.id === recapId && d.canRefresh === false);
    const again = await A.api("/api/recap", "POST");
    check("상담이 더 안 쌓였으면 다시 만들지 않음", again.status === 200 && again.body.recap?.id === recapId);
    const { data: rows } = await admin.from("reports").select("id").eq("user_id", A.id).eq("kind", "recap");
    check("시즌마다 하나", (rows ?? []).length === 1);
    const dup = await admin.from("reports").insert({ user_id: A.id, kind: "recap", source_count: 1, model: "x", content: { season: "2026" } });
    check("같은 시즌 두 번째 줄은 DB 가 막음", !!dup.error);

    // 남과 DB 직접 조회
    check("B 에게는 A 결산 안 보임", (await Bu.api("/api/recap")).body.recap === null);
    const direct = await A.sb.from("reports").select("content");
    check("공개 키로 DB 직접 조회해도 못 읽음", !!direct.error || (direct.data ?? []).length === 0);

    // 사람을 지우면 이름은 사라지고 관계만 남는다
    await A.api(`/api/persons/${person.id}`, "DELETE");
    d = (await A.api("/api/recap")).body;
    check("사람 삭제 후: 이름 없음, 결산은 남음", d.recap?.id === recapId && d.recap.topPersonName === null, JSON.stringify(d.recap?.topPersonName));

    const ex = (await A.api("/api/me/export")).body;
    check("내려받기에 결산", (ex?.reports ?? []).some((r) => r.kind === "recap"));
  } finally {
    await admin.from("usage").delete().eq("user_id", A.id);
  }
}
