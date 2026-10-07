import { useState, type FormEvent } from 'react';
import { findConflicts } from '../logic/conflicts';
import { useStore } from '../model/store';
import { newId, type AppData, type Group } from '../model/types';
import { EmptyState, localToday, useRemoveWithUndo, useUi } from '../ui';

export default function Groups() {
  const { data, dispatch } = useStore();
  const { go, toast } = useUi();
  const remove = useRemoveWithUndo();
  const [name, setName] = useState('');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const save = (g: Group) => dispatch({ type: 'upsert', collection: 'groups', item: g });

  const create = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    save({ id: newId(), name: name.trim(), teamIds });
    toast(`Grupo "${name.trim()}" creado`);
    setName('');
    setTeamIds([]);
  };

  if (data.teams.length === 0) {
    return (
      <div className="card">
        <EmptyState icon="🔗" title="Primero necesitas equipos">
          <p>Un grupo junta equipos que no pueden jugar a la vez. Crea los equipos y luego vuelve aquí.</p>
          <button className="primary" onClick={() => go('teams')}>
            Ir a equipos
          </button>
        </EmptyState>
      </div>
    );
  }

  return (
    <>
      <section className="card">
        <h2>Nuevo grupo</h2>
        <p className="muted">
          Junta los equipos cuyos partidos no pueden pisarse. Por ejemplo, «Junior que juegan en el Sénior», o «Familia García»: el
          fútbol de la hija, el baloncesto del hijo y el equipo que entrena el padre.
        </p>
        <form onSubmit={create}>
          <label className="field">
            <span>Nombre del grupo</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="p. ej. Familia García" />
          </label>
          <p className="field-label">Equipos que no pueden coincidir</p>
          <TeamChips data={data} selected={teamIds} onChange={setTeamIds} />
          <div className="toolbar">
            <button className="primary" type="submit" disabled={!name.trim() || teamIds.length < 2}>
              Crear grupo
            </button>
            {name.trim() && teamIds.length < 2 && <span className="muted">Elige al menos dos equipos.</span>}
          </div>
        </form>
      </section>

      {data.groups.map((g) => {
        const n = findConflicts(g, data, { from: localToday() }).length;
        return (
          <section className="card" key={g.id}>
            <div className="card-head">
              <input className="title-input" value={g.name} aria-label="Nombre del grupo" onChange={(e) => save({ ...g, name: e.target.value })} />
              <div className="toolbar">
                <span className={'pill ' + (n ? 'bad' : 'ok')}>{n ? `${n} ${n === 1 ? 'coincidencia próxima' : 'coincidencias próximas'}` : 'Sin coincidencias próximas'}</span>
                {n > 0 && (
                  <button className="link" onClick={() => go('conflicts')}>
                    Ver
                  </button>
                )}
                <button
                  className="ghost danger"
                  onClick={() => {
                    remove('groups', g.id, `Grupo "${g.name}" borrado`);
                  }}
                >
                  Borrar
                </button>
              </div>
            </div>
            <TeamChips data={data} selected={g.teamIds} onChange={(ids) => save({ ...g, teamIds: ids })} />
          </section>
        );
      })}
    </>
  );
}

function TeamChips({ data, selected, onChange }: { data: AppData; selected: string[]; onChange: (ids: string[]) => void }) {
  return (
    <div className="chips">
      {data.teams.map((t) => {
        const type = data.activityTypes.find((a) => a.id === t.activityTypeId);
        const on = selected.includes(t.id);
        return (
          <button
            type="button"
            key={t.id}
            className={'chip' + (on ? ' on' : '')}
            aria-pressed={on}
            style={on ? { borderColor: type?.color, background: `color-mix(in srgb, ${type?.color} 14%, var(--surface))` } : undefined}
            onClick={() => onChange(on ? selected.filter((id) => id !== t.id) : [...selected, t.id])}
          >
            <span className="dot" style={{ background: type?.color }} />
            {t.name}
            {on && <span aria-hidden>✓</span>}
          </button>
        );
      })}
    </div>
  );
}
