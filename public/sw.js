self.addEventListener('install', (event) => {
    self.skipWaiting();
  });
  
  self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
  });
  
  self.addEventListener('fetch', (event) => {
    // 1. Agar form submit ya POST request ho, toh beech mein mat aao
    if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
      return;
    }
  
    // 2. Agar fetch fail ho jaye, toh undefined ki jagah valid Response bhejega
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return new Response('Network offline', { status: 503, statusText: 'Offline' });
      })
    );
  });