/**
 * Browser storage under the `cg.*` keys. Venue ids are the join key — see CLAUDE.md on
 * why they must never be renamed. When accounts arrive these are the tables to migrate.
 *
 * Every read and write is guarded: private windows, cleared site data and storage-blocking
 * settings all make these throw, and none of that should take the page down.
 */
export function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — the session simply does not persist */
  }
}

export const KEYS = {
  theme: 'cg.theme',
  edges: 'cg.edges',
  saved: 'cg.saved',
  paper: 'cg.paper',
  papers: 'cg.papers',
} as const;
