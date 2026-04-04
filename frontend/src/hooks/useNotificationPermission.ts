import { useState, useEffect } from 'react';

export type NotifPermission = 'granted' | 'denied' | 'default' | 'unsupported';

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

  useEffect(() => {
    if (!('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission as NotifPermission);
  }, []);

  const requestPermission = async (): Promise<NotifPermission> => {
    if (!('Notification' in window)) return 'unsupported';
    const result = await Notification.requestPermission();
    setPermission(result as NotifPermission);
    return result as NotifPermission;
  };

  const isSupported = permission !== 'unsupported';
  const isGranted = permission === 'granted';
  const isDenied = permission === 'denied';

  return { permission, requestPermission, isSupported, isGranted, isDenied };
}
