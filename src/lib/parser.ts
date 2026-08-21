import type { Filters, Lexicon, LocationFormat, Blinding, Kind } from './types';

/**
 * The plain-language bar. Substring rules over data/query-lexicon.json, with a visible
 * trace of everything it recognised and an honest note about what it ignored.
 *
 * When a model replaces this, keep two things: the trace (the parse is never silent) and
 * this lexicon as the regression fixture — every trigger here must still resolve to the
 * same filter, which is what stops a model upgrade from silently regressing search.
 */

export interface TraceToken {
  text: string;
  /** Which filter key the token set, so the chip below can be highlighted as machine-set. */
  key: keyof Filters;
}

export interface ParseResult {
  patch: Partial<Filters>;
  trace: TraceToken[];
  /** Words the parser did not recognise, verbatim. */
  unread: string[];
}

const hit = (q: string, triggers: string[]): string | null => triggers.find((t) => q.includes(t)) ?? null;

export function parseQuery(raw: string, lexicon: Lexicon): ParseResult {
  const q = raw.toLowerCase();
  const patch: Partial<Filters> = {};
  const trace: TraceToken[] = [];
  const consumed: string[] = [];

  const take = (trigger: string, text: string, key: keyof Filters) => {
    consumed.push(trigger);
    trace.push({ text, key });
  };

  // topics
  const topics: string[] = [];
  for (const [topic, triggers] of Object.entries(lexicon.topics)) {
    const t = hit(q, triggers);
    if (t) {
      topics.push(topic);
      take(t, `topic: ${topic}`, 'topics');
    }
  }
  if (topics.length) patch.topics = topics;

  // review blinding
  for (const [blinding, triggers] of Object.entries(lexicon.blinding)) {
    const t = hit(q, triggers);
    if (t) {
      patch.blinding = blinding as Blinding;
      take(t, `review: ${blinding}`, 'blinding');
      break;
    }
  }

  // ranking tiers
  const tiers: string[] = [];
  for (const [tier, triggers] of Object.entries(lexicon.tiers)) {
    const t = hit(q, triggers);
    if (t) {
      tiers.push(tier);
      take(t, `ranking: ${tier}`, 'tiers');
    }
  }
  if (tiers.length) patch.tiers = tiers;

  // event format
  const formats: LocationFormat[] = [];
  for (const [format, triggers] of Object.entries(lexicon.formats)) {
    const t = hit(q, triggers);
    if (t) {
      formats.push(format as LocationFormat);
      take(t, `format: ${format}`, 'formats');
    }
  }
  if (formats.length) patch.formats = formats;

  // conference vs workshop
  for (const [kind, triggers] of Object.entries(lexicon.kinds)) {
    const t = hit(q, triggers);
    if (t) {
      patch.kind = kind as Kind;
      take(t, `type: ${kind}s only`, 'kind');
      break;
    }
  }

  // acceptance bands
  for (const band of lexicon.acceptanceBands) {
    const t = hit(q, band.triggers);
    if (t) {
      patch.accFrom = band.from;
      patch.accTo = band.to;
      take(t, `acceptance: ${band.from}–${band.to}%`, 'accFrom');
      break;
    }
  }

  // deadline windows — "next 30 days", "within 3 months", "by March"
  const windowMatch = q.match(/(?:next|within|in)\s+(\d{1,3})\s*(day|week|month)/);
  if (windowMatch) {
    const n = Number(windowMatch[1]);
    const unit = windowMatch[2]!;
    const days = unit === 'day' ? n : unit === 'week' ? n * 7 : n * 30;
    // The window filter takes any day count, so this no longer rounds up to a preset.
    patch.window = days;
    take(windowMatch[0], `deadline within ${days} days`, 'window');
  } else {
    const byMonth = q.match(
      /\bby\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/
    );
    if (byMonth) {
      const monthIndex = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december',
      ].indexOf(byMonth[1]!);
      const now = new Date();
      let year = now.getUTCFullYear();
      if (monthIndex < now.getUTCMonth()) year += 1;
      // last day of that month
      const before = new Date(Date.UTC(year, monthIndex + 1, 0)).toISOString().slice(0, 10);
      patch.before = before;
      take(byMonth[0], `deadline on or before end of ${byMonth[1]} ${year}`, 'before');
    }
  }

  // what did it not read?
  const STOP = new Set([
    'a', 'an', 'and', 'the', 'i', 'me', 'my', 'can', 'for', 'to', 'of', 'in', 'on', 'at',
    'with', 'that', 'this', 'is', 'are', 'want', 'need', 'find', 'show', 'get', 'looking',
    'venues', 'venue', 'papers', 'paper', 'submit', 'submission', 'hit', 'by', 'or', 'where',
  ]);
  const unread = q
    .split(/[^a-z0-9*<>]+/)
    .filter(Boolean)
    .filter((w) => !STOP.has(w) && !/^\d+$/.test(w))
    .filter((w) => !consumed.some((c) => c.includes(w) || w.includes(c)));

  return { patch, trace, unread: [...new Set(unread)] };
}

export function traceNote(result: ParseResult): string {
  if (result.trace.length === 0) {
    return result.unread.length
      ? 'Nothing in that matched a filter. Set them by hand below, or rephrase.'
      : 'Nothing to read yet.';
  }
  if (result.unread.length === 0) return 'Everything in your query was read.';
  const shown = result.unread.slice(0, 6);
  return `Ignored: ${shown.join(', ')}${result.unread.length > shown.length ? '…' : ''}. Every chip below is editable.`;
}
