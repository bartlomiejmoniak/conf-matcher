import type { ReactNode } from 'react';
import type { MatchBand, Taxonomy, Venue, VenueView } from '../lib/types';
import { fmtDate, relative } from '../lib/dates';
import { editionYear } from '../lib/matching';
import { Flag, ICON_SM } from './Icons';

export function Label({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return <div className="cg-label" style={style}>{children}</div>;
}

export function SmallLabel({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return <div className="cg-label-sm" style={style}>{children}</div>;
}

export function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="cg-chip" aria-pressed={active} onClick={onClick}>
      {label}
    </button>
  );
}

const BAND_TEXT: Record<MatchBand, string> = {
  strong: 'Strong match',
  partial: 'Partial match',
  weak: 'Weak match',
};

export function BandPill({ band, overlap }: { band: MatchBand; overlap: string[] }) {
  const title = overlap.length
    ? `Shares ${overlap.length} topic${overlap.length > 1 ? 's' : ''} with your paper: ${overlap.join(', ')}`
    : 'No topic overlap with your paper profile';
  return (
    <span className={band === 'strong' ? 'cg-pill cg-pill-accent' : 'cg-pill cg-pill-outline'} title={title}>
      {BAND_TEXT[band]}
    </span>
  );
}

/** Ranking badges. A value of "—" is dropped, and a source with displayed:false never renders. */
export function hasRankings(venue: Venue, taxonomy: Taxonomy): boolean {
  return Object.entries(taxonomy.rankingSources).some(
    ([key, src]) =>
      !key.startsWith('$') &&
      src.displayed &&
      venue.rankings[key as keyof Venue['rankings']] &&
      venue.rankings[key as keyof Venue['rankings']] !== '—'
  );
}

export function RankingBadges({ venue, taxonomy }: { venue: Venue; taxonomy: Taxonomy }) {
  const entries = Object.entries(taxonomy.rankingSources)
    .filter(([key, src]) => !key.startsWith('$') && src.displayed)
    .map(([key, src]) => [src.label, venue.rankings[key as keyof Venue['rankings']]] as const)
    .filter(([, value]) => value && value !== '—');

  if (!entries.length) return null;
  return (
    <>
      {entries.map(([label, value]) => (
        <span key={label} className="cg-pill" style={{ fontWeight: 400, textTransform: 'none' }}>
          <span className="cg-muted">{label}</span>
          <strong style={{ fontFamily: 'var(--font-heading)', fontWeight: 800 }}>{value}</strong>
        </span>
      ))}
    </>
  );
}

/**
 * "24.5% accepted (2025)", or an explicit statement that no figure is published.
 *
 * The year is not decoration. An acceptance rate is almost always the *previous* edition's
 * — the current one has not happened — and two shipping records quote a figure two
 * editions old. Rendered bare, every one of them reads as this year's. A gap of two or
 * more editions gets the same accent treatment as the other "read this before you rely on
 * it" states.
 */
export function AcceptanceText({ venue }: { venue: Venue }) {
  const { latestPct, latestYear } = venue.acceptance;
  if (latestPct === null) return <span className="cg-muted">acceptance not published</span>;

  const edition = editionYear(venue);
  const gap = edition !== null && latestYear !== null ? edition - latestYear : 0;

  return (
    <span>
      {latestPct}% accepted
      {latestYear !== null && (
        <span
          className={gap >= 2 ? undefined : 'cg-muted'}
          style={gap >= 2 ? { color: 'var(--color-accent-700)' } : undefined}
          title={
            gap >= 2
              ? `${latestYear} figure — ${gap} editions before this one. The venue has published nothing more recent.`
              : `The ${latestYear} edition's published figure.`
          }
        >
          {' '}({latestYear})
        </span>
      )}
    </span>
  );
}

