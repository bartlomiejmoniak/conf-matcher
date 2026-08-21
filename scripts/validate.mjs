/**
 * The checks DATA_GUIDE.md lists under "Before committing", plus a schema pass.
 * Exits non-zero on any error, so it works as a pre-commit / CI gate.
 *
 *   node scripts/validate.mjs
 */
import { readFileSync } from 'node:fs';
import Ajv from 'ajv';

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const schema = read('data/venue.schema.json');
const doc = read('data/venues.json');
const taxonomy = read('data/taxonomy.json');
const lexicon = read('data/query-lexicon.json');

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// ── schema ──────────────────────────────────────────────────────────────────
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
if (!validate(doc)) {
  for (const e of validate.errors) err(`schema ${e.instancePath || '/'} ${e.message}`);
}

const venues = doc.venues ?? [];
const ids = new Set();
const TOPICS = new Set(taxonomy.topics);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ID_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// ── per-record ──────────────────────────────────────────────────────────────
for (const v of venues) {
  const at = (m) => err(`${v.id}: ${m}`);

  if (ids.has(v.id)) at('duplicate id');
  ids.add(v.id);
  if (!ID_FORMAT.test(v.id)) at(`id "${v.id}" is not lowercase-hyphenated`);
  if (!/-(19|20)\d{2}$/.test(v.id)) warn(`${v.id}: id does not end in a year (acronym-year convention)`);

  for (const t of v.topics ?? []) if (!TOPICS.has(t)) at(`topic "${t}" is not in taxonomy.json#/topics`);
  if ((v.topics?.length ?? 0) > 6) warn(`${v.id}: ${v.topics.length} topics — DATA_GUIDE caps this at six; over-tagging destroys the match signal`);

  // deadlines ascending, on the ORIGINAL date (never the extension)
  const dates = (v.deadlines ?? []).map((d) => d.date);
  for (const [i, d] of dates.entries()) {
    if (!ISO.test(d)) at(`deadlines[${i}].date "${d}" is not YYYY-MM-DD`);
  }
  if (dates.some((d, i) => i > 0 && d < dates[i - 1])) at('deadlines are not in ascending date order');
  for (const d of v.deadlines ?? []) {
    if (d.extendedTo && d.extendedTo <= d.date) at(`"${d.stage}" extendedTo ${d.extendedTo} is not after the original ${d.date}`);
    if (d.extendedTo && !d.extensionNote) warn(`${v.id}: "${d.stage}" is extended with no extensionNote`);
  }

  if (v.event?.start && v.event?.end && v.event.end < v.event.start) at('event.end precedes event.start');
  if ((v.event?.start == null) !== (v.event?.end == null)) at('event.start and event.end must be null together');

  // provenance
  if (!v.source?.urls?.length) at('no source URL — must not ship');
  if (!v.source?.verifiedOn) at('no source.verifiedOn — must not ship');

  // rankings: "—" not "N/A" / "" / null
  for (const [k, val] of Object.entries(v.rankings ?? {})) {
    if (val === '' || val === null || val === 'N/A' || val === 'n/a') at(`rankings.${k} is "${val}" — use "—" for genuinely unranked`);
  }

  if (v.kind === 'workshop' && !v.hostVenueId) at('workshop has no hostVenueId');
  if (v.kind === 'conference' && v.hostVenueId) at('conference has a hostVenueId');

  if (v.integrityFlag) {
    if (!taxonomy.integrityLevels.includes(v.integrityFlag.level)) at(`integrityFlag.level "${v.integrityFlag.level}" is not in taxonomy.json#/integrityLevels`);
    if (!v.integrityFlag.sources?.length) at('integrityFlag has no sources — a public accusation must be citable');
  }
}

// ── cross-record references ─────────────────────────────────────────────────
for (const v of venues) {
  if (v.hostVenueId && !ids.has(v.hostVenueId)) err(`${v.id}: hostVenueId "${v.hostVenueId}" does not resolve`);
  for (const w of v.coLocatedWorkshops ?? []) {
    if (w.venueId && !ids.has(w.venueId)) err(`${v.id}: coLocatedWorkshops venueId "${w.venueId}" does not resolve`);
  }
}

// ── file-level ──────────────────────────────────────────────────────────────
if (!ISO.test(doc.updated ?? '')) err('top-level `updated` is not a YYYY-MM-DD date');
else if (doc.updated > new Date().toISOString().slice(0, 10)) err('top-level `updated` is in the future');

// ── lexicon stays in step with the taxonomy ─────────────────────────────────
for (const t of Object.keys(lexicon.topics ?? {})) {
  if (!TOPICS.has(t)) err(`query-lexicon.json maps triggers onto "${t}", which is not a taxonomy topic`);
}
for (const [narrow, broad] of Object.entries(taxonomy.narrowTopics ?? {})) {
  if (narrow.startsWith('$')) continue;
  if (!TOPICS.has(broad)) err(`taxonomy narrowTopics."${narrow}" rolls up into "${broad}", which is not a topic`);
}

// ── taxonomy is internally consistent ───────────────────────────────────────
// The tier rules and the window presets moved out of the code and into this file, so
// they are now data that can be wrong. A tier naming a ranking source that does not
// exist would silently match nothing.
for (const t of taxonomy.tiers?.entries ?? []) {
  if (!taxonomy.rankingSources?.[t.source]) {
    err(`taxonomy tier "${t.label}" reads rankings.${t.source}, which is not in rankingSources`);
  }
  if (typeof t.value !== 'string' || !t.value) err(`taxonomy tier "${t.label}" has no value to match`);
  if (typeof t.inProfile !== 'boolean') err(`taxonomy tier "${t.label}" needs an explicit inProfile boolean`);
}
if (!taxonomy.tiers?.entries?.some((t) => t.inProfile)) {
  err('no taxonomy tier is marked inProfile, so the paper profile would offer no target tier');
}
for (const d of taxonomy.deadlineWindows?.days ?? []) {
  if (!Number.isInteger(d) || d <= 0) err(`taxonomy deadlineWindows.days contains "${d}", which is not a positive day count`);
}

// A topic nothing uses renders no chip, which is fine — but it is worth saying out loud,
// because it usually means either a missing record or a vocabulary that has drifted.
const usedTopics = new Set(venues.flatMap((v) => v.topics ?? []));
for (const t of taxonomy.topics) {
  if (!usedTopics.has(t)) warn(`taxonomy topic "${t}" is used by no venue, so it renders no filter chip`);
}

// ── report ──────────────────────────────────────────────────────────────────
for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`ERROR ${e}`);
console.log(`\n${venues.length} venues · ${errors.length} error(s) · ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
