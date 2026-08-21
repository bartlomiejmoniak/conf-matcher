import { useMemo } from 'react';
import { addMonths, fmtDate, fmtMonth, utc } from '../lib/dates';
import { Chip, SmallLabel } from './Bits';

/** One thing to plot: a deadline, a paper's target date, anything with a date and a name. */
export interface Mark {
  iso: string;
  label: string;
  /** Drawn hollow rather than filled — used for dates that have already passed. */
  muted?: boolean;
}

/** One row: a name in the gutter, and the marks to lay out against the scale. */
export interface Lane {
  id: string;
  name: string;
  marks: Mark[];
  onNameClick?: () => void;
  /** Shown in place of the marks when none fall inside the window. */
  emptyNote?: string;
}

/**
 * The shared deadline scale, extracted from Compare so the Papers view can plot against
 * exactly the same geometry.
 *
 * The span is measured in **days**, not months, because the window is user-configurable
 * down to an arbitrary day count. Month ticks are still what gets labelled — days are
 * unreadable across a year — so the tick interval widens with the span rather than being
 * fixed at "every second month", which only ever worked for an even month count.
 */
export function Timeline({
  lanes,
  spanDays,
  gutter = 150,
  laneHeight = 62,
}: {
  lanes: Lane[];
  spanDays: number;
  gutter?: number;
  laneHeight?: number;
}) {
  const scale = useMemo(() => {
    const now = new Date();
    const [y0, m0] = [now.getUTCFullYear(), now.getUTCMonth()];
    const startMs = Date.UTC(y0, m0, 1);
    const endMs = startMs + spanDays * 86_400_000;
    const span = endMs - startMs;

    // One label per month is right for a quarter; a year needs every second or third.
    const months = spanDays / 30.44;
    const step = months <= 7 ? 1 : months <= 18 ? 2 : 3;

    const ticks: { label: string; left: number }[] = [];
    for (let i = 0; ; i += step) {
      const [y, m] = addMonths(y0, m0, i);
      const ms = Date.UTC(y, m, 1);
      if (ms > endMs) break;
      ticks.push({ label: fmtMonth(y, m), left: ((ms - startMs) / span) * 100 });
    }

    return {
      startMs,
      endMs,
      inWindow: (iso: string) => utc(iso) >= startMs && utc(iso) < endMs,
      pct: (iso: string) => ((utc(iso) - startMs) / span) * 100,
      ticks,
    };
  }, [spanDays]);

  return (
    <div style={{ minWidth: 720 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `${gutter}px 1fr` }}>
        <div />
        <div style={{ position: 'relative', height: 18, borderBottom: '1px solid var(--color-divider)' }}>
          {scale.ticks.map((t) => (
            <div key={t.label} className="cg-muted" style={{ position: 'absolute', left: `${t.left}%`, fontSize: 10, whiteSpace: 'nowrap' }}>
              {t.label}
            </div>
          ))}
        </div>
      </div>

      {lanes.map((lane) => {
        const visible = lane.marks.filter((m) => scale.inWindow(m.iso));
        return (
          <div
            key={lane.id}
            style={{ display: 'grid', gridTemplateColumns: `${gutter}px 1fr`, height: laneHeight, borderBottom: '1px solid var(--color-divider)' }}
          >
            <div style={{ paddingRight: 12, paddingTop: 8 }}>
              {lane.onNameClick ? (
                <button type="button" className="cg-namebtn" style={{ fontSize: 13 }} onClick={lane.onNameClick}>
                  {lane.name}
                </button>
              ) : (
                <span style={{ fontSize: 13, fontFamily: 'var(--font-heading)', fontWeight: 800 }}>{lane.name}</span>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              {visible.map((m, i) => (
                <div key={`${m.iso}-${i}`} style={{ position: 'absolute', left: `${scale.pct(m.iso)}%`, top: 0, height: '100%' }}>
                  <div
                    style={{
                      width: 2,
                      height: '100%',
                      background: m.muted ? 'var(--color-neutral-400)' : 'var(--color-accent)',
                    }}
                  />
                  {/* Labels alternate 10/30px down so neighbouring marks do not collide.
                      The index is into the *visible* marks, so the stagger stays stable
                      as the window changes rather than shifting with what got filtered. */}
                  <div
                    className="cg-muted"
                    style={{ position: 'absolute', top: i % 2 === 0 ? 10 : 30, left: 4, fontSize: 9, whiteSpace: 'nowrap' }}
                  >
                    {m.label} · {fmtDate(m.iso)}
                  </div>
                </div>
              ))}

              {visible.length === 0 && (
                <div className="cg-muted" style={{ position: 'absolute', top: 20, fontSize: 11 }}>
                  {lane.emptyNote ?? (lane.marks.length ? 'Nothing inside this window' : 'No dates published')}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The offered spans, in days. Any positive count works — these are the shortcuts. */
export const SPAN_PRESETS = [
  { days: 90, label: '3 months' },
  { days: 180, label: '6 months' },
  { days: 365, label: '1 year' },
];

/** Preset chips plus a free day count, for a caller that owns the span in its own state. */
export function TimelineWindow({ spanDays, setSpanDays }: { spanDays: number; setSpanDays: (d: number) => void }) {
  const custom = !SPAN_PRESETS.some((p) => p.days === spanDays);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
      <SmallLabel style={{ marginRight: 2 }}>Window</SmallLabel>
      {SPAN_PRESETS.map((p) => (
        <Chip key={p.days} label={p.label} active={spanDays === p.days} onClick={() => setSpanDays(p.days)} />
      ))}
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
        <input
          type="number"
          className="input"
          min={7}
          max={3650}
          value={spanDays}
          aria-label="Timeline window in days"
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n) && n >= 7 && n <= 3650) setSpanDays(Math.round(n));
          }}
          style={{ width: 66, fontSize: 11, padding: '3px 5px', fontWeight: custom ? 800 : 400 }}
        />
        <span className="cg-muted">days</span>
      </label>
    </div>
  );
}
