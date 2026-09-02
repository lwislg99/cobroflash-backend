import crypto from 'crypto';
// SCRUM-655: quién SUMA y quién no lo decide `apartados.ts`, en un solo sitio.
import { lineasQueSuman } from '../../modules/quotes/domain/apartados';

// A11.2 (S3): teléfonos SIEMPRE enmascarados en logs — prefijo + últimos 3.
// "34000000001" → "34•••••001". Nunca usar el número completo en console.*.
// SCRUM-261: el ejemplo era un MÓVIL REAL. Un número de verdad en un comentario se copia —
// a un test, a un seed, a un ticket— así que el ejemplo va en el rango imposible de SCRUM-262.
export function maskPhone(input?: string | null): string {
  const p = String(input ?? '').replace(/\D/g, '');
  if (!p) return '—';
  if (p.length <= 5) return `•••${p.slice(-2)}`;
  return `${p.slice(0, 2)}${'•'.repeat(Math.max(3, p.length - 5))}${p.slice(-3)}`;
}

// SCRUM-101: emails SIEMPRE enmascarados en logs — mismo espíritu que maskPhone, pero
// por HASH en vez de caracteres parciales: un email es más fácil de re-identificar a
// partir de solo 2-3 caracteres visibles que un teléfono (el local-part suele ser un
// nombre). Conserva el dominio (útil para depurar patrones de bounce/typo por proveedor)
// y un hash corto NO reversible (útil para correlacionar "es el mismo email" entre
// líneas de log sin guardar el dato — RGPD: minimización). Nunca interpolar el email
// crudo en console.*.
export function maskEmail(input?: string | null): string {
  const e = String(input ?? '').trim().toLowerCase();
  const at = e.indexOf('@');
  if (!e || at <= 0) return '—';
  const domain = e.slice(at + 1);
  const hash = crypto.createHash('sha256').update(e).digest('hex').slice(0, 8);
  return `${hash}@${domain}`;
}

