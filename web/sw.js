// Service worker mínimo. O push em si é tratado pelo worker do OneSignal.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
