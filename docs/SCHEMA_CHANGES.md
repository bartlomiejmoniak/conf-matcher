# Schema amendments

`data/venue.schema.json` was amended in three places before the first records shipped, and
twice since. Each amendment resolves a case where the schema as written demanded a fact
that `DATA_GUIDE.md` forbids inventing, or could not record one it should have.

- [Round 1 — three fields made absent-able](#why) (before the first records shipped)
- [Round 2 — `acceptance.latestYear` and `registration.tiers`](#round-2--dating-a-rate-and-tabling-a-fee)

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

## Round 2 — dating a rate, and tabling a fee

Two fields added, both because the shape as written could not hold something the data
already contained.

### `acceptance.latestYear` — required whenever `latestPct` is set

`latestPct` is documented as "most recent published … rate", and `DATA_GUIDE.md` says to
"use the most recent published figure even if it is two years old and say so in `notes`".
Two shipping records do exactly that — `eccv-2026` and `emnlp-2026` both quote a **2024**
figure — and neither says so anywhere the UI can read. A rate rendered without its year
reads as the current edition's, which is the one thing it usually is not.

Prose in `notes` is not a fix: nothing can render it beside the number. `latestYear` is
non-null exactly when `latestPct` is, enforced in both directions by `validate.mjs`.

The backfill invented nothing. All 9 records with a non-null rate carry a `history` array,
every one of them ends at a year whose `pct` equals `latestPct`, so the year was derived
from data already present and asserted to match before being written. The other 33 records
have no figure and therefore no year.

While there: `history` is documented "oldest first" and nothing checked it. `cvpr-2026`
shipped newest-first. Both the ordering and its agreement with `latestPct` are now
validated.

### `registration.tiers[]` — the fee table as data

`registration.fee` is free text "as published", which is right for a venue that publishes a
blob and useless for one that publishes a table. It is the literal string `"—"` on all 42
records, so nothing is lost by leaving it in place for the blob case.

`tiers[]` holds one entry per published row: `{label, amount, currency, cutoff, note}`,
with `label` drawn from `taxonomy.json#/registrationTiers` and `currency` an ISO 4217 code.
Amounts are stored in the currency they were published in and **never converted** — the
same rule `fee` already carried.

Every record ships `tiers: []`, because no venue in this set has published a 2026/2027 fee
table yet. That is the honest state, and it is the state the cost estimator is built for:
with no tier to select, it takes a hand-entered figure instead of implying a price the data
does not have.

## Promoting a quarantined record

`data/venues.pending.json` holds every record that failed a shipping gate, each with its
reason under `_quarantine`. Ids there are already in final form, so promoting a record
never renames it and never orphans a saved watchlist entry.

1. Fix what the `_quarantine` reason names — usually adding the CFP URL to `source.urls`.
2. Delete the `_quarantine` key.
3. Move the record into `data/venues.json` and set `updated` to today.
4. `npm run validate`.
