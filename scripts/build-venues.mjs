/**
 * Repair-and-quarantine pipeline.
 *
 * Reads the raw research dump, applies only deterministic repairs, and splits the
 * result into two files:
 *
 *   data/venues.json          records that satisfy venue.schema.json AND carry a source
 *   data/venues.pending.json  everything else, each with a `_quarantine` reason
 *
 * Nothing here invents a date, an acceptance rate or a source URL. A record that
 * cannot be repaired without inventing a fact is quarantined, not guessed at.
 *
 *   node scripts/build-venues.mjs [--in confgraph_venues.json]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const argv = process.argv.slice(2);
const inPath = argv[argv.indexOf('--in') + 1] ?? 'confgraph_venues.json';
if (!existsSync(inPath)) {
  console.error(`build-venues: input not found: ${inPath}`);
  process.exit(1);
}

const raw = JSON.parse(readFileSync(inPath, 'utf8'));
const taxonomy = JSON.parse(readFileSync('data/taxonomy.json', 'utf8'));
const TOPICS = new Set(taxonomy.topics);
const BLINDING = new Set(taxonomy.blindingTypes);

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const today = new Date().toISOString().slice(0, 10);

/** Ids that break the `acronym-year` convention. Fixed once, before anything ships,
 *  because ids are permanent the moment a user saves one. */
const ID_REPAIRS = { 'aaai-26': 'aaai-2026', 'aaai-27': 'aaai-2027' };

/** Records that cannot be modelled by venue.schema.json at all. */
const OUT_OF_MODEL = {
  'tomm-fusion-2027': 'Journal special issue, not a conference or workshop — `location.format: "journal"` is outside the taxonomy and the record has no `fullName`. The venue model is one record per venue per year; special issues need their own kind before they can ship.',
  'ijcv-social-2027': 'Journal special issue, not a conference or workshop — same as tomm-fusion-2027.',
  'vismac-2026': 'Summer school, not a peer-reviewed submission venue. Its only date is a registration deadline, which the countdown would misrepresent as a submission deadline.',
};

const repairs = [];
const shipped = [];
const pending = [];

const note = (id, what) => repairs.push({ id, what });

