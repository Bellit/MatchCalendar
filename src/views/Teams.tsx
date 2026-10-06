import { useState } from 'react';
import { useStore } from '../model/store';
import { formatMinutes, newId, type CalendarEvent, type Team } from '../model/types';
import { DurationInput } from './DurationInput';
import FcbqImport from './FcbqImport';

export default function Teams() {
  const { data, dispatch } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(data.teams[0]?.id ?? null);
  const selected = data.teams.find((t) => t.id === selectedId) ?? null;

  const addTeam = () => {
    if (data.activityTypes.length === 0) return;
    const team: Team = { id: newId(), name: 'Nuevo equipo', activityTypeId: data.activityTypes[0].id };
    dispatch({ type: 'upsert', collection: 'teams', item: team });
    setSelectedId(team.id);
  };

  return (
    <section className="split">
      <aside>
        <h2>Equipos</h2>
        <ul className="list">
          {data.teams.map((t) => {
            const type = data.activityTypes.find((a) => a.id === t.activityTypeId);
            return (
              <li key={t.id} className={t.id === selectedId ? 'active' : ''} onClick={() => setSelectedId(t.id)}>
                <span className="dot" style={{ background: type?.color }} />
                {t.name}
                <span className="muted"> ({data.events.filter((e) => e.teamId === t.id).length})</span>
              </li>
            );
          })}
        </ul>
        <button onClick={addTeam} disabled={data.activityTypes.length === 0}>
          + Añadir equipo
        </button>
      </aside>
      <div className="detail">{selected ? <TeamDetail team={selected} /> : <p className="hint">Crea o selecciona un equipo.</p>}</div>
    </section>
  );
}

function TeamDetail({ team }: { team: Team }) {
  const { data, dispatch } = useStore();
  const [showImport, setShowImport] = useState(false);
  const type = data.activityTypes.find((a) => a.id === team.activityTypeId);
  const events = data.events
    .filter((e) => e.teamId === team.id)
    .sort((a, b) => (a.date + (a.time ?? '99')).localeCompare(b.date + (b.time ?? '99')));
  const saveTeam = (t: Team) => dispatch({ type: 'upsert', collection: 'teams', item: t });
  const saveEvent = (e: CalendarEvent) => dispatch({ type: 'upsert', collection: 'events', item: e });

  return (
    <>
      <div className="form-row">
        <label>
          Nombre
          <input value={team.name} onChange={(e) => saveTeam({ ...team, name: e.target.value })} />
        </label>
        <label>
          Actividad
          <select value={team.activityTypeId} onChange={(e) => saveTeam({ ...team, activityTypeId: e.target.value })}>
            {data.activityTypes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Bloque propio <span className="muted">(vacío = {type ? formatMinutes(type.blockMinutes) : '—'})</span>
          <DurationInput optional minutes={team.blockMinutesOverride} onChange={(m) => saveTeam({ ...team, blockMinutesOverride: m })} />
        </label>
        <button
          className="danger"
          onClick={() => {
            if (window.confirm(`¿Borrar "${team.name}" y sus ${events.length} partido(s)?`))
              dispatch({ type: 'remove', collection: 'teams', id: team.id });
          }}
        >
          Borrar equipo
        </button>
      </div>

      <h3>Partidos / eventos</h3>
      <div className="toolbar">
        <button
          onClick={() =>
            saveEvent({ id: newId(), teamId: team.id, date: new Date().toISOString().slice(0, 10), time: '10:00', title: '' })
          }
        >
          + Añadir partido
        </button>
        <button onClick={() => setShowImport((s) => !s)}>{showImport ? 'Cerrar importación' : 'Importar desde FCBQ (pegar)'}</button>
      </div>
      {showImport && <FcbqImport team={team} onDone={() => setShowImport(false)} />}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Partido / descripción</th>
              <th>Lugar</th>
              <th>Bloque propio</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.id} className={ev.time ? '' : 'pending'}>
                <td>
                  <input type="date" value={ev.date} onChange={(e) => saveEvent({ ...ev, date: e.target.value })} />
                </td>
                <td>
                  <input
                    type="time"
                    value={ev.time ?? ''}
                    title={ev.time ? '' : 'Sin hora: no se tiene en cuenta para coincidencias'}
                    onChange={(e) => saveEvent({ ...ev, time: e.target.value || undefined })}
                  />
                </td>
                <td>
                  <input value={ev.title} placeholder="Rival / descripción" onChange={(e) => saveEvent({ ...ev, title: e.target.value })} />
                </td>
                <td>
                  <input value={ev.venue ?? ''} onChange={(e) => saveEvent({ ...ev, venue: e.target.value || undefined })} />
                </td>
                <td>
                  <DurationInput optional minutes={ev.blockMinutesOverride} onChange={(m) => saveEvent({ ...ev, blockMinutesOverride: m })} />
                </td>
                <td>
                  <button className="danger small" onClick={() => dispatch({ type: 'remove', collection: 'events', id: ev.id })}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Sin partidos todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
