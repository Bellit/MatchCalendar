import { useRef, useState } from 'react';
import { useStore } from '../model/store';
import { DEFAULT_DATA } from '../model/types';
import { parseAppData } from '../model/validate';
import { downloadBackup, Icon, plural, useReplaceAllWithUndo, useUi } from '../ui';

export default function Data() {
  const { data } = useStore();
  const { toast, confirm } = useUi();
  const replaceAll = useReplaceAllWithUndo();
  const fileRef = useRef<HTMLInputElement>(null);
  // Los errores de importación se quedan a la vista (un aviso de 3 s se pierde) hasta que se cierran o se reintenta.
  const [importError, setImportError] = useState<string | null>(null);

  const exportJson = () => {
    downloadBackup(data);
    toast('Copia descargada');
  };

  const importJson = async (file: File) => {
    setImportError(null);
    try {
      let raw: unknown;
      try {
        raw = JSON.parse(await file.text());
      } catch {
        throw new Error('El archivo no es un JSON válido. Elige un archivo descargado con «Descargar copia».');
      }
      const result = parseAppData(raw);
      if (!result.ok)
        throw new Error(
          result.reason === 'newer'
            ? 'La copia es de una versión más nueva de MatchCalendar. Recarga la página para actualizar y vuelve a intentarlo.'
            : 'El archivo no es una copia de MatchCalendar. Elige un archivo descargado con «Descargar copia».',
        );
      const { data: clean, dropped } = result;
      const ok = await confirm({
        title: '¿Cargar esta copia?',
        body: (
          <>
            <p>
              Sustituirá todos los datos actuales por {plural(clean.teams.length, 'equipo')}, {plural(clean.events.length, 'partido')} y{' '}
              {plural(clean.groups.length, 'grupo')}. Podrás deshacerlo justo después.
            </p>
            {dropped > 0 && (
              <p className="notice warn">
                {dropped === 1 ? '1 elemento del archivo está dañado o incompleto' : `${dropped} elementos del archivo están dañados o incompletos`} y
                no se cargará{dropped === 1 ? '' : 'n'}.
              </p>
            )}
          </>
        ),
        confirmLabel: 'Cargar copia',
        offerBackup: true,
      });
      if (ok)
        replaceAll(
          clean,
          `Copia cargada: ${plural(clean.teams.length, 'equipo')}, ${plural(clean.events.length, 'partido')}` + (dropped ? ` (${dropped} descartados)` : ''),
        );
    } catch (e) {
      setImportError((e as Error).message);
    }
  };

  const stats = [
    [data.activityTypes.length, 'actividades'],
    [data.teams.length, 'equipos'],
    [data.events.length, 'partidos'],
    [data.groups.length, 'grupos'],
  ] as const;

  return (
    <>
      <section className="card">
        <h2>Tus datos</h2>
        <p className="muted">
          Todo se guarda <b>solo en este navegador</b>. Haz una copia de vez en cuando para no perderla, o para pasarla a otro ordenador
          o a otra persona (por ejemplo, al coordinador del club).
        </p>
        <p className="notice warn">
          Los datos no tienen contraseña: cualquiera que use este navegador puede verlos. En un ordenador compartido (el del club, una
          biblioteca…) borra los datos al terminar. Las copias descargadas incluyen nombres de equipos y personas: compártelas solo
          con quien las necesite.
        </p>
        <div className="stats">
          {stats.map(([n, label]) => (
            <div key={label} className="stat">
              <span className="stat-value">{n}</span>
              <span className="stat-label">{label}</span>
            </div>
          ))}
        </div>
        {importError && (
          <p className="notice bad" role="alert">
            No se ha podido cargar la copia. {importError}{' '}
            <button className="link" onClick={() => setImportError(null)}>
              Cerrar
            </button>
          </p>
        )}
        <div className="toolbar">
          <button className="primary with-icon" onClick={exportJson}>
            <Icon name="download" /> Descargar copia
          </button>
          <button className="with-icon" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" /> Cargar copia…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJson(f);
              e.target.value = '';
            }}
          />
        </div>
      </section>
      <section className="card danger-zone">
        <h2>Zona peligrosa</h2>
        <p className="muted">Borra todos los equipos, partidos y grupos de este navegador. Las actividades vuelven a los valores iniciales.</p>
        <button
          className="danger solid"
          onClick={async () => {
            const ok = await confirm({
              title: '¿Borrar todos los datos?',
              body: <p>Se borrarán todos los equipos, partidos y grupos de este navegador. Podrás deshacerlo solo durante unos segundos.</p>,
              confirmLabel: 'Borrar todo',
              danger: true,
              offerBackup: true,
            });
            if (ok) replaceAll(DEFAULT_DATA, 'Datos borrados');
          }}
        >
          Borrar todo
        </button>
      </section>
    </>
  );
}
