import { describe, expect, it } from 'vitest';
import { defaultInputs, estimate, fmtMoney, nightsForEvent, tierOnDate } from '../costing';
import type { RegistrationTier, Venue } from '../types';

const venue = (over: Partial<Venue> = {}): Venue => ({
  id: 'cvpr-2026',
  name: 'CVPR 2026',
  fullName: 'Conference on Computer Vision and Pattern Recognition',
  kind: 'conference',
  location: { city: 'Denver', country: 'USA', format: 'in-person' },
  event: { start: '2026-06-14', end: '2026-06-18' },
  topics: ['computer vision'],
  rankings: {},
  acceptance: { latestPct: null, latestYear: null },
  review: { blinding: 'double-blind' },
  deadlines: [],
  source: { verifiedOn: '2026-08-21', urls: ['https://example.org'] },
  ...over,
}) as Venue;

const tier = (over: Partial<RegistrationTier>): RegistrationTier => ({
  label: 'regular',
  amount: 900,
  currency: 'USD',
  ...over,
});

describe('nights come from the event, not a guess', () => {
  it('counts a 14–18 June event as five nights', () => {
    expect(nightsForEvent(venue())).toBe(5);
  });

  it('is null when the dates are not published', () => {
    expect(nightsForEvent(venue({ event: { start: null, end: null } }))).toBeNull();
  });

  it('never returns zero for a single-day event', () => {
    expect(nightsForEvent(venue({ event: { start: '2026-06-14', end: '2026-06-14' } }))).toBe(1);
  });
});

describe('defaults', () => {
  it('fills the night count and leaves every cost at zero', () => {
    const d = defaultInputs(venue());
    expect(d.nights).toBe(5);
    expect(d.perDiemDays).toBe(5);
    expect([d.nightlyRate, d.travel, d.visa, d.perDiem, d.registrationOverride]).toEqual([0, 0, 0, 0, 0]);
  });

  it('selects the first tier when one exists, and none when the table is empty', () => {
    expect(defaultInputs(venue({ registration: { tiers: [tier({})] } })).tierIndex).toBe(0);
    expect(defaultInputs(venue({ registration: { tiers: [] } })).tierIndex).toBeNull();
  });
});

describe('tierOnDate picks the cheapest rate still open', () => {
  const tiers = [
    tier({ label: 'early-bird', amount: 650, cutoff: '2026-04-30' }),
    tier({ label: 'regular', amount: 900, cutoff: '2026-06-01' }),
    tier({ label: 'late', amount: 1100, cutoff: null }),
  ];

  it('takes early-bird before its cutoff', () => {
    expect(tierOnDate(tiers, '2026-03-01')).toBe(0);
  });

  it('falls through to regular once early-bird has passed', () => {
    expect(tierOnDate(tiers, '2026-05-15')).toBe(1);
  });

  it('lands on the uncapped rate once every cutoff has passed', () => {
    expect(tierOnDate(tiers, '2026-06-10')).toBe(2);
  });

  it('is inclusive of the cutoff day itself', () => {
    expect(tierOnDate(tiers, '2026-04-30')).toBe(0);
  });

  it('is null for an empty table', () => {
    expect(tierOnDate([], '2026-01-01')).toBeNull();
  });
});

describe('the estimate', () => {
  /** A venue with a real fee table, and every reader-supplied figure filled in. */
  const priced = venue({ registration: { tiers: [tier({ amount: 900 })] } });
  const filled = { ...defaultInputs(priced), nightlyRate: 180, travel: 700, visa: 160, perDiem: 60 };

  it('sums the lines', () => {
    const r = estimate(priced, filled);
    // 900 registration + 5×180 lodging + 700 travel + 160 visa + 5×60 per diem
    expect(r.total).toBe(2960);
    expect(r.unfilled).toBe(0);
  });

  it('counts blank lines so the total can be labelled a floor', () => {
    const r = estimate(venue(), defaultInputs(venue()));
    expect(r.total).toBe(0);
    // registration, lodging, travel, per diem — visa is deliberately never "blank"
    expect(r.unfilled).toBe(4);
  });

  it('never treats visa as unfilled, since zero is a real answer for most people', () => {
    const r = estimate(venue(), { ...filled, visa: 0 });
    expect(r.lines.find((l) => l.label === 'Visa')!.blank).toBe(false);
  });

  it('uses the hand-entered figure when the reader deselects the tier', () => {
    expect(estimate(priced, filled).lines[0]!.amount).toBe(900);
    const r = estimate(priced, { ...filled, tierIndex: null, registrationOverride: 250 });
    expect(r.lines[0]!.amount).toBe(250);
  });

  it('flags a tier published in another currency rather than converting it', () => {
    const v = venue({ registration: { tiers: [tier({ amount: 780, currency: 'EUR' })] } });
    const withTier = { ...filled, tierIndex: 0 };
    expect(estimate(v, { ...withTier, currency: 'USD' }).currencyMismatch).toBe('EUR');
    expect(estimate(v, { ...withTier, currency: 'EUR' }).currencyMismatch).toBeNull();
  });
});

describe('fmtMoney', () => {
  it('degrades instead of throwing on a code Intl does not know', () => {
    expect(fmtMoney(100, 'NOTACODE')).toBe('100 NOTACODE');
  });

  it('formats a known currency', () => {
    expect(fmtMoney(1234, 'USD')).toMatch(/1,?234/);
  });
});
