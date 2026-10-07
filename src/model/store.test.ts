import { describe, expect, it } from 'vitest';
import { buildDemoData } from './demo';
import { reducer } from './store';
import { parseAppData, SCHEMA_VERSION, serializeAppData } from './validate';

describe('deshacer borrados (restore)', () => {
  it('recupera un equipo con sus partidos y su sitio en los grupos', () => {
    const before = buildDemoData();
    const removed = reducer(before, { type: 'remove', collection: 'teams', id: 'demo-junior' });
    expect(removed.events.some((e) => e.teamId === 'demo-junior')).toBe(false);
    expect(removed.groups.every((g) => !g.teamIds.includes('demo-junior'))).toBe(true);

    const restored = reducer(removed, { type: 'restore', before });
    expect(restored).toEqual(before);
  });

  it('recupera una actividad borrada en cascada', () => {
    const before = buildDemoData();
    const removed = reducer(before, { type: 'remove', collection: 'activityTypes', id: 'basket' });
    expect(removed.teams.some((t) => t.activityTypeId === 'basket')).toBe(false);
    expect(reducer(removed, { type: 'restore', before })).toEqual(before);
  });

  it('no deshace cambios hechos después del borrado', () => {
    const before = buildDemoData();
    let s = reducer(before, { type: 'remove', collection: 'groups', id: before.groups[0].id });
    const renamed = { ...s.teams[0], name: 'Renombrado después' };
    s = reducer(s, { type: 'upsert', collection: 'teams', item: renamed });
    s = reducer(s, { type: 'restore', before });
    expect(s.groups).toHaveLength(before.groups.length);
    expect(s.teams.find((t) => t.id === renamed.id)?.name).toBe('Renombrado después');
  });
});

describe('versión del formato', () => {
  it('guarda la versión y la lee de vuelta', () => {
    const data = buildDemoData();
    const json = JSON.parse(serializeAppData(data));
    expect(json.version).toBe(SCHEMA_VERSION);
    expect(parseAppData(json)).toEqual({ ok: true, data, dropped: 0 });
  });

  it('acepta copias antiguas sin versión', () => {
    const data = buildDemoData();
    expect(parseAppData(data)).toMatchObject({ ok: true, data });
  });

  it('rechaza copias de una versión más nueva en lugar de estropearlas', () => {
    const json = { ...JSON.parse(serializeAppData(buildDemoData())), version: SCHEMA_VERSION + 1 };
    expect(parseAppData(json)).toEqual({ ok: false, reason: 'newer' });
  });
});
