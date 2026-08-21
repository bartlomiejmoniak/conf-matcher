import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, filtersActive, parseHash, toHash, type UrlState } from '../urlState';
import type { Filters } from '../types';

const base: UrlState = {
  f: DEFAULT_FILTERS,
  sort: 'fit',
  view: 'browse',
  detailId: null,
  compare: [],
};

const roundTrip = (s: UrlState): UrlState => parseHash(toHash(s));

describe('hash round trip', () => {
  it('writes nothing when everything is at its default', () => {
    expect(toHash(base)).toBe('');
  });

  it('survives every filter at once', () => {
    const f: Filters = {
      topics: ['computer vision', 'ml theory'],
      window: 45,
      after: '2026-09-01',
      before: '2027-03-31',
      tiers: ['CORE A*', 'CCF-A'],
      formats: ['virtual', 'hybrid'],
      kind: 'workshop',
      blinding: 'double-blind',
      accFrom: 15,
      accTo: 35,
      accIncludeUnknown: false,
      showClosed: false,
    };
    const state: UrlState = { ...base, f, sort: 'deadline', view: 'compare', compare: ['a', 'b'] };
    const out = roundTrip(state);
    expect(out.f).toEqual(f);
    expect(out.sort).toBe('deadline');
    expect(out.view).toBe('compare');
    expect(out.compare).toEqual(['a', 'b']);
  });

  it('keeps the detail id only on the detail view', () => {
    expect(roundTrip({ ...base, view: 'detail', detailId: 'cvpr-2026' }).detailId).toBe('cvpr-2026');
    expect(roundTrip({ ...base, view: 'browse', detailId: 'cvpr-2026' }).detailId).toBeNull();
  });

  it('carries a window that is not one of the presets', () => {
    expect(roundTrip({ ...base, f: { ...DEFAULT_FILTERS, window: 42 } }).f.window).toBe(42);
  });
});

describe('parse rejects what it cannot trust', () => {
  it('drops a malformed date rather than filtering everything out', () => {
    expect(parseHash('#before=next%20march').f.before).toBe('');
    expect(parseHash('#after=2026-13').f.after).toBe('');
    expect(parseHash('#after=2026-09-01').f.after).toBe('2026-09-01');
  });

  it('drops a window that is not a positive day count', () => {
    for (const w of ['0', '-5', 'soon', '99999', '1.5']) {
      expect(parseHash(`#w=${w}`).f.window).toBeNull();
    }
  });

  it('falls back to defaults for an unknown sort or view', () => {
    expect(parseHash('#sort=magic&view=nowhere')).toMatchObject({ sort: 'fit', view: 'browse' });
  });

  it('clamps the acceptance range into 0–100', () => {
    expect(parseHash('#af=-20&at=400').f).toMatchObject({ accFrom: 0, accTo: 100 });
  });

  it('reads both inclusive toggles as on unless explicitly turned off', () => {
    expect(parseHash('').f).toMatchObject({ accIncludeUnknown: true, showClosed: true });
    expect(parseHash('#accunk=0&closed=0').f).toMatchObject({ accIncludeUnknown: false, showClosed: false });
  });
});

describe('filtersActive covers every field', () => {
  it('is false only for the untouched default', () => {
    expect(filtersActive(DEFAULT_FILTERS)).toBe(false);
  });

  /**
   * The Reset button is disabled on this, so a filter missing from the OR chain becomes a
   * filter the user cannot clear. Deriving the cases from the type keeps them in step.
   */
  it('is true for a deviation in any single field', () => {
    const deviations: Partial<Filters>[] = [
      { topics: ['computer vision'] },
      { window: 30 },
      { after: '2026-09-01' },
      { before: '2026-09-01' },
      { tiers: ['CORE A*'] },
      { formats: ['virtual'] },
      { kind: 'workshop' },
      { blinding: 'double-blind' },
      { accFrom: 10 },
      { accTo: 90 },
      { accIncludeUnknown: false },
      { showClosed: false },
    ];
    expect(Object.keys(DEFAULT_FILTERS).sort()).toEqual(
      [...new Set(deviations.flatMap((d) => Object.keys(d)))].sort()
    );
    for (const d of deviations) {
      expect(filtersActive({ ...DEFAULT_FILTERS, ...d }), JSON.stringify(d)).toBe(true);
    }
  });
});
