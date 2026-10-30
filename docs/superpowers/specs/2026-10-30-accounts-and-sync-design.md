# Accounts and sync — design

Spec 1 of the [roadmap](2026-10-30-roadmap.md). Status: draft for review.

## Goal

Let a user sign in with GitHub or Google and have their watchlist, paper profile and
tracked papers follow them across devices — without changing anything for a user who
never signs in, and without moving venue data out of the static build.

Success looks like: sign in on a laptop, star three venues and track a paper; open the
site on a phone, sign in, and see the same three venues and the same paper within a
few seconds. Sign out, and the phone holds nothing of theirs.

## Scope

**In:**
- Sign-in with GitHub and Google.
- A private profile containing display name, avatar and linked providers.
- Sync of `cg.saved`, `cg.paper` and `cg.papers`.
- Merging browser data into the account on first sign-in.
- A sync status indicator.
- Data export and account deletion.

**Out:**
- Sign in with Apple, deferred for cost.
- Email or magic-link sign-in.
- Public profile pages.
- ORCID linking and reputation (spec 2).
- Teams and sharing (spec 4).
- The calendar subscription URL and billing (spec 5).
- Moving venue data into the database (spec 2).

## Architecture

```
static site (GitHub / Cloudflare Pages)          Supabase (free tier)
  data/venues.json  ── unchanged ──              auth: GitHub, Google
  React app                                      Postgres + row-level security
    src/lib/storage.ts   localStorage (cg.*)  ◀─▶  profiles, watchlist,
    src/lib/sync.ts      push / pull / merge       paper_profile, tracked_papers
    src/lib/auth.ts      supabase-js session
```

- **Two tiers, as `CLAUDE.md` intends.** Venue data stays static and cacheable. Supabase holds user data only.
- **No server of our own.** The browser talks to Supabase with the public anon key. Row-level security is the only thing standing between users, so every table has a policy and nothing else holds a secret.
- **localStorage stays the working copy.** The UI keeps reading and writing `cg.*` exactly as today. `sync.ts` mirrors those keys to Supabase when a session exists, and does nothing when it doesn't. A signed-out user runs exactly today's code path.
- **New dependency:** `@supabase/supabase-js`.
- **Build-time config:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are both public by design.
- **If they're missing, the build still works.** The app builds and runs with sign-in hidden, so forks and local development need no Supabase project.

## Data model

Migrations live in `supabase/migrations/` and are applied with the Supabase CLI.

| Table | Columns | Notes |
|---|---|---|
| `profiles` | `id uuid pk → auth.users`, `display_name text`, `avatar_url text`, `created_at`, `updated_at` | Created by a trigger on sign-up from the provider's metadata. Spec 2 adds ORCID and reputation columns here. |
| `watchlist` | `user_id`, `venue_id text`, `added_at`, `updated_at`, `deleted_at` | PK `(user_id, venue_id)`. Soft delete so a removal on one device propagates. |
| `paper_profile` | `user_id pk`, `data jsonb`, `updated_at` | The `PaperProfile` object as stored today. One row per user. |
| `tracked_papers` | `id uuid pk`, `user_id`, `venue_id text`, `title`, `stage`, `outcome`, `note`, `position int`, `updated_at`, `deleted_at` | One row per paper. `position` preserves today's per-venue ordering. |

- **`venue_id` is text, not a foreign key.** Venues aren't in the database yet, and ids are permanent by rule. An id that no longer resolves stays stored, and the UI shows it as "venue no longer in the index" rather than dropping the user's work.
- **Row-level security on every table:** `user_id = auth.uid()` for select, insert, update and delete. `profiles` uses `id = auth.uid()`.
- **Not synced, because they're device preferences:** `cg.theme`, `cg.timeline`, `cg.cost`.

### Required local change: papers get ids

Today a tracked paper is addressed as venue id + array index (`src/lib/papers.ts`). Index
is not stable across devices, so `TrackedPaper` gains `id: string` (a UUID from
`crypto.randomUUID()`) and `updatedAt: string`. A one-time migration on load assigns both
to any stored paper lacking them; `PaperRef` and the edit helpers address papers by `id`.
This ships before, and independently of, sign-in.

## Sync behaviour

All merge logic is pure functions in `src/lib/sync.ts`, so it can be unit-tested without
a network.

- **Pull:**
  - Runs on sign-in, on page load with a session, and when the tab regains focus.
  - Fetches rows changed since the last pull (`updated_at > cg.sync.cursor`), merges them into localStorage, and re-renders.
- **Push:**
  - Every write through `storage.ts` that touches a synced key also records the change in `cg.sync.outbox`.
  - The outbox is flushed (upsert) 1.5 s after the last write, and again when the browser comes back online.
  - Entries leave the outbox only once the server confirms them.
