/** Mirrors data/venue.schema.json. Amendments are marked; see docs/SCHEMA_CHANGES.md. */

export type Kind = 'conference' | 'workshop';
export type LocationFormat = 'in-person' | 'hybrid' | 'virtual';
export type Blinding = 'double-blind' | 'single-blind' | 'open review' | 'unspecified';
export type Confidence = 'confirmed' | 'provisional' | 'projected';

export interface Deadline {
  stage: string;
  date: string;
  /** Set only when officially extended. `date` keeps the ORIGINAL and is never overwritten. */
  extendedTo?: string | null;
  extensionNote?: string | null;
  timezone?: string;
}

export interface Venue {
  id: string;
  name: string;
  fullName: string;
  kind: Kind;
  hostVenueId?: string | null;
  broadScope?: boolean;
  location: { city: string; country: string; format: LocationFormat };
  /** null on both ends when the venue has not announced its dates (schema amendment). */
  event: { start: string | null; end: string | null };
  registration?: { fee?: string };
  topics: string[];
  rankings: { core?: string; ccf?: string; h5Index?: string; mnisw?: string };
  /** `latestPct` is null when the venue publishes no figure (schema amendment). */
  acceptance: { latestPct: number | null; history?: { year: number; pct: number }[] };
  review: {
    blinding: Blinding;
    blindingNote?: string;
    rebuttal?: string;
    pageLimit?: string;
    openAccess?: string;
    publisher?: string;
  };
  /** May be empty when the venue publishes no itemised dates (schema amendment). */
  deadlines: Deadline[];
  coLocatedWorkshops?: { name: string; deadline: string; venueId?: string | null }[];
  integrityFlag: null | { level: string; note: string; reviewed: string; sources?: string[] };
  links?: { cfp?: string; website?: string };
  notes?: string;
  source: { verifiedOn: string; urls: string[]; confidence?: Confidence };
}

/** A ranking tier as a rule: `rankings[source] === value` puts a venue in it. */
export interface TierDef {
  label: string;
  source: string;
  value: string;
  /** Offered as a paper's target tier. A shorter list than the filter row. */
  inProfile: boolean;
}

export interface Taxonomy {
  topics: string[];
  narrowTopics: Record<string, string>;
  formats: LocationFormat[];
  kinds: Kind[];
  tiers: { entries: TierDef[] };
  deadlineWindows: { days: number[] };
  blindingTypes: Blinding[];
  rankingSources: Record<string, { label: string; assessedLabel: string; displayed: boolean }>;
  integrityLevels: string[];
  paperStages: string[];
  paperOutcomes: string[];
}

export interface Lexicon {
  topics: Record<string, string[]>;
  blinding: Record<string, string[]>;
  tiers: Record<string, string[]>;
  formats: Record<string, string[]>;
  kinds: Record<string, string[]>;
  acceptanceBands: { triggers: string[]; from: number; to: number }[];
}

// ── view model ──────────────────────────────────────────────────────────────

export type MatchBand = 'strong' | 'partial' | 'weak';

export interface VenueView extends Venue {
  /** First deadline still in the future, or null when the cycle has closed / none published. */
  nextDeadline: (Deadline & { effectiveDate: string }) | null;
  daysLeft: number | null;
  /** true when the venue published deadlines and every one of them has passed. */
  cycleClosed: boolean;
  hostName: string | null;
  /** Every tier label this venue satisfies, resolved once against the taxonomy. */
  tierLabels: string[];
  band: MatchBand;
  overlap: string[];
  /** Deadline falls before the user can have the paper ready. */
  tooEarly: boolean;
  inTargetTier: boolean;
}

export interface DataIssue {
  level: 'error' | 'warning';
  venueId?: string;
  text: string;
}

export interface PaperProfile {
  topics: string[];
  tiers: string[];
  readyBy: string;
}

export interface TrackedPaper {
  title: string;
  stage: string;
  outcome: string;
  note: string;
}

export interface Filters {
  topics: string[];
  /** "within N days of today". Any positive day count; the taxonomy only offers shortcuts. */
  window: number | null;
  /** Absolute bounds on the next deadline, inclusive. Empty string means unbounded. */
  after: string;
  before: string;
  tiers: string[];
  formats: LocationFormat[];
  kind: 'all' | Kind;
  blinding: Blinding | null;
  accFrom: number;
  accTo: number;
  /** Keep venues that publish no acceptance figure when the range is narrowed. */
  accIncludeUnknown: boolean;
  /** Show venues whose cycle has closed, or that publish no dates at all. */
  showClosed: boolean;
}

export type SortKey = 'fit' | 'deadline' | 'ranking' | 'acceptance';
export type View = 'browse' | 'detail' | 'compare' | 'watchlist';
