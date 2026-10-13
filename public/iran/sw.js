// Service worker למד ההסלמה: הדף נטען מהרשת כשיש חיבור, ומהמטמון כשאין.
const CACHE = "iran-meter-v1";
const SHELL = ["/iran", "/iran/index.html", "/iran/manifest.webmanifest", "/iran/icon.svg", "/iran/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // נתוני השווקים תמיד מהרשת; אם אין רשת הדף פשוט לא מציג אותם
  if (url.pathname.startsWith("/api/")) return;
  // רשת קודם, מטמון כגיבוי (כך עדכונים מגיעים מיד)
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (url.origin === location.origin || url.hostname.endsWith("gstatic.com") || url.hostname.endsWith("googleapis.com"))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("/iran/index.html")))
  );
});
