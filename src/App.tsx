import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DataIssue, Filters, PaperProfile, TrackedPaper, Venue, VenueView } from './lib/types';
import { loadData } from './lib/data';
import { toView } from './lib/matching';
import { KEYS, read, write } from './lib/storage';
import { DEFAULT_FILTERS, parseHash, toHash, type UrlState } from './lib/urlState';
import Browse from './views/Browse';
import Detail from './views/Detail';
import Compare from './views/Compare';
import Watchlist from './views/Watchlist';
import { EmptyState } from './components/Bits';

const DEFAULT_PAPER: PaperProfile = { topics: [], tiers: [], readyBy: '' };

type Loaded = Awaited<ReturnType<typeof loadData>>;
type DataState = { status: 'loading' } | { status: 'ready'; data: Loaded } | { status: 'error'; message: string };

export default function App() {
  const [dataState, setDataState] = useState<DataState>({ status: 'loading' });

  // ── persisted preferences ────────────────────────────────────────────────
  const [theme, setTheme] = useState<'light' | 'dark'>(() => read(KEYS.theme, 'light' as 'light' | 'dark'));
  const [edges, setEdges] = useState<'sharp' | 'round'>(() => read(KEYS.edges, 'sharp' as 'sharp' | 'round'));
  const [saved, setSaved] = useState<string[]>(() => read<string[]>(KEYS.saved, []));
  const [paper, setPaper] = useState<PaperProfile>(() => ({ ...DEFAULT_PAPER, ...read(KEYS.paper, DEFAULT_PAPER) }));
  const [papers, setPapers] = useState<Record<string, TrackedPaper[]>>(() => read(KEYS.papers, {}));

  // ── shareable state, mirrored into the URL hash ──────────────────────────
  const [url, setUrl] = useState<UrlState>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHash = () => setUrl(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const patchUrl = useCallback((patch: Partial<UrlState>) => {
    setUrl((prev) => {
      const next = { ...prev, ...patch };
      const hash = toHash(next);
      // replaceState, so filter fiddling does not fill the back button with noise
      history.replaceState(null, '', hash || window.location.pathname + window.location.search);
      return next;
    });
  }, []);

  const setFilters = useCallback((f: Filters | ((prev: Filters) => Filters)) => {
    setUrl((prev) => {
      const nextF = typeof f === 'function' ? f(prev.f) : f;
      const next = { ...prev, f: nextF };
      history.replaceState(null, '', toHash(next) || window.location.pathname + window.location.search);
      return next;
    });
  }, []);

  useEffect(() => { write(KEYS.theme, theme); document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { write(KEYS.edges, edges); document.documentElement.dataset.edges = edges; }, [edges]);
  useEffect(() => { write(KEYS.saved, saved); }, [saved]);
  useEffect(() => { write(KEYS.paper, paper); }, [paper]);
  useEffect(() => { write(KEYS.papers, papers); }, [papers]);

  useEffect(() => {
    let live = true;
    loadData()
      .then((data) => live && setDataState({ status: 'ready', data }))
      .catch((e: unknown) => live && setDataState({ status: 'error', message: e instanceof Error ? e.message : String(e) }));
    return () => { live = false; };
  }, []);

  // ── derived view model ───────────────────────────────────────────────────
  const ready = dataState.status === 'ready' ? dataState.data : null;

  const views: VenueView[] = useMemo(() => {
    if (!ready) return [];
    const names = new Map(ready.venues.map((v: Venue) => [v.id, v.name]));
    return ready.venues.map((v: Venue) =>
      toView(v, ready.taxonomy, paper, v.hostVenueId ? names.get(v.hostVenueId) ?? null : null)
    );
  }, [ready, paper]);

  const byId = useMemo(() => new Map(views.map((v) => [v.id, v])), [views]);

  // ── actions shared across views ──────────────────────────────────────────
  const toggleSaved = useCallback((id: string) => {
    setSaved((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  /** Compare holds two to four venues; selecting a fifth drops the oldest. */
  const toggleCompare = useCallback((id: string) => {
    setUrl((prev) => {
      const has = prev.compare.includes(id);
      const compare = has ? prev.compare.filter((x) => x !== id) : [...prev.compare, id].slice(-4);
      const next = { ...prev, compare };
      history.replaceState(null, '', toHash(next) || window.location.pathname + window.location.search);
      return next;
    });
  }, []);

  const openDetail = useCallback((id: string) => {
    patchUrl({ view: 'detail', detailId: id });
    window.scrollTo({ top: 0 });
  }, [patchUrl]);

  const nav = (view: UrlState['view']) => () => { patchUrl({ view }); window.scrollTo({ top: 0 }); };

  const trackedCount = useCallback((id: string) => papers[id]?.length ?? 0, [papers]);

  // ── chrome ───────────────────────────────────────────────────────────────
  const header = (
    <div className="nav cg-rule" style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--color-bg)' }}>
      <div className="cg-shell" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', width: '100%', boxSizing: 'border-box' }}>
        <button
          type="button"
          onClick={nav('browse')}
          style={{ display: 'flex', alignItems: 'baseline', gap: 10, background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'var(--color-text)' }}
        >
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 17, letterSpacing: '-0.01em' }}>CONFGRAPH</span>
          <span className="cg-label" style={{ color: 'var(--color-accent)' }}>AI venue index</span>
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost" onClick={nav('browse')} style={{ fontSize: 13 }}>Browse</button>
          <button type="button" className="btn btn-ghost" onClick={nav('compare')} style={{ fontSize: 13 }}>
            Compare{url.compare.length ? ` (${url.compare.length})` : ''}
          </button>
          <button type="button" className="btn btn-ghost" onClick={nav('watchlist')} style={{ fontSize: 13 }}>
            Watchlist{saved.length ? ` (${saved.length})` : ''}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setEdges((e) => (e === 'sharp' ? 'round' : 'sharp'))}
            style={{ fontSize: 12, padding: '6px 10px', minWidth: 96, justifyContent: 'flex-start' }}
            title="Modernist mandates radius 0; the rounded variant is a sanctioned trial"
          >
            {edges === 'sharp' ? '▢ Sharp' : '▢ Round'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            style={{ fontSize: 12, padding: '6px 10px', minWidth: 74, justifyContent: 'flex-start' }}
          >
            {theme === 'light' ? '☾ Dark' : '☀ Light'}
          </button>
        </div>
      </div>
    </div>
  );

  if (dataState.status === 'loading') {
    return (
      <>
        {header}
        <div className="cg-shell cg-pulse" style={{ padding: '80px 20px', fontSize: 13 }}>Loading venue data…</div>
      </>
    );
  }

  if (dataState.status === 'error') {
    return (
      <>
        {header}
        <div className="cg-shell">
          <EmptyState kicker="Could not load" title="The data files did not load.">
            <p style={{ fontFamily: 'var(--font-body)' }}><code>{dataState.message}</code></p>
            <p className="cg-muted">
              The files under <code>data/</code> are fetched at runtime, so this page has to be served over HTTP —
              opening it straight off the filesystem blocks the request. Run <code>npm run dev</code>, or any static
              server from the project root.
            </p>
          </EmptyState>
        </div>
      </>
    );
  }

  const data = dataState.data;

  if (data.venues.length === 0) {
    return (
      <>
        {header}
        <div className="cg-shell">
          <EmptyState kicker="No venues yet" title="The index is empty.">
            <p>
              Every conference, deadline and ranking in this interface is read from <code>data/venues.json</code>,
              which currently holds an empty array. Add records there and they appear here — no code change.
            </p>
            <p className="cg-muted">
              <code>DATA_GUIDE.md</code> explains each field and the rules that matter more than the schema;{' '}
              <code>data/venues.example.json</code> has two filled records to copy the shape from. One record is
              enough to see the interface work.
            </p>
          </EmptyState>
        </div>
      </>
    );
  }

  const shared = {
    data,
    views,
    byId,
    saved,
    papers,
    paper,
    compare: url.compare,
    toggleSaved,
    toggleCompare,
    openDetail,
    trackedCount,
  };

  return (
    <>
      {header}
      <IssueBanner issues={data.issues} />
      <div className="cg-shell">
        {url.view === 'browse' && (
          <Browse
            {...shared}
            filters={url.f}
            sort={url.sort}
            setFilters={setFilters}
            setSort={(sort) => patchUrl({ sort })}
            setPaper={setPaper}
            reset={() => { setFilters(DEFAULT_FILTERS); patchUrl({ sort: 'fit' }); }}
          />
        )}
        {url.view === 'detail' && (
          <Detail {...shared} id={url.detailId} back={() => patchUrl({ view: 'browse', detailId: null })} />
        )}
        {url.view === 'compare' && <Compare {...shared} browse={nav('browse')} />}
        {url.view === 'watchlist' && <Watchlist {...shared} setPapers={setPapers} browse={nav('browse')} />}
      </div>
      <footer className="cg-shell cg-muted" style={{ fontSize: 11, padding: '32px 20px 40px', borderTop: '2px solid var(--color-divider)', marginTop: 40 }}>
        {data.venues.length} venues · data verified per record, see each venue's provenance line · deadlines are AoE
        unless stated · absence of an integrity flag is not an endorsement.
      </footer>
    </>
  );
}

/**
 * The load-time integrity check, surfaced above the results. It is the only thing stopping
 * bad records from shipping silently, so it renders even though it is not pretty.
 */
function IssueBanner({ issues }: { issues: DataIssue[] }) {
  const [open, setOpen] = useState(false);
  if (!issues.length) return null;
  const errors = issues.filter((i) => i.level === 'error').length;
  return (
    <div style={{ background: 'var(--color-accent-100)', borderBottom: '2px solid var(--color-divider)', padding: '10px 0' }}>
      <div className="cg-shell">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 12, color: 'var(--color-accent-800)' }}
        >
          ⚑ {issues.length} data {issues.length === 1 ? 'issue' : 'issues'}
          {errors ? ` (${errors} blocking)` : ''} · {open ? 'hide' : 'show'}
        </button>
        {open && (
          <div className="cg-in" style={{ marginTop: 6 }}>
            {issues.map((i, n) => (
              <div key={n} style={{ fontSize: 12, color: 'var(--color-accent-800)' }}>{i.text}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
