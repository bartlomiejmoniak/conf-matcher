# Schema amendments

`data/venue.schema.json` was amended in three places before the first records shipped.
Each amendment resolves a case where the schema as written demanded a fact that
`DATA_GUIDE.md` forbids inventing.

## Why

The schema required `acceptance.latestPct` as a number, because "the range filter needs it".
`DATA_GUIDE.md` says the opposite about the same field:

> If a venue publishes no figure, omit the year from `history` rather than estimating.

Most conferences outside the top tier publish no acceptance rate at all. Held to both rules
at once, those records can neither ship nor be filled honestly. The same tension applies to
a venue whose CFP is open but whose location and dates are still TBA, and to one that
publishes a call with no itemised deadline chain.

Of the 59 records in the research dump, **52 failed the schema as written** — and only one
class of failure (`review.blinding: "—"`) was a data error rather than a modelling gap.
Enforcing the schema strictly would have shipped 7 venues.

## The three amendments

| Field | Was | Now | UI consequence |
| --- | --- | --- | --- |
| `acceptance.latestPct` | `number`, required | `number \| null`, required | Renders "acceptance not published". Excluded from the acceptance range filter while the range is narrowed, and sorted last on an acceptance sort — never treated as 0%. |
| `deadlines` | `minItems: 1` | `minItems: 0` | Renders "No dates published", which is distinct from "Cycle closed". Never a countdown of zero. |
| `event.start` / `event.end` | `date`, required | `date \| null`, required, null together | Renders "Dates not announced". |

Each one has a defined, visible rendering. Nothing is silently blank, and no absent fact is
replaced with a guess.

## What was NOT relaxed

**The provenance rule.** `CLAUDE.md`: *"No unsourced records."* A record without
`source.verifiedOn` and at least one URL still does not ship. 13 records failed on this and
were quarantined rather than badged as unverified — an unsourced deadline is worse than a
missing one, because a user schedules against it.

## Promoting a quarantined record

`data/venues.pending.json` holds every record that failed a shipping gate, each with its
reason under `_quarantine`. Ids there are already in final form, so promoting a record
never renames it and never orphans a saved watchlist entry.

1. Fix what the `_quarantine` reason names — usually adding the CFP URL to `source.urls`.
2. Delete the `_quarantine` key.
3. Move the record into `data/venues.json` and set `updated` to today.
4. `npm run validate`.
