import type { VenueView } from '../lib/types';
import { fmtDate, fmtRange } from '../lib/dates';
import { icsHref } from '../lib/ics';
import type { ViewProps } from '../views/shared';
import {
  AcceptanceChart,
  AcceptanceText,
  BandPill,
  ConfidenceNote,
  CountdownRail,
  DeadlineLine,
  IntegrityPill,
  RankingBadges,
  SmallLabel,
  hasRankings,
  place,
} from './Bits';

interface Props extends ViewProps {
  v: VenueView;
  expanded: boolean;
  onExpand: () => void;
}

export default function ResultRow({ v, expanded, onExpand, data, saved, compare, toggleSaved, toggleCompare, openDetail, trackedCount }: Props) {
  const tracked = trackedCount(v.id);
  const ics = icsHref(v);

  return (
    <article className="cg-row" style={{ padding: '14px 0' }}>
      <CountdownRail v={v} />

      <div className="cg-stack" style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <button type="button" className="cg-namebtn" onClick={() => openDetail(v.id)}>{v.name}</button>
          {v.kind === 'workshop' && (
            <span className="cg-muted" style={{ fontSize: 11 }}>
              Workshop{v.hostName ? ` · ${v.hostName}` : ''}
            </span>
          )}
          <BandPill band={v.band} overlap={v.overlap} />
          <IntegrityPill venue={v} />
          {tracked > 0 && (
            <span className="cg-pill" style={{ fontWeight: 400 }}>{tracked} paper{tracked > 1 ? 's' : ''} tracked</span>
          )}
        </div>

        <div style={{ fontSize: 13 }}>
          <DeadlineLine v={v} />
          <ConfidenceNote venue={v} />
          {v.tooEarly && (
            <span style={{ color: 'var(--color-accent-700)' }}> · too early for your ready-by date</span>
          )}
        </div>

        <div className="cg-muted" style={{ fontSize: 12 }}>
          {place(v.location)} · {fmtRange(v.event.start, v.event.end)} · {v.location.format}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 12, paddingTop: 2 }}>
          <RankingBadges venue={v} taxonomy={data.taxonomy} />
          {hasRankings(v, data.taxonomy) && <span className="cg-muted">·</span>}
          <AcceptanceText pct={v.acceptance.latestPct} />
        </div>
      </div>

      <div className="cg-actions">
        <button type="button" className="btn btn-secondary" onClick={() => toggleSaved(v.id)} aria-pressed={saved.includes(v.id)}>
          {saved.includes(v.id) ? 'Saved ✓' : 'Save'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => toggleCompare(v.id)} aria-pressed={compare.includes(v.id)}>
          {compare.includes(v.id) ? 'Comparing ✓' : 'Compare'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onExpand} aria-expanded={expanded}>
          {expanded ? 'Less ▲' : 'More ▼'}
        </button>
      </div>

      {expanded && (
        <div className="cg-in cg-cols" style={{ gridColumn: '1 / -1', paddingTop: 16, borderTop: '1px solid var(--color-divider)', marginTop: 12 }}>
          <div>
            <SmallLabel style={{ marginBottom: 8 }}>Cycle</SmallLabel>
            {v.deadlines.length === 0 ? (
              <div className="cg-muted" style={{ fontSize: 12 }}>No itemised dates published for this cycle.</div>
            ) : (
              v.deadlines.map((d, i) => (
                <div key={i} style={{ fontSize: 12, marginBottom: 5, lineHeight: 1.5 }}>
                  <span className="cg-muted">{d.stage}</span>{' · '}
                  {d.extendedTo ? (
                    <>
                      <s className="cg-muted">{fmtDate(d.date)}</s>{' '}
                      <span style={{ color: 'var(--color-accent-700)' }}>{fmtDate(d.extendedTo)}</span>
                      {d.extensionNote && (
                        <div style={{ fontSize: 11, color: 'var(--color-accent-700)' }}>{d.extensionNote}</div>
                      )}
                    </>
                  ) : (
                    fmtDate(d.date)
                  )}
                </div>
              ))
            )}
          </div>

          <div>
            <SmallLabel style={{ marginBottom: 8 }}>Review process</SmallLabel>
            <Facts
              rows={[
                ['Blinding', [v.review.blinding, v.review.blindingNote].filter(Boolean).join(' — ')],
                ['Rebuttal', v.review.rebuttal],
                ['Page limit', v.review.pageLimit],
                ['Open access', v.review.openAccess],
                ['Publisher', v.review.publisher],
                ['Registration', v.registration?.fee],
              ]}
            />
          </div>

          <div>
            <SmallLabel style={{ marginBottom: 8 }}>Acceptance history</SmallLabel>
            <AcceptanceChart history={v.acceptance.history} />
          </div>

          <div>
            <SmallLabel style={{ marginBottom: 8 }}>Topics</SmallLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
              {v.topics.map((t) => (
                <span key={t} className={v.overlap.includes(t) ? 'tag tag-accent' : 'tag tag-neutral'} style={{ fontSize: 11 }}>{t}</span>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {ics && (
                <a className="btn btn-secondary" href={ics} download={`${v.id}-deadline.ics`} style={{ fontSize: 12 }}>
                  Add to calendar
                </a>
              )}
              <button type="button" className="btn btn-ghost" onClick={() => openDetail(v.id)} style={{ fontSize: 12 }}>
                Full record
              </button>
              {v.links?.cfp && <a className="btn btn-ghost" href={v.links.cfp} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>CFP</a>}
              {v.links?.website && <a className="btn btn-ghost" href={v.links.website} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>Site</a>}
            </div>
            {v.notes && <div className="cg-muted" style={{ fontSize: 11, marginTop: 10, lineHeight: 1.55 }}>{v.notes}</div>}
          </div>
        </div>
      )}
    </article>
  );
}

export function Facts({ rows }: { rows: [string, string | undefined | null][] }) {
  const present = rows.filter(([, v]) => v && v !== '—');
  if (!present.length) return <div className="cg-muted" style={{ fontSize: 12 }}>Not published.</div>;
  return (
    <dl style={{ margin: 0, fontSize: 12, lineHeight: 1.6 }}>
      {present.map(([k, val]) => (
        <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 3 }}>
          <dt className="cg-muted" style={{ minWidth: 92, flexShrink: 0 }}>{k}</dt>
          <dd style={{ margin: 0 }}>{val}</dd>
        </div>
      ))}
    </dl>
  );
}
