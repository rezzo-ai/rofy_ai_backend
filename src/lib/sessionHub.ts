type Listener = (evt: { event: string; data: any }) => void;

declare global {
  // eslint-disable-next-line no-var
  var __SESSION_BUS__: Map<string, Set<Listener>> | undefined;
}
const BUS: Map<string, Set<Listener>> = (globalThis.__SESSION_BUS__ ??= new Map());

export function subscribe(sessionId: string, fn: Listener) {
  const set = BUS.get(sessionId) ?? new Set<Listener>();
  set.add(fn);
  BUS.set(sessionId, set);
  return () => {
    const s = BUS.get(sessionId);
    if (!s) return;
    s.delete(fn);
    if (s.size === 0) BUS.delete(sessionId);
  };
}

export function publish(sessionId: string, event: string, data: any) {
  const set = BUS.get(sessionId);
  if (!set || set.size === 0) return;
  for (const fn of set) fn({ event, data });
}
