import { useState } from 'react';
import type { TrackedPaper } from '../lib/types';
import { fmtDate, todayISO } from '../lib/dates';
import { addPaper, groupByTitle, removePaper, updatePaper } from '../lib/papers';
import { EmptyState, SmallLabel } from '../components/Bits';
import { PaperEditor, StageBar } from '../components/PaperEditor';
import { Timeline, TimelineWindow, type Lane } from '../components/Timeline';
import { KEYS, read, write } from '../lib/storage';
import { ChevronDown, ChevronUp, ICON } from '../components/Icons';
import type { ViewProps } from './shared';

interface Props extends ViewProps {
  setPapers: (p: Record<string, TrackedPaper[]> | ((prev: Record<string, TrackedPaper[]>) => Record<string, TrackedPaper[]>)) => void;
  browse: () => void;
}

/**
 * Papers, not venues.
 *
 * The Watchlist answers "what am I watching"; this answers "what am I working on, and what
 * is coming at it". The same store keyed the other way round: one paper aimed at three
 * venues is one row with three deadlines on the timeline, rather than three rows to
 * cross-reference by eye.
 */
export default function Papers({ papers, saved, byId, data, setPapers, openDetail, browse }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [spanDays, setSpanDays] = useState<number>(() => read(KEYS.timeline, 365));
  const setSpan = (d: number) => { setSpanDays(d); write(KEYS.timeline, d); };

  const groups = groupByTitle(papers);
  const today = todayISO();

  if (groups.length === 0) {
    return (
      <EmptyState kicker="No papers tracked" title="Nothing in flight.">
        <p>
          Save a venue, then hit <strong>Progress</strong> on it to track a paper you are sending there.
          Papers aimed at more than one venue line up here on a single timeline, so a rebuttal window
          landing on top of another deadline is visible before it happens.
        </p>
        <p><button type="button" className="btn btn-secondary" onClick={browse}>Back to browse</button></p>
      </EmptyState>
    );
  }

  /** One lane per paper; every target venue's next deadline is a mark on it. */
  const lanes: Lane[] = groups.map((g) => ({
    id: g.key,
    name: g.title || 'Untitled',
    emptyNote: 'No deadline inside this window',
    marks: g.entries.flatMap(({ venueId }) => {
      const v = byId.get(venueId);
      if (!v?.nextDeadline) return [];
      return [{ iso: v.nextDeadline.effectiveDate, label: v.name, muted: v.nextDeadline.effectiveDate < today }];
    }),
  }));

  const totalEntries = groups.reduce((n, g) => n + g.entries.length, 0);

  return (
    <div className="cg-in">
      <section className="cg-rule" style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', padding: '20px 0 12px' }}>
        <h1 style={{ fontSize: 28, letterSpacing: '-0.02em', margin: 0 }}>Papers</h1>
        <span className="cg-muted" style={{ fontSize: 12 }}>
          {groups.length} {groups.length === 1 ? 'paper' : 'papers'} · {totalEntries}{' '}
          {totalEntries === 1 ? 'submission' : 'submissions'} · stored in this browser only
        </span>
      </section>

      <section className="cg-rule" style={{ padding: '18px 0 8px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <SmallLabel>What is coming at each paper</SmallLabel>
          <div style={{ marginLeft: 'auto' }}>
            <TimelineWindow spanDays={spanDays} setSpanDays={setSpan} />
          </div>
        </div>
        <Timeline lanes={lanes} spanDays={spanDays} gutter={190} />
      </section>

      {groups.map((g) => {
        const isOpen = open === g.key;
        return (
          <article key={g.key} className="cg-rule" style={{ padding: '14px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 17 }}>
                {g.title || <span className="cg-muted">Untitled paper</span>}
              </span>
              <span className="cg-pill" style={{ fontWeight: 400 }}>
                {g.entries.length} {g.entries.length === 1 ? 'venue' : 'venues'}
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginLeft: 'auto', fontSize: 12 }}
                onClick={() => setOpen((o) => (o === g.key ? null : g.key))}
                aria-expanded={isOpen}
              >
                {isOpen ? <ChevronUp size={ICON} /> : <ChevronDown size={ICON} />}
                {isOpen ? 'Done' : 'Edit'}
              </button>
            </div>

            {/* Collapsed: one line per venue, so the state of the whole paper reads at a glance. */}
            {!isOpen && (
              <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                {g.entries.map(({ venueId, index, paper }) => {
                  const v = byId.get(venueId);
                  return (
                    <div
                      key={`${venueId}-${index}`}
                      style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 240px) 1fr auto', gap: 12, alignItems: 'center' }}
                    >
                      <div style={{ minWidth: 0 }}>
                        {v ? (
                          <button type="button" className="cg-namebtn" style={{ fontSize: 13 }} onClick={() => openDetail(v.id)}>
                            {v.name}
                          </button>
                        ) : (
                          <span className="cg-muted" style={{ fontSize: 13 }}>{venueId} — not in the index</span>
                        )}
                        <div className="cg-muted" style={{ fontSize: 11 }}>
                          {v?.nextDeadline
                            ? `${v.nextDeadline.stage} · ${fmtDate(v.nextDeadline.effectiveDate)}`
                            : v?.cycleClosed
                              ? 'Cycle closed'
                              : 'No dates published'}
                        </div>
                      </div>

                      <StageBar
                        stages={data.taxonomy.paperStages}
                        current={paper.stage}
                        onPick={(stage) => setPapers((prev) => updatePaper(prev, venueId, index, { stage }))}
                        compact
                      />

                      <span className="cg-muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                        {paper.stage} · {paper.outcome}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {isOpen && (
              <div className="cg-in" style={{ paddingTop: 14, marginTop: 12, borderTop: '1px solid var(--color-divider)' }}>
                {g.entries.map(({ venueId, index, paper }) => (
                  <PaperEditor
                    key={`${venueId}-${index}`}
                    paper={paper}
                    taxonomy={data.taxonomy}
                    context={byId.get(venueId)?.name ?? venueId}
                    onChange={(patch) => setPapers((prev) => updatePaper(prev, venueId, index, patch))}
                    onRemove={() => setPapers((prev) => removePaper(prev, venueId, index))}
                  />
                ))}
                {/* Aiming the same paper at another venue is the common next move, and it
                    only makes sense for venues already saved — hence the select. */}
                <AddTarget
                  exclude={g.entries.map((e) => e.venueId)}
                  options={saved.flatMap((id) => { const v = byId.get(id); return v ? [{ id: v.id, name: v.name }] : []; })}
                  onAdd={(venueId) =>
                    setPapers((prev) => {
                      const next = addPaper(prev, venueId, data.taxonomy);
                      const list = next[venueId]!;
                      return updatePaper(next, venueId, list.length - 1, { title: g.title });
                    })
                  }
                />
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function AddTarget({
  options,
  exclude,
  onAdd,
}: {
  options: { id: string; name: string }[];
  exclude: string[];
  onAdd: (venueId: string) => void;
}) {
  const available = options.filter((o) => !exclude.includes(o.id));
  if (available.length === 0) return null;

  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span className="cg-muted">Also send it to</span>
      <select
        className="input"
        value=""
        aria-label="Add another target venue for this paper"
        onChange={(e) => { if (e.target.value) onAdd(e.target.value); }}
        style={{ fontSize: 12, minHeight: 30, maxWidth: 280 }}
      >
        <option value="">+ another venue</option>
        {available.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </label>
  );
}
