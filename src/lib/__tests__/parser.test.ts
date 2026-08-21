import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseQuery } from '../parser';
import type { Lexicon } from '../types';

const lexicon: Lexicon = JSON.parse(readFileSync('data/query-lexicon.json', 'utf8'));

/**
 * DATA_GUIDE: "when a model replaces the rule parser, keep this file as the test fixture —
 * every trigger listed must still resolve to the same filter, which is what stops a model
 * upgrade from silently regressing search."
 *
 * This suite IS that fixture. It walks query-lexicon.json rather than hard-coding cases, so
 * adding a phrasing to the lexicon extends the regression net with no test change.
 */
describe('every lexicon trigger resolves to its filter', () => {
  it.each(Object.entries(lexicon.topics).flatMap(([topic, triggers]) => triggers.map((t) => [t, topic] as const)))(
    'topic trigger %j → %j',
    (trigger, topic) => {
      expect(parseQuery(trigger, lexicon).patch.topics).toContain(topic);
    }
  );

  it.each(Object.entries(lexicon.blinding).flatMap(([b, triggers]) => triggers.map((t) => [t, b] as const)))(
    'blinding trigger %j → %j',
    (trigger, blinding) => {
      expect(parseQuery(trigger, lexicon).patch.blinding).toBe(blinding);
    }
  );

  it.each(Object.entries(lexicon.tiers).flatMap(([tier, triggers]) => triggers.map((t) => [t, tier] as const)))(
    'tier trigger %j → %j',
    (trigger, tier) => {
      expect(parseQuery(trigger, lexicon).patch.tiers).toContain(tier);
    }
  );

  it.each(Object.entries(lexicon.formats).flatMap(([f, triggers]) => triggers.map((t) => [t, f] as const)))(
    'format trigger %j → %j',
    (trigger, format) => {
      expect(parseQuery(trigger, lexicon).patch.formats).toContain(format);
    }
  );

  it.each(Object.entries(lexicon.kinds).flatMap(([k, triggers]) => triggers.map((t) => [t, k] as const)))(
    'kind trigger %j → %j',
    (trigger, kind) => {
      expect(parseQuery(trigger, lexicon).patch.kind).toBe(kind);
    }
  );

  it.each(lexicon.acceptanceBands.flatMap((b) => b.triggers.map((t) => [t, b.from, b.to] as const)))(
    'acceptance trigger %j → %d–%d',
    (trigger, from, to) => {
      const { patch } = parseQuery(trigger, lexicon);
      expect(patch.accFrom).toBe(from);
      expect(patch.accTo).toBe(to);
    }
  );
});

describe('the trace is never silent', () => {
  it('names every filter it set', () => {
    const r = parseQuery('double-blind CV venues', lexicon);
    expect(r.trace.map((t) => t.text)).toEqual(
      expect.arrayContaining(['topic: computer vision', 'review: double-blind'])
    );
  });

  it('reports what it ignored rather than pretending to understand', () => {
    const r = parseQuery('vision venues in Reykjavik', lexicon);
    expect(r.patch.topics).toContain('computer vision');
    expect(r.unread).toContain('reykjavik');
  });

  it('recognises nothing in an unparseable query, and says so', () => {
    const r = parseQuery('somewhere nice and warm', lexicon);
    expect(r.trace).toHaveLength(0);
    expect(r.unread.length).toBeGreaterThan(0);
  });
});

describe('deadline phrasing', () => {
  it('reads a relative window as the exact day count', () => {
    // It used to round up to the nearest 30/60/90 preset; the filter takes any day count.
    expect(parseQuery('anything in the next 45 days', lexicon).patch.window).toBe(45);
    expect(parseQuery('within 2 weeks', lexicon).patch.window).toBe(14);
  });

  it('turns "by <month>" into a before-date at the end of that month', () => {
    const before = parseQuery('CV venues I can hit by March', lexicon).patch.before!;
    expect(before).toMatch(/^\d{4}-03-31$/);
    expect(before >= new Date().toISOString().slice(0, 10)).toBe(true);
  });
});
