import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { expandTopics, matchBand, sortVenues, toView } from '../matching';
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
