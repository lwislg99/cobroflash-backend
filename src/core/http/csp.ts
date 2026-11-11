// SCRUM-1637 · PASO 1 de la Content-Security-Policy: SÓLO `-Report-Only`.
//
// POR QUÉ REPORT-ONLY Y NO LA CABECERA DE VERDAD (decisión del orquestador, 2-nov-2026):
// medidas 24 páginas públicas o servidas con `<script>` en línea y `style=`, y 10 manejadores
// `on*=` en ocho ficheros de cuatro carriles. Con `script-src 'self'` aplicada se rompen TODAS.
// Y la salida fácil —añadir `'unsafe-inline'`— NO entra: el XSS de SCRUM-1632c era exactamente
// script en línea inyectado, así que una CSP con `'unsafe-inline'` sería una cabecera puesta y
// cero protección contra lo único que nos ha mordido.
//
// Así que la política de abajo es la que QUEREMOS aplicar, escrita estricta, y el navegador sólo
// INFORMA de lo que habría bloqueado: no rompe nada y enseña la población real de quejas (en la
// consola; el colector `report-uri` es el tramo siguiente). Pasar a `Content-Security-Policy`
// es el paso 3, cuando el paso 2 (quitar los manejadores y scripts en línea) deje el informe
// vacío. Hasta entonces esta cabecera NO protege de nada, y no se puede contar como protección.

/** Directivas de la política que se quiere llegar a aplicar. Una por línea (un elemento por línea). */
export const DIRECTIVAS_CSP: readonly string[] = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  // Las firmas y fotos se pintan como data-URI/blob en las páginas de firma y el panel.
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
];

export const CABECERA_CSP_INFORME = 'Content-Security-Policy-Report-Only';

export const POLITICA_CSP = DIRECTIVAS_CSP.join('; ');

/** Middleware global: pone la política en modo informe en TODA respuesta. */
export function cspSoloInforme(_req: unknown, res: { setHeader(n: string, v: string): unknown }, next: () => void): void {
  res.setHeader(CABECERA_CSP_INFORME, POLITICA_CSP);
  next();
}
