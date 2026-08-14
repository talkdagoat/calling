// Service Worker for Talk PWA - Multi-Device Background Call Ringing & Web Push
const CACHE_NAME = 'talk-pwa-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle Background Push Notifications for Incoming Calls
self.addEventListener('push', (event) => {
  let data = {
    title: 'Incoming Call on Talk',
    body: 'Someone is calling you with end-to-end encryption...',
    callerName: 'Incoming Caller',
    callType: 'audio',
    callId: 'call_' + Date.now(),
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const title = `📞 Incoming ${data.callType === 'video' ? 'Video' : 'Audio'} Call: ${data.callerName}`;
  const options = {
    body: `Encrypted 256-bit call from ${data.callerName}. Tap to answer.`,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [500, 250, 500, 250, 500, 250, 500, 250],
    tag: `incoming-call-${data.callId}`,
    renotify: true,
    requireInteraction: true, // Keeps ringing alert on screen even if app is closed
    data: {
      url: '/',
      callId: data.callId,
      callType: data.callType,
      callerName: data.callerName,
    },
    actions: [
      { action: 'answer', title: '🟢 Answer Call' },
      { action: 'decline', title: '🔴 Decline' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle Notification Click / Actions when user interacts while app was closed
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action;
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and post message
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: action === 'decline' ? 'PWA_DECLINE_CALL' : 'PWA_ANSWER_CALL',
            data: event.notification.data,
          });
          return client.focus();
        }
      }
      // If no window is open (app was closed), launch the Talk PWA
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
