# Confgraph — working notes

A search interface for scientific conferences: plain-language search, category filters, deadline countdowns, venue comparison, a watchlist, and per-paper submission progress tracking.

## Read first

- `README.md` — how to run it, and how the pieces fit.
- `DATA_GUIDE.md` — how to fill `data/venues.json`. Adding records is the ongoing task.
- `data/venue.schema.json` — authoritative field list, with a description on every field.
  Three fields were amended before the first records shipped; `docs/SCHEMA_CHANGES.md` says which and why.
- `HANDOFF.md` — the design spec: layout, tokens, states, behaviour, and how the prototype maps onto the build.

## Layout

```
src/lib/             the domain layer — matching, parser, filtering, loading, URL state
src/views/           Browse · Detail · Compare · Watchlist
src/components/      shared primitives (Bits.tsx) and the result row
data/venues.json     venue records — 42 shipping
data/venues.pending.json  quarantined records, each with a `_quarantine` reason. NOT loaded
data/taxonomy.json   controlled vocabularies (topics, formats, ranking sources, paper stages)
data/query-lexicon.json  trigger words for the plain-language search bar
data/venue.schema.json   JSON Schema for venues.json
data/venues.example.json two filled records; reference only, not loaded
scripts/validate.mjs     the DATA_GUIDE "before committing" checks — `npm run validate`
scripts/build-venues.mjs the repair/quarantine pipeline over a raw research dump
confgraph_venues.json  that raw dump — build-venues.mjs's input, kept as provenance. NOT loaded
_ds/modernist-*/     the Modernist design system: styles.css + component bundle
docs/                DEPLOYMENT.md, SCHEMA_CHANGES.md, the original .dc.html prototype
```

Stack: React 19 + Vite + TypeScript, static output, no backend.
`data/` and `_ds/` stay at the repo root — a small Vite plugin serves them in dev and copies
them into the build, so neither is duplicated into `public/`.

## Rules

- **No venue facts in code.** Every conference, date, ranking and topic comes from `data/`. If a value needs hard-coding, it belongs in `data/taxonomy.json`.
- **Never invent a fact to satisfy the schema.** An unpublished acceptance rate is `null`, an unannounced event date is `null`, an un-itemised deadline chain is `[]` — each has its own visible UI state. A record that cannot be filled honestly goes to `data/venues.pending.json`, not into `venues.json` with a guess.
- **No unsourced records.** Every venue carries `source.verifiedOn` and at least one URL. `confidence: "projected"` for dates inferred from previous years.
- **Ids are permanent.** Watchlists and paper progress are keyed on venue id in browser storage; renaming one orphans a user's tracked work.
- **Never overwrite an extended deadline** — original in `date`, extension in `extendedTo`.
- **Design system is binding.** Modernist: zero corner radius, 2px rules, flush-left labels, Archivo, single red accent. Take every colour, space and font from `var(--*)` in `_ds/modernist-*/styles.css`; never hard-code a hex. The one sanctioned exception is the rounded-corner variant, gated behind the `cornerStyle` prop / header toggle while the choice is open.
- **Integrity flags need citable evidence.** Default `null`. See DATA_GUIDE.
- Dark mode is a `data-theme="dark"` attribute; both themes must be checked on any visual change.

## Architecture intent

Two tiers, deliberately. The venue graph is public, changes rarely, and ships as static JSON built from this repo — no live queries, no database, cacheable forever. User data (accounts, watchlist, paper progress, reviews) is the only part that needs a backend, and it is naturally bounded by human activity rather than traffic. Keep that split; it is what makes the read path free to run.
