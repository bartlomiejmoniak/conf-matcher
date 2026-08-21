import { useState } from 'react';
import { fmtDate, fmtRange, todayISO } from '../lib/dates';
import { effectiveDate } from '../lib/matching';
import { Timeline, TimelineWindow, type Lane } from '../components/Timeline';
import { KEYS, read, write } from '../lib/storage';
import { AcceptanceText, EmptyState, SmallLabel, place } from '../components/Bits';
import type { ViewProps } from './shared';
import { Flag, ICON_SM, X } from '../components/Icons';

interface Props extends ViewProps {
  browse: () => void;
}

export default function Compare({ compare, byId, data, toggleCompare, openDetail, browse }: Props) {
  const venues = compare.map((id) => byId.get(id)).filter((v): v is NonNullable<typeof v> => Boolean(v));
  const [spanDays, setSpanDays] = useState<number>(() => read(KEYS.timeline, 365));
  const setSpan = (d: number) => { setSpanDays(d); write(KEYS.timeline, d); };

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

  const today = todayISO();
  const lanes: Lane[] = venues.map((v) => ({
    id: v.id,
    name: v.name,
    onNameClick: () => openDetail(v.id),
    emptyNote: v.deadlines.length ? 'No deadline inside this window' : 'No dates published',
    marks: v.deadlines.map((d) => {
      const iso = effectiveDate(d);
      return { iso, label: d.stage, muted: iso < today };
    }),
  }));

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <SmallLabel>Deadline timeline</SmallLabel>
          <div style={{ marginLeft: 'auto' }}>
            <TimelineWindow spanDays={spanDays} setSpanDays={setSpan} />
          </div>
        </div>
        <Timeline lanes={lanes} spanDays={spanDays} />
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
            <Row label="Acceptance" venues={venues} cell={(v) => <AcceptanceText venue={v} />} />
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
            <Row label="Integrity" venues={venues} cell={(v) => v.integrityFlag ? <><Flag size={ICON_SM} /> {v.integrityFlag.level}</> : <span className="cg-muted">no flag recorded</span>} />
            <tr>
              <td className="cg-muted">Remove</td>
              {venues.map((v) => (
                <td key={v.id}>
                  <button type="button" className="btn btn-ghost" onClick={() => toggleCompare(v.id)} style={{ fontSize: 11 }}>
                    <X size={ICON_SM} />
                    Remove
                  </button>
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
