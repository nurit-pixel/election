import { COPY } from "./copy";
import { PARTY_BY_KEY } from "./parties";
import type { Bet } from "./scoring";

export function pmLabel(pm: string): string {
  if (pm === "none") return COPY.pmNone;
  if (pm.startsWith("other:")) return pm.slice(6);
  const p = PARTY_BY_KEY[pm];
  return p ? p.leader || p.name : pm;
}

export function topParties(bet: Bet, n = 3) {
  return Object.entries(bet.seats)
    .filter(([k, v]) => v > 0 && PARTY_BY_KEY[k])
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => ({ party: PARTY_BY_KEY[k], seats: v }));
}
