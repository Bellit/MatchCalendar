import { useMemo, useState } from 'react';
import { blockMinutesFor, findConflicts, inRange, startMinutes, type Conflict, type DateRange } from '../logic/conflicts';
import { useStore } from '../model/store';
import { formatMinutes, type AppData, type CalendarEvent, type Group } from '../model/types';
import { EmptyState, formatDateLong, formatDateShort, localToday, useUi } from '../ui';

type Preset = 'upcoming' | 'month' | 'all' | 'custom';

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** Minutos desde medianoche → "HH:MM" (y "+1 día" si pasa de medianoche). */
function clock(min: number, baseDay: number): string {
  const day = Math.floor(min / 1440);
  const m = ((min % 1440) + 1440) % 1440;
  const s = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return day > baseDay ? `${s} (día siguiente)` : day < baseDay ? `${s} (día anterior)` : s;
}

export default function Conflicts() {
  const { data } = useStore();
  const { go } = useUi();
  const [groupId, setGroupId] = useState<string>('all');
  const [preset, setPreset] = useState<Preset>('upcoming');
  const [from, setFrom] = useState(localToday());
  const [to, setTo] = useState('');
  const [view, setView] = useState<'list' | 'agenda'>('list');

  const range: DateRange = useMemo(() => {
    const today = localToday();
    if (preset === 'upcoming') return { from: today };
    if (preset === 'month') return { from: today, to: addDays(today, 30) };
    if (preset === 'all') return {};
    return { from: from || undefined, to: to || undefined };
  }, [preset, from, to]);

  const groups = groupId === 'all' ? data.groups : data.groups.filter((g) => g.id === groupId);
  const results = useMemo(() => groups.map((g) => ({ group: g, conflicts: findConflicts(g, data, range) })), [data, groupId, range]);
  const total = results.reduce((n, r) => n + r.conflicts.length, 0);
  const affected = results.filter((r) => r.conflicts.length).length;
  const next = results
    .flatMap((r) => r.conflicts)
    .map((c) => c.a.date)
    .sort()[0];

  if (data.groups.length === 0) {
    const ready = data.teams.length >= 2;
    return (
      <div className="card">
        <EmptyState icon="🔗" title="Aún no hay nada que comparar">
          <p>
            {ready
              ? 'Ya tienes equipos. Ahora crea un grupo con los equipos que no pueden coincidir.'
              : 'Primero crea al menos dos equipos con sus partidos y después agrúpalos.'}
          </p>
          <div className="toolbar center">
            <button className="primary" onClick={() => go(ready ? 'groups' : 'teams')}>
              {ready ? 'Crear un grupo' : 'Ir a equipos'}
            </button>
            <button onClick={() => go('home')}>Ver cómo funciona</button>
          </div>
        </EmptyState>
      </div>
    );
  }

  return (
    <>
      <section className="card filters">
        <label className="field">
          <span>Grupo</span>
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="all">Todos los grupos</option>
            {data.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>Periodo</span>
          <div className="seg">
            {(
              [
                ['upcoming', 'Próximos'],
                ['month', '30 días'],
                ['all', 'Todo'],
                ['custom', 'Fechas…'],
              ] as [Preset, string][]
            ).map(([id, label]) => (
              <button key={id} className={preset === id ? 'active' : ''} onClick={() => setPreset(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {preset === 'custom' && (
          <>
            <label className="field">
              <span>Desde</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="field">
              <span>Hasta</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </>
        )}
        <div className="field push">
          <span>Vista</span>
          <div className="seg">
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
              Lista
            </button>
            <button className={view === 'agenda' ? 'active' : ''} onClick={() => setView('agenda')}>
              Agenda
            </button>
          </div>
        </div>
      </section>

      <div className="stats scoreboard">
        <div className={'stat ' + (total ? 'bad' : 'ok')}>
          <span className="stat-value">{total}</span>
          <span className="stat-label">{total === 1 ? 'coincidencia' : 'coincidencias'}</span>
        </div>
        <div className="stat">
          <span className="stat-value">
            {affected}/{groups.length}
          </span>
          <span className="stat-label">grupos afectados</span>
        </div>
        <div className="stat">
          <span className="stat-value small">{next ? formatDateShort(next) : '—'}</span>
          <span className="stat-label">próxima coincidencia</span>
        </div>
      </div>

      {results.map(({ group, conflicts }) => (
        <section key={group.id} className="card">
          <div className="card-head">
            <h2>{group.name}</h2>
            <span className={'pill ' + (conflicts.length ? 'bad' : 'ok')}>
              {conflicts.length ? `${conflicts.length} ${conflicts.length === 1 ? 'coincidencia' : 'coincidencias'}` : 'Sin coincidencias'}
            </span>
          </div>
          {group.teamIds.length < 2 ? (
            <p className="notice warn">
              Este grupo tiene menos de dos equipos.{' '}
              <button className="link" onClick={() => go('groups')}>
                Añadir equipos al grupo
              </button>
            </p>
          ) : view === 'list' ? (
            <ConflictList conflicts={conflicts} data={data} />
          ) : (
            <Agenda group={group} conflicts={conflicts} data={data} range={range} />
          )}
        </section>
      ))}
    </>
  );
}

function TeamLink({ teamId, data }: { teamId: string; data: AppData }) {
  const { go } = useUi();
  const team = data.teams.find((t) => t.id === teamId);
  const type = data.activityTypes.find((a) => a.id === team?.activityTypeId);
  return (
    <button className="link team-link" onClick={() => go('teams', { teamId })} title="Ver los partidos de este equipo">
      <span className="dot" style={{ background: type?.color }} />
      {team?.name}
    </button>
  );
}

function EventCard({ ev, data }: { ev: CalendarEvent; data: AppData }) {
  const team = data.teams.find((t) => t.id === ev.teamId);
  const type = data.activityTypes.find((a) => a.id === team?.activityTypeId);
  const start = startMinutes(ev)!;
  const block = blockMinutesFor(ev, data);
  const baseDay = Math.floor(start / 1440);
  return (
    <div className="event-card" style={{ borderLeftColor: type?.color }}>
      <TeamLink teamId={ev.teamId} data={data} />
      <div className="event-time">
        <b>{ev.time}</b> → {clock(start + block, baseDay)} <span className="muted">({formatMinutes(block)})</span>
      </div>
      {ev.title && <div>{ev.title}</div>}
      {ev.venue && <div className="muted">📍 {ev.venue}</div>}
    </div>
  );
}

function ConflictList({ conflicts, data }: { conflicts: Conflict[]; data: AppData }) {
  if (conflicts.length === 0) return <p className="muted">Ningún partido se pisa en este periodo.</p>;
  const byDate = new Map<string, Conflict[]>();
  for (const c of conflicts) byDate.set(c.a.date, [...(byDate.get(c.a.date) ?? []), c]);
  return (
    <>
      {[...byDate].map(([date, cs]) => (
        <div key={date} className="day">
          <h3 className="day-title">{formatDateLong(date)}</h3>
          {cs.map((c) => {
            const aStart = startMinutes(c.a)!;
            const bStart = startMinutes(c.b)!;
            const aEnd = aStart + blockMinutesFor(c.a, data);
            const latestA = bStart - blockMinutesFor(c.a, data);
            const aTeam = data.teams.find((t) => t.id === c.a.teamId)?.name;
            const bTeam = data.teams.find((t) => t.id === c.b.teamId)?.name;
            const day = Math.floor(aStart / 1440);
            return (
              <article key={c.a.id + c.b.id} className="conflict">
                <div className="conflict-pair">
                  <EventCard ev={c.a} data={data} />
                  <div className="overlap" aria-label={`Se pisan ${formatMinutes(c.overlapMinutes)}`}>
                    <span className="overlap-icon">⚡</span>
                    <b>{formatMinutes(c.overlapMinutes)}</b>
                    <span>se pisan</span>
                  </div>
                  <EventCard ev={c.b} data={data} />
                </div>
                <p className="suggestion">
                  Para evitarlo: <b>{bTeam}</b> debería empezar a las <b>{clock(aEnd, day)}</b> o más tarde, o <b>{aTeam}</b> a las{' '}
                  <b>{clock(latestA, day)}</b> o antes.
                </p>
              </article>
            );
          })}
        </div>
      ))}
    </>
  );
}

const DAY_START = 8 * 60;
const DAY_END = 24 * 60;

function Agenda({ group, conflicts, data, range }: { group: Group; conflicts: Conflict[]; data: AppData; range: DateRange }) {
  const [onlyConflicts, setOnlyConflicts] = useState(conflicts.length > 0);
  const conflictIds = new Set(conflicts.flatMap((c) => [c.a.id, c.b.id]));
  const events = data.events.filter((e) => group.teamIds.includes(e.teamId) && e.time && inRange(e.date, range));
  const days = [...new Set(events.map((e) => e.date))]
    .sort()
    .filter((d) => !onlyConflicts || events.some((e) => e.date === d && conflictIds.has(e.id)));
  const hours = Array.from({ length: (DAY_END - DAY_START) / 120 + 1 }, (_, i) => DAY_START / 60 + i * 2);
  const pct = (min: number) => `${((Math.max(DAY_START, Math.min(DAY_END, min)) - DAY_START) / (DAY_END - DAY_START)) * 100}%`;

  return (
    <>
      <div className="agenda-tools">
        <label className="check">
          <input type="checkbox" checked={onlyConflicts} onChange={(e) => setOnlyConflicts(e.target.checked)} />
          Solo días con coincidencias
        </label>
        <div className="legend">
          {group.teamIds.map((id) => (
            <TeamLink key={id} teamId={id} data={data} />
          ))}
        </div>
      </div>
      <div className="table-wrap">
        <div className="agenda">
          <div className="agenda-row agenda-head">
            <div className="agenda-label" />
            <div className="agenda-track">
              {hours.map((h) => (
                <span key={h} className="tick" style={{ left: pct(h * 60) }}>
                  {h}h
                </span>
              ))}
            </div>
          </div>
          {days.map((d) => {
            const dayEvents = events.filter((e) => e.date === d).sort((a, b) => a.time!.localeCompare(b.time!));
            const hasConflict = dayEvents.some((e) => conflictIds.has(e.id));
            return (
              <div key={d} className={'agenda-row' + (hasConflict ? ' has-conflict' : '')}>
                <div className="agenda-label">{formatDateShort(d)}</div>
                <div className="agenda-track" style={{ height: `${Math.max(1, dayEvents.length) * 28 + 8}px` }}>
                  {hours.map((h) => (
                    <span key={h} className="grid" style={{ left: pct(h * 60) }} />
                  ))}
                  {dayEvents.map((ev, i) => {
                    const team = data.teams.find((t) => t.id === ev.teamId);
                    const type = data.activityTypes.find((a) => a.id === team?.activityTypeId);
                    const [hh, mm] = ev.time!.split(':').map(Number);
                    const s = hh * 60 + mm;
                    const e = s + blockMinutesFor(ev, data);
                    return (
                      <div
                        key={ev.id}
                        className={'bar' + (conflictIds.has(ev.id) ? ' conflict-bar' : '')}
                        style={{ left: pct(s), width: `calc(${pct(e)} - ${pct(s)})`, top: i * 28 + 4, background: type?.color }}
                        title={`${ev.time} · ${team?.name} · ${ev.title} (bloque ${formatMinutes(e - s)})`}
                      >
                        {ev.time} {team?.name}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {days.length === 0 && <p className="muted pad">No hay partidos con hora en este periodo.</p>}
        </div>
      </div>
    </>
  );
}
