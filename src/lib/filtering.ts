import type { Filters, VenueView } from './types';
import { inTier } from './matching';

export interface FilterOutcome {
  shown: VenueView[];
  /** Venues that pass every filter but have no live deadline — hidden, and counted in the UI. */
  closedHidden: number;
}

/**
 * Filters apply immediately — no apply button, no spinner.
 *
 * A venue with `latestPct: null` is never excluded by the acceptance range: the range is a
 * claim about a published figure, and a venue that publishes none has not failed the test.
 * It is excluded only when the user narrows the range away from the full 0–100 span.
 */
export function applyFilters(list: VenueView[], f: Filters): FilterOutcome {
  const narrowed = f.accFrom !== 0 || f.accTo !== 100;

  const passes = (v: VenueView): boolean => {
    if (f.topics.length && !f.topics.some((t) => v.topics.includes(t))) return false;
    if (f.kind !== 'all' && v.kind !== f.kind) return false;
    if (f.formats.length && !f.formats.includes(v.location.format)) return false;
    if (f.blinding && v.review.blinding !== f.blinding) return false;
    if (f.tiers.length && !inTier(v, f.tiers)) return false;

    if (f.window !== null) {
      if (v.daysLeft === null || v.daysLeft > f.window) return false;
    }
    if (f.before && (!v.nextDeadline || v.nextDeadline.effectiveDate > f.before)) return false;

    if (narrowed) {
      const pct = v.acceptance.latestPct;
      if (pct === null) return false;
      if (pct < f.accFrom || pct > f.accTo) return false;
    }
    return true;
  };

  const matched = list.filter(passes);
  // A closed cycle is never what someone searching for somewhere to submit wants, so it is
  // hidden rather than ranked last — but the count is always shown so nothing vanishes silently.
  const shown = matched.filter((v) => v.daysLeft !== null);
  return { shown, closedHidden: matched.length - shown.length };
}
