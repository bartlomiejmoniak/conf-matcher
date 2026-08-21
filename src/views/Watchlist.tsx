import { useState } from 'react';
import type { TrackedPaper } from '../lib/types';
import { fmtRange } from '../lib/dates';
import { icsHref } from '../lib/ics';
import { ConfidenceNote, CountdownRail, DeadlineLine, EmptyState, place } from '../components/Bits';
import type { ViewProps } from './shared';
import { CalendarPlus, Globe, ICON, ListChecks, Plus, X } from '../components/Icons';
import { PaperEditor } from '../components/PaperEditor';
import { addPaper, removePaper, updatePaper } from '../lib/papers';

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

  const update = (venueId: string, index: number, patch: Partial<TrackedPaper>) =>
    setPapers((prev) => updatePaper(prev, venueId, index, patch));

  const add = (venueId: string) => {
    setPapers((prev) => addPaper(prev, venueId, data.taxonomy));
    setOpen(venueId);
  };

  const remove = (venueId: string, index: number) => setPapers((prev) => removePaper(prev, venueId, index));

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

                {tracked.map((p, i) => (
                  <PaperEditor
                    key={i}
                    paper={p}
                    taxonomy={data.taxonomy}
                    onChange={(patch) => update(v.id, i, patch)}
                    onRemove={() => remove(v.id, i)}
                  />
                ))}

                <button type="button" className="btn btn-secondary" onClick={() => add(v.id)} style={{ fontSize: 12 }}>
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
