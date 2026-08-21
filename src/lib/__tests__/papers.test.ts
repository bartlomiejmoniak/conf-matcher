import { describe, expect, it } from 'vitest';
import { addPaper, groupByTitle, removePaper, updatePaper, type PaperStore } from '../papers';
import type { Taxonomy, TrackedPaper } from '../types';

const taxonomy = {
  paperStages: ['Drafting', 'Submitted', 'Under review'],
  paperOutcomes: ['Pending', 'Accepted', 'Rejected'],
} as Taxonomy;

const paper = (over: Partial<TrackedPaper> = {}): TrackedPaper => ({
  title: '',
  stage: 'Drafting',
  outcome: 'Pending',
  note: '',
  ...over,
});

describe('edits do not mutate the store', () => {
  it('replaces one entry and leaves the rest identical', () => {
    const before: PaperStore = { 'cvpr-2026': [paper({ title: 'A' }), paper({ title: 'B' })], 'iccv-2027': [paper()] };
    const after = updatePaper(before, 'cvpr-2026', 0, { stage: 'Submitted' });

    expect(after['cvpr-2026']![0]!.stage).toBe('Submitted');
    expect(before['cvpr-2026']![0]!.stage).toBe('Drafting');
    expect(after['iccv-2027']).toBe(before['iccv-2027']);
  });

  it('ignores an index or venue that is not there', () => {
    const store: PaperStore = { 'cvpr-2026': [paper()] };
    expect(updatePaper(store, 'cvpr-2026', 9, { stage: 'Submitted' })).toBe(store);
    expect(updatePaper(store, 'nope-2026', 0, { stage: 'Submitted' })).toBe(store);
  });

  it('seeds a new paper at the first stage and outcome', () => {
    const after = addPaper({}, 'cvpr-2026', taxonomy);
    expect(after['cvpr-2026']).toEqual([{ title: '', stage: 'Drafting', outcome: 'Pending', note: '' }]);
  });

  it('removes by index without shifting other venues', () => {
    const before: PaperStore = { 'cvpr-2026': [paper({ title: 'A' }), paper({ title: 'B' })] };
    expect(removePaper(before, 'cvpr-2026', 0)['cvpr-2026']!.map((p) => p.title)).toEqual(['B']);
  });
});

describe('grouping the store by paper rather than by venue', () => {
  it('collects one title aimed at several venues into a single group', () => {
    const store: PaperStore = {
      'cvpr-2026': [paper({ title: 'Occlusion-aware tracking' })],
      'iccv-2027': [paper({ title: 'occlusion-aware TRACKING' })],
    };
    const groups = groupByTitle(store);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.entries.map((e) => e.venueId).sort()).toEqual(['cvpr-2026', 'iccv-2027']);
  });

  it('matches on trimmed, case-insensitive titles', () => {
    const store: PaperStore = {
      'a-2026': [paper({ title: '  Spectral methods ' })],
      'b-2026': [paper({ title: 'spectral methods' })],
    };
    expect(groupByTitle(store)).toHaveLength(1);
  });

  it('never merges untitled drafts, which have nothing to match on', () => {
    const store: PaperStore = { 'a-2026': [paper(), paper()], 'b-2026': [paper()] };
    const groups = groupByTitle(store);
    expect(groups).toHaveLength(3);
    expect(groups.every((g) => g.entries.length === 1)).toBe(true);
  });

  it('puts titled work first, then sorts alphabetically', () => {
    const store: PaperStore = {
      'a-2026': [paper(), paper({ title: 'Zebra' })],
      'b-2026': [paper({ title: 'Alpha' })],
    };
    expect(groupByTitle(store).map((g) => g.title)).toEqual(['Alpha', 'Zebra', '']);
  });

  it('keeps the index each entry came from, so an edit lands on the right paper', () => {
    const store: PaperStore = { 'a-2026': [paper({ title: 'X' }), paper({ title: 'Y' })] };
    const y = groupByTitle(store).find((g) => g.title === 'Y')!.entries[0]!;
    expect(y.index).toBe(1);

    const after = updatePaper(store, y.venueId, y.index, { outcome: 'Accepted' });
    expect(after['a-2026']!.map((p) => p.outcome)).toEqual(['Pending', 'Accepted']);
  });
});
