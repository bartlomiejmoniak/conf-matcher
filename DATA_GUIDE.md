# Data guide

Everything the interface shows comes from three files in `data/`. No venue facts live in the component.

| File | What it holds | How often it changes |
| --- | --- | --- |
| `data/venues.json` | Every conference and workshop record. **Currently empty — this is the file to fill.** | Continuously |
| `data/taxonomy.json` | Controlled vocabularies: topics, formats, ranking sources, paper stages | Rarely |
| `data/query-lexicon.json` | Trigger words the plain-language search bar maps onto filters | When phrasings are missed |
| `data/venue.schema.json` | JSON Schema for `venues.json` — validate against it before committing | Only with a schema change |
| `data/venues.example.json` | Two fully filled records, not loaded by the app | Reference only |

## Filling `venues.json`

Add objects to the `venues` array. `data/venue.schema.json` carries the authoritative field list with a description on every field; read it alongside this guide. Order in the array is irrelevant — the app sorts.

### Rules that matter more than the schema

**One record per venue per year.** `ICLR 2027` and `ICLR 2028` are two records with two ids. Do not model a venue as recurring; deadlines differ every cycle and users search for a specific one.

**`id` is permanent.** Format `acronym-year`, lowercase, hyphenated. A user's watchlist and their tracked paper progress are keyed on it in browser storage. Renaming an id silently orphans their work. If a venue is renamed, keep the id and change `name`.

**Deadlines are the product.** Everything else is context. Enter the *whole* chain, in order, even stages a submitter doesn't act on — the compare timeline draws every one of them. The countdown is derived: the app takes the first deadline still in the future, so a chain that has entirely passed automatically reads as "cycle closed" with no extra flag.

**Never overwrite an extended deadline.** Put the original in `date` and the new one in `extendedTo`, with a one-clause `extensionNote`. The UI strikes the original through and shows the extension. Extension history is a signal researchers read — a venue that extends every year is telling you something.

**Topics: three to six, broad only.** Values must come from `taxonomy.json#/topics`. Tagging a venue with everything it would technically accept destroys the strong/partial/weak match signal that the whole ranking depends on. If a venue genuinely accepts most of ML, set `broadScope: true` instead and tag its real centre of gravity.

**`"—"` for absent rankings**, not `"N/A"`, `""` or `null`. The renderer drops a badge whose value is `"—"`.

**MNiSW is collected but hidden.** Fill `rankings.mnisw` anyway. Visibility is one flag in `taxonomy.json#/rankingSources/mnisw/displayed`, so the day it is wanted the data is already there.

**Acceptance rate means the main track.** Do not blend a workshop track or a findings track into it. If a venue publishes no figure, omit the year from `history` rather than estimating; `latestPct` is required because the range filter needs it, so use the most recent published figure even if it is two years old and say so in `notes`.

**`source` is not optional.** A record without `verifiedOn` and at least one URL should not be committed. `confidence: "projected"` is the honest value for a venue whose 2027 dates you inferred from its 2026 pattern, and the UI is expected to label those differently from confirmed ones.

**`integrityFlag` is a public accusation.** Leave it `null` unless there is a citable, checkable basis: mass solicitation email, review turnaround measured in days, a mandatory publication fee with no identifiable programme committee, a retracted-mass-acceptance incident on record. Write the evidence, not an adjective. Include `sources`. Absence of a flag is not an endorsement, and the interface must never imply that it is.

### Suggested filling order

1. The venues you personally submit to (20–30 records). The app is useful at that size.
2. Their co-located workshops — cheap to add, and nothing else indexes them well.
3. Broaden by subfield, one `taxonomy.json` topic at a time, so match quality stays even across topics.
4. Flagged venues last and sparingly.

### Before committing

- Validate `venues.json` against `data/venue.schema.json`.
- Every `topics` entry exists in `taxonomy.json#/topics`.
- Every `hostVenueId` and `coLocatedWorkshops[].venueId` resolves to an existing id.
- Every `deadlines` array is in ascending date order.
- No duplicate ids.
- `updated` at the top of the file is today.

A `npm run validate` script implementing exactly these checks is the first thing worth writing.

## Extending the search bar

`data/query-lexicon.json` maps trigger substrings onto filter values. Adding `"vlm"` to the `multimodal` triggers teaches the bar a new phrasing with no code change. The parser is deliberately dumb rules for now; when a model replaces it, keep this file as the test fixture — every trigger listed must still resolve to the same filter, which is what stops a model upgrade from silently regressing search.

## What is not in these files

Paper-progress tracking and the watchlist are per-user, live in browser storage under the `cg.*` keys, and are not part of the content graph. When these move to a real backend, keep them there: the venue graph stays static and cacheable, and only user writes need a database.
