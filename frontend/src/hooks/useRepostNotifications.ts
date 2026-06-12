import { useEffect, useRef } from 'react';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';

function getToken() {
  return localStorage.getItem('kb_session') || localStorage.getItem('token');
}

/**
 * Real-time notifications via Server-Sent Events (no polling). Connects to
 * /api/notifications/stream and shows each event as a desktop notification
 * (falling back to alert() if permission isn't granted). Auto-reconnects.
 *
 * When a repost notification arrives, prompts user to sync ads.
 */
export function useRepostNotifications(onRepostNotification?: () => void) {
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    // Aggressively ask for notification permission on first load
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }

    const show = (title: string, body: string) => {
      if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification(title, { body }); return; } catch { /* fall through */ }
      }
      alert(`${title}\n${body}`);
    };

    let closed = false;
    let reconnectTimer: number | null = null;

    const connect = () => {
      if (closed) return;
      const es = new EventSource(`${API_URL}/notifications/stream?token=${encodeURIComponent(token)}`);
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (!data || data.type === 'ping') return; // heartbeat

          let title = '🔔 AnzeigenBoost';
          if (data.type === 'repost_simulated') title = '✅ Anzeige neu gestellt';
          else if (data.type === 'repost_pending_notification') title = '📢 Repost bereit';
          else if (data.type === 'repost_disabled') title = '⚠️ Auto-Repost deaktiviert';
          else if (data.type === 'reposts_paused') title = '⛔ Reposts pausiert';

          show(title, data.message || 'Benachrichtigung von AnzeigenBoost');

          // When repost notification arrives, trigger refresh in parent component
          if (data.type === 'repost_pending_notification' && onRepostNotification) {
            // Give user a moment to see the notification, then prompt sync
            setTimeout(() => {
              const syncNow = confirm('🔔 Repost-Zeit erreicht!\n\nMöchtest du die Anzeigen jetzt synchronisieren?');
              if (syncNow) {
                onRepostNotification();
              }
            }, 1000);
          }
        } catch { /* ignore non-JSON */ }
      };

      es.onerror = () => {
        // EventSource auto-reconnects, but if the server closed (e.g. 401) we
        // back off and retry manually.
        es.close();
        if (!closed && reconnectTimer == null) {
          reconnectTimer = window.setTimeout(() => { reconnectTimer = null; connect(); }, 5000);
        }
      };
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      esRef.current?.close();
    };
  }, [onRepostNotification]);
}
