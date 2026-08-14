// Background Ringing & Web Push Notification Engine for Talk App

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
    const isPwaInstalled = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    const permission = typeof Notification !== 'undefined' ? Notification.permission : 'default';

    return {
      permission,
      isServiceWorkerRegistered: !!this.swRegistration || 'serviceWorker' in navigator,
      isPwaInstalled,
      canRingInBackground: permission === 'granted',
    };
  }

  public async requestNotificationPermission(): Promise<boolean> {
    if (typeof Notification === 'undefined') {
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (e) {
      console.error('Error requesting notification permission:', e);
      return false;
    }
  }

  /**
   * Trigger Background Ring Notification (works when window is closed or in background if PWA / Service Worker is registered)
   */
  public async triggerIncomingCallAlert(callerName: string, callType: string, callId: string) {
    // 1. Try Service Worker Notification
    if (this.swRegistration && this.swRegistration.showNotification) {
      try {
        const swOptions: any = {
          body: `Encrypted call ringing from ${callerName}. Tap to answer on Talk.`,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [500, 250, 500, 250, 500, 250],
          tag: `incoming-call-${callId}`,
          renotify: true,
          requireInteraction: true,
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

    // 2. Standard Web Notification fallback
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(`📞 Incoming ${callType.toUpperCase()} Call: ${callerName}`, {
          body: `Encrypted call ringing from ${callerName}. Tap to answer on Talk.`,
          icon: '/icon-192.png',
          requireInteraction: true,
        });
      } catch (e) {
        console.warn('Notification fallback error:', e);
      }
    }
  }

  /**
   * Dismiss notification alert when call is answered, ended or declined
   */
  public async dismissIncomingCallAlert(callId: string) {
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
