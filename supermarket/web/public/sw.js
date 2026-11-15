// Service worker: מציג התראות מחיר שנשלחות מהשרת (Web Push) ופותח את מסך ההתראות בלחיצה.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "פראיירמטר", {
      body: data.body || "",
      icon: "/app-icon-192.png",
      badge: "/app-icon-192.png",
      dir: "rtl",
      lang: "he",
      tag: "price-alerts",
      renotify: true,
      data: { url: data.url || "/alerts" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/alerts", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
