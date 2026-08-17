// Background Ringing & Web Push Notification Engine for Talk App
import { ringEngine } from './audioRingEngine';

export interface NotificationStatus {
  permission: NotificationPermission;
  isServiceWorkerRegistered: boolean;
  isPwaInstalled: boolean;
  canRingInBackground: boolean;
}

class NotificationEngine {
  private swRegistration: ServiceWorkerRegistration | null = null;

  constructor() {
    this.initServiceWorker();
  }

  public async initServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        this.swRegistration = reg;
        return reg;
      } catch (err) {
        console.warn('Service Worker registration failed:', err);
      }
    }
    return null;
  }

  public getStatus(): NotificationStatus {
    const isPwaInstalled =
      (typeof window !== 'undefined' &&
        (window.matchMedia('(display-mode: standalone)').matches ||
          (window.navigator as any).standalone === true)) ||
      false;
    const permission = typeof Notification !== 'undefined' ? Notification.permission : 'default';

    return {
      permission,
      isServiceWorkerRegistered: !!this.swRegistration || (typeof navigator !== 'undefined' && 'serviceWorker' in navigator),
      isPwaInstalled,
      canRingInBackground: permission === 'granted',
    };
  }

  /**
   * Request system notification permission and unlock Web Audio engine
   */
  public async requestNotificationPermission(): Promise<NotificationPermission> {
    // 1. Unlock Web Audio Context
    ringEngine.unlockAudio();

    if (typeof Notification === 'undefined') {
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        // Play short verified confirmation chime
        ringEngine.playVerifiedChime();
        // Re-init Service Worker
        await this.initServiceWorker();
      }
      return permission;
    } catch (e) {
      console.error('Error requesting notification permission:', e);
      return typeof Notification !== 'undefined' ? Notification.permission : 'denied';
    }
  }

  /**
   * Trigger Background Ring Notification (works when window is closed or in background if PWA / Service Worker is registered)
   */
  public async triggerIncomingCallAlert(callerName: string, callType: string, callId: string) {
    // 1. Unlock & start physical audio ringtone immediately
    ringEngine.unlockAudio();
    ringEngine.startIncomingRing();

    // 2. Physical device vibration pattern
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([500, 200, 500, 200, 1000]);
      } catch (e) {}
    }

    // 3. Try Service Worker Notification with Answer/Decline action buttons
    if (this.swRegistration && this.swRegistration.showNotification) {
      try {
        const swOptions: any = {
          body: `Incoming ${callType.toUpperCase()} call from ${callerName}. Tap to answer on Talk.`,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [500, 250, 500, 250, 500, 250],
          tag: `incoming-call-${callId}`,
          renotify: true,
          requireInteraction: true,
          actions: [
            { action: 'answer', title: '📞 Answer' },
            { action: 'decline', title: '❌ Decline' },
          ],
          data: {
            url: '/',
            callId,
            callType,
            callerName,
          },
        };
        await this.swRegistration.showNotification(`📞 Incoming ${callType.toUpperCase()} Call: ${callerName}`, swOptions);
        return;
      } catch (e) {
        console.warn('SW notification error:', e);
      }
    }

    // 4. Standard Web Notification fallback
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const notif = new Notification(`📞 Incoming ${callType.toUpperCase()} Call: ${callerName}`, {
          body: `Incoming call from ${callerName}. Tap to open Talk and answer.`,
          icon: '/icon-192.png',
          requireInteraction: true,
          tag: `incoming-call-${callId}`,
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch (e) {
        console.warn('Notification fallback error:', e);
      }
    }
  }

  /**
   * Dismiss notification alert when call is answered, ended or declined
   */
  public async dismissIncomingCallAlert(callId: string) {
    ringEngine.stopAll();
    if (this.swRegistration && this.swRegistration.getNotifications) {
      try {
        const notifications = await this.swRegistration.getNotifications({ tag: `incoming-call-${callId}` });
        notifications.forEach((notif) => notif.close());
      } catch (e) {
        console.warn('Error dismissing notification:', e);
      }
    }
  }
}

export const notificationEngine = new NotificationEngine();

