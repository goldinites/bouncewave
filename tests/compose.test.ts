import { describe, expect, it } from 'vitest';
import { additive, cycle, euclid } from '@/audio/music/compose';

const hits = (rhythm: boolean[]) => rhythm.map((hit) => (hit ? 'x' : '.')).join('');

describe('compose', () => {
  it('spreads Euclidean pulses as evenly as they go', () => {
    expect(hits(euclid(4, 16))).toBe('x...x...x...x...');
    expect(hits(euclid(3, 8))).toBe('x..x..x.'); // the tresillo
    expect(euclid(5, 16).filter(Boolean)).toHaveLength(5);
    expect(euclid(7, 16).filter(Boolean)).toHaveLength(7);
    expect(hits(euclid(3, 8, 1))).not.toBe(hits(euclid(3, 8)));
  });

  it('turns a cell over the bars without restarting at the bar line', () => {
    const line = cycle([{ cell: ['A', 'B', 'C', 'D', 'E'], bars: 2 }]);
    const [first, second] = line.split(' | ').map((bar) => bar.split(' '));
    expect(first.slice(0, 6)).toEqual(['A', 'B', 'C', 'D', 'E', 'A']);
    // Sixteen notes later the five-note cell has moved on by one
    expect(second[0]).toBe('B');
  });

  it('carries the turn into the next chord’s cell, and rests where the rhythm does', () => {
    const line = cycle(
      [
        { cell: ['A', 'B'], bars: 1 },
        { cell: ['C', 'D', 'E'], bars: 1 },
      ],
      euclid(4, 16),
    );
    // Four notes into the turn: the three-note cell picks up at its second, D
    expect(line).toBe('A . . . B . . . A . . . B . . . | D . . . E . . . C . . . D . . .');
  });

  it('grows a cell one note a bar', () => {
    const bars = additive(['A', 'B', 'C', 'D'], [2, 3]).split(' | ');
    expect(bars[0].split(' ').slice(0, 4)).toEqual(['A', 'B', 'A', 'B']);
    expect(bars[1].split(' ').slice(0, 4)).toEqual(['A', 'B', 'C', 'A']);
  });
});

describe('transpose', () => {
  it('moves the notes and keeps the holds and rests', async () => {
    const { transpose } = await import('@/audio/music/compose');
    expect(transpose('C5 - Eb5 . Bb4 -', 4)).toBe('E5 - G5 . D5 -');
    expect(transpose('G5 - - - | Ab5 . C6 -', -8)).toBe('B4 - - - | C5 . E5 -');
  });
});
