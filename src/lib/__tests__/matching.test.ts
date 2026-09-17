import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { expandTopics, freshnessOf, matchBand, sortVenues, toView } from '../matching';
import type { PaperProfile, Taxonomy, Venue } from '../types';

const taxonomy: Taxonomy = JSON.parse(readFileSync('data/taxonomy.json', 'utf8'));

const venue = (over: Partial<Venue>): Venue => ({
  id: 'x-2027',
  name: 'X 2027',
  fullName: 'Example',
  kind: 'conference',
  hostVenueId: null,
  location: { city: 'Lyon', country: 'France', format: 'in-person' },
  event: { start: '2027-06-01', end: '2027-06-05' },
  topics: ['computer vision'],
  rankings: { core: 'A' },
  acceptance: { latestPct: 25, latestYear: 2025 },
  review: { blinding: 'double-blind' },
  deadlines: [{ stage: 'Paper', date: '2027-01-10' }],
  integrityFlag: null,
  source: { verifiedOn: '2026-08-01', urls: ['https://example.org'] },
  ...over,
});

const paper = (over: Partial<PaperProfile> = {}): PaperProfile => ({ topics: [], tiers: [], readyBy: '', ...over });

describe('match bands', () => {
  it('2+ overlaps is strong, 1 is partial, 0 is weak', () => {
    const v = venue({ topics: ['computer vision', 'multimodal', 'robotics'] });
    expect(matchBand(v, expandTopics(['computer vision', 'multimodal'], taxonomy)).band).toBe('strong');
    expect(matchBand(v, expandTopics(['computer vision'], taxonomy)).band).toBe('partial');
    expect(matchBand(v, expandTopics(['ml theory'], taxonomy)).band).toBe('weak');
  });

  it('reaches a broad venue through a narrow paper topic — fairness → trustworthy AI', () => {
    const v = venue({ topics: ['trustworthy AI', 'ml theory'] });
    const { band, overlap } = matchBand(v, expandTopics(['fairness'], taxonomy));
    expect(band).toBe('partial');
    expect(overlap).toEqual(['trustworthy AI']);
  });

  it('floors a broadScope venue at partial rather than weak', () => {
    const v = venue({ topics: ['ml theory'], broadScope: true });
    expect(matchBand(v, expandTopics(['robotics'], taxonomy)).band).toBe('partial');
    expect(matchBand(venue({ topics: ['ml theory'] }), expandTopics(['robotics'], taxonomy)).band).toBe('weak');
  });

  it('reads partial across the board when no paper topics are set', () => {
    expect(matchBand(venue({}), expandTopics([], taxonomy)).band).toBe('partial');
  });
});

describe('countdown', () => {
  const today = '2026-08-21';

  it('picks the first deadline still in the future', () => {
    const v = toView(venue({ deadlines: [
      { stage: 'Abstract', date: '2026-05-01' },
      { stage: 'Paper', date: '2026-09-25' },
      { stage: 'Notification', date: '2026-12-16' },
    ] }), taxonomy, paper(), null, today);
    expect(v.nextDeadline?.stage).toBe('Paper');
    expect(v.daysLeft).toBe(35);
    expect(v.cycleClosed).toBe(false);
  });

  it('reads a fully-passed chain as a closed cycle', () => {
    const v = toView(venue({ deadlines: [{ stage: 'Paper', date: '2026-01-10' }] }), taxonomy, paper(), null, today);
    expect(v.cycleClosed).toBe(true);
    expect(v.daysLeft).toBeNull();
  });

  it('distinguishes "no dates published" from a closed cycle', () => {
    const v = toView(venue({ deadlines: [] }), taxonomy, paper(), null, today);
    expect(v.cycleClosed).toBe(false);
    expect(v.daysLeft).toBeNull();
  });

  it('schedules on the extension but keeps the original date intact', () => {
    const v = toView(venue({ deadlines: [{ stage: 'Paper', date: '2026-08-01', extendedTo: '2026-09-01' }] }), taxonomy, paper(), null, today);
    expect(v.nextDeadline?.effectiveDate).toBe('2026-09-01');
    expect(v.nextDeadline?.date).toBe('2026-08-01');
  });

  it('flags a deadline that falls before the paper is ready', () => {
    const v = toView(venue({ deadlines: [{ stage: 'Paper', date: '2026-09-25' }] }), taxonomy, paper({ readyBy: '2026-11-01' }), null, today);
    expect(v.tooEarly).toBe(true);
  });
});