for (const src of raw.venues) {
  const v = structuredClone(src);
  const originalId = v.id;

  // --- deterministic repairs -------------------------------------------------
  if (ID_REPAIRS[v.id]) {
    note(v.id, `id → ${ID_REPAIRS[v.id]} (acronym-year convention)`);
    v.id = ID_REPAIRS[v.id];
  }

  // taxonomy already carries "unspecified" for exactly this case
  if (v.review && !BLINDING.has(v.review.blinding)) {
    note(v.id, `review.blinding "${v.review.blinding}" → "unspecified"`);
    v.review.blinding = 'unspecified';
  }

  // "2026-09-ish" is not a date and cannot be made into one. Drop the entry
  // rather than guess a day; the remaining chain still drives the countdown.
  if (Array.isArray(v.deadlines)) {
    const kept = v.deadlines.filter((d) => ISO.test(d.date));
    if (kept.length !== v.deadlines.length) {
      const dropped = v.deadlines.filter((d) => !ISO.test(d.date));
      note(v.id, `dropped ${dropped.length} unparseable deadline(s): ${dropped.map((d) => `${d.stage}="${d.date}"`).join(', ')}`);
      v.deadlines = kept;
    }
  }

  // "TBD" / "2027-04" are not dates. null is the schema's honest value for
  // "not announced"; the UI renders it as such.
  for (const end of ['start', 'end']) {
    const val = v.event?.[end];
    if (val != null && !ISO.test(val)) {
      note(v.id, `event.${end} "${val}" → null (dates not announced)`);
      v.event[end] = null;
    }
  }
  if (v.event && (v.event.start === null) !== (v.event.end === null)) {
    v.event.start = v.event.end = null; // both ends go together
  }

  // normalise empties the schema would otherwise reject as wrong-typed
  if (v.acceptance && v.acceptance.latestPct === undefined) v.acceptance.latestPct = null;
  if (Array.isArray(v.acceptance?.history) && v.acceptance.history.length === 0) delete v.acceptance.history;
  if (v.links) for (const k of Object.keys(v.links)) if (v.links[k] === '') delete v.links[k];
  if (v.review) for (const k of Object.keys(v.review)) if (v.review[k] === '') delete v.review[k];
  if (v.registration?.fee === '') delete v.registration.fee;
  if (v.notes === '') delete v.notes;
  if (!Array.isArray(v.deadlines)) v.deadlines = [];

  // --- quarantine gates ------------------------------------------------------
  const reasons = [];

  if (OUT_OF_MODEL[originalId]) reasons.push(OUT_OF_MODEL[originalId]);

  // CLAUDE.md: "No unsourced records." This rule is not relaxed.
  if (!v.source?.urls?.length) {
    reasons.push('No source URL. DATA_GUIDE: a record without `verifiedOn` and at least one URL must not be committed. Add the CFP URL to ship it.');
  }
  if (!v.source?.verifiedOn || !ISO.test(v.source.verifiedOn)) {
    reasons.push('No usable `source.verifiedOn` date.');
  }

  // A workshop with no resolvable host cannot render its "Workshop · HOST" tag.
  if (v.kind === 'workshop' && !v.hostVenueId) {
    reasons.push('Workshop with no `hostVenueId`. The host conference is not in this dataset, so the record cannot state what it is co-located with.');
  }

  const badTopics = (v.topics ?? []).filter((t) => !TOPICS.has(t));
  if (badTopics.length) reasons.push(`Topics outside taxonomy.json#/topics: ${badTopics.join(', ')}.`);
  if (!v.topics?.length) reasons.push('No topics — the match band cannot be computed.');

  if (reasons.length) {
    pending.push({ _quarantine: reasons, ...v });
  } else {
    shipped.push(v);
  }
}

// hostVenueId / coLocatedWorkshops must resolve against what actually ships
const shippedIds = new Set(shipped.map((v) => v.id));
for (let i = shipped.length - 1; i >= 0; i--) {
  const v = shipped[i];
  if (v.kind === 'workshop' && !shippedIds.has(v.hostVenueId)) {
    shipped.splice(i, 1);
    pending.push({ _quarantine: [`hostVenueId "${v.hostVenueId}" does not resolve to a shipping venue.`], ...v });
    shippedIds.delete(v.id);
  }
}
for (const v of shipped) {
  if (Array.isArray(v.coLocatedWorkshops)) {
    for (const w of v.coLocatedWorkshops) {
      if (w.venueId && !shippedIds.has(w.venueId)) w.venueId = null; // dangling link → plain name
    }
  }
}

shipped.sort((a, b) => a.id.localeCompare(b.id));
pending.sort((a, b) => a.id.localeCompare(b.id));

writeFileSync(
  'data/venues.json',
  JSON.stringify({ $schema: './venue.schema.json', version: 1, updated: today, venues: shipped }, null, 2) + '\n'
);
writeFileSync(
  'data/venues.pending.json',
  JSON.stringify(
    {
      $comment:
        'NOT LOADED BY THE APP. Records that failed a shipping gate, each with the reason under `_quarantine`. Fix the reason, delete `_quarantine`, move the record into venues.json, then run `npm run validate`. Ids here are already in their final form, so promoting a record never renames it.',
      version: 1,
      updated: today,
      venues: pending,
    },
    null,
    2
  ) + '\n'
);

console.log(`repairs applied : ${repairs.length}`);
for (const r of repairs) console.log(`  ${r.id.padEnd(18)} ${r.what}`);
console.log(`\nshipped         : ${shipped.length}`);
console.log(`quarantined     : ${pending.length}`);
for (const v of pending) console.log(`  ${v.id.padEnd(18)} ${v._quarantine[0].slice(0, 72)}`);