- **Conflicts:** last write wins per row, compared on `updated_at`.
  - Rows are small and per-user, and the only concurrent writer is the same person on another device, so field-level merging isn't worth its complexity.
  - Clock skew is bounded because the server overwrites `updated_at` on upsert through a trigger.
  - The comparison uses the server value from then on.
- **Deletes are tombstones:** `deleted_at` is set rather than the row being removed. Tombstones older than 90 days are purged by a scheduled SQL job.

### First sign-in on a device that already has data

| Data | Rule |
|---|---|
| Watchlist | Union of browser and account. Nothing is lost. |
| Tracked papers | Union by `id`. Papers created anonymously have fresh UUIDs, so they never collide. |
| Paper profile | If the account has none, upload the browser's copy. If both exist and differ, keep the account's copy and show a one-line notice offering "use this device's profile instead". |

### Sign-out

Sign-out clears `cg.saved`, `cg.paper`, `cg.papers` and the sync keys from the device, so a
shared computer keeps nothing. If the outbox is not empty, sign-out first attempts a flush;
if that fails (offline) it warns that unsynced changes will be lost and asks to confirm.

## Interface

All of it follows the Modernist design system: radius 0, 2px rules, every value from `var(--*)`, and checked in both themes.

- **Header:**
  - A "Sign in" secondary button sits after the theme toggle.
  - Choosing it opens a small panel with "Continue with GitHub" and "Continue with Google", plus one sentence on what syncs and that signing in is optional.
  - Signed in, the button becomes the avatar and name, which opens the account menu.
- **Sync status:** a muted text label next to the account button, showing one of four states:
  - "Synced"
  - "Syncing…"
  - "Offline — changes saved on this device"
  - "Sync failed — retry", with a retry action
  - There's no spinner animation.
- **Account view** (`#/account`, a new hash route):
  - Display name (editable) and avatar.
  - Linked providers, with the option to link the other one.
  - "Download my data" (JSON of every user table).
  - "Delete account".
- **Deletion:**
  - Requires typing the display name to confirm.
  - Calls a Postgres function (`security definer`, callable only by the user themselves) that deletes the auth user, and the user's rows with it.
  - Then signs out locally.

## Auth details

- **Flow:** Supabase OAuth with PKCE.
- **Redirect URL:** the site root (`CONFGRAPH_BASE`), configured per deployment.
- **Hash routing:** the OAuth callback returns `?code=` in the query string, which doesn't collide with the hash routes. After the exchange the app strips the query and restores the route the user started from (saved in `sessionStorage` before the redirect).
- **Linking providers:** Supabase identity linking for GitHub and Google. Sign-ins with the same verified email address are linked automatically.

## Error handling

- **Supabase unreachable or paused:** the app works fully from localStorage and the status reads "Offline". Nothing blocks the UI.
- **Session expired:** supabase-js refreshes it silently. If the refresh fails, the status reads "Signed out — sign in to resume sync" and local data is kept until the user acts.
- **A row rejected by row-level security or validation:** the entry stays in the outbox, flagged as failed, and is surfaced in the account view. Sync doesn't loop retrying it.

## Operations and cost

- **Supabase free tier:** 500 MB of database, 50k monthly active users. User rows are a few hundred bytes each, so this won't bind for a long time.
- **Free projects pause after 7 days without activity.**
  - Before launch, accept it.
  - Once real users exist, either a weekly GitHub Actions job runs a trivial query, or the project moves to Supabase Pro ($25/month) when traffic justifies it.
- **Backups:** the free tier has no point-in-time restore. A weekly GitHub Actions job runs `pg_dump` into a private storage bucket.
- **Privacy:**
  - Users are in the EU, so a short privacy notice is required: what is stored, why, the processor (Supabase, EU region), and how to export or delete.
  - The project is created in an EU region.
  - The notice is linked from the sign-in panel.

## Testing

- **Unit tests (vitest), with the merge logic in `src/lib/sync.ts` written test-first:**
  - Union rules.
  - Last-write-wins.
  - Tombstones.
  - Outbox flush and retain on failure.
  - The paper-id migration.
- **Row-level security tests:** SQL tests run against a local Supabase (`supabase start`). User A can't read, write or delete user B's rows in any table, and an anonymous caller gets nothing.
- **Manual check before release:**
  - The two-browser scenario from **Goal**: sign in, star, track, sign out.
  - Offline edits, then reconnect.
  - First sign-in with existing browser data.
  - Account deletion.
  - Both themes.
- **Existing suite:** `npm test`, `npm run typecheck` and `npm run validate` must stay green. The build with no Supabase config must still succeed.

## Docs to update alongside

- `README.md` — run instructions with and without Supabase.
- `docs/DEPLOYMENT.md` — Supabase project setup, the redirect URL for each host, and the env vars.
- `HANDOFF.md` — account and sync states.
- `CLAUDE.md`:
  - the layout adds `supabase/`;
  - the architecture note becomes "user data lives in Supabase; venue data stays static".
