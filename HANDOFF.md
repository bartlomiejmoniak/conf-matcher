# Handoff: Confgraph — conference search

## Overview

A search interface for scientific conferences and workshops, aimed at one question: *where should I submit this paper?* The user states their paper's topics, target tier and ready-by date once; every result is then ranked and annotated against that profile. Secondary jobs: tracking deadlines they care about, comparing shortlisted venues, and recording how their submissions to each venue are going.

## About the design files

`Confgraph.dc.html` is a **design reference created in HTML** — a working prototype showing intended look and behaviour, not production code to lift. The task is to rebuild it in the target codebase's environment using that codebase's patterns and libraries, or, if none exists yet, to pick a framework and implement it there. The data files under `data/` are the exception: they are the real content contract and should be carried over as-is.

## Fidelity

**High fidelity.** Final colours, typography, spacing, interaction states and copy. Recreate closely. All visual values come from the Modernist design system at `_ds/modernist-ad0f4f50-9b3d-422b-86fb-2eef560a995f/styles.css` — read tokens from there rather than from the hex values quoted below.

## Data contract

Read `DATA_GUIDE.md` and `data/venue.schema.json` first. `data/venues.json` ships empty on purpose; the prototype renders an explicit empty state until it is filled. Nothing about a venue is hard-coded in the component.

Loading: the three `data/*.json` files are fetched at mount, in parallel, then normalized into the internal view model. The normalizer also runs cheap integrity checks — unknown topic, missing source, out-of-order deadlines — and surfaces them in a banner above the results. Keep that behaviour: it is the only thing stopping bad records from shipping silently.

## Screens

Four views in one page, switched from the header. State is in the URL hash (`#t=…&w=60&tier=CORE%20A*&sort=deadline&view=compare`), so any filtered result set is shareable and survives reload.

### 1. Browse (default)

Vertical stack, max-width 1280px, 20px side padding, sections separated by 2px `--color-divider` rules.

**Header** (`.nav`, sticky, `--color-bg`): wordmark "CONFGRAPH" at 17px `--font-heading` with "AI VENUE INDEX" at 11px uppercase letterspaced 0.1em beside it; right side Browse / Compare (n) / Watchlist (n) as ghost buttons, then the corner-style toggle and theme toggle as secondary buttons.

**Ask bar**: 11px accent uppercase label "ASK OR FILTER" with a muted one-line explanation. Full-width input, 52px min-height, 18px `--font-heading`, beside a solid accent "Interpret" button of the same height. On submit: a pulsing "Reading your query" line for ~420ms, then a "READ AS" row of accent tags naming each filter the query set, plus a muted note when nothing was recognised. **The visible trace is the point** — the parse is never silent, and every chip it sets remains hand-editable below.

**Paper profile bar** (`--color-surface`, 12px padding): three groups — removable topic tags with a `+ topic` select; CORE A* / A / B tier toggles; a `ready by` date input — and a right-aligned muted summary ("2 of 14 shown are strong topic matches. Ready-by 1 Nov 2026 flags deadlines that fall too early."). Persisted to `localStorage.cg.paper`.

**Filter chips**: auto-fit grid, `minmax(210px, 1fr)`, 16px/28px gaps. Groups: Topic (from taxonomy), Deadline window (30/60/90), Ranking (CORE A*, CORE A, CCF-A), Format (+ a review-type chip when the parser set one), Type (Everything / Conferences / Workshops), and Acceptance rate. Chip: 12px text, 4px 10px padding, 1px divider border, transparent; active flips to accent fill with `--color-bg` text. No radius.

**Acceptance-rate control**: a two-handle range over a 4px track — `--color-neutral-300` rail, accent fill between the handles, 10×22px accent handles, `0%`/`100%` end labels and a live `15–35%` readout in the group label. Handles cannot cross (each clamps 1% off the other).

**Result count row**: count in heading weight, muted "n closed cycles hidden", then Sort chips (Fit / Deadline / Ranking / Acceptance) and a Reset ghost button.

**Result card**: `92px | 1fr | auto` grid, 1px bottom rule.
- Left rail: days-remaining number at 30px heading weight, "DAYS LEFT" at 10px uppercase. Accent fill with `--color-bg` text when ≤45 days; `--color-surface` otherwise; a bordered "Cycle closed" cell when no deadline remains.
- Middle: venue name as an 18px heading-weight button; then the match band pill (STRONG / PARTIAL / WEAK), a workshop tag naming its host, an integrity flag pill, and a "n papers tracked" pill when the user tracks papers there. Second line: next deadline stage and date, a muted confidence note for provisional/projected dates, an accent "too early for your ready-by date" warning, then the muted location · dates · format line. Third line: ranking badges (CORE / CCF / h5) and the acceptance figure.
- Right: Save, Compare, More ▼ buttons, 104px min-width, stacked 4px apart.

