import { describe, expect, it } from 'vitest';
import { findConflicts } from './conflicts';
import type { AppData, Group } from '../model/types';

function data(events: AppData['events'], extra: Partial<AppData> = {}): AppData {
  return {
    activityTypes: [
      { id: 'basket', name: 'Baloncesto', blockMinutes: 180, color: '#000' },
      { id: 'futbol', name: 'Fútbol', blockMinutes: 210, color: '#000' },
    ],
    teams: [
      { id: 'A', name: 'Junior', activityTypeId: 'basket' },
      { id: 'B', name: 'Sénior', activityTypeId: 'basket' },
      { id: 'C', name: 'Fútbol', activityTypeId: 'futbol' },
    ],
    groups: [],
    events,
    ...extra,
  };
}

const group: Group = { id: 'g', name: 'G', teamIds: ['A', 'B', 'C'] };

describe('findConflicts', () => {
  it('detecta solape dentro del bloque', () => {
    const d = data([
      { id: '1', teamId: 'A', date: '2026-10-10', time: '10:00', title: 'x' },
      { id: '2', teamId: 'B', date: '2026-10-10', time: '12:30', title: 'y' },
    ]);
    const c = findConflicts(group, d);
    expect(c).toHaveLength(1);
    expect(c[0].overlapMinutes).toBe(30);
  });

  it('bloques contiguos no son coincidencia', () => {
    const d = data([
      { id: '1', teamId: 'A', date: '2026-10-10', time: '10:00', title: 'x' },
      { id: '2', teamId: 'B', date: '2026-10-10', time: '13:00', title: 'y' },
    ]);
    expect(findConflicts(group, d)).toHaveLength(0);
  });

  it('usa el bloque del evento que empieza antes', () => {
    const d = data([
      { id: '1', teamId: 'C', date: '2026-10-10', time: '10:00', title: 'futbol' },
      { id: '2', teamId: 'A', date: '2026-10-10', time: '13:15', title: 'basket' },
    ]);
    expect(findConflicts(group, d)[0].overlapMinutes).toBe(15);
  });

  it('ignora eventos del mismo equipo y de equipos fuera del grupo', () => {
    const d = data([
      { id: '1', teamId: 'A', date: '2026-10-10', time: '10:00', title: 'x' },
      { id: '2', teamId: 'A', date: '2026-10-10', time: '11:00', title: 'y' },
      { id: '3', teamId: 'B', date: '2026-10-10', time: '11:00', title: 'z' },
    ]);
    expect(findConflicts({ id: 'g', name: 'G', teamIds: ['A'] }, d)).toHaveLength(0);
    expect(findConflicts(group, d)).toHaveLength(2);
  });

  it('respeta overrides de equipo y evento', () => {
    const d = data(
      [
        { id: '1', teamId: 'A', date: '2026-10-10', time: '10:00', title: 'x' },
        { id: '2', teamId: 'B', date: '2026-10-10', time: '11:30', title: 'y' },
      ],
      {
        teams: [
          { id: 'A', name: 'Junior', activityTypeId: 'basket', blockMinutesOverride: 90 },
          { id: 'B', name: 'Sénior', activityTypeId: 'basket' },
        ],
      },
    );
    expect(findConflicts(group, d)).toHaveLength(0);
    d.events[0].blockMinutesOverride = 120;
    expect(findConflicts(group, d)).toHaveLength(1);
  });

  it('ignora partidos sin hora y filtra por rango', () => {
    const d = data([
      { id: '1', teamId: 'A', date: '2026-10-10', title: 'pendiente' },
      { id: '2', teamId: 'B', date: '2026-10-10', time: '10:00', title: 'y' },
      { id: '3', teamId: 'A', date: '2026-10-17', time: '10:00', title: 'x' },
      { id: '4', teamId: 'B', date: '2026-10-17', time: '11:00', title: 'y' },
    ]);
    expect(findConflicts(group, d)).toHaveLength(1);
    expect(findConflicts(group, d, { to: '2026-10-16' })).toHaveLength(0);
  });

  it('detecta solape que cruza la medianoche', () => {
    const d = data([
      { id: '1', teamId: 'A', date: '2026-10-10', time: '22:30', title: 'x' },
      { id: '2', teamId: 'B', date: '2026-10-11', time: '00:30', title: 'y' },
    ]);
    expect(findConflicts(group, d)).toHaveLength(1);
  });
});
