import { addMonths, fmtDate, fmtMonth, fmtRange, utc } from '../lib/dates';
import { effectiveDate } from '../lib/matching';
import { AcceptanceText, EmptyState, SmallLabel, place } from '../components/Bits';
import type { ViewProps } from './shared';

interface Props extends ViewProps {
  browse: () => void;
}

const MONTHS_SHOWN = 16;

export default function Compare({ compare, byId, data, toggleCompare, openDetail, browse }: Props) {
  const venues = compare.map((id) => byId.get(id)).filter((v): v is NonNullable<typeof v> => Boolean(v));

  if (venues.length === 0) {
    return (
      <EmptyState kicker="Nothing to compare" title="Pick two to four venues.">
        <p>
          Hit <strong>Compare</strong> on any result to add it here. The timeline lines their whole deadline
          chains up on one scale, which is the quickest way to see whether two cycles actually collide.
        </p>
        <p><button type="button" className="btn btn-secondary" onClick={browse}>Back to browse</button></p>
      </EmptyState>
    );
  }

  // 16 months from the start of the current month
  const now = new Date();
  const [y0, m0] = [now.getUTCFullYear(), now.getUTCMonth()];
  const startMs = Date.UTC(y0, m0, 1);
  const [yEnd, mEnd] = addMonths(y0, m0, MONTHS_SHOWN);
  const endMs = Date.UTC(yEnd, mEnd, 1);
  const span = endMs - startMs;
  const pct = (iso: string) => ((utc(iso) - startMs) / span) * 100;

  const ticks = Array.from({ length: MONTHS_SHOWN / 2 + 1 }, (_, i) => {
    const [y, m] = addMonths(y0, m0, i * 2);
    return { label: fmtMonth(y, m), left: ((Date.UTC(y, m, 1) - startMs) / span) * 100 };
  });

  const displayed = Object.entries(data.taxonomy.rankingSources).filter(([k, s]) => !k.startsWith('$') && s.displayed);
  const sharedTopics = venues.reduce<string[]>(
    (acc, v, i) => (i === 0 ? v.topics : acc.filter((t) => v.topics.includes(t))),
    []
  );

  return (
    <div className="cg-in">
      <section className="cg-rule" style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', padding: '20px 0 12px' }}>
        <h1 style={{ fontSize: 28, letterSpacing: '-0.02em', margin: 0 }}>Comparing {venues.length}</h1>
        <span className="cg-muted" style={{ fontSize: 12 }}>
          Up to four at a time — selecting a fifth drops the oldest.
        </span>
      </section>

      {/* ── Shared timeline ─────────────────────────────────────────────── */}
      <section className="cg-rule" style={{ padding: '18px 0 8px', overflowX: 'auto' }}>
        <SmallLabel style={{ marginBottom: 14 }}>Deadline timeline · next {MONTHS_SHOWN} months</SmallLabel>
        <div style={{ minWidth: 720 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr' }}>
            <div />
            <div style={{ position: 'relative', height: 18, borderBottom: '1px solid var(--color-divider)' }}>
              {ticks.map((t) => (
                <div key={t.label} className="cg-muted" style={{ position: 'absolute', left: `${t.left}%`, fontSize: 10, whiteSpace: 'nowrap' }}>
                  {t.label}
                </div>
              ))}
            </div>
          </div>

          {venues.map((v) => (
            <div key={v.id} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', height: 62, borderBottom: '1px solid var(--color-divider)' }}>
              <div style={{ paddingRight: 12, paddingTop: 8 }}>
                <button type="button" className="cg-namebtn" style={{ fontSize: 13 }} onClick={() => openDetail(v.id)}>{v.name}</button>
              </div>
              <div style={{ position: 'relative' }}>
                {v.deadlines
                  .map((d) => ({ d, iso: effectiveDate(d) }))
                  .filter(({ iso }) => utc(iso) >= startMs && utc(iso) < endMs)
                  .map(({ d, iso }, i) => (
                    <div key={i} style={{ position: 'absolute', left: `${pct(iso)}%`, top: 0, height: '100%' }}>
                      <div style={{ width: 2, height: '100%', background: 'var(--color-accent)' }} />
                      {/* labels alternate 10/30px down so neighbouring ticks do not collide */}
                      <div
                        className="cg-muted"
                        style={{ position: 'absolute', top: i % 2 === 0 ? 10 : 30, left: 4, fontSize: 9, whiteSpace: 'nowrap' }}
                      >
                        {d.stage} · {fmtDate(iso)}
                      </div>
                    </div>
                  ))}
                {v.deadlines.every(({ ...d }) => utc(effectiveDate(d)) < startMs || utc(effectiveDate(d)) >= endMs) && (
                  <div className="cg-muted" style={{ position: 'absolute', top: 20, fontSize: 11 }}>
                    {v.deadlines.length ? 'No deadline inside this window' : 'No dates published'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Fact table ──────────────────────────────────────────────────── */}
      <section style={{ padding: '22px 0 40px', overflowX: 'auto' }}>
        <table className="table" style={{ fontSize: 12, minWidth: 640 }}>
          <thead>
            <tr>
              <th style={{ width: 150 }} />
              {venues.map((v) => (
                <th key={v.id}>
                  <button type="button" className="cg-namebtn" style={{ fontSize: 13 }} onClick={() => openDetail(v.id)}>{v.name}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row label="Next deadline" venues={venues} cell={(v) =>
              v.nextDeadline ? `${v.nextDeadline.stage} · ${fmtDate(v.nextDeadline.effectiveDate)}` : v.cycleClosed ? 'Cycle closed' : 'Not published'
            } />
            {displayed.map(([key, src]) => (
              <Row key={key} label={src.label} venues={venues} cell={(v) => v.rankings[key as keyof typeof v.rankings] || '—'} />
            ))}
            <Row label="Acceptance" venues={venues} cell={(v) => <AcceptanceText pct={v.acceptance.latestPct} />} />
            <Row label="Review" venues={venues} cell={(v) => [v.review.blinding, v.review.rebuttal].filter((x) => x && x !== '—').join(' · ') || '—'} />
            <Row label="Page limit" venues={venues} cell={(v) => v.review.pageLimit || '—'} />
            <Row label="Cost" venues={venues} cell={(v) => v.registration?.fee || '—'} />
            <Row label="Location" venues={venues} cell={(v) => `${place(v.location)} · ${v.location.format}`} />
            <Row label="Event dates" venues={venues} cell={(v) => fmtRange(v.event.start, v.event.end)} />
            <Row label="Topics" venues={venues} cell={(v) => (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {v.topics.map((t) => (
                  <span key={t} className={sharedTopics.includes(t) ? 'tag tag-accent' : 'tag tag-neutral'} style={{ fontSize: 10 }}>{t}</span>
                ))}
              </div>
            )} />
            <Row label="Integrity" venues={venues} cell={(v) => v.integrityFlag ? `⚑ ${v.integrityFlag.level}` : <span className="cg-muted">no flag recorded</span>} />
            <tr>
              <td className="cg-muted">Remove</td>
              {venues.map((v) => (
                <td key={v.id}>
                  <button type="button" className="btn btn-ghost" onClick={() => toggleCompare(v.id)} style={{ fontSize: 11 }}>Remove</button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        {sharedTopics.length > 0 && (
          <div className="cg-muted" style={{ fontSize: 11, marginTop: 10 }}>
            Accent tags are topics all {venues.length} share.
          </div>
        )}
      </section>
    </div>
  );
}

function Row({
  label,
  venues,
  cell,
}: {
  label: string;
  venues: ViewProps['views'];
  cell: (v: ViewProps['views'][number]) => React.ReactNode;
}) {
  return (
    <tr>
      <td className="cg-muted">{label}</td>
      {venues.map((v) => <td key={v.id}>{cell(v)}</td>)}
    </tr>
  );
}
