const CACHE = "hisabkitab-v1";
const PRECACHE = ["/", "/login", "/dashboard", "/pwa/icon-192.png", "/pwa/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("push", (event) => {
  let payload = { title: "HisabKitab", message: "", href: "/dashboard" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.message,
      icon: "/pwa/icon-192.png",
      badge: "/pwa/icon-192.png",
      data: { href: payload.href || "/dashboard" }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client && "navigate" in client) {
          try {
            return client.navigate(href).then(() => client.focus());
          } catch {}
        }
      }
      return self.clients.openWindow(href);
    })
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isStatic = url.pathname.match(/\.(png|svg|jpg|jpeg|webp|gif|ico|woff2?|ttf|otf|css|js)$/) || request.destination === "image" || request.destination === "font" || request.destination === "style" || request.destination === "script";

  if (isStatic) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
      return response;
    })));
    return;
  }

  event.respondWith(fetch(request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  }).catch(() => caches.match(request).then((cached) => cached || caches.match("/"))));
});
