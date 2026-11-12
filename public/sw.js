// 온기노트 서비스 워커.
// 상담 내용은 민감해서 기기에 캐시하지 않는다. 화면 이동이 네트워크 문제로 실패했을 때만 오프라인 안내를 보여 준다.
const CACHE = "onginote-offline-v2";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE_URL, "/icons/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // 오프라인 안내 그림
  if (req.method === "GET" && new URL(req.url).pathname === "/icons/icon-192.png") {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
    return;
  }
  // 화면 이동만 가로챈다. API, 사진, 스크립트는 그대로 네트워크로 (캐시하지 않음)
  if (req.mode !== "navigate") return;
  event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
});
