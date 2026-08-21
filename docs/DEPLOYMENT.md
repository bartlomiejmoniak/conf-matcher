# Deployment

Confgraph builds to a folder of static files — HTML, one JS bundle, one CSS bundle, and the
JSON under `data/`. There is no server, no database and no build-time API, so every free
static host can run it. `dist/` is about **400 KB**, of which **~75 KB** is the gzipped JS.

That is the whole point of the two-tier architecture in `CLAUDE.md`: the venue graph is
public, changes rarely, and ships as static JSON, so the read path costs nothing to run.
Only user data (accounts, watchlist, paper progress) would ever need a backend, and that is
bounded by human activity rather than traffic.

## Verified free tiers, August 2026

| Host | Bandwidth | Builds | Commercial use | Custom domain | Overage behaviour |
| --- | --- | --- | --- | --- | --- |
| **Cloudflare Pages** | Unlimited | 500 / month, 1 concurrent | Allowed | 100 per project | — |
| **GitHub Pages** | 100 GB / month (soft) | 10 / hour (soft; not applied to Actions builds) | Allowed | Yes | Throttled, not billed |
| **Netlify** | 100 GB / month | 300 build minutes / month | Allowed | Yes | Site suspended until reset |
| **Vercel Hobby** | 100 GB / month | 6,000 build minutes / month | **Not allowed** — Hobby forbids monetisation and revenue-generating workloads | Yes | Soft block, warnings |

Sources: [GitHub Pages limits](https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/github-pages-limits) ·
[Cloudflare Workers & Pages pricing](https://www.cloudflare.com/plans/developer-platform/) ·
[Cloudflare Pages free tier](https://freetier.co/directory/products/cloudflare-pages) ·
[Vercel vs Netlify free tiers, 2026](https://www.productsrelay.com/blog/vercel-vs-netlify-free-tier)

### Recommendation

**Cloudflare Pages.** Unlimited bandwidth is the one limit that actually matters here — a
venue index is read far more than it is built, and 500 builds a month is far more than a
dataset that changes weekly will ever use. It also permits commercial use, which Vercel's
Hobby plan does not, so it does not have to be migrated if this ever becomes a product.

**GitHub Pages** is the better first move if you want zero extra accounts: the workflow is
already committed, and 100 GB/month is a lot of traffic for a page this size. Its limits are
soft — GitHub throttles rather than bills. Move to Cloudflare if the index gets popular.

Avoid **Vercel Hobby** unless this stays strictly a personal project; its terms forbid
monetisation, and a venue index with any commercial angle would be out of compliance.

## GitHub Pages

Already wired up in `.github/workflows/deploy.yml`. One-time setup:

1. **Settings → Pages → Source: GitHub Actions**
2. Push to `main`.

The workflow sets `CONFGRAPH_BASE=/<repo>/` because a *project* site is served from a
subpath. For a **user site** (`<user>.github.io`), delete the `env:` block so the base
stays `/`.

### What a push actually costs

Nothing, while the repo is public. Actions minutes on standard GitHub-hosted runners are
free and unbilled for public repositories, so the deploy on every push to `main` draws
against no quota. The Pages **10 builds/hour** figure in the table above is not the
relevant limit either — it applies to the legacy Jekyll builder, not to Actions-based
deploys like this one.

If the repo is ever made **private**, the Free plan's 2,000 minutes/month starts applying.
A full run here is well under a minute, so that is still on the order of two thousand
pushes a month.

Which is why the venue data stays in this repo rather than a separate one: splitting it
would buy no quota back, and would cost the deploy gate — `npm run validate` failing means
a bad record never reaches the site. A data-only repo edits its way around that check.

## Cloudflare Pages

No config file needed — set these in the dashboard (Workers & Pages → Create → Pages →
Connect to Git):

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | `22` (env var `NODE_VERSION=22`) |

The base stays `/`, so no environment variable is required. `npm run build` runs
`npm run validate` first, which means a record that breaks the data rules fails the
deploy rather than shipping.

## Netlify

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "22"
```

## Anything else

Any static host works — `npm run build`, then upload `dist/`. Two requirements:

1. **Serve over HTTP.** The JSON under `data/` is fetched at runtime, so opening
   `dist/index.html` off the filesystem trips the browser's local-file restriction and the
   page shows its load-error state.
2. **Set `CONFGRAPH_BASE` if the site is not at the domain root.** It is baked into the
   asset URLs and the `data/` fetch path at build time.

There is no SPA rewrite rule to configure: all four views live in the URL *hash*, so every
shareable link resolves to `index.html` on its own.
