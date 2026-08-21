import type { Deadline, MatchBand, PaperProfile, SortKey, Taxonomy, Venue, VenueView } from './types';
import { daysBetween, todayISO, utc } from './dates';

/** An extension replaces the original for scheduling purposes; the original is still shown, struck through. */
export const effectiveDate = (d: Deadline): string => d.extendedTo ?? d.date;

/**
 * Expand a paper's topics through taxonomy narrowTopics, so a paper tagged `fairness`
 * reaches a venue tagged `trustworthy AI`.
 */
export function expandTopics(topics: string[], taxonomy: Taxonomy): Set<string> {
  const out = new Set<string>();
  for (const t of topics) {
    out.add(t);
    const broad = taxonomy.narrowTopics[t];
    if (broad) out.add(broad);
  }
  return out;
}

/**
 * 2+ overlaps = strong, 1 = partial, 0 = weak — except a broadScope venue floors at partial.
 * With no paper topics set there is nothing to match against, so everything reads partial.
 */
export function matchBand(venue: Venue, expanded: Set<string>): { band: MatchBand; overlap: string[] } {
  if (expanded.size === 0) return { band: 'partial', overlap: [] };
  const overlap = venue.topics.filter((t) => expanded.has(t));
  let band: MatchBand = overlap.length >= 2 ? 'strong' : overlap.length === 1 ? 'partial' : 'weak';
  if (band === 'weak' && venue.broadScope) band = 'partial';
  return { band, overlap };
}

const CORE_ORDER = ['A*', 'A', 'B', 'C'];
const coreRank = (v: Venue): number => {
  const i = CORE_ORDER.indexOf(v.rankings.core ?? '');
  return i === -1 ? CORE_ORDER.length : i;
};

/**
 * Every tier label the venue satisfies. The rules live in taxonomy.json rather than here,
 * so adding a ranking tier is a data edit. Resolved once per venue in `toView`, which is
 * why the filter downstream only ever reads `VenueView.tierLabels`.
 */
export function venueTiers(venue: Venue, taxonomy: Taxonomy): string[] {
  return taxonomy.tiers.entries
    .filter((t) => (venue.rankings as Record<string, string | undefined>)[t.source] === t.value)
    .map((t) => t.label);
}

/** Build the derived view model for one venue against the user's paper profile. */
export function toView(
  venue: Venue,
  taxonomy: Taxonomy,
  paper: PaperProfile,
  hostName: string | null,
  today = todayISO()
): VenueView {
  const chain = [...venue.deadlines].sort((a, b) => utc(effectiveDate(a)) - utc(effectiveDate(b)));
  const upcoming = chain.find((d) => utc(effectiveDate(d)) >= utc(today)) ?? null;

  const nextDeadline = upcoming ? { ...upcoming, effectiveDate: effectiveDate(upcoming) } : null;
  const daysLeft = nextDeadline ? daysBetween(today, nextDeadline.effectiveDate) : null;

  const { band, overlap } = matchBand(venue, expandTopics(paper.topics, taxonomy));
  const tierLabels = venueTiers(venue, taxonomy);

  return {
    ...venue,
    nextDeadline,
    daysLeft,
    cycleClosed: chain.length > 0 && nextDeadline === null,
    hostName,
    tierLabels,
    band,
    overlap,
    tooEarly: Boolean(paper.readyBy && nextDeadline && nextDeadline.effectiveDate < paper.readyBy),
    inTargetTier: paper.tiers.some((t) => tierLabels.includes(t)),
  };
}

const BAND_ORDER: Record<MatchBand, number> = { strong: 0, partial: 1, weak: 2 };

/**
 * Fit: band, then overlap count, then whether the venue sits in the user's target tier,
 * then CORE tier, then deadline proximity.
 *
 * A venue with no live deadline sinks below every venue that has one, in *every* sort —
 * the filter now shows closed cycles rather than removing them, so this is what keeps a
 * closed venue from outranking a live one on tier or acceptance alone.
 */
export function sortVenues(list: VenueView[], sort: SortKey): VenueView[] {
  const liveFirst = (a: VenueView, b: VenueView) =>
    Number(a.daysLeft === null) - Number(b.daysLeft === null);

  const byDeadline = (a: VenueView, b: VenueView) => {
    if (a.daysLeft === null || b.daysLeft === null) return a.name.localeCompare(b.name);
    return a.daysLeft - b.daysLeft;
  };

  const cmp: Record<SortKey, (a: VenueView, b: VenueView) => number> = {
    fit: (a, b) =>
      BAND_ORDER[a.band] - BAND_ORDER[b.band] ||
      b.overlap.length - a.overlap.length ||
      Number(b.inTargetTier) - Number(a.inTargetTier) ||
      coreRank(a) - coreRank(b) ||
      byDeadline(a, b),
    deadline: byDeadline,
    ranking: (a, b) => coreRank(a) - coreRank(b) || byDeadline(a, b),
    // Venues with no published figure sort last rather than as 0%.
    acceptance: (a, b) => {
      const x = a.acceptance.latestPct;
      const y = b.acceptance.latestPct;
      if (x === null && y === null) return byDeadline(a, b);
      if (x === null) return 1;
      if (y === null) return -1;
      return x - y || byDeadline(a, b);
    },
  };

  return [...list].sort((a, b) => liveFirst(a, b) || cmp[sort](a, b));
}
