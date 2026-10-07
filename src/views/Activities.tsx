import { useStore } from '../model/store';
import { formatMinutes, newId, type ActivityType } from '../model/types';
import { plural, TrashIcon, useRemoveWithUndo } from '../ui';
import { DurationInput } from './DurationInput';

export default function Activities() {
  const { data, dispatch } = useStore();
  const remove = useRemoveWithUndo();
  const save = (item: ActivityType) => dispatch({ type: 'upsert', collection: 'activityTypes', item });

  return (
    <section className="card">
      <div className="card-head">
        <h2>Actividades</h2>
        <button onClick={() => save({ id: newId(), name: 'Nueva actividad', blockMinutes: 180, color: '#3b6fd8' })}>+ Añadir actividad</button>
      </div>
      <p className="muted">
        El <b>bloque</b> es el tiempo que queda ocupado desde la hora de inicio: lo que dura la actividad más el margen para llegar a la
        siguiente. Ejemplo: un partido de 2 h con 1 h de desplazamiento → bloque de 3 h.
      </p>
      <div className="activity-list">
        {data.activityTypes.map((a) => {
          const nTeams = data.teams.filter((t) => t.activityTypeId === a.id).length;
          return (
            <div key={a.id} className="activity" style={{ borderLeftColor: a.color }}>
              <label className="color-swatch" title="Cambiar color">
                <input type="color" value={a.color} onChange={(e) => save({ ...a, color: e.target.value })} />
              </label>
              <label className="field grow">
                <span>Nombre</span>
                <input value={a.name} onChange={(e) => save({ ...a, name: e.target.value })} />
              </label>
              <div className="field">
                <span>Bloque ocupado</span>
                <DurationInput minutes={a.blockMinutes} onChange={(m) => save({ ...a, blockMinutes: m ?? 60 })} />
              </div>
              <div className="activity-meta">
                <span className="block-preview">{formatMinutes(a.blockMinutes)}</span>
                <span className="muted">
                  {nTeams} equipo{nTeams === 1 ? '' : 's'}
                </span>
              </div>
              <button
                className="icon-btn danger"
                title="Borrar actividad"
                aria-label={`Borrar ${a.name}`}
                onClick={() => {
                  if (nTeams === 0 || window.confirm(`Se borrarán también ${plural(nTeams, 'equipo')} y sus partidos. ¿Seguir?`)) {
                    remove('activityTypes', a.id, `Actividad "${a.name}" borrada`);
                  }
                }}
              >
                <TrashIcon />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
