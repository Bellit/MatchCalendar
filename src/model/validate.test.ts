import { describe, expect, it } from 'vitest';
import { buildDemoData } from './demo';
import { DEFAULT_DATA } from './types';
import { isValidDate, sanitizeAppData } from './validate';

const base = () => ({
  activityTypes: [{ id: 'basket', name: 'Baloncesto', blockMinutes: 180, color: '#e8711a' }],
  teams: [{ id: 't1', name: 'Junior', activityTypeId: 'basket' }],
  events: [{ id: 'e1', teamId: 't1', date: '2026-10-10', time: '10:00', title: 'Partido' }],
  groups: [{ id: 'g1', name: 'Grupo', teamIds: ['t1'] }],
});

describe('sanitizeAppData', () => {
  it('deja intactos los datos válidos (ejemplo y valores iniciales)', () => {
    const demo = buildDemoData();
    expect(sanitizeAppData(demo)).toEqual({ data: demo, dropped: 0 });
    expect(sanitizeAppData(DEFAULT_DATA)).toEqual({ data: DEFAULT_DATA, dropped: 0 });
  });

  it('rechaza lo que no tiene forma de copia de MatchCalendar', () => {
    expect(sanitizeAppData(null)).toBeNull();
    expect(sanitizeAppData([])).toBeNull();
    expect(sanitizeAppData({ teams: [] })).toBeNull();
    expect(sanitizeAppData('{}')).toBeNull();
  });

  it('descarta elementos que romperían la app (null, fechas no válidas, ids raros)', () => {
    const d = base();
    const r = sanitizeAppData({
      ...d,
      events: [...d.events, null, 42, { id: 'e2', teamId: 't1', date: 20261010, title: 'x' }, { id: 'e3', teamId: 't1', date: '2026-02-31', title: 'x' }, { teamId: 't1', date: '2026-10-11', title: 'sin id' }],
    })!;
    expect(r.data.events.map((e) => e.id)).toEqual(['e1']);
    expect(r.dropped).toBe(5);
  });

  it('no permite colores que no sean #rrggbb (evita url() y otras inyecciones en estilos)', () => {
    const d = base();
    d.activityTypes[0].color = 'url(https://ejemplo.invalid/espia.png)';
    const r = sanitizeAppData(d)!;
    expect(r.data.activityTypes[0].color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(r.data.activityTypes).toHaveLength(1);
  });

  it('corrige campos secundarios en lugar de perder el elemento', () => {
    const d = base() as Record<string, unknown[]>;
    d.activityTypes = [{ id: 'basket', name: 7, blockMinutes: 99999, color: 'red' }];
    d.events = [{ id: 'e1', teamId: 't1', date: '2026-10-10', time: '25:99', title: null, blockMinutesOverride: -5 }];
    const r = sanitizeAppData(d)!;
    expect(r.data.activityTypes[0]).toMatchObject({ name: '', blockMinutes: 48 * 60 });
    expect(r.data.events[0]).toEqual({ id: 'e1', teamId: 't1', date: '2026-10-10', title: '' });
    expect(r.dropped).toBe(0);
  });

  it('elimina referencias rotas y duplicados', () => {
    const d = base();
    const r = sanitizeAppData({
      ...d,
      teams: [...d.teams, { id: 't1', name: 'Duplicado', activityTypeId: 'basket' }, { id: 't2', name: 'Huérfano', activityTypeId: 'nada' }],
      events: [...d.events, { id: 'e9', teamId: 't2', date: '2026-10-10', title: 'x' }],
      groups: [{ id: 'g1', name: 'Grupo', teamIds: ['t1', 't1', 't2', 5] }],
    })!;
    expect(r.data.teams.map((t) => t.name)).toEqual(['Junior']);
    expect(r.data.events.map((e) => e.id)).toEqual(['e1']);
    expect(r.data.groups[0].teamIds).toEqual(['t1']);
    expect(r.dropped).toBe(3);
  });

  it('ignora propiedades extra como __proto__', () => {
    const r = sanitizeAppData(JSON.parse('{"__proto__":{"x":1},"activityTypes":[],"teams":[],"events":[],"groups":[]}'))!;
    expect(Object.keys(r.data)).toEqual(['activityTypes', 'teams', 'events', 'groups']);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });
});

describe('isValidDate', () => {
  it('acepta fechas reales y rechaza las imposibles', () => {
    expect(isValidDate('2028-02-29')).toBe(true);
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('2026-13-01')).toBe(false);
    expect(isValidDate('10/10/2026')).toBe(false);
  });
});
