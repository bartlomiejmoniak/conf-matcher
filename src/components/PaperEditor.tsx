import type { Taxonomy, TrackedPaper } from '../lib/types';
import { SmallLabel } from './Bits';
import { ICON_SM, X } from './Icons';

/**
 * The six-segment cumulative stage bar. Clicking a segment sets the stage and fills every
 * segment up to it, so the bar reads as progress rather than as a radio group.
 *
 * Stages come from taxonomy.json#/paperStages — the count is not baked in here.
 */
export function StageBar({
  stages,
  current,
  onPick,
  compact = false,
}: {
  stages: string[];
  current: string;
  onPick: (stage: string) => void;
  compact?: boolean;
}) {
  const currentIndex = stages.indexOf(current);

  return (
    <div style={{ display: 'flex', gap: 2 }} role="group" aria-label="Paper stage">
      {stages.map((stage, i) => {
        const filled = i <= currentIndex;
        return (
          <button
            key={stage}
            type="button"
            className="cg-stage"
            onClick={() => onPick(stage)}
            aria-pressed={filled}
            aria-label={stage}
            title={stage}
            style={{
              flex: 1,
              fontSize: compact ? 9 : 10,
              padding: compact ? '4px 3px' : '6px 4px',
              background: filled ? 'var(--color-accent)' : 'transparent',
              color: filled ? 'var(--color-bg)' : 'var(--color-text)',
            }}
          >
            {compact ? '' : stage}
          </button>
        );
      })}
    </div>
  );
}

/**
 * One tracked paper, editable. Shared by the Watchlist row expansion and the Papers view,
 * which both write into the same `cg.papers` store.
 */
export function PaperEditor({
  paper,
  taxonomy,
  onChange,
  onRemove,
  /** Shown after the title, naming which venue this entry targets. */
  context,
}: {
  paper: TrackedPaper;
  taxonomy: Taxonomy;
  onChange: (patch: Partial<TrackedPaper>) => void;
  onRemove: () => void;
  context?: string;
}) {
  return (
    <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--color-divider)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        <input
          className="input"
          value={paper.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Paper title"
          aria-label="Paper title"
          style={{ flex: '1 1 260px', minHeight: 30, fontSize: 13 }}
        />
        <span className="cg-muted" style={{ fontSize: 11 }}>
          {context ? `${context} · ` : ''}{paper.stage} · {paper.outcome}
        </span>
        <button type="button" className="btn btn-ghost" onClick={onRemove} style={{ fontSize: 11 }}>
          <X size={ICON_SM} />
          Remove
        </button>
      </div>

      <SmallLabel style={{ marginBottom: 6 }}>Stage</SmallLabel>
      <div style={{ marginBottom: 10 }}>
        <StageBar stages={taxonomy.paperStages} current={paper.stage} onPick={(stage) => onChange({ stage })} />
      </div>

      <SmallLabel style={{ marginBottom: 6 }}>Outcome</SmallLabel>
      <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
        {taxonomy.paperOutcomes.map((outcome) => (
          <button
            key={outcome}
            type="button"
            className="cg-chip"
            aria-pressed={paper.outcome === outcome}
            onClick={() => onChange({ outcome })}
          >
            {outcome}
          </button>
        ))}
      </div>

      <input
        className="input"
        value={paper.note}
        onChange={(e) => onChange({ note: e.target.value })}
        placeholder="Note — reviewer scores, rebuttal plan, anything"
        aria-label="Note"
        style={{ minHeight: 30, fontSize: 12 }}
      />
    </div>
  );
}
