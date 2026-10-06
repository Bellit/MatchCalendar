import { useState, type FormEvent } from 'react';
import { useStore } from '../model/store';
import { formatMinutes, newId, type CalendarEvent, type Team } from '../model/types';
import { EmptyState, formatMonth, localToday, useUi } from '../ui';
import { DurationInput } from './DurationInput';
import FcbqImport from './FcbqImport';

export default function Teams() {
  const { data, dispatch } = useStore();
  const { nav, toast } = useUi();
  const [selectedId, setSelectedId] = useState<string | null>(nav.teamId ?? data.teams[0]?.id ?? null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState(data.activityTypes[0]?.id ?? '');
  const selected = data.teams.find((t) => t.id === selectedId) ?? data.teams[0] ?? null;

  const addTeam = (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || !newType) return;
    const team: Team = { id: newId(), name, activityTypeId: newType };
    dispatch({ type: 'upsert', collection: 'teams', item: team });
    setSelectedId(team.id);
    setNewName('');
    toast(`Equipo "${name}" creado`);
  };

  return (
    <div className="split">
      <aside className="card sidebar">
        <h2>Equipos</h2>
        {data.teams.length > 0 && (
          <ul className="list">
            {data.teams.map((t) => {
              const type = data.activityTypes.find((a) => a.id === t.activityTypeId);
              const count = data.events.filter((e) => e.teamId === t.id).length;
              return (
                <li key={t.id}>
                  <button className={'list-item' + (t.id === selected?.id ? ' active' : '')} onClick={() => setSelectedId(t.id)}>
                    <span className="dot" style={{ background: type?.color }} />
                    <span className="list-name">{t.name}</span>
                    <span className="count">{count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <form className="add-team" onSubmit={addTeam}>
          <label className="field">
            <span>Nuevo equipo</span>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="p. ej. Canovelles BC 3" />
          </label>
          <label className="field">
            <span>Actividad</span>
            <select value={newType} onChange={(e) => setNewType(e.target.value)}>
              {data.activityTypes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <button className="primary" type="submit" disabled={!newName.trim() || !newType}>
            + Añadir equipo
          </button>
        </form>
      </aside>

      <div className="detail">
        {selected ? (
          <TeamDetail key={selected.id} team={selected} />
        ) : (
          <div className="card">
            <EmptyState icon="👥" title="Todavía no hay equipos">
              <p>Crea un equipo con el formulario de la izquierda: ponle nombre y elige la actividad.</p>
            </EmptyState>
          </div>
        )}
      </div>
    </div>
  );
}

function TeamDetail({ team }: { team: Team }) {
  const { data, dispatch } = useStore();
  const { toast } = useUi();
  const events = data.events.filter((e) => e.teamId === team.id);
  const [showImport, setShowImport] = useState(events.length === 0);
  const [showPast, setShowPast] = useState(false);
  const type = data.activityTypes.find((a) => a.id === team.activityTypeId);
  const today = localToday();

  const saveTeam = (t: Team) => dispatch({ type: 'upsert', collection: 'teams', item: t });
  const saveEvent = (e: CalendarEvent) => dispatch({ type: 'upsert', collection: 'events', item: e });

  const sorted = events.slice().sort((a, b) => (a.date + (a.time ?? '99')).localeCompare(b.date + (b.time ?? '99')));
  const past = sorted.filter((e) => e.date < today);
  const visible = showPast ? sorted : sorted.filter((e) => e.date >= today);
  const byMonth = new Map<string, CalendarEvent[]>();
  for (const e of visible) {
    const k = e.date.slice(0, 7);
    byMonth.set(k, [...(byMonth.get(k) ?? []), e]);
  }
  const pending = events.filter((e) => !e.time).length;

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2>
            <span className="dot lg" style={{ background: type?.color }} />
            {team.name}
          </h2>
          <button
            className="ghost danger"
            onClick={() => {
              if (window.confirm(`¿Borrar "${team.name}" y sus ${events.length} partido(s)?`)) {
                dispatch({ type: 'remove', collection: 'teams', id: team.id });
                toast(`Equipo "${team.name}" borrado`);
              }
            }}
          >
            Borrar equipo
          </button>
        </div>
        <div className="fields">
          <label className="field grow">
            <span>Nombre</span>
            <input value={team.name} onChange={(e) => saveTeam({ ...team, name: e.target.value })} />
          </label>
          <label className="field">
            <span>Actividad</span>
            <select value={team.activityTypeId} onChange={(e) => saveTeam({ ...team, activityTypeId: e.target.value })}>
              {data.activityTypes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <span>
              Bloque propio <small className="muted">(vacío = {type ? formatMinutes(type.blockMinutes) : '—'})</small>
            </span>
            <DurationInput optional minutes={team.blockMinutesOverride} onChange={(m) => saveTeam({ ...team, blockMinutesOverride: m })} />
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Añadir partidos</h2>
          <div className="seg">
            <button className={!showImport ? 'active' : ''} onClick={() => setShowImport(false)}>
              ✏️ A mano
            </button>
            <button className={showImport ? 'active' : ''} onClick={() => setShowImport(true)}>
              📋 Pegar de la FCBQ
            </button>
          </div>
        </div>
        {showImport ? <FcbqImport team={team} onDone={() => setShowImport(false)} /> : <AddEventForm team={team} />}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>
            Partidos <span className="muted">({events.length})</span>
          </h2>
          {past.length > 0 && (
            <label className="check">
              <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
              Mostrar los {past.length} ya jugados
            </label>
          )}
        </div>
        {pending > 0 && <p className="notice warn">⏳ {pending} partido(s) sin hora: no cuentan para coincidencias hasta que tengan hora.</p>}
        {visible.length === 0 ? (
          <EmptyState icon="🗓️" title={events.length ? 'No hay partidos próximos' : 'Sin partidos todavía'}>
            <p>Añádelos a mano o pegando el calendario de la federación.</p>
          </EmptyState>
        ) : (
          [...byMonth].map(([month, evs]) => (
            <div key={month} className="month">
              <h3 className="month-title">{formatMonth(evs[0].date)}</h3>
              <div className="table-wrap">
                <table className="events">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Hora</th>
                      <th>Partido / descripción</th>
                      <th>Lugar</th>
                      <th title="Vacío = el del equipo o la actividad">Bloque propio</th>
                      <th>
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {evs.map((ev) => (
                      <tr key={ev.id} className={(ev.time ? '' : 'pending') + (ev.date < today ? ' past' : '')}>
                        <td>
                          <input type="date" value={ev.date} onChange={(e) => e.target.value && saveEvent({ ...ev, date: e.target.value })} />
                        </td>
                        <td>
                          <input type="time" value={ev.time ?? ''} onChange={(e) => saveEvent({ ...ev, time: e.target.value || undefined })} />
                        </td>
                        <td>
                          <input
                            className="wide"
                            value={ev.title}
                            placeholder="Rival / descripción"
                            onChange={(e) => saveEvent({ ...ev, title: e.target.value })}
                          />
                          {ev.notes && <div className="sub">{ev.notes}</div>}
                        </td>
                        <td>
                          <input className="wide" value={ev.venue ?? ''} onChange={(e) => saveEvent({ ...ev, venue: e.target.value || undefined })} />
                        </td>
                        <td>
                          <DurationInput optional minutes={ev.blockMinutesOverride} onChange={(m) => saveEvent({ ...ev, blockMinutesOverride: m })} />
                        </td>
                        <td>
                          <button
                            className="icon-btn danger"
                            title="Borrar partido"
                            aria-label="Borrar partido"
                            onClick={() => {
                              dispatch({ type: 'remove', collection: 'events', id: ev.id });
                              toast('Partido borrado');
                            }}
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </section>
    </>
  );
}

function AddEventForm({ team }: { team: Team }) {
  const { dispatch } = useStore();
  const { toast } = useUi();
  const [date, setDate] = useState(localToday());
  const [time, setTime] = useState('');
  const [title, setTitle] = useState('');
  const [venue, setVenue] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!date) return;
    dispatch({
      type: 'upsert',
      collection: 'events',
      item: { id: newId(), teamId: team.id, date, time: time || undefined, title: title.trim(), venue: venue.trim() || undefined },
    });
    toast('Partido añadido');
    setTitle('');
    setVenue('');
    setTime('');
  };

  return (
    <form className="fields" onSubmit={submit}>
      <label className="field">
        <span>Fecha</span>
        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="field">
        <span>
          Hora <small className="muted">(opcional)</small>
        </span>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </label>
      <label className="field grow">
        <span>Partido / descripción</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="p. ej. vs CB Rival" />
      </label>
      <label className="field grow">
        <span>Lugar</span>
        <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Pabellón, dirección…" />
      </label>
      <button className="primary" type="submit">
        Añadir
      </button>
    </form>
  );
}
