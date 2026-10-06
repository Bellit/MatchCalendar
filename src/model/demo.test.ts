import { describe, expect, it } from 'vitest';
import { findConflicts } from '../logic/conflicts';
import { buildDemoData } from './demo';

describe('buildDemoData', () => {
  it('genera coincidencias en ambos grupos de ejemplo', () => {
    const d = buildDemoData();
    const [seniors, family] = d.groups.map((g) => findConflicts(g, d));
    expect(seniors).toHaveLength(1);
    expect(seniors[0].overlapMinutes).toBe(90);
    expect(family).toHaveLength(3);
  });
});