/** projected / provisional dates are labelled; confirmed ones say nothing. */
export function ConfidenceNote({ venue }: { venue: Venue }) {
  const c = venue.source.confidence ?? 'confirmed';
  if (c === 'confirmed') return null;
  const text =
    c === 'projected'
      ? 'projected from previous years — not on an official CFP'
      : 'provisional — announced but not on a paged CFP';
  return <span className="cg-muted"> · {text}</span>;
}

export function IntegrityPill({ venue }: { venue: Venue }) {
  if (!venue.integrityFlag) return null;
  return (
    <span className="cg-pill cg-pill-outline" title={venue.integrityFlag.note}>
      <Flag size={ICON_SM} /> {venue.integrityFlag.level}
    </span>
  );
}

/** The left countdown rail: number of days, or an explicit closed / no-dates cell. */
export function CountdownRail({ v }: { v: VenueView }) {
  if (v.daysLeft === null) {
    return (
      <div className="cg-rail cg-rail-closed">
        <div style={{ fontSize: 11, lineHeight: 1.3 }}>{v.cycleClosed ? 'Cycle closed' : 'No dates published'}</div>
      </div>
    );
  }
  return (
    <div className={v.daysLeft <= 45 ? 'cg-rail cg-rail-urgent' : 'cg-rail'}>
      <div className="cg-rail-num">{v.daysLeft}</div>
      <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>Days left</div>
    </div>
  );
}

/** "Paper submission · 24 Sep 2026 (AoE) · in 86 days" */
export function DeadlineLine({ v }: { v: VenueView }) {
  if (!v.nextDeadline) {
    return (
      <span className="cg-muted">
        {v.cycleClosed ? 'Every published deadline has passed' : 'No deadline dates published for this cycle'}
      </span>
    );
  }
  const d = v.nextDeadline;
  return (
    <>
      <strong style={{ fontFamily: 'var(--font-heading)', fontWeight: 800 }}>{d.stage}</strong>
      {' · '}
      {d.extendedTo ? (
        <>
          <s className="cg-muted">{fmtDate(d.date)}</s> <span style={{ color: 'var(--color-accent-700)' }}>{fmtDate(d.extendedTo)}</span>
        </>
      ) : (
        fmtDate(d.date)
      )}
      {` (${d.timezone ?? 'AoE'})`}
      <span className="cg-muted"> · {relative(v.daysLeft ?? 0)}</span>
    </>
  );
}

/** "Lyon, France" — an unpublished country is dropped rather than printed as "—". */
export function place(loc: { city: string; country: string }): string {
  return loc.country && loc.country !== '—' ? `${loc.city}, ${loc.country}` : loc.city;
}

export function EmptyState({ title, kicker, children }: { title: string; kicker: string; children: ReactNode }) {
  return (
    <div style={{ padding: '48px 0', maxWidth: '60ch' }}>
      <div className="cg-label" style={{ color: 'var(--color-accent)', marginBottom: 10 }}>{kicker}</div>
      <h1 style={{ fontSize: 34, letterSpacing: '-0.03em', margin: '0 0 12px' }}>{title}</h1>
      <div style={{ fontSize: 14, lineHeight: 1.65 }}>{children}</div>
    </div>
  );
}

/** Acceptance history, scaled to the venue's own maximum. */
export function AcceptanceChart({ history }: { history?: { year: number; pct: number }[] }) {
  if (!history?.length) return <div className="cg-muted" style={{ fontSize: 12 }}>No published history.</div>;
  const max = Math.max(...history.map((h) => h.pct));
  return (
    <div>
      <div className="cg-bars">
        {history.map((h) => (
          <div key={h.year} style={{ textAlign: 'left' }} title={`${h.year}: ${h.pct}%`}>
            <div className="cg-bar" style={{ height: Math.max(2, (h.pct / max) * 56) }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        {history.map((h) => (
          <div key={h.year} className="cg-muted" style={{ width: 16, fontSize: 9, textAlign: 'left' }}>
            {String(h.year).slice(2)}
          </div>
        ))}
      </div>
    </div>
  );
}
