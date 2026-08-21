import type { DataIssue, Lexicon, Taxonomy, Venue } from './types';
import { ISO, utc } from './dates';
import { effectiveDate } from './matching';

const url = (p: string) => `${import.meta.env.BASE_URL}${p}`.replace(/([^:])\/{2,}/g, '$1/');

export interface LoadedData {
  venues: Venue[];
  taxonomy: Taxonomy;
  lexicon: Lexicon;
  issues: DataIssue[];
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(url(path), { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

/**
 * Cheap integrity checks run at load, surfaced in a banner above the results.
 * This is the last thing standing between a bad record and a user reading it as fact,
 * so it stays in the runtime path rather than living only in `npm run validate`.
 */
export function checkIntegrity(venues: Venue[], taxonomy: Taxonomy): DataIssue[] {
  const issues: DataIssue[] = [];
  const ids = new Set(venues.map((v) => v.id));
  const topics = new Set(taxonomy.topics);
  const seen = new Set<string>();

  for (const v of venues) {
    if (seen.has(v.id)) issues.push({ level: 'error', venueId: v.id, text: `${v.id}: duplicate id — one record is shadowing another.` });
    seen.add(v.id);

    for (const t of v.topics) {
      if (!topics.has(t)) issues.push({ level: 'error', venueId: v.id, text: `${v.name}: unknown topic "${t}" — not in taxonomy.json.` });
    }

    if (!v.source?.urls?.length || !v.source?.verifiedOn) {
      issues.push({ level: 'error', venueId: v.id, text: `${v.name}: no source — this record should not have shipped.` });
    }

    const chain = v.deadlines.map(effectiveDate);
    for (const [i, d] of chain.entries()) {
      if (!ISO.test(d)) issues.push({ level: 'error', venueId: v.id, text: `${v.name}: deadline "${v.deadlines[i]?.stage}" is not a date.` });
    }
    if (chain.some((d, i) => i > 0 && utc(d) < utc(chain[i - 1]!))) {
      issues.push({ level: 'warning', venueId: v.id, text: `${v.name}: deadlines are out of order — the countdown may pick the wrong stage.` });
    }

    for (const d of v.deadlines) {
      if (d.extendedTo && utc(d.extendedTo) <= utc(d.date)) {
        issues.push({ level: 'warning', venueId: v.id, text: `${v.name}: "${d.stage}" extension is not after the original date.` });
      }
    }

    if (v.kind === 'workshop' && (!v.hostVenueId || !ids.has(v.hostVenueId))) {
      issues.push({ level: 'warning', venueId: v.id, text: `${v.name}: workshop host "${v.hostVenueId ?? '—'}" does not resolve.` });
    }
    if (v.event.start && v.event.end && utc(v.event.end) < utc(v.event.start)) {
      issues.push({ level: 'warning', venueId: v.id, text: `${v.name}: event ends before it starts.` });
    }
  }
  return issues;
}

export async function loadData(): Promise<LoadedData> {
  const [venueDoc, taxonomy, lexicon] = await Promise.all([
    getJSON<{ venues: Venue[] }>('data/venues.json'),
    getJSON<Taxonomy>('data/taxonomy.json'),
    getJSON<Lexicon>('data/query-lexicon.json'),
  ]);
  const venues = venueDoc.venues ?? [];
  return { venues, taxonomy, lexicon, issues: checkIntegrity(venues, taxonomy) };
}
