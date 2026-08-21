import type { Filters, VenueView } from './types';

export interface FilterOutcome {
  shown: VenueView[];
  /** Of the matched venues, how many published deadlines that have all passed. */
  closed: number;
  /** Of the matched venues, how many publish no itemised dates at all. */
  undated: number;
}

/**
 * Filters apply immediately — no apply button, no spinner.
 *
 * Two rules here are about absence rather than value, and both default to inclusive:
 *
 * A venue with `latestPct: null` is never excluded by the acceptance range, because the
 * range is a claim about a published figure and a venue that publishes none has not failed
 * the test. Narrowing the range used to drop them silently; `accIncludeUnknown` now makes
 * that a choice, and 33 of 42 records depend on it.
 *
 * A venue with no live deadline is shown and sorted last rather than removed. Most of the
 * index is in that state at any given moment — a closed cycle is still the answer to "when
 * does this venue open again", and a venue that publishes no dates is not evidence of
 * nothing. `showClosed` turns them off for someone who only wants somewhere to submit now.
 */
export function applyFilters(list: VenueView[], f: Filters): FilterOutcome {
  const narrowed = f.accFrom !== 0 || f.accTo !== 100;

  const passes = (v: VenueView): boolean => {
    if (f.topics.length && !f.topics.some((t) => v.topics.includes(t))) return false;
    if (f.kind !== 'all' && v.kind !== f.kind) return false;
    if (f.formats.length && !f.formats.includes(v.location.format)) return false;
    if (f.blinding && v.review.blinding !== f.blinding) return false;
    if (f.tiers.length && !f.tiers.some((t) => v.tierLabels.includes(t))) return false;

    // Every deadline bound is a claim about the *next* one, so a venue without one fails
    // them all — including when the bound is a plain date rather than a day count.
    if (f.window !== null) {
      if (v.daysLeft === null || v.daysLeft > f.window) return false;
    }
    if (f.after && (!v.nextDeadline || v.nextDeadline.effectiveDate < f.after)) return false;
    if (f.before && (!v.nextDeadline || v.nextDeadline.effectiveDate > f.before)) return false;

    if (narrowed) {
      const pct = v.acceptance.latestPct;
      if (pct === null) return f.accIncludeUnknown;
      if (pct < f.accFrom || pct > f.accTo) return false;
    }
    return true;
  };

  const matched = list.filter(passes);
  const closed = matched.filter((v) => v.cycleClosed).length;
  const undated = matched.filter((v) => v.daysLeft === null && !v.cycleClosed).length;

  return {
    shown: f.showClosed ? matched : matched.filter((v) => v.daysLeft !== null),
    closed,
    undated,
  };
}
