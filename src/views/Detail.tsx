import { fmtDate, fmtRange, relative } from '../lib/dates';
import { icsHref } from '../lib/ics';
import { AcceptanceChart, AcceptanceText, ConfidenceNote, EmptyState, Label, SmallLabel, place } from '../components/Bits';
import { Facts } from '../components/ResultRow';
import type { ViewProps } from './shared';

interface Props extends ViewProps {
  id: string | null;
  back: () => void;
}

export default function Detail({ id, back, byId, data, saved, compare, toggleSaved, toggleCompare, openDetail }: Props) {
  const v = id ? byId.get(id) : undefined;

  if (!v) {
    return (
      <EmptyState kicker="Not found" title="No venue with that id.">
        <p>
          The link may point at a record that has since been removed, or at an id that never shipped.
          Ids are permanent by policy, so this usually means the record is in{' '}
          <code>data/venues.pending.json</code> waiting on a missing field.
        </p>
        <p><button type="button" className="btn btn-secondary" onClick={back}>Back to browse</button></p>
      </EmptyState>
    );
  }

  const ics = icsHref(v);
  const displayed = Object.entries(data.taxonomy.rankingSources).filter(([k, s]) => !k.startsWith('$') && s.displayed);

  return (
    <div className="cg-in">
      <div style={{ padding: '14px 0' }}>
        <button type="button" className="btn btn-ghost" onClick={back} style={{ fontSize: 12 }}>← Back</button>
      </div>

      <section className="cg-rule" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 32, paddingBottom: 26 }}>
        <div>
          <div className="cg-muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {v.kind === 'workshop' ? `Workshop${v.hostName ? ` · co-located with ${v.hostName}` : ''}` : 'Conference'}
          </div>
          <h1 style={{ fontSize: 44, letterSpacing: '-0.03em', margin: '6px 0 8px' }}>{v.name}</h1>
          <p style={{ fontSize: 15, maxWidth: '52ch', margin: '0 0 16px', lineHeight: 1.5 }}>{v.fullName}</p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 16 }}>
            {v.topics.map((t) => (
              <span key={t} className={v.overlap.includes(t) ? 'tag tag-accent' : 'tag tag-neutral'} style={{ fontSize: 11 }}>{t}</span>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button type="button" className="btn btn-primary" onClick={() => toggleSaved(v.id)} style={{ fontSize: 13 }}>
              {saved.includes(v.id) ? 'Saved ✓' : 'Save to watchlist'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => toggleCompare(v.id)} style={{ fontSize: 13 }}>
              {compare.includes(v.id) ? 'Comparing ✓' : 'Compare'}
            </button>
            {ics && <a className="btn btn-secondary" href={ics} download={`${v.id}-deadline.ics`} style={{ fontSize: 13 }}>Add to calendar</a>}
            {v.links?.cfp && <a className="btn btn-ghost" href={v.links.cfp} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>Call for papers</a>}
            {v.links?.website && <a className="btn btn-ghost" href={v.links.website} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>Website</a>}
          </div>
        </div>

        <aside style={{ borderLeft: '2px solid var(--color-divider)', paddingLeft: 24 }}>
          {v.nextDeadline ? (
            <>
              <SmallLabel>Next deadline</SmallLabel>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 26, margin: '6px 0 2px' }}>
                {v.nextDeadline.stage}
              </div>
              <div style={{ fontSize: 14 }}>
                {fmtDate(v.nextDeadline.effectiveDate)} ({v.nextDeadline.timezone ?? 'AoE'})
              </div>
              <div style={{ color: 'var(--color-accent-700)', fontSize: 13, marginTop: 2 }}>
                {relative(v.daysLeft ?? 0)}
              </div>
            </>
          ) : (
            <>
              <SmallLabel>Next deadline</SmallLabel>
              <div style={{ fontSize: 14, marginTop: 6 }}>
                {v.cycleClosed ? 'Cycle closed — every published deadline has passed.' : 'No dates published for this cycle.'}
              </div>
            </>
          )}

          <div style={{ marginTop: 20 }}>
            <Facts
              rows={[
                ['Dates', fmtRange(v.event.start, v.event.end)],
                ['Location', place(v.location)],
                ['Format', v.location.format],
                ['Registration', v.registration?.fee],
                ['Publisher', v.review.publisher],
                ['Open access', v.review.openAccess],
                ['Acceptance', v.acceptance.latestPct === null ? 'not published' : `${v.acceptance.latestPct}%`],
              ]}
            />
          </div>
        </aside>
      </section>

      {v.integrityFlag && (
        <section className="cg-rule" style={{ background: 'var(--color-accent-100)', margin: '0 -20px', padding: '16px 20px' }}>
          <Label style={{ color: 'var(--color-accent-800)' }}>⚑ {v.integrityFlag.level}</Label>
          <p style={{ fontSize: 13, color: 'var(--color-accent-800)', maxWidth: '70ch', lineHeight: 1.6 }}>{v.integrityFlag.note}</p>
          <div style={{ fontSize: 11, color: 'var(--color-accent-800)' }}>
            Last checked {v.integrityFlag.reviewed}
            {v.integrityFlag.sources?.length ? ' · ' : ''}
            {v.integrityFlag.sources?.map((s, i) => (
              <a key={i} href={s} target="_blank" rel="noreferrer" style={{ marginRight: 8 }}>source {i + 1}</a>
            ))}
          </div>
        </section>
      )}

      <section className="cg-rule cg-cols" style={{ padding: '22px 0' }}>
        <div>
          <SmallLabel style={{ marginBottom: 10 }}>Deadline chain</SmallLabel>
          {v.deadlines.length === 0 ? (
            <div className="cg-muted" style={{ fontSize: 12 }}>
              This venue publishes no itemised dates. The record carries its event dates only.
            </div>
          ) : (
            v.deadlines.map((d, i) => (
              <div key={i} style={{ fontSize: 13, marginBottom: 7, lineHeight: 1.5 }}>
                <span className="cg-muted">{d.stage}</span>{' · '}
                {d.extendedTo ? (
                  <>
                    <s className="cg-muted">{fmtDate(d.date)}</s>{' '}
                    <span style={{ color: 'var(--color-accent-700)' }}>{fmtDate(d.extendedTo)}</span>
                    {d.extensionNote && <div style={{ fontSize: 11, color: 'var(--color-accent-700)' }}>{d.extensionNote}</div>}
                  </>
                ) : (
                  fmtDate(d.date)
                )}
              </div>
            ))
          )}
        </div>

        <div>
          <SmallLabel style={{ marginBottom: 10 }}>Rankings</SmallLabel>
          <table className="table" style={{ fontSize: 12 }}>
            <thead>
              <tr><th>Source</th><th>Value</th><th>Assessed</th></tr>
            </thead>
            <tbody>
              {displayed.map(([key, src]) => (
                <tr key={key}>
                  <td>{src.label}</td>
                  <td>{v.rankings[key as keyof typeof v.rankings] || '—'}</td>
                  <td className="cg-muted">{src.assessedLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <SmallLabel style={{ marginBottom: 10 }}>Review process</SmallLabel>
          <Facts
            rows={[
              ['Blinding', [v.review.blinding, v.review.blindingNote].filter(Boolean).join(' — ')],
              ['Rebuttal', v.review.rebuttal],
              ['Page limit', v.review.pageLimit],
            ]}
          />
          <div style={{ marginTop: 14 }}>
            <SmallLabel style={{ marginBottom: 8 }}>Acceptance history</SmallLabel>
            <AcceptanceChart history={v.acceptance.history} />
            <div style={{ fontSize: 12, marginTop: 6 }}><AcceptanceText pct={v.acceptance.latestPct} /></div>
          </div>
        </div>
      </section>

      {v.coLocatedWorkshops?.length ? (
        <section className="cg-rule" style={{ padding: '22px 0' }}>
          <SmallLabel style={{ marginBottom: 10 }}>Co-located workshops</SmallLabel>
          <div className="cg-cols">
            {v.coLocatedWorkshops.map((w, i) => (
              <div key={i} className="card">
                <div className="card-title" style={{ fontSize: 14 }}>{w.name}</div>
                <div className="card-meta" style={{ fontSize: 12 }}>Deadline {fmtDate(w.deadline)}</div>
                {w.venueId && byId.has(w.venueId) && (
                  <button type="button" className="btn btn-ghost" onClick={() => openDetail(w.venueId!)} style={{ fontSize: 12, marginTop: 6 }}>
                    Open record
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {v.notes && (
        <section className="cg-rule" style={{ padding: '18px 0' }}>
          <SmallLabel style={{ marginBottom: 8 }}>Submitter notes</SmallLabel>
          <p style={{ fontSize: 13, maxWidth: '72ch', lineHeight: 1.65, margin: 0 }}>{v.notes}</p>
        </section>
      )}

      <section className="cg-muted" style={{ padding: '18px 0 40px', fontSize: 11, lineHeight: 1.6 }}>
        Verified {fmtDate(v.source.verifiedOn)}
        <ConfidenceNote venue={v} />
        {' · '}
        {v.source.urls.map((u, i) => (
          <a key={i} href={u} target="_blank" rel="noreferrer" style={{ marginRight: 8 }}>source {i + 1}</a>
        ))}
        <div style={{ marginTop: 6 }}>
          Record id <code>{v.id}</code>. Absence of an integrity flag is not an endorsement.
        </div>
      </section>
    </div>
  );
}
