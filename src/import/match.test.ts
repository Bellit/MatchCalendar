import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../model/types';
import { matchExisting } from './match';

const ev = (id: string, date: string, title: string, time?: string): CalendarEvent => ({ id, teamId: 't', date, title, time });

describe('matchExisting', () => {
  it('actualiza el partido aunque cambie la hora (único del día)', () => {
    const existing = [ev('a', '2026-10-10', 'Junior A - CB Rival', '10:00')];
    expect(matchExisting([{ date: '2026-10-10', title: 'Junior A - CB Rival' }], existing)).toEqual([existing[0]]);
    expect(matchExisting([{ date: '2026-10-10', title: 'JUNIOR A - CB RIVAL (canvi)' }], existing)).toEqual([existing[0]]);
  });

  it('no mezcla dos partidos del mismo día (torneo)', () => {
    const existing = [ev('a', '2026-10-10', 'Junior A - CB Uno'), ev('b', '2026-10-10', 'Junior A - CB Dos')];
    const rows = [
      { date: '2026-10-10', title: 'Junior A - CB Dos' },
      { date: '2026-10-10', title: 'Junior A - CB Uno' },
    ];
    expect(matchExisting(rows, existing).map((e) => e?.id)).toEqual(['b', 'a']);
  });

  it('un partido nuevo en un día con otro ya guardado y emparejado se crea aparte', () => {
    const existing = [ev('a', '2026-10-10', 'Junior A - CB Uno')];
    const rows = [
      { date: '2026-10-10', title: 'Junior A - CB Uno' },
      { date: '2026-10-10', title: 'Junior A - CB Dos' },
    ];
    expect(matchExisting(rows, existing).map((e) => e?.id ?? null)).toEqual(['a', null]);
  });

  it('si el día es ambiguo, no adivina', () => {
    const existing = [ev('a', '2026-10-10', 'Partido 1'), ev('b', '2026-10-10', 'Partido 2')];
    const rows = [{ date: '2026-10-10', title: 'Otro texto' }];
    expect(matchExisting(rows, existing)).toEqual([null]);
  });

  it('nunca usa el mismo partido guardado dos veces', () => {
    const existing = [ev('a', '2026-10-10', 'Junior A - CB Uno')];
    const rows = [
      { date: '2026-10-10', title: 'Junior A - CB Uno' },
      { date: '2026-10-10', title: 'Junior A - CB Uno' },
    ];
    expect(matchExisting(rows, existing).map((e) => e?.id ?? null)).toEqual(['a', null]);
  });
});