export function normalizePhone(input?: string | null): string {
    if (!input) return '';
    let p = String(input).trim();
    p = p.replace(/[\s\-()]/g, '');
    if (p.startsWith('+')) p = p.slice(1);
    if (p.startsWith('00')) p = p.slice(2);
    if (!/^\d{8,15}$/.test(p)) return '';
    return p;
  }
  
  /**
   * SCRUM-636 · EL IMPORTE **SIN SÍMBOLO**, con el mismo formato que `formatMoneyEs`.
   *
   * ── POR QUÉ UNA VARIANTE Y NO APLANARLO TODO ────────────────────────────────────────────
   *
   * Hay sitios donde el símbolo NO va en la cifra: las columnas de precio y total de un PDF lo
   * llevan en la cabecera, no en cada fila. Forzarles `formatMoneyEs` metería un `€` por celda.
   *
   * Es la misma forma que tomó SCRUM-436 en el front: el formateador compartido **gana una
   * variante** (allí `fmtMoneyEsOAusente`, para el «—» del libro) en vez de aplanar los casos
   * legítimos. Una variante declarada es un sitio único con dos salidas; cuatro copias son cuatro
   * sitios donde divergir.
   *
   * 🔴 `useGrouping: 'always'` NO ES COSMÉTICO, y es la razón de que esto exista. `es-ES` **no
   * agrupa los números de cuatro cifras** por CLDR, así que un `toLocaleString` a pelo escribe
   * `1000,00` y `9999,99` — justo el tramo del importe corriente de un trabajo. Cada copia del
   * formato que se hizo por su cuenta reintrodujo ese defecto; A18.2 (AB6) lo había corregido y
   * SCRUM-436 lo volvió a corregir en el front. Aquí se corrige en el backend.
   *
   * Comparte cuerpo con `formatMoneyEs` a propósito —mismo `Intl`, mismas opciones— salvo
   * `style`. Si divergieran, el símbolo dejaría de ser lo único que las separa.
   */
  export function formatImporteEs(n: number | string | { toString(): string }): string {
    const v = Number(String(n));
    try {
      return new Intl.NumberFormat('es-ES', {
        style: 'decimal',
        useGrouping: 'always' as unknown as boolean,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(v);
    } catch {
      // Mismo respaldo que `formatMoneyEs`: si `Intl` falla, se escribe algo legible en vez de
      // reventar el documento entero.
      return v.toFixed(2);
    }
  }

  // A6.6 (P1 visual): dinero CLIENT-FACING siempre en formato español —
  // "2.383,70 €" (o "1.500,00 MXN" fuera del euro), nunca "2383.70 EUR".
  export function formatMoneyEs(
    n: number | string | { toString(): string }, // acepta Prisma Decimal
    currency = 'EUR',
  ): string {
    const v = Number(String(n));
    try {
      return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        // A18.2 (AB6): punto de miles SIEMPRE ("2.383,70 €", no "2383,70 €")
        useGrouping: 'always' as unknown as boolean,
        currency: currency || 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(v);
    } catch {
      return `${v.toFixed(2)} ${currency}`;
    }
  }

  // SCRUM-655: `qty` y `price` son OPCIONALES porque una CABECERA de apartado no las tiene. El
  // tipo dice la verdad sobre la forma real de `Quote.lines`; quien sume, filtra por la marca.
  export type QuoteLine = { concept: string; qty?: number; price?: number; tax?: number; apartado?: boolean };
  
  /**
   * El total de un presupuesto.
   *
   * 🔴 SCRUM-655 · LAS CABECERAS DE APARTADO NO SUMAN, y antes no era «no sumaban»: era `NaN`.
   * Una cabecera no lleva cantidad ni precio, y `undefined * undefined` es `NaN`, que contamina
   * la suma entera — medido con esta misma función antes de tocarla:
   *
   *     [{concept:'Mano de obra', qty:2, price:100}]                     →  200
   *     [{concept:'1. APARTADO'}, {concept:'Mano de obra', qty:2, …}]     →  NaN
   *
   * Se filtran por su MARCA, no por «no tener precio»: así una cabecera a la que alguien le meta
   * un importe sigue sin mover el total, que es lo único que hace de esto una garantía.
   */
  export function calcTotal(lines: QuoteLine[]): number {
    const sum = lineasQueSuman(lines as unknown as Record<string, unknown>[])
      .reduce((acc, l) => acc + Number(l.qty) * Number(l.price) * (1 + (Number(l.tax) || 0)), 0);
    return Math.round(sum * 100) / 100;
  }
  
  export function makeReference() {
    const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `CF-${ymd}-${rand}`;
  }
  
  // nextInvoiceNumber() (aleatorio) eliminado en Sprint SPAIN: los números de
  // factura los asigna SIEMPRE modules/invoicing/domain/invoiceNumber.service.ts
  // (serie anual correlativa por merchant: 2026-CF-001).

  // Extrae el id numérico real de un parámetro de ruta, tolerando URLs "sucias".
  // El botón URL dinámica de WhatsApp puede dejar el placeholder sin sustituir
  // (p. ej. "{{1}}23" en vez de "23"); aquí quitamos primero cualquier "{{...}}"
  // (que contiene su propio dígito) y luego nos quedamos solo con los dígitos.
  // Devuelve NaN si no queda ningún dígito.
  export function parseNumericId(raw: unknown): number {
    const digits = String(raw ?? '')
      .replace(/\{\{.*?\}\}/g, '')  // fuera placeholders tipo {{1}}
      .replace(/\D/g, '');          // solo dígitos
    return digits ? Number(digits) : NaN;
  }

  // SCRUM-95: mismo saneo que parseNumericId, pero para tokens opacos hexadecimales
  // (crypto.randomBytes(16).toString('hex'), 32 caracteres) en vez de ids numéricos —
  // quita primero cualquier placeholder "{{...}}" sin sustituir y se queda solo con
  // hex. Cadena vacía si no queda nada válido (findUnique con '' nunca matchea).
  export function parseToken(raw: unknown): string {
    return String(raw ?? '')
      .replace(/\{\{.*?\}\}/g, '')
      .replace(/[^0-9a-fA-F]/g, '')
      .toLowerCase();
  }

  // HTML escape
  export function esc(v?: string | number | null) {
    return String(v ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as any)[s]);
  }
  