**Expanded row** (in place, 180ms fade-and-rise): four auto-fit columns — Cycle (full deadline chain; extended dates struck through with the accent extension note beneath), Review process (blinding, rebuttal, page limit, open access, publisher, fee), Acceptance-rate history (bar chart, 16px accent-400 bars scaled to the venue's own max), and Topics (matched tags in accent, others neutral) plus actions: add-to-calendar, save, track a paper, and links to the CFP and site.

**Match bands** — the ranking signal. The user's paper topics are expanded through `taxonomy.json#/narrowTopics` (so `fairness` reaches a `trustworthy AI` venue), then intersected with the venue's topics: 2+ overlaps = strong, 1 = partial, 0 = weak, except a `broadScope` venue floors at partial. Fit sort orders by band, then overlap count, then whether the venue sits in the user's target tier, then CORE tier, then deadline proximity.

### 2. Detail

Back link; then a 1.6fr / 1fr split with a 2px rule between: left has the kind line, the venue name at 44px (-0.03em), the full name in 15px at 52ch, topic tags and the primary actions; right is a bordered column with the next deadline stage at 26px, its date with "(AoE)", an accent relative line, then a fact list (dates, location, format, registration, publisher, open access, acceptance). Below: an accent-tinted integrity banner when flagged, then three columns — deadline chain, rankings table (`.table`), review process with the acceptance history chart — then co-located workshops as `.card`s, then the provenance line.

### 3. Compare

Two to four venues. A shared timeline: 16 months from the start of the current month, month ticks every second month, one 62px row per venue with its name in a 150px left gutter and every deadline as a 2px accent tick with a staggered label (alternating 10px/30px top offset to avoid collisions). Below, a `.table` with one column per venue: next deadline, CORE/CCF/h5, acceptance rate, review, cost and location, shared topics, trust flag. Selecting a fifth venue drops the oldest.

### 4. Watchlist

Saved venues, each row `92px | 1fr | auto`: countdown rail, name with a progress summary pill ("1 paper · Under review"), deadline and location lines, then Progress (n) / Calendar / Remove.

**Progress tracker** (expands under the row): one block per tracked paper — an editable title input, a muted stage summary, a Remove button, then a six-segment stage bar (Drafting, Submitted, Under review, Rebuttal, Decision, Camera-ready) where clicking a segment sets the stage and fills every segment up to it in accent; then an outcome pill group (Pending / Accepted / Rejected) and a free-text note input. "+ Add a paper" beneath. Stages and outcomes come from `taxonomy.json`.

## Interactions

- Filter chips, sort and the range slider apply immediately — no apply button, no spinner.
- "Interpret" is the only deliberately delayed action (~420ms, pulsing label) because it stands in for a model call.
- Expansion is in place; the detail view is a separate screen reached by clicking the venue name.
- Add-to-calendar is a generated `.ics` data URL for the next deadline. No library.
- Corner style and theme toggle instantly; both persist.
- Empty states are written, not blank: no results (offers reset, explains hidden closed cycles), nothing to compare, empty watchlist, and no data at all (points at the data files).
- Transitions are 180–200ms ease-out; the only continuous animation is the loading pulse.

## State

Component state: `view`, `detailId`, `query`, `trace`, `thinking`, `f` (the filter set), `paper`, `expanded`, `saved`, `compare`, `sort`, `theme`, `edges`, `papers`, `tracker`, plus `dataState` / `dataIssues`.

Persisted to `localStorage`: `cg.theme`, `cg.edges`, `cg.saved` (venue ids), `cg.paper` (the paper profile), `cg.papers` (progress, keyed by venue id → array of `{title, stage, outcome, note}`). Ids are the join key — see CLAUDE.md on why they must never be renamed.

In the URL hash: topics, deadline window, before-date, tiers, formats, kind, acceptance range, sort, view, detail id.

When accounts arrive, `cg.saved` / `cg.papers` / `cg.paper` are the tables to migrate; everything else stays client-side.

## Design tokens

All from `_ds/modernist-*/styles.css`. Light: bg `#f3f2f2`, text `#201e1d`, accent `#ec3013`, plus 100–900 neutral and accent ramps. Dark is an override block in the prototype's `<helmet>`: bg `#171615`, surface `#221f1e`, text `#f1efee`, accent `#ff563c`, with the ramps inverted in step. Type is Archivo throughout (`--font-heading` 800 weight for numerals, labels and names; `--font-body` for prose). Spacing from `--space-*`. **Radius is 0** — Modernist mandates it.

The rounded variant is the one sanctioned deviation: a `data-edges="round"` attribute on the root applies 4px to buttons, inputs, tags, pills and cards, and rounds the left edge of the countdown rail. Exposed as the `cornerStyle` prop and a header toggle while the choice is open; when it settles, delete the loser.

Uppercase 10–11px letterspaced 0.08–0.12em labels do all the sectioning work. Icons, where needed, are Lucide.

## What is mocked

- **The plain-language parser** is substring rules over `data/query-lexicon.json`, with a scripted delay. It is honest about what it recognised and ignores the rest. Replacing it with a model should keep the visible trace and the hand-editable chips, and keep the lexicon as a regression fixture.
- **Community ratings** are absent by product decision — nothing is shown until there is real data behind it.
- **CFP and website links** come from the data; records without them fall back to `#`.
- **No auth, no backend.** Everything persists to browser storage.

## Files

- `Confgraph.dc.html` — the whole interface
- `CLAUDE.md` — working rules and architecture intent
- `DATA_GUIDE.md` — how to fill the data files
- `data/venues.json` (empty), `data/venue.schema.json`, `data/taxonomy.json`, `data/query-lexicon.json`, `data/venues.example.json`
- `_ds/modernist-ad0f4f50-9b3d-422b-86fb-2eef560a995f/` — the design system: `styles.css`, component bundle, `readme.md`

## Serving

The data files are fetched at runtime, so the page must be served over HTTP — opening it from the filesystem trips the browser's local-file restriction and the prototype shows its load-error state. Any static server from the project root will do.
