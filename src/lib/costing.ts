import type { RegistrationTier, Venue } from './types';
import { daysBetween } from './dates';

/**
 * What attending a venue costs, as far as this app can honestly say.
 *
 * The one rule that shapes everything here: **nothing is estimated on the reader's behalf.**
 * `registration.tiers` is the only figure the data can supply, and it is empty on every
 * record currently shipping. Lodging, travel, visa and per-diem are the reader's numbers —
 * a built-in nightly rate for "Vancouver" would be an invented venue fact, which CLAUDE.md
 * forbids and which would be wrong often enough to be worse than a blank field.
 *
 * The one thing that *is* derived is the night count, because the event dates are real
 * data. Everything else starts at zero and says so.
 */
export interface CostInputs {
  /** Index into the venue's `registration.tiers`, or null for a hand-entered fee. */
  tierIndex: number | null;
  /** Used when no tier is selected — either there are none, or the reader knows better. */
  registrationOverride: number;
  nights: number;
  nightlyRate: number;
  travel: number;
  visa: number;
  perDiem: number;
  perDiemDays: number;
  /** ISO 4217, the currency the reader is working in. */
  currency: string;
}

export interface CostLine {
  label: string;
  detail: string;
  amount: number;
  /** The reader has not filled this in yet. */
  blank: boolean;
}

export interface CostEstimate {
  lines: CostLine[];
  total: number;
  currency: string;
  /** Lines still at zero — the total is a floor until these are filled. */
  unfilled: number;
  /**
   * Set when the chosen tier was published in a different currency from the reader's.
   * Fees are never converted, so the total says so rather than quietly mixing units.
   */
  currencyMismatch: string | null;
}

/** Inclusive night count for the event, or null when the dates are not published. */
export function nightsForEvent(venue: Venue): number | null {
  const { start, end } = venue.event;
  if (!start || !end) return null;
  // A 4–8 Jan event is 4 days, so 4 nights: arrive the day before, leave the last day.
  return Math.max(1, daysBetween(start, end) + 1);
}

export function defaultInputs(venue: Venue, currency = 'USD'): CostInputs {
  const nights = nightsForEvent(venue) ?? 0;
  const tiers = venue.registration?.tiers ?? [];
  return {
    tierIndex: tiers.length ? 0 : null,
    registrationOverride: 0,
    nights,
    nightlyRate: 0,
    travel: 0,
    visa: 0,
    perDiem: 0,
    perDiemDays: nights,
    currency,
  };
}

/**
 * Which tier applies on a given date — the earliest one whose cutoff has not passed.
 * Tiers with no cutoff never expire, so they sort last as the fallback.
 */
export function tierOnDate(tiers: RegistrationTier[], iso: string): number | null {
  if (!tiers.length) return null;
  const live = tiers
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => !t.cutoff || t.cutoff >= iso)
    .sort((a, b) => a.t.amount - b.t.amount);
  return live[0]?.i ?? null;
}

export function estimate(venue: Venue, input: CostInputs): CostEstimate {
  const tiers = venue.registration?.tiers ?? [];
  const tier = input.tierIndex !== null ? tiers[input.tierIndex] : undefined;

  const registration = tier ? tier.amount : input.registrationOverride;
  const lodging = input.nights * input.nightlyRate;
  const perDiem = input.perDiemDays * input.perDiem;

  const lines: CostLine[] = [
    {
      label: 'Registration',
      detail: tier
        ? `${tier.label}${tier.cutoff ? ` · until ${tier.cutoff}` : ''}${tier.note ? ` · ${tier.note}` : ''}`
        : tiers.length
          ? 'hand-entered'
          : 'no published fee table — your figure',
      amount: registration,
      blank: registration === 0,
    },
    {
      label: 'Lodging',
      detail: `${input.nights} ${input.nights === 1 ? 'night' : 'nights'} × ${input.nightlyRate || '—'}`,
      amount: lodging,
      blank: input.nightlyRate === 0,
    },
    { label: 'Travel', detail: 'return fare', amount: input.travel, blank: input.travel === 0 },
    // Visa is deliberately a line at zero rather than an omitted one: for a great many
    // researchers it is the cost that decides the trip, and a missing row does not prompt.
    { label: 'Visa', detail: 'zero for most, decisive for some', amount: input.visa, blank: false },
    {
      label: 'Per diem',
      detail: `${input.perDiemDays} ${input.perDiemDays === 1 ? 'day' : 'days'} × ${input.perDiem || '—'}`,
      amount: perDiem,
      blank: input.perDiem === 0,
    },
  ];

  return {
    lines,
    total: lines.reduce((n, l) => n + l.amount, 0),
    currency: input.currency,
    unfilled: lines.filter((l) => l.blank).length,
    currencyMismatch: tier && tier.currency !== input.currency ? tier.currency : null,
  };
}

/** Grouping and symbol placement are the browser's problem, not ours. */
export function fmtMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // An unrecognised code should degrade, not throw.
    return `${Math.round(amount)} ${currency}`;
  }
}
