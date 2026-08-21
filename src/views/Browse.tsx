import { useEffect, useMemo, useRef, useState } from 'react';
import type { Filters, LocationFormat, SortKey } from '../lib/types';
import type { PaperProfile } from '../lib/types';
import { applyFilters } from '../lib/filtering';
import { sortVenues } from '../lib/matching';
import { parseQuery, traceNote, type ParseResult } from '../lib/parser';
import { filtersActive } from '../lib/urlState';
import { Chip, EmptyState, Label, SmallLabel } from '../components/Bits';
import ResultRow from '../components/ResultRow';
import { type ViewProps } from './shared';

interface Props extends ViewProps {
  filters: Filters;
  sort: SortKey;
  setFilters: (f: Filters | ((prev: Filters) => Filters)) => void;
  setSort: (s: SortKey) => void;
  setPaper: (p: PaperProfile | ((prev: PaperProfile) => PaperProfile)) => void;
  reset: () => void;
}

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'fit', label: 'Fit' },
  { key: 'deadline', label: 'Deadline' },
  { key: 'ranking', label: 'Ranking' },
  { key: 'acceptance', label: 'Acceptance' },
];

export default function Browse(props: Props) {
  const { data, views, filters, sort, setFilters, setSort, paper, setPaper, reset } = props;
  const { taxonomy, lexicon } = data;

  const [query, setQuery] = useState('');
  const [thinking, setThinking] = useState(false);
  const [trace, setTrace] = useState<ParseResult | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  /**
   * "Interpret" is the only deliberately delayed action — it stands in for a model call.
   * The visible trace is the point: the parse is never silent, and every chip it sets
   * stays hand-editable below.
   */
  const runQuery = () => {
    if (!query.trim()) { setTrace(null); return; }
    setThinking(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const result = parseQuery(query, lexicon);
      setThinking(false);
      setTrace(result);
      setFilters((prev) => ({ ...prev, ...result.patch }));
    }, 420);
  };

  const toggleIn = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

  /**
   * Chips advertise only what the data can actually match. A topic in the taxonomy with no
   * venue behind it renders a chip that empties the list, so the vocabulary is the taxonomy
   * intersected with what shipped — in taxonomy order, which is load-bearing.
   */
  const topicOptions = useMemo(() => {
    const used = new Set(views.flatMap((v) => v.topics));
    return taxonomy.topics.filter((t) => used.has(t));
  }, [views, taxonomy.topics]);

  const kindOptions = useMemo(() => {
    const used = new Set(views.map((v) => v.kind));
    return taxonomy.kinds.filter((k) => used.has(k));
  }, [views, taxonomy.kinds]);

  const { shown, closedHidden } = applyFilters(views, filters);
  const results = sortVenues(shown, sort);

  const strongCount = views.filter((v) => v.band === 'strong').length;
  const paperSummary = paper.topics.length
    ? `${strongCount} of ${views.length} indexed venues are strong topic matches.` +
      (paper.readyBy ? ` Ready-by ${paper.readyBy} flags deadlines that fall too early.` : '')
    : 'Add your paper’s topics to rank every result against it.';

  const accNarrowed = filters.accFrom !== 0 || filters.accTo !== 100;

  return (
    <div>
      {/* ── Ask bar ─────────────────────────────────────────────────────── */}
      <section className="cg-rule" style={{ padding: '20px 0 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <Label style={{ color: 'var(--color-accent)' }}>Ask or filter</Label>
          <span className="cg-muted" style={{ fontSize: 11 }}>
            Plain language sets the filters below — you can always correct them by hand.
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runQuery()}
            placeholder="double-blind CV venues I can hit by March"
            aria-label="Ask or filter"
            style={{ minHeight: 52, fontSize: 18, padding: '0 14px', fontFamily: 'var(--font-heading)', fontWeight: 400 }}
          />
          <button type="button" className="btn btn-primary" onClick={runQuery} style={{ minHeight: 52, padding: '0 20px', justifyContent: 'flex-start' }}>
            Interpret
          </button>
        </div>

        {thinking && (
          <div className="cg-pulse" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12 }}>
            <span style={{ width: 6, height: 6, background: 'var(--color-accent)' }} />
            Reading your query
          </div>
        )}

        {!thinking && trace && (
          <div className="cg-in" style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Label style={{ color: 'var(--color-accent)' }}>Read as</Label>
            {trace.trace.map((t, i) => (
              <span key={i} className="tag tag-accent" style={{ fontSize: 11 }}>{t.text}</span>
            ))}
            <span className="cg-muted" style={{ fontSize: 11 }}>{traceNote(trace)}</span>
          </div>
        )}
      </section>

      {/* ── Paper profile ───────────────────────────────────────────────── */}
      <section className="cg-rule" style={{ background: 'var(--color-surface)', margin: '0 -20px', padding: '12px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 24 }}>
          <div>
            <Label style={{ marginBottom: 6 }}>Your paper</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {paper.topics.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="tag tag-accent"
                  onClick={() => setPaper((p) => ({ ...p, topics: p.topics.filter((x) => x !== t) }))}
                  style={{ border: 0, cursor: 'pointer', fontFamily: 'var(--font-body)', gap: 6 }}
                  aria-label={`Remove topic ${t}`}
                >
                  {t} <span style={{ opacity: 0.55 }}>✕</span>
                </button>
              ))}
              <select
                className="input"
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) setPaper((p) => ({ ...p, topics: [...new Set([...p.topics, v])] }));
                }}
                aria-label="Add a topic to your paper profile"
                style={{ width: 'auto', minHeight: 26, fontSize: 11, padding: '2px 8px' }}
              >
                <option value="">+ topic</option>
                <optgroup label="Venue topics">
                  {taxonomy.topics.filter((t) => !paper.topics.includes(t)).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </optgroup>
                <optgroup label="Narrower — rolls up to a venue topic">
                  {Object.keys(taxonomy.narrowTopics)
                    .filter((t) => !t.startsWith('$') && !paper.topics.includes(t))
                    .map((t) => (
                      <option key={t} value={t}>{t} → {taxonomy.narrowTopics[t]}</option>
                    ))}
                </optgroup>
              </select>
            </div>
          </div>

          <div>
            <Label style={{ marginBottom: 6 }}>Target tier</Label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {taxonomy.tiers.entries.filter((t) => t.inProfile).map((t) => (
                <Chip key={t.label} label={t.label} active={paper.tiers.includes(t.label)} onClick={() => setPaper((p) => ({ ...p, tiers: toggleIn(p.tiers, t.label) }))} />
              ))}
            </div>
          </div>

          <div>
            <Label style={{ marginBottom: 6 }}>Ready by</Label>
            <input
              className="input"
              type="date"
              value={paper.readyBy}
              onChange={(e) => setPaper((p) => ({ ...p, readyBy: e.target.value }))}
              aria-label="Date your paper will be ready"
              style={{ width: 160, minHeight: 28, fontSize: 12 }}
            />
          </div>

          <div className="cg-muted" style={{ marginLeft: 'auto', maxWidth: 300, fontSize: 11, lineHeight: 1.45 }}>
            {paperSummary}
          </div>
        </div>
      </section>

      {/* ── Filter chips ────────────────────────────────────────────────── */}
      <section className="cg-rule cg-cols" style={{ padding: '14px 0' }}>
        <div>
          <SmallLabel style={{ marginBottom: 7 }}>Topic</SmallLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {topicOptions.map((t) => (
              <Chip key={t} label={t} active={filters.topics.includes(t)} onClick={() => setFilters((f) => ({ ...f, topics: toggleIn(f.topics, t) }))} />
            ))}
          </div>
        </div>

        <div>
          <SmallLabel style={{ marginBottom: 7 }}>Deadline window</SmallLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {taxonomy.deadlineWindows.days.map((w) => (
              <Chip key={w} label={`${w} days`} active={filters.window === w} onClick={() => setFilters((f) => ({ ...f, window: f.window === w ? null : w }))} />
            ))}
          </div>
        </div>

        <div>
          <SmallLabel style={{ marginBottom: 7 }}>Ranking</SmallLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {taxonomy.tiers.entries.map((t) => (
              <Chip key={t.label} label={t.label} active={filters.tiers.includes(t.label)} onClick={() => setFilters((f) => ({ ...f, tiers: toggleIn(f.tiers, t.label) }))} />
            ))}
          </div>
        </div>

        <div>
          <SmallLabel style={{ marginBottom: 7 }}>Format</SmallLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {taxonomy.formats.map((fmt) => (
              <Chip key={fmt} label={fmt} active={filters.formats.includes(fmt)} onClick={() => setFilters((f) => ({ ...f, formats: toggleIn(f.formats, fmt as LocationFormat) }))} />
            ))}
            {/* The review-type chip appears only once the parser has set one. */}
            {filters.blinding && (
              <Chip label={filters.blinding} active onClick={() => setFilters((f) => ({ ...f, blinding: null }))} />
            )}
          </div>
        </div>

        <div>
          <SmallLabel style={{ marginBottom: 7 }}>Type</SmallLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            <Chip label="Everything" active={filters.kind === 'all'} onClick={() => setFilters((f) => ({ ...f, kind: 'all' }))} />
            {kindOptions.map((k) => (
              <Chip key={k} label={`${k[0]!.toUpperCase()}${k.slice(1)}s`} active={filters.kind === k} onClick={() => setFilters((f) => ({ ...f, kind: k }))} />
            ))}
          </div>
        </div>

        <div>
          <SmallLabel style={{ marginBottom: 7 }}>
            Acceptance rate · {accNarrowed ? `${filters.accFrom}–${filters.accTo}%` : 'any'}
          </SmallLabel>
          <RangeControl
            from={filters.accFrom}
            to={filters.accTo}
            onChange={(accFrom, accTo) => setFilters((f) => ({ ...f, accFrom, accTo }))}
          />
          {accNarrowed && (
            <div className="cg-muted" style={{ fontSize: 10, marginTop: 6, lineHeight: 1.4 }}>
              Venues that publish no figure are excluded while this is narrowed.
            </div>
          )}
        </div>
      </section>

      {/* ── Result count + sort ─────────────────────────────────────────── */}
      <section className="cg-rule" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 0' }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 15 }}>
          {results.length} {results.length === 1 ? 'venue' : 'venues'}
        </span>
        {closedHidden > 0 && (
          <span className="cg-muted" style={{ fontSize: 12 }}>{closedHidden} closed {closedHidden === 1 ? 'cycle' : 'cycles'} hidden</span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <SmallLabel style={{ marginRight: 4 }}>Sort</SmallLabel>
          {SORTS.map((s) => (
            <Chip key={s.key} label={s.label} active={sort === s.key} onClick={() => setSort(s.key)} />
          ))}
          <button type="button" className="btn btn-ghost" onClick={reset} style={{ fontSize: 12, marginLeft: 4 }} disabled={!filtersActive(filters) && sort === 'fit'}>
            Reset
          </button>
        </div>
      </section>

      {/* ── Results ─────────────────────────────────────────────────────── */}
      {results.length === 0 ? (
        <EmptyState kicker="No results" title="Nothing matches those filters.">
          <p>
            {closedHidden > 0
              ? `${closedHidden} ${closedHidden === 1 ? 'venue matches' : 'venues match'} but ${closedHidden === 1 ? 'its cycle has' : 'their cycles have'} already closed, so ${closedHidden === 1 ? 'it is' : 'they are'} hidden.`
              : 'Every filter is an AND, so a narrow topic plus a short deadline window empties the list quickly.'}
          </p>
          <p><button type="button" className="btn btn-secondary" onClick={reset}>Reset every filter</button></p>
        </EmptyState>
      ) : (
        <div>
          {results.map((v) => (
            <ResultRow
              key={v.id}
              v={v}
              {...props}
              expanded={expanded === v.id}
              onExpand={() => setExpanded((e) => (e === v.id ? null : v.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Two handles over one track. Neither can cross the other — each clamps 1% off. */
function RangeControl({ from, to, onChange }: { from: number; to: number; onChange: (from: number, to: number) => void }) {
  return (
    <div>
      <div className="cg-range">
        <div className="cg-range-rail" />
        <div className="cg-range-fill" style={{ left: `${from}%`, width: `${Math.max(0, to - from)}%` }} />
        <input
          type="range" min={0} max={100} value={from}
          aria-label="Minimum acceptance rate"
          onChange={(e) => onChange(Math.min(Number(e.target.value), to - 1), to)}
        />
        <input
          type="range" min={0} max={100} value={to}
          aria-label="Maximum acceptance rate"
          onChange={(e) => onChange(from, Math.max(Number(e.target.value), from + 1))}
        />
      </div>
      <div className="cg-muted" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 2 }}>
        <span>0%</span><span>100%</span>
      </div>
    </div>
  );
}