describe('sorting', () => {
  const today = '2026-08-21';
  const mk = (over: Partial<Venue>, p = paper()) => toView(venue(over), taxonomy, p, null, today);

  it('fit orders by band, then overlap count, then target tier', () => {
    const p = paper({ topics: ['computer vision', 'multimodal'], tiers: ['CORE A*'] });
    const weak = mk({ id: 'weak-2027', topics: ['robotics'] }, p);
    const partial = mk({ id: 'partial-2027', topics: ['computer vision'] }, p);
    const strong = mk({ id: 'strong-2027', topics: ['computer vision', 'multimodal'] }, p);
    expect(sortVenues([weak, partial, strong], 'fit').map((v) => v.id)).toEqual(['strong-2027', 'partial-2027', 'weak-2027']);
  });

  it('sinks venues with no published acceptance rate rather than treating them as 0%', () => {
    const withPct = mk({ id: 'a-2027', acceptance: { latestPct: 40, latestYear: 2025 } });
    const without = mk({ id: 'b-2027', acceptance: { latestPct: null, latestYear: null } });
    expect(sortVenues([without, withPct], 'acceptance').map((v) => v.id)).toEqual(['a-2027', 'b-2027']);
  });

  it('sinks venues with no live deadline on a deadline sort', () => {
    const live = mk({ id: 'a-2027', deadlines: [{ stage: 'Paper', date: '2026-09-25' }] });
    const closed = mk({ id: 'b-2027', deadlines: [{ stage: 'Paper', date: '2026-01-01' }] });
    expect(sortVenues([closed, live], 'deadline').map((v) => v.id)).toEqual(['a-2027', 'b-2027']);
  });
});

describe('freshness', () => {
  // The thresholds are data, so the tests read them rather than restating them — a change
  // in taxonomy.json should move these boundaries, not break these tests.
  const { staleDays, veryStaleDays } = taxonomy.freshness;
  const daysBefore = (n: number) => new Date(Date.UTC(2026, 8, 17) - n * 86_400_000).toISOString().slice(0, 10);
  const TODAY = '2026-09-17';

  it('counts the days since verifiedOn', () => {
    const v = venue({ source: { verifiedOn: daysBefore(27), urls: ['https://example.org'] } });
    expect(freshnessOf(v, taxonomy, TODAY).days).toBe(27);
  });

  it('is fresh right up to the threshold and stale on it', () => {
    const at = (n: number) => freshnessOf(venue({ source: { verifiedOn: daysBefore(n), urls: ['https://x.org'] } }), taxonomy, TODAY).level;
    expect(at(staleDays - 1)).toBe('fresh');
    expect(at(staleDays)).toBe('stale');
    expect(at(veryStaleDays - 1)).toBe('stale');
    expect(at(veryStaleDays)).toBe('very-stale');
  });

  it('reads a record verified today as fresh, at zero days', () => {
    const v = venue({ source: { verifiedOn: TODAY, urls: ['https://example.org'] } });
    expect(freshnessOf(v, taxonomy, TODAY)).toEqual({ days: 0, level: 'fresh' });
  });

  it('claims nothing when verifiedOn is missing or malformed', () => {
    const missing = venue({ source: { verifiedOn: '', urls: [] } });
    expect(freshnessOf(missing, taxonomy, TODAY)).toEqual({ days: null, level: 'fresh' });
    const junk = venue({ source: { verifiedOn: 'last spring', urls: [] } });
    expect(freshnessOf(junk, taxonomy, TODAY)).toEqual({ days: null, level: 'fresh' });
  });

  it('is independent of whether the cycle is open — the two states do not track each other', () => {
    // Verified this morning, but every deadline is long gone.
    const v = toView(
      venue({ deadlines: [{ stage: 'Paper', date: '2026-01-01' }], source: { verifiedOn: TODAY, urls: ['https://x.org'] } }),
      taxonomy,
      paper(),
      null,
      TODAY
    );
    expect(v.cycleClosed).toBe(true);
    expect(v.freshness).toBe('fresh');

    // Wide open, but nobody has looked at it in a year.
    const w = toView(
      venue({ deadlines: [{ stage: 'Paper', date: '2027-06-01' }], source: { verifiedOn: daysBefore(365), urls: ['https://x.org'] } }),
      taxonomy,
      paper(),
      null,
      TODAY
    );
    expect(w.cycleClosed).toBe(false);
    expect(w.freshness).toBe('very-stale');
  });

  it('carries the age onto the view model', () => {
    const v = toView(venue({ source: { verifiedOn: daysBefore(90), urls: ['https://x.org'] } }), taxonomy, paper(), null, TODAY);
    expect(v.verifiedDaysAgo).toBe(90);
  });
});
