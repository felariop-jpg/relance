import { useEffect, useState } from 'react';

const CHANNEL = 'relance-tabs';
const PING_MS = 4000;
const STALE_MS = 10_000;

/**
 * Detects other tabs or windows of this browser with Relance open, using
 * BroadcastChannel (local to the browser; nothing leaves the computer).
 * Data already syncs between tabs; this only powers a gentle notice.
 */
export function useOtherTabsOpen(): boolean {
  const [others, setOthers] = useState(false);
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const me = crypto.randomUUID();
    const seen = new Map<string, number>();
    const channel = new BroadcastChannel(CHANNEL);
    const refresh = () => {
      const now = Date.now();
      for (const [id, at] of seen) if (now - at > STALE_MS) seen.delete(id);
      setOthers(seen.size > 0);
    };
    channel.onmessage = (event: MessageEvent<{ id: string; type: 'here' | 'bye' }>) => {
      const { id, type } = event.data ?? {};
      if (!id || id === me) return;
      if (type === 'bye') seen.delete(id);
      else seen.set(id, Date.now());
      refresh();
    };
    const ping = () => channel.postMessage({ id: me, type: 'here' });
    ping();
    const timer = setInterval(() => {
      ping();
      refresh();
    }, PING_MS);
    const bye = () => channel.postMessage({ id: me, type: 'bye' });
    window.addEventListener('pagehide', bye);
    return () => {
      bye();
      clearInterval(timer);
      window.removeEventListener('pagehide', bye);
      channel.close();
    };
  }, []);
  return others;
}
