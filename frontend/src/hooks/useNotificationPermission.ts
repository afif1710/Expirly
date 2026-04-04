import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export type NotifPermission = 'granted' | 'denied' | 'default' | 'unsupported';

type SubscriptionStatus = 'idle' | 'registering' | 'subscribed' | 'error';

const SERVICE_WORKER_PATH = '/sw.js';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function normalizeSubscription(subscription: PushSubscription) {
  const payload = subscription.toJSON();

  if (!payload.endpoint || !payload.keys?.p256dh || !payload.keys?.auth) {
    throw new Error('Push subscription is missing required keys');
  }

  return {
    endpoint: payload.endpoint,
    expirationTime: payload.expirationTime ?? null,
    keys: {
      p256dh: payload.keys.p256dh,
      auth: payload.keys.auth,
    },
  };
}

/**
 * Hook for managing Web Notification API permission state.
 * Groundwork for future push notification delivery.
 *
 * When push delivery is implemented:
 *   1. On 'granted', call navigator.serviceWorker.ready then subscribe()
 *   2. POST the PushSubscription to /api/notifications/subscribe
 *   3. Server stores subscription and uses web-push to deliver reminders at reminder_at
 */
export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotifPermission>('default');
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('idle');
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);

  const isPushSupported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  const ensurePushSubscription = useCallback(async (): Promise<boolean> => {
    if (!isPushSupported) {
      setSubscriptionStatus('error');
      setSubscriptionError('Push notifications are not supported in this browser.');
      return false;
    }

    setSubscriptionStatus('registering');
    setSubscriptionError(null);

    try {
      await navigator.serviceWorker.register(SERVICE_WORKER_PATH, { scope: '/' });
      const registration = await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const vapid = await api.get<{ public_key: string }>('/api/notifications/vapid-public-key');
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid.public_key),
        });
      }

      await api.post('/api/notifications/subscribe', normalizeSubscription(subscription));
      setSubscriptionStatus('subscribed');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to finish push setup';
      setSubscriptionStatus('error');
      setSubscriptionError(message);
      return false;
    }
  }, [isPushSupported]);

  useEffect(() => {
    if (!('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    const currentPermission = Notification.permission as NotifPermission;
    setPermission(currentPermission);

    if (currentPermission === 'granted') {
      void ensurePushSubscription();
    }
  }, [ensurePushSubscription]);

  const requestPermission = async (): Promise<NotifPermission> => {
    if (!('Notification' in window)) return 'unsupported';
    const result = await Notification.requestPermission();
    setPermission(result as NotifPermission);
    return result as NotifPermission;
  };

  const isSupported = permission !== 'unsupported' && isPushSupported;
  const isGranted = permission === 'granted';
  const isDenied = permission === 'denied';

  return {
    permission,
    requestPermission,
    ensurePushSubscription,
    isSupported,
    isGranted,
    isDenied,
    subscriptionStatus,
    subscriptionError,
  };
}
