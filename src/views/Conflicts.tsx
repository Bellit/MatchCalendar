import { useMemo, useState } from 'react';
import { blockMinutesFor, findConflicts, inRange, startMinutes, type Conflict } from '../logic/conflicts';
import { useStore } from '../model/store';
import { formatMinutes, type AppData, type CalendarEvent, type Group } from '../model/types';

const today = () => new Date().toISOString().slice(0, 10);

function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function Conflicts() {
  const { data } = useStore();
  const [groupId, setGroupId] = useState<string>('all');
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState('');
  const [view, setView] = useState<'list' | 'agenda'>('list');

  const groups = groupId === 'all' ? data.groups : data.groups.filter((g) => g.id === groupId);
  const range = { from: from || undefined, to: to || undefined };

  const results = useMemo(
    () => groups.map((g) => ({ group: g, conflicts: findConflicts(g, data, range) })),
    [data, groupId, from, to],
  );
  const total = results.reduce((n, r) => n + r.conflicts.length, 0);

  if (data.groups.length === 0) {
    return (
      <section>
        <h2>Coincidencias</h2>
        <p className="hint">
          Para empezar: 1) revisa los bloques en <b>Actividades</b>, 2) crea equipos y añade sus partidos en <b>Equipos y partidos</b>,
          3) agrupa los equipos que no pueden coincidir en <b>Grupos</b>.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2>Coincidencias</h2>
      <div className="form-row">
        <label>
          Grupo
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="all">Todos los grupos</option>
            {data.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Desde
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <div className="seg">
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
            Lista
          </button>
          <button className={view === 'agenda' ? 'active' : ''} onClick={() => setView('agenda')}>
            Agenda
          </button>
        </div>
      </div>

      <p className={total ? 'summary bad' : 'summary ok'}>
        {total ? `⚠️ ${total} coincidencia(s) encontrada(s)` : '✅ Sin coincidencias en el periodo seleccionado'}
      </p>

      {results.map(({ group, conflicts }) => (
        <div key={group.id} className="group-result">
          {groups.length > 1 && (
            <h3>
              {group.name} <span className="muted">— {conflicts.length} coincidencia(s)</span>
            </h3>
          )}
          {view === 'list' ? <ConflictList conflicts={conflicts} data={data} /> : <Agenda group={group} conflicts={conflicts} data={data} range={range} />}
        </div>
      ))}
    </section>
  );
}

function EventCard({ ev, data }: { ev: CalendarEvent; data: AppData }) {
  const team = data.teams.find((t) => t.id === ev.teamId);
  const type = data.activityTypes.find((a) => a.id === team?.activityTypeId);
  const start = startMinutes(ev)!;
  const end = start + blockMinutesFor(ev, data);
  const endTime = `${String(Math.floor((end % 1440) / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
  return (
    <div className="event-card" style={{ borderColor: type?.color }}>
      <div>
        <b>{ev.time}</b> <span className="muted">(ocupado hasta {endTime})</span>
      </div>
      <div>
        <span className="dot" style={{ background: type?.color }} />
        <b>{team?.name}</b>
      </div>
      {ev.title && <div>{ev.title}</div>}
      {ev.venue && <div className="muted">📍 {ev.venue}</div>}
    </div>
  );
}

function ConflictList({ conflicts, data }: { conflicts: Conflict[]; data: AppData }) {
  if (conflicts.length === 0) return <p className="muted">Sin coincidencias.</p>;
  const byDate = new Map<string, Conflict[]>();
  for (const c of conflicts) byDate.set(c.a.date, [...(byDate.get(c.a.date) ?? []), c]);
  return (
    <>
      {[...byDate].map(([date, cs]) => (
        <div key={date} className="day">
          <h4>{formatDate(date)}</h4>
          {cs.map((c) => (
            <div key={c.a.id + c.b.id} className="conflict">
              <EventCard ev={c.a} data={data} />
              <div className="overlap">
                se pisan
                <b>{formatMinutes(c.overlapMinutes)}</b>
              </div>
              <EventCard ev={c.b} data={data} />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

const DAY_START = 8 * 60;
const DAY_END = 24 * 60;

function Agenda({ group, conflicts, data, range }: { group: Group; conflicts: Conflict[]; data: AppData; range: { from?: string; to?: string } }) {
  const [onlyConflicts, setOnlyConflicts] = useState(true);
  const conflictIds = new Set(conflicts.flatMap((c) => [c.a.id, c.b.id]));
  const events = data.events.filter((e) => group.teamIds.includes(e.teamId) && e.time && inRange(e.date, range));
  const days = [...new Set(events.map((e) => e.date))]
    .sort()
    .filter((d) => !onlyConflicts || events.some((e) => e.date === d && conflictIds.has(e.id)));
  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => DAY_START / 60 + i);
  const pct = (min: number) => `${((Math.max(DAY_START, Math.min(DAY_END, min)) - DAY_START) / (DAY_END - DAY_START)) * 100}%`;

  return (
    <>
      <label className="check">
        <input type="checkbox" checked={onlyConflicts} onChange={(e) => setOnlyConflicts(e.target.checked)} />
        Solo días con coincidencias
      </label>
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
            const dayEvents = events.filter((e) => e.date === d);
            return (
              <div key={d} className="agenda-row">
                <div className="agenda-label">{formatDate(d)}</div>
                <div className="agenda-track" style={{ height: `${Math.max(1, dayEvents.length) * 26 + 6}px` }}>
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
                        style={{ left: pct(s), width: `calc(${pct(e)} - ${pct(s)})`, top: i * 26 + 3, background: type?.color }}
                        title={`${ev.time} ${team?.name} ${ev.title} (${formatMinutes(e - s)})`}
                      >
                        {ev.time} {team?.name}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {days.length === 0 && <p className="muted">Nada que mostrar.</p>}
        </div>
      </div>
    </>
  );
}
