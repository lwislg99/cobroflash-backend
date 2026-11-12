// src/modules/invoicing/domain/selloTemporal.ts — SCRUM-1726 (pieza 1)
//
// EL «SELLO TEMPORAL» DEL CERTIFICADO DE EVIDENCIAS DE LA FIRMA, con su etiqueta.
//
// Firmado por el fundador el 12-nov-2026 (SCRUM-1656 c.21724, propuesta 1 de c.21722): la hora en la
// zona del negocio y, detrás, «(hora peninsular)». Los comercios sin zona guardada siguen con
// «(hora del servidor)» y no se añade ningún texto nuevo.
//
// 🔴 SÓLO LA PENÍNSULA lleva «(hora peninsular)». Las zonas que escribe el alta son dos
// (`zonaDeLaProvincia.ts`: `Europe/Madrid` y `Atlantic/Canary`); para Canarias «hora peninsular»
// sería falso, y un texto para ella no está firmado: se queda como antes, en la hora del servidor.
// Sin zona, o con una que `Intl` no conoce, `zonaDelMerchant` da UTC (decisión A): también como antes.
//
// La hora «del servidor» se pide EXPLÍCITA (la zona que resuelve el proceso), no por omisión: es lo
// que su etiqueta dice, y así ninguna de las dos ramas lee el reloj del proceso sin nombrarlo.
//
// ⛔ NO ES VERIFACTU NI CAMINO DE EMISIÓN: el certificado sólo lo pinta `generateQuotePdf` (el PDF del
// presupuesto firmado), no `generateInvoicePdf`. Medido por AST en SCRUM-1726.
import { zonaDelMerchant } from '../../../core/zonaDelMerchant';

// Sin `export`: nadie fuera de este fichero la lee, y un export sin llamador lo tumba scrum411.
const ZONA_PENINSULAR = 'Europe/Madrid';

const FORMA: Intl.DateTimeFormatOptions = {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
};

/**
 * «12/11/2026, 17:34:51 (hora peninsular)» · o «… (hora del servidor)» sin zona peninsular.
 * `firmadoAt` viene de un Json: si falta o no es una fecha, «—» y la etiqueta igual (como antes).
 */
export function selloTemporal(firmadoAt: unknown, zona: string | null | undefined): string {
  const peninsular = zonaDelMerchant({ timezone: zona ?? null }) === ZONA_PENINSULAR;
  const zonaDelSello = peninsular ? ZONA_PENINSULAR : Intl.DateTimeFormat().resolvedOptions().timeZone;
  const etiqueta = peninsular ? '(hora peninsular)' : '(hora del servidor)';
  const d = firmadoAt ? new Date(firmadoAt as string) : null;
  const sello = d && !Number.isNaN(d.getTime())
    ? d.toLocaleString('es-ES', { ...FORMA, timeZone: zonaDelSello })
    : '—';
  return `${sello} ${etiqueta}`;
}
