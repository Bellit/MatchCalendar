import { buildDemoData } from '../model/demo';
import { useStore } from '../model/store';
import { formatMinutes } from '../model/types';
import { useUi, type TabId } from '../ui';

export default function Home() {
  const { data, dispatch } = useStore();
  const { go, toast } = useUi();

  const teamsWithEvents = data.teams.filter((t) => data.events.some((e) => e.teamId === t.id)).length;
  const usefulGroups = data.groups.filter((g) => g.teamIds.length >= 2).length;
  const isEmpty = data.teams.length === 0 && data.events.length === 0 && data.groups.length === 0;

  const steps: { title: string; text: string; done: boolean; tab: TabId; cta: string }[] = [
    {
      title: 'Ajusta el tiempo de cada actividad',
      text: `Cuánto tiempo bloquea cada actividad desde que empieza, incluyendo el desplazamiento. Ahora: ${data.activityTypes
        .map((a) => `${a.name} ${formatMinutes(a.blockMinutes)}`)
        .join(', ')}.`,
      done: data.activityTypes.length > 0,
      tab: 'activities',
      cta: 'Revisar tiempos',
    },
    {
      title: 'Crea los equipos y añade sus partidos',
      text: 'A mano o pegando el calendario copiado de la web de la FCBQ (basquetcatala.cat).',
      done: teamsWithEvents >= 2,
      tab: 'teams',
      cta: data.teams.length ? 'Ir a equipos' : 'Crear el primer equipo',
    },
    {
      title: 'Agrupa los equipos que no pueden coincidir',
      text: 'Por ejemplo, el Junior y el Sénior donde juegan los mismos jugadores, o los equipos de una misma familia.',
      done: usefulGroups > 0,
      tab: 'groups',
      cta: 'Crear grupo',
    },
    {
      title: 'Revisa las coincidencias',
      text: 'Verás qué partidos se pisan y cuánto tiempo falta para que no choquen.',
      done: false,
      tab: 'conflicts',
      cta: 'Ver coincidencias',
    },
  ];
  const nextStep = steps.findIndex((s) => !s.done);

  const loadDemo = () => {
    if (!isEmpty && !window.confirm('Los datos de ejemplo sustituirán los que tienes ahora. ¿Seguir?')) return;
    dispatch({ type: 'replaceAll', data: buildDemoData() });
    toast('Datos de ejemplo cargados: 4 equipos y 2 grupos');
    go('conflicts');
  };

  return (
    <div className="home">
      <section className="hero">
        <h1>Encuentra qué partidos se pisan antes de que pase</h1>
        <p className="lead">
          MatchCalendar compara los calendarios de varios equipos o actividades y te avisa cuando alguien tendría que estar en dos sitios
          a la vez. Ideal para jugadores que juegan en dos equipos, entrenadores, o familias con varios hijos compitiendo.
        </p>
        <div className="hero-actions">
          <button className="primary lg" onClick={() => go(steps[nextStep === -1 ? 3 : nextStep].tab)}>
            {isEmpty ? 'Empezar' : 'Continuar'}
          </button>
          <button className="lg" onClick={loadDemo}>
            Probar con datos de ejemplo
          </button>
        </div>
      </section>

      <section className="card">
        <h2>¿Cómo decide si hay coincidencia?</h2>
        <p>
          Cada actividad tiene un <b>bloque de tiempo</b>: lo que dura más el margen para llegar a la siguiente. Un partido de
          baloncesto dura cerca de 2 h, pero con 1 h para desplazarse bloquea <b>3 h</b> desde su hora de inicio. Si el bloque de un
          partido se pisa con el de otro equipo del mismo grupo, es una coincidencia.
        </p>
        <div className="explain">
          <Timeline
            label="Coincidencia"
            bad
            bars={[
              { from: 10, to: 13, text: 'Baloncesto 10:00 (3 h)', color: 'var(--c-basket)' },
              { from: 12.5, to: 16, text: 'Fútbol 12:30 (3 h 30)', color: 'var(--c-futbol)', row: 1 },
            ]}
            overlap={[12.5, 13]}
            note="Se pisan 30 min: el fútbol tendría que empezar a las 13:00 o más tarde."
          />
          <Timeline
            label="Sin coincidencia"
            bars={[
              { from: 10, to: 13, text: 'Baloncesto 10:00 (3 h)', color: 'var(--c-basket)' },
              { from: 13, to: 16.5, text: 'Fútbol 13:00 (3 h 30)', color: 'var(--c-futbol)', row: 1 },
            ]}
            note="Un bloque acaba justo cuando empieza el otro: da tiempo a llegar."
          />
        </div>
      </section>

      <section className="card">
        <h2>Primeros pasos</h2>
        <ol className="steps">
          {steps.map((s, i) => (
            <li key={s.title} className={s.done ? 'done' : i === nextStep ? 'current' : ''}>
              <span className="step-num" aria-hidden>
                {s.done ? '✓' : i + 1}
              </span>
              <div className="step-body">
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
              <button className={i === nextStep ? 'primary' : ''} onClick={() => go(s.tab)}>
                {s.cta}
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section className="card">
        <h2>Preguntas frecuentes</h2>
        <details>
          <summary>¿Cómo importo el calendario de la federación?</summary>
          <p>
            En <b>Equipos</b>, abre el equipo y pulsa <b>Importar desde FCBQ</b>. En basquetcatala.cat, abre el calendario del equipo,
            selecciona la tabla de partidos con el ratón, cópiala (Ctrl+C) y pégala. Podrás revisar los partidos antes de guardarlos.
            Si vuelves a importar más adelante, los partidos se actualizan (por ejemplo, si ha cambiado la hora).
          </p>
        </details>
        <details>
          <summary>¿Y si un partido todavía no tiene hora?</summary>
          <p>Se guarda marcado en amarillo y no cuenta para las coincidencias hasta que le pongas hora.</p>
        </details>
        <details>
          <summary>¿Un partido concreto necesita más margen?</summary>
          <p>
            Puedes poner un bloque propio a un equipo entero (por ejemplo, si siempre juega lejos) o a un partido concreto. Si lo dejas
            vacío, se usa el de la actividad.
          </p>
        </details>
        <details>
          <summary>¿Dónde se guardan mis datos?</summary>
          <p>
            Solo en este navegador; no se envían a ningún sitio. Para usarlos en otro ordenador o compartirlos, ve a <b>Datos</b> y
            exporta una copia.
          </p>
        </details>
      </section>
    </div>
  );
}

const T0 = 9;
const T1 = 17;

function Timeline({
  label,
  bars,
  overlap,
  note,
  bad,
}: {
  label: string;
  bad?: boolean;
  bars: { from: number; to: number; text: string; color: string; row?: number }[];
  overlap?: [number, number];
  note: string;
}) {
  const pct = (h: number) => `${((h - T0) / (T1 - T0)) * 100}%`;
  const hours = Array.from({ length: T1 - T0 + 1 }, (_, i) => T0 + i);
  return (
    <figure className={'timeline ' + (bad ? 'is-bad' : 'is-ok')}>
      <figcaption>{label}</figcaption>
      <div className="tl-track">
        {hours.map((h) => (
          <span key={h} className="tl-hour" style={{ left: pct(h) }}>
            {h}h
          </span>
        ))}
        {overlap && <span className="tl-overlap" style={{ left: pct(overlap[0]), width: `calc(${pct(overlap[1])} - ${pct(overlap[0])})` }} />}
        {bars.map((b) => (
          <span
            key={b.text}
            className="tl-bar"
            style={{ left: pct(b.from), width: `calc(${pct(b.to)} - ${pct(b.from)})`, top: 22 + (b.row ?? 0) * 30, background: b.color }}
          >
            {b.text}
          </span>
        ))}
      </div>
      <p className="tl-note">{note}</p>
    </figure>
  );
}
