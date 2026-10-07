import { useRef, useState, type FormEvent } from 'react';
import { useStore } from '../model/store';
import { formatMinutes, newId, type CalendarEvent, type Team } from '../model/types';
import { EmptyState, formatDateLong, NameInput, formatMonth, localToday, parseLocalDate, plural, TrashIcon, useRemoveWithUndo, useUi } from '../ui';
import { DurationInput } from './DurationInput';
import FcbqImport from './FcbqImport';

export default function Teams() {
  const { data, dispatch } = useStore();
  const { nav, toast } = useUi();
  const [selectedId, setSelectedId] = useState<string | null>(nav.teamId ?? data.teams[0]?.id ?? null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState(data.activityTypes[0]?.id ?? '');
  const selected = data.teams.find((t) => t.id === selectedId) ?? data.teams[0] ?? null;
  const detailRef = useRef<HTMLDivElement>(null);

  // En pantallas estrechas el detalle queda debajo de la lista: al elegir un equipo, se lleva a la vista.
  const select = (id: string) => {
    setSelectedId(id);
    if (window.matchMedia?.('(max-width: 860px)').matches) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }));
    }
  };

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
                  <button className={'list-item' + (t.id === selected?.id ? ' active' : '')} aria-current={t.id === selected?.id ? 'true' : undefined} onClick={() => select(t.id)}>
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

      <div className="detail" ref={detailRef}>
        {selected ? (
          <TeamDetail key={selected.id} team={selected} />
        ) : (
          <div className="card">
            <EmptyState icon="team" title="Todavía no hay equipos">
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
  const remove = useRemoveWithUndo();
  const events = data.events.filter((e) => e.teamId === team.id);
  // La importación de la FCBQ solo tiene sentido de entrada para baloncesto; el resto empieza a mano.
  const [showImport, setShowImport] = useState(events.length === 0 && team.activityTypeId === 'basket');
  const [showPast, setShowPast] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const type = data.activityTypes.find((a) => a.id === team.activityTypeId);
  const teamBlock = team.blockMinutesOverride ?? type?.blockMinutes;
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
              // Sin confirmación: el aviso ofrece Deshacer, igual que en grupos y actividades.
              remove('teams', team.id, `Equipo "${team.name}" borrado` + (events.length ? ` con ${plural(events.length, 'partido')}` : ''));
            }}
          >
            Borrar equipo
          </button>
        </div>
        <div className="fields">
          <label className="field grow">
            <span>Nombre</span>
            <NameInput value={team.name} onSave={(name) => saveTeam({ ...team, name })} />
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
            <DurationInput optional label="Bloque del equipo" minutes={team.blockMinutesOverride} onChange={(m) => saveTeam({ ...team, blockMinutesOverride: m })} />
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Añadir partidos</h2>
          <div className="seg" role="group" aria-label="Cómo añadir partidos">
            <button className={!showImport ? 'active' : ''} aria-pressed={!showImport} onClick={() => setShowImport(false)}>
              A mano
            </button>
            <button className={showImport ? 'active' : ''} aria-pressed={showImport} onClick={() => setShowImport(true)}>
              Pegar de la FCBQ
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
        {pending > 0 && <p className="notice warn">{pending === 1 ? '1 partido sin hora: no cuenta' : `${pending} partidos sin hora: no cuentan`} para coincidencias hasta que tenga{pending === 1 ? '' : 'n'} hora.</p>}
        {visible.length === 0 ? (
          <EmptyState icon="calendar" title={events.length ? 'No hay partidos próximos' : 'Sin partidos todavía'}>
            <p>Añádelos a mano o pegando el calendario de la federación.</p>
          </EmptyState>
        ) : (
          [...byMonth].map(([month, evs]) => (
            <div key={month} className="month">
              <h3 className="month-title">{formatMonth(evs[0].date)}</h3>
              {/* Lectura primero: cada partido es una línea de marcador; se edita al pulsarlo. */}
              <ul className="event-rows">
                {evs.map((ev) => (
                  <EventRow
                    key={ev.id}
                    ev={ev}
                    past={ev.date < today}
                    inherited={teamBlock}
                    editing={editingId === ev.id}
                    onToggle={() => setEditingId(editingId === ev.id ? null : ev.id)}
                    onSave={saveEvent}
                    onRemove={() => {
                      setEditingId(null);
                      remove('events', ev.id, 'Partido borrado');
                    }}
                  />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </>
  );
}

function EventRow({
  ev,
  past,
  inherited,
  editing,
  onToggle,
  onSave,
  onRemove,
}: {
  ev: CalendarEvent;
  past: boolean;
  inherited?: number;
  editing: boolean;
  onToggle: () => void;
  onSave: (e: CalendarEvent) => void;
  onRemove: () => void;
}) {
  const d = parseLocalDate(ev.date);
  const weekday = d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
  const editorId = `ev-edit-${ev.id}`;
  return (
    <li className={'event-row' + (ev.time ? '' : ' pending') + (past ? ' past' : '') + (editing ? ' editing' : '')}>
      <button className="ev-summary" aria-expanded={editing} aria-controls={editorId} onClick={onToggle}>
        <span className="ev-date-chip" aria-label={formatDateLong(ev.date)}>
          <span className="ev-wd">{weekday}</span>
          <span className="ev-day">{d.getDate()}</span>
        </span>
        <span className={'ev-time-chip' + (ev.time ? '' : ' none')}>{ev.time ?? 'Sin hora'}</span>
        <span className="ev-main">
          <span className="ev-title-text">{ev.title || <span className="muted">Sin descripción</span>}</span>
          {(ev.venue || ev.notes) && <span className="ev-sub">{[ev.venue, ev.notes].filter(Boolean).join(' · ')}</span>}
        </span>
        {ev.blockMinutesOverride !== undefined && <span className="pill">bloque {formatMinutes(ev.blockMinutesOverride)}</span>}
        <span className="ev-action">{editing ? 'Cerrar' : 'Editar'}</span>
      </button>
      {editing && (
        <div
          id={editorId}
          className="ev-editor"
          onKeyDown={(e) => {
            if (e.key === 'Escape') onToggle();
          }}
        >
          <div className="fields">
            <label className="field">
              <span>Fecha</span>
              <input type="date" autoFocus value={ev.date} onChange={(e) => e.target.value && onSave({ ...ev, date: e.target.value })} />
            </label>
            <label className="field">
              <span>
                Hora <small className="muted">(sin hora no cuenta)</small>
              </span>
              <input type="time" value={ev.time ?? ''} onChange={(e) => onSave({ ...ev, time: e.target.value || undefined })} />
            </label>
            <label className="field grow">
              <span>Partido / descripción</span>
              <input value={ev.title} placeholder="p. ej. vs CB Rival" onChange={(e) => onSave({ ...ev, title: e.target.value })} />
            </label>
            <label className="field grow">
              <span>Lugar</span>
              <input value={ev.venue ?? ''} placeholder="Pabellón, dirección…" onChange={(e) => onSave({ ...ev, venue: e.target.value || undefined })} />
            </label>
          </div>
          <details className="more" open={ev.blockMinutesOverride !== undefined}>
            <summary>Más opciones</summary>
            <div className="field">
              <span>
                Bloque propio de este partido <small className="muted">(vacío = {inherited ? formatMinutes(inherited) : 'el del equipo'})</small>
              </span>
              <DurationInput
                optional
                label="Bloque de este partido"
                minutes={ev.blockMinutesOverride}
                onChange={(m) => onSave({ ...ev, blockMinutesOverride: m })}
              />
            </div>
          </details>
          <div className="toolbar">
            <button className="primary" onClick={onToggle}>
              Listo
            </button>
            <button className="ghost danger" onClick={onRemove}>
              <TrashIcon /> Borrar partido
            </button>
          </div>
        </div>
      )}
    </li>
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
