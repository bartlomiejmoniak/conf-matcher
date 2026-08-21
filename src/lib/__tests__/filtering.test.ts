import { describe, expect, it } from 'vitest';
import { applyFilters } from '../filtering';
import { DEFAULT_FILTERS } from '../urlState';
import type { Filters, VenueView } from '../types';

/**
 * A venue view stripped to what the filter actually reads. Everything else is spread in
 * from the caller, so each test states only the fields it is about.
 */
function view(over: Partial<VenueView> & { id: string }): VenueView {
  return {
    name: over.id,
    fullName: over.id,
    kind: 'conference',
    location: { city: 'Berlin', country: 'Germany', format: 'in-person' },
    event: { start: null, end: null },
    topics: ['computer vision'],
    rankings: {},
    acceptance: { latestPct: null, latestYear: null },
    review: { blinding: 'double-blind' },
    deadlines: [],
    source: { verifiedOn: '2026-08-21', urls: ['https://example.org'] },
    nextDeadline: null,
    daysLeft: null,
    cycleClosed: false,
    hostName: null,
    tierLabels: [],
    band: 'weak',
    overlap: [],
    tooEarly: false,
    inTargetTier: false,
    ...over,
  } as VenueView;
}

/** A venue with a live deadline `days` out. */
const live = (id: string, days: number, over: Partial<VenueView> = {}): VenueView =>
  view({
    id,
    daysLeft: days,
    nextDeadline: { stage: 'Paper', date: '2026-12-01', effectiveDate: '2026-12-01' },
    ...over,
  });

const f = (over: Partial<Filters> = {}): Filters => ({ ...DEFAULT_FILTERS, ...over });
const ids = (list: VenueView[]) => list.map((v) => v.id);

describe('acceptance range and unpublished figures', () => {
  const list = [
    live('has-rate', 10, { acceptance: { latestPct: 25, latestYear: 2025 } }),
    live('no-rate', 10, { acceptance: { latestPct: null, latestYear: null } }),
    live('out-of-range', 10, { acceptance: { latestPct: 80, latestYear: 2025 } }),
  ];

  it('keeps unpublished figures while the range is untouched', () => {
    expect(ids(applyFilters(list, f()).shown)).toContain('no-rate');
  });

  it('keeps them when the range is narrowed and the toggle is on', () => {
    const { shown } = applyFilters(list, f({ accFrom: 10, accTo: 40 }));
    expect(ids(shown).sort()).toEqual(['has-rate', 'no-rate']);
  });

  it('drops them when the toggle is off', () => {
    const { shown } = applyFilters(list, f({ accFrom: 10, accTo: 40, accIncludeUnknown: false }));
    expect(ids(shown)).toEqual(['has-rate']);
  });

  it('never lets the toggle rescue a venue whose figure is out of range', () => {
    const { shown } = applyFilters(list, f({ accFrom: 10, accTo: 40 }));
    expect(ids(shown)).not.toContain('out-of-range');
  });
});

describe('venues with no live deadline', () => {
  const list = [
    live('open', 30),
    view({ id: 'closed', cycleClosed: true, deadlines: [{ stage: 'Paper', date: '2025-01-01' }] }),
    view({ id: 'undated' }),
  ];

  it('shows them by default, and counts the two states apart', () => {
    const { shown, closed, undated } = applyFilters(list, f());
    expect(ids(shown).sort()).toEqual(['closed', 'open', 'undated']);
    expect([closed, undated]).toEqual([1, 1]);
  });

  it('hides them when showClosed is off, while still counting them', () => {
    const { shown, closed, undated } = applyFilters(list, f({ showClosed: false }));
    expect(ids(shown)).toEqual(['open']);
    expect([closed, undated]).toEqual([1, 1]);
  });

  it('excludes them from every deadline bound, since each is a claim about a next deadline', () => {
    expect(ids(applyFilters(list, f({ window: 90 })).shown)).toEqual(['open']);
    expect(ids(applyFilters(list, f({ after: '2020-01-01' })).shown)).toEqual(['open']);
    expect(ids(applyFilters(list, f({ before: '2030-01-01' })).shown)).toEqual(['open']);
  });
});

describe('absolute deadline bounds', () => {
  const list = [
    live('jan', 10, { nextDeadline: { stage: 'Paper', date: '2027-01-15', effectiveDate: '2027-01-15' } }),
    live('jun', 20, { nextDeadline: { stage: 'Paper', date: '2027-06-15', effectiveDate: '2027-06-15' } }),
  ];

  it('is inclusive at both ends', () => {
    expect(ids(applyFilters(list, f({ after: '2027-01-15', before: '2027-01-15' })).shown)).toEqual(['jan']);
  });

  it('bounds independently', () => {
    expect(ids(applyFilters(list, f({ after: '2027-02-01' })).shown)).toEqual(['jun']);
    expect(ids(applyFilters(list, f({ before: '2027-02-01' })).shown)).toEqual(['jan']);
  });

  it('reads the extended date, not the original', () => {
    const extended = live('ext', 5, {
      nextDeadline: { stage: 'Paper', date: '2027-01-01', extendedTo: '2027-03-01', effectiveDate: '2027-03-01' },
    });
    expect(ids(applyFilters([extended], f({ after: '2027-02-01' })).shown)).toEqual(['ext']);
  });
});

describe('every filter is an AND', () => {
  it('narrows across groups', () => {
    const list = [
      live('cv-core', 10, { topics: ['computer vision'], tierLabels: ['CORE A*'] }),
      live('cv-other', 10, { topics: ['computer vision'], tierLabels: [] }),
      live('nlp-core', 10, { topics: ['natural language'], tierLabels: ['CORE A*'] }),
    ];
    const { shown } = applyFilters(list, f({ topics: ['computer vision'], tiers: ['CORE A*'] }));
    expect(ids(shown)).toEqual(['cv-core']);
  });
});
