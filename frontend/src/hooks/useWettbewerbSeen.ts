import { useWettbewerbUsage } from './useWettbewerbUsage';

/**
 * Thin wrapper exposing just hasSeenWettbewerb, so AppShell.tsx's tab badge
 * only needs one hook call rather than pulling in the full usage surface.
 * Backed by the same shared ['wettbewerb-usage'] query cache used by the
 * page itself — no duplicate network call, no race between badge and page.
 */
export function useWettbewerbSeen(): boolean {
  const { hasSeenWettbewerb } = useWettbewerbUsage();
  return hasSeenWettbewerb;
}
