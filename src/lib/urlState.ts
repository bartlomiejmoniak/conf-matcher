import type { Filters, LocationFormat, SortKey, View, Blinding, Kind } from './types';

/**
 * Filters, sort and the current view live in the URL hash, so any filtered result set is
 * shareable and survives a reload:  #t=computer+vision&w=60&tier=CORE%20A*&sort=deadline&view=compare
 */
export const DEFAULT_FILTERS: Filters = {
  topics: [],
  window: null,
  before: '',
  tiers: [],
  formats: [],
  kind: 'all',
  blinding: null,
  accFrom: 0,
  accTo: 100,
};

export interface UrlState {
  f: Filters;
  sort: SortKey;
  view: View;
  detailId: string | null;
  compare: string[];
}

const SORTS: SortKey[] = ['fit', 'deadline', 'ranking', 'acceptance'];
const VIEWS: View[] = ['browse', 'detail', 'compare', 'watchlist'];

const list = (s: string | null): string[] => (s ? s.split('|').filter(Boolean) : []);

export function parseHash(hash: string): UrlState {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const num = (k: string, fallback: number) => {
    const raw = p.get(k);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : fallback;
  };
  const view = VIEWS.find((v) => v === p.get('view')) ?? 'browse';
  const sort = SORTS.find((s) => s === p.get('sort')) ?? 'fit';
  const w = p.get('w');

  return {
    f: {
      topics: list(p.get('t')),
      window: w && Number.isInteger(Number(w)) && Number(w) > 0 && Number(w) <= 3650 ? Number(w) : null,
      before: p.get('before') ?? '',
      tiers: list(p.get('tier')),
      formats: list(p.get('fmt')) as LocationFormat[],
      kind: (['conference', 'workshop'].includes(p.get('kind') ?? '') ? p.get('kind') : 'all') as 'all' | Kind,
      blinding: (p.get('blind') as Blinding) || null,
      accFrom: Math.max(0, Math.min(100, num('af', 0))),
      accTo: Math.max(0, Math.min(100, num('at', 100))),
    },
    sort,
    view,
    detailId: p.get('id'),
    compare: list(p.get('cmp')),
  };
}

export function toHash(s: UrlState): string {
  const p = new URLSearchParams();
  const set = (k: string, v: string | number | null | undefined) => {
    if (v !== null && v !== undefined && v !== '') p.set(k, String(v));
  };
  if (s.f.topics.length) set('t', s.f.topics.join('|'));
  set('w', s.f.window);
  set('before', s.f.before);
  if (s.f.tiers.length) set('tier', s.f.tiers.join('|'));
  if (s.f.formats.length) set('fmt', s.f.formats.join('|'));
  if (s.f.kind !== 'all') set('kind', s.f.kind);
  set('blind', s.f.blinding);
  if (s.f.accFrom !== 0) set('af', s.f.accFrom);
  if (s.f.accTo !== 100) set('at', s.f.accTo);
  if (s.sort !== 'fit') set('sort', s.sort);
  if (s.view !== 'browse') set('view', s.view);
  if (s.view === 'detail') set('id', s.detailId);
  if (s.compare.length) set('cmp', s.compare.join('|'));
  const q = p.toString();
  return q ? `#${q}` : '';
}

export const filtersActive = (f: Filters): boolean =>
  f.topics.length > 0 ||
  f.window !== null ||
  f.before !== '' ||
  f.tiers.length > 0 ||
  f.formats.length > 0 ||
  f.kind !== 'all' ||
  f.blinding !== null ||
  f.accFrom !== 0 ||
  f.accTo !== 100;
