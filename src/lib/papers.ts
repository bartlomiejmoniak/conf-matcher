import type { TrackedPaper, Taxonomy } from './types';

/**
 * Pure edits over the `cg.papers` record — venue id → the papers aimed at it.
 *
 * These used to be closures inside Watchlist. The Papers view edits the same store, and
 * two copies of "replace index i of venue v" is exactly the kind of thing that drifts.
 */
export type PaperStore = Record<string, TrackedPaper[]>;

/** A paper plus where it lives, so a caller can edit it without tracking the pair itself. */
export interface PaperRef {
  venueId: string;
  index: number;
  paper: TrackedPaper;
}

export function updatePaper(store: PaperStore, venueId: string, index: number, patch: Partial<TrackedPaper>): PaperStore {
  const list = store[venueId];
  if (!list?.[index]) return store;
  const next = [...list];
  next[index] = { ...next[index]!, ...patch };
  return { ...store, [venueId]: next };
}

export function addPaper(store: PaperStore, venueId: string, taxonomy: Taxonomy): PaperStore {
  const blank: TrackedPaper = {
    title: '',
    stage: taxonomy.paperStages[0]!,
    outcome: taxonomy.paperOutcomes[0]!,
    note: '',
  };
  return { ...store, [venueId]: [...(store[venueId] ?? []), blank] };
}

export function removePaper(store: PaperStore, venueId: string, index: number): PaperStore {
  return { ...store, [venueId]: (store[venueId] ?? []).filter((_, i) => i !== index) };
}

/**
 * One paper submitted to three venues is one piece of work, not three. Grouping on the
 * title is what turns the per-venue store into the thing the Papers view is about; an
 * untitled paper cannot be matched to anything, so each stays on its own.
 */
export interface PaperGroup {
  key: string;
  title: string;
  entries: PaperRef[];
}

export function groupByTitle(store: PaperStore): PaperGroup[] {
  const groups = new Map<string, PaperGroup>();

  for (const [venueId, list] of Object.entries(store)) {
    list.forEach((paper, index) => {
      const title = paper.title.trim();
      const key = title ? `t:${title.toLowerCase()}` : `u:${venueId}:${index}`;
      const group = groups.get(key) ?? { key, title, entries: [] };
      group.entries.push({ venueId, index, paper });
      groups.set(key, group);
    });
  }

  // Titled work first, then alphabetical — untitled drafts sink rather than lead.
  return [...groups.values()].sort((a, b) => {
    if (Boolean(a.title) !== Boolean(b.title)) return a.title ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
}
