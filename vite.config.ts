import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Política de seguridad de contenido. GitHub Pages no permite cabeceras propias, así que va en un <meta>.
 * La app no habla con ningún servidor: todo (scripts, estilos, fuentes, iconos) sale de la propia web.
 * 'unsafe-inline' en estilos es necesario para los colores de cada actividad (atributo style de React).
 * Solo en la build: el servidor de desarrollo de Vite usa scripts en línea que esta política bloquearía.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'matchcalendar-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  };
}

export default defineConfig({
  base: '/MatchCalendar/',
  plugins: [react(), contentSecurityPolicy()],
});
