import { useState } from 'react';
import type { TrackedPaper } from '../lib/types';
import { fmtRange } from '../lib/dates';
import { icsHref } from '../lib/ics';
import { ConfidenceNote, CountdownRail, DeadlineLine, EmptyState, SmallLabel, place } from '../components/Bits';
import type { ViewProps } from './shared';
import { CalendarPlus, Globe, ICON, ListChecks, Plus, X } from '../components/Icons';

interface Props extends ViewProps {
  setPapers: (p: Record<string, TrackedPaper[]> | ((prev: Record<string, TrackedPaper[]>) => Record<string, TrackedPaper[]>)) => void;
  browse: () => void;
}

export default function Watchlist({ saved, byId, data, papers, setPapers, toggleSaved, openDetail, browse }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const venues = saved.map((id) => byId.get(id)).filter((v): v is NonNullable<typeof v> => Boolean(v));
  const orphaned = saved.filter((id) => !byId.has(id));

  if (venues.length === 0 && orphaned.length === 0) {
    return (
      <EmptyState kicker="Watchlist empty" title="Nothing saved yet.">
        <p>
          Hit <strong>Save</strong> on any result to keep its countdown here, and track how each paper you send
          it is going. Both live in this browser only — there is no account and nothing leaves the machine.
        </p>
        <p><button type="button" className="btn btn-secondary" onClick={browse}>Back to browse</button></p>
      </EmptyState>
    );
  }

  const update = (venueId: string, index: number, patch: Partial<TrackedPaper>) => {
    setPapers((prev) => {
      const list = [...(prev[venueId] ?? [])];
      const current = list[index];
      if (!current) return prev;
      list[index] = { ...current, ...patch };
      return { ...prev, [venueId]: list };
    });
  };

  const addPaper = (venueId: string) => {
    setPapers((prev) => ({
      ...prev,
      [venueId]: [...(prev[venueId] ?? []), { title: '', stage: data.taxonomy.paperStages[0]!, outcome: data.taxonomy.paperOutcomes[0]!, note: '' }],
    }));
    setOpen(venueId);
  };

  const removePaper = (venueId: string, index: number) => {
    setPapers((prev) => ({ ...prev, [venueId]: (prev[venueId] ?? []).filter((_, i) => i !== index) }));
  };

  return (
    <div className="cg-in">
      <section className="cg-rule" style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', padding: '20px 0 12px' }}>
        <h1 style={{ fontSize: 28, letterSpacing: '-0.02em', margin: 0 }}>Watchlist</h1>
        <span className="cg-muted" style={{ fontSize: 12 }}>{venues.length} saved · stored in this browser only</span>
      </section>

      {venues.map((v) => {
        const tracked = papers[v.id] ?? [];
        const ics = icsHref(v);
        const summary = tracked.length
          ? `${tracked.length} paper${tracked.length > 1 ? 's' : ''} · ${tracked[0]!.stage}${tracked.length > 1 ? ' +' : ''}`
          : null;

        return (
          <article key={v.id} className="cg-row" style={{ padding: '14px 0' }}>
            <CountdownRail v={v} />

            <div className="cg-stack" style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <button type="button" className="cg-namebtn" onClick={() => openDetail(v.id)}>{v.name}</button>
                {summary && <span className="cg-pill" style={{ fontWeight: 400 }}>{summary}</span>}
              </div>
              <div style={{ fontSize: 13 }}>
                <DeadlineLine v={v} />
                <ConfidenceNote venue={v} />
              </div>
              <div className="cg-muted" style={{ fontSize: 12 }}>
                {place(v.location)} · {fmtRange(v.event.start, v.event.end)}
              </div>
            </div>

            <div className="cg-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setOpen((o) => (o === v.id ? null : v.id))} aria-expanded={open === v.id}>
                <ListChecks size={ICON} />
                Progress{tracked.length ? ` (${tracked.length})` : ''}
              </button>
              {ics && (
                <a className="btn btn-secondary" href={ics} download={`${v.id}-deadline.ics`}>
                  <CalendarPlus size={ICON} />
                  Calendar
                </a>
              )}
              {v.links?.website && (
                <a className="btn btn-secondary" href={v.links.website} target="_blank" rel="noreferrer">
                  <Globe size={ICON} />
                  Website
                </a>
              )}
              <button type="button" className="btn btn-ghost" onClick={() => toggleSaved(v.id)}>
                <X size={ICON} />
                Remove
              </button>
            </div>

            {open === v.id && (
              <div className="cg-in" style={{ gridColumn: '1 / -1', paddingTop: 14, marginTop: 12, borderTop: '1px solid var(--color-divider)' }}>
                {tracked.length === 0 && (
                  <div className="cg-muted" style={{ fontSize: 12, marginBottom: 10 }}>
                    No papers tracked for {v.name} yet.
                  </div>
                )}

                {tracked.map((p, i) => {
                  const stageIndex = data.taxonomy.paperStages.indexOf(p.stage);
                  return (
                    <div key={i} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--color-divider)' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                        <input
                          className="input"
                          value={p.title}
                          onChange={(e) => update(v.id, i, { title: e.target.value })}
                          placeholder="Paper title"
                          aria-label="Paper title"
                          style={{ flex: '1 1 260px', minHeight: 30, fontSize: 13 }}
                        />
                        <span className="cg-muted" style={{ fontSize: 11 }}>{p.stage} · {p.outcome}</span>
                        <button type="button" className="btn btn-ghost" onClick={() => removePaper(v.id, i)} style={{ fontSize: 11 }}>Remove</button>
                      </div>

                      <SmallLabel style={{ marginBottom: 6 }}>Stage</SmallLabel>
                      <div style={{ display: 'flex', gap: 2, marginBottom: 10 }}>
                        {data.taxonomy.paperStages.map((stage, si) => (
                          <button
                            key={stage}
                            type="button"
                            onClick={() => update(v.id, i, { stage })}
                            aria-pressed={si <= stageIndex}
                            title={stage}
                            style={{
                              flex: 1,
                              font: 'inherit',
                              fontSize: 10,
                              padding: '6px 4px',
                              cursor: 'pointer',
                              textAlign: 'left',
                              border: '1px solid var(--color-divider)',
                              background: si <= stageIndex ? 'var(--color-accent)' : 'transparent',
                              color: si <= stageIndex ? 'var(--color-bg)' : 'var(--color-text)',
                            }}
                          >
                            {stage}
                          </button>
                        ))}
                      </div>

                      <SmallLabel style={{ marginBottom: 6 }}>Outcome</SmallLabel>
                      <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
                        {data.taxonomy.paperOutcomes.map((outcome) => (
                          <button
                            key={outcome}
                            type="button"
                            className="cg-chip"
                            aria-pressed={p.outcome === outcome}
                            onClick={() => update(v.id, i, { outcome })}
                          >
                            {outcome}
                          </button>
                        ))}
                      </div>

                      <input
                        className="input"
                        value={p.note}
                        onChange={(e) => update(v.id, i, { note: e.target.value })}
                        placeholder="Note — reviewer scores, rebuttal plan, anything"
                        aria-label="Note"
                        style={{ minHeight: 30, fontSize: 12 }}
                      />
                    </div>
                  );
                })}

                <button type="button" className="btn btn-secondary" onClick={() => addPaper(v.id)} style={{ fontSize: 12 }}>
                  <Plus size={ICON} />
                  Add a paper
                </button>
              </div>
            )}
          </article>
        );
      })}

      {orphaned.length > 0 && (
        <section style={{ padding: '20px 0', fontSize: 12 }} className="cg-muted">
          {orphaned.length} saved {orphaned.length === 1 ? 'id is' : 'ids are'} not in the current index
          ({orphaned.join(', ')}). Saved work is keyed on the venue id, so these will reappear if the records
          come back — nothing has been deleted.
        </section>
      )}
    </div>
  );
}
