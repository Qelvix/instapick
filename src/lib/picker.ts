import type { CachedComment } from "@prisma/client";

export type PickerFilters = {
  /** Inclusive ISO timestamps. Omit either side for an open-ended range. */
  startTime?: string;
  endTime?: string;
  includeReplies?: boolean;
  excludeUsernames?: string[];
  requireKeyword?: string;
  dedupeByUsername?: boolean;
  winnerCount?: number;
};

export function applyFilters(comments: CachedComment[], filters: PickerFilters) {
  const start = filters.startTime ? new Date(filters.startTime).getTime() : -Infinity;
  const end = filters.endTime ? new Date(filters.endTime).getTime() : Infinity;
  const excluded = new Set((filters.excludeUsernames ?? []).map((u) => u.toLowerCase()));
  const keyword = filters.requireKeyword?.toLowerCase();

  let pool = comments.filter((c) => {
    const t = c.timestamp.getTime();
    if (t < start || t > end) return false;
    if (!filters.includeReplies && c.parentCommentId) return false;
    if (excluded.has(c.username.toLowerCase())) return false;
    if (keyword && !c.text.toLowerCase().includes(keyword)) return false;
    return true;
  });

  if (filters.dedupeByUsername) {
    const seen = new Set<string>();
    pool = pool.filter((c) => {
      if (seen.has(c.username)) return false;
      seen.add(c.username);
      return true;
    });
  }

  return pool;
}

/** Deterministic PRNG (mulberry32) seeded from a string, so a draw can be replayed from its stored seed. */
function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export function pickWinners(pool: CachedComment[], winnerCount: number, seed: string) {
  const rng = seededRandom(seed);
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(winnerCount, shuffled.length));
}
