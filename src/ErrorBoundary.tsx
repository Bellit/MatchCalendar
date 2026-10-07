import { Component, type ErrorInfo, type ReactNode } from 'react';
import { STORAGE_KEY } from './model/store';
import { downloadFile } from './ui';

/**
 * Si algo falla al dibujar la app, muestra una salida en vez de una página en blanco:
 * descargar los datos tal cual están guardados y, si hace falta, empezar de cero.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('MatchCalendar se ha detenido', error, info.componentStack);
  }

  private download = () => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* storage bloqueado */
    }
    downloadFile(raw ?? '{}', 'matchcalendar-rescate.json');
  };

  private reset = () => {
    if (!window.confirm('Se borrarán todos los datos de este navegador. Si no has descargado una copia, se perderán. ¿Seguir?')) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage bloqueado */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main>
        <section className="card crash" role="alert">
          <h1>La app se ha detenido</h1>
          <p>
            Algo en los datos guardados no se ha podido mostrar. Tus datos siguen en este navegador: descarga una copia antes de hacer
            nada más.
          </p>
          <div className="toolbar">
            <button className="primary" onClick={this.download}>
              Descargar mis datos
            </button>
            <button onClick={() => window.location.reload()}>Recargar</button>
            <button className="danger" onClick={this.reset}>
              Borrar datos y empezar de cero
            </button>
          </div>
          <p className="muted crash-detail">Detalle técnico: {this.state.error.message}</p>
        </section>
      </main>
    );
  }
}
