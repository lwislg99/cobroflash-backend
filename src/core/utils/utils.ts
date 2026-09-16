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
  /**
   * SCRUM-743 · LO ÚNICO QUE LAS TRES FORMAS COMPARTEN, Y LO ÚNICO QUE NO PUEDE DIVERGIR.
   *
   * `es-ES` **no agrupa los enteros de cuatro cifras** por CLDR. Cada copia del formato que se
   * escribió por su cuenta reintrodujo ese defecto —A18.2 lo corrigió, SCRUM-436 lo volvió a
   * corregir en el front, SCRUM-636 en el backend y SCRUM-739 en Informes—, y siempre por el mismo
   * motivo: la agrupación estaba escrita N veces.
   *
   * Aquí está UNA vez. Las tres formas la traen con `...AGRUPA_SIEMPRE`, así que lo que las separa
   * es sólo lo que TIENE que separarlas: el símbolo y los decimales.
   */
  const AGRUPA_SIEMPRE = { useGrouping: 'always' as unknown as boolean };

  export function formatImporteEs(n: number | string | { toString(): string }): string {
    const v = Number(String(n));
    try {
      return new Intl.NumberFormat('es-ES', {
        ...AGRUPA_SIEMPRE,
        style: 'decimal',
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
        // A18.2 (AB6): punto de miles SIEMPRE ("2.383,70 €", no "2383,70 €").
        // SCRUM-743: viene de `AGRUPA_SIEMPRE`, compartido con las otras dos formas.
        ...AGRUPA_SIEMPRE,
        style: 'currency',
        currency: currency || 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(v);
    } catch {
      return `${v.toFixed(2)} ${currency}`;
    }
  }

  /**
   * ─────────────────────────────────────────────────────────────────────────────────────────
   * SCRUM-743 · LA TERCERA FORMA: **agrupar SIN forzar decimales**.
   *
   * No es dinero: es un NÚMERO que se escribe en un documento o en una pantalla — una cantidad
   * («1.500 ud»), el rótulo de un eje. Por eso no puede pasar por las otras dos.
   *
   * 🔴 `1,5` SIGUE SIENDO `1,5`, NO `1,50`. Ése es el filo entero de este ticket. Las dos formas
   * de dinero fijan `minimumFractionDigits: 2`; pasar una cantidad por ellas **añadiría decimales
   * que hoy no están** — y en un albarán FIRMADO eso es cambiar lo impreso, que es peor que el
   * defecto que se viene a arreglar. Aquí el mínimo es 0: los decimales que traiga, hasta dos.
   *
   * Lo que SÍ comparte con las otras dos es `AGRUPA_SIEMPRE`, que es lo que estaba roto: un
   * `toLocaleString('es-ES')` a pelo escribe `1500` donde el producto escribe `1.500`.
   * ─────────────────────────────────────────────────────────────────────────────────────────
   */
  export function formatNumeroEs(n: number | string | { toString(): string }): string {
    const v = Number(String(n));
    try {
      return new Intl.NumberFormat('es-ES', {
        ...AGRUPA_SIEMPRE,
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(v);
    } catch {
      // Mismo criterio que las otras dos: si `Intl` falla, algo legible antes que romper el
      // documento. Sin `toFixed`, que forzaría los decimales que esta forma existe para no poner.
      return String(v);
    }
  }

  // SCRUM-655: `qty` y `price` son OPCIONALES porque una CABECERA de apartado no las tiene. El
  // tipo dice la verdad sobre la forma real de `Quote.lines`; quien sume, filtra por la marca.
  export type QuoteLine = {
    concept: string; qty?: number; price?: number; tax?: number; apartado?: boolean;
    /**
     * SCRUM-594 (DOC-04) · el descuento de ESTA línea, en PORCENTAJE.
     *
     * 🔴 OPCIONAL Y NUNCA CON DEFAULT. Una línea sin `dto` —y lo son TODAS las anteriores a este
     * ticket— tiene que dar exactamente el mismo total que antes. Es el mismo criterio que
     * `costeUnitario` (SCRUM-661): un default convertiría el silencio en un dato.
     */
    dto?: number;
  };

  /** El precio de una línea DESPUÉS de su descuento. Sin `dto`, es el precio tal cual. */
  function precioConDto(price: unknown, dto: unknown): number {
    const p = Number(price);
    if (!Number.isFinite(p)) return 0;
    const d = Number(dto);
    if (!Number.isFinite(d) || d <= 0) return p;
    return p * (1 - Math.min(100, d) / 100);
  }
  
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
  export function calcTotal(lines: QuoteLine[], descuentoGlobal?: number | string | null): number {
    const suman = lineasQueSuman(lines as unknown as Record<string, unknown>[]);

    // ── SCRUM-594 · EL DESCUENTO DE LÍNEA OPERA SÓLO SOBRE EL PRECIO ──────────────────────
    // El margen NO vive en el documento (DOC-08): vive en el catálogo. Así que aquí no hay
    // ningún margen que respetar, y el descuento se aplica al precio y ya.
    //
    // 🔴 LA CONVENCIÓN DE REDONDEO NO SE TOCA. `Math.round(sum * 100) / 100` sobre la suma en
    // coma flotante es la que esta función ya tenía, y cambiarla movería importes de documentos
    // existentes. Son CUATRO conviviendo en el árbol (medido en SCRUM-624) y la elección está en
    // la asesoría con SCRUM-619 y 623: este ticket no la decide.
    const base = suman.reduce(
      (acc, l) => acc + Number(l.qty) * precioConDto(l.price, (l as Record<string, unknown>).dto)
        * (1 + (Number(l.tax) || 0)),
      0,
    );

    // ── EL DESCUENTO GLOBAL ────────────────────────────────────────────────────────────────
    // Va en EUROS y reduce la base ANTES del impuesto, así que su efecto sobre el total incluye
    // el IVA que deja de devengarse. Se prorratea entre los tipos proporcionalmente a su base
    // —la única forma que no elige favorecer a nadie— y el ÚLTIMO tipo absorbe el céntimo que
    // sobra, para que la suma de los repartos sea EXACTAMENTE el importe que el cliente firmó.
    //
    // ⚠️ REGLA DEL PRESUPUESTO, QUE NO ES DOCUMENTO FISCAL. Antes de que un descuento llegue a
    // una FACTURA, este prorrateo va a la asesoría con SCRUM-619, 623 y 624.
    const global = Number(descuentoGlobal);
    if (!Number.isFinite(global) || global <= 0) return Math.round(base * 100) / 100;

    const porTipo = new Map<number, number>();
    for (const l of suman) {
      const rate = Math.round((Number(l.tax) || 0) * 100);
      const baseCents = Math.round(
        Number(l.qty) * precioConDto(l.price, (l as Record<string, unknown>).dto) * 100,
      );
      porTipo.set(rate, (porTipo.get(rate) || 0) + (Number.isFinite(baseCents) ? baseCents : 0));
    }
    const tipos = [...porTipo.entries()];
    const sumaBases = tipos.reduce((a, [, c]) => a + c, 0);
    if (sumaBases <= 0) return Math.round(base * 100) / 100;

    const aRepartir = Math.min(Math.round(global * 100), sumaBases);
    let quitado = 0;
    let acumulado = 0;
    for (let i = 0; i < tipos.length; i++) {
      const [rate, baseCents] = tipos[i];
      const cents = i === tipos.length - 1
        ? aRepartir - acumulado
        : Math.round((aRepartir * baseCents) / sumaBases);
      acumulado += cents;
      quitado += cents * (1 + rate / 100);   // el descuento se lleva su parte de impuesto
    }
    return Math.round((base * 100 - quitado)) / 100;
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

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // SCRUM-807 · LA HERMANA DE `esc`, Y ESTÁ AL LADO A PROPÓSITO — NO DENTRO
  //
  // `esc` escapa HTML y lo hace bien. Un href NO se defiende escapando HTML: se defiende
  // validando el ESQUEMA. En `javascript:alert(1)` no hay un solo carácter que escapar, así que
  // `esc` lo devuelve intacto — y no es un fallo suyo, es que le estábamos pidiendo otro trabajo.
  // MEDIDO en SCRUM-807: cinco de seis cargas llegaban crudas al atributo, y dos de tres
  // variantes de navegación las EJECUTABAN en el origen de la aplicación.
  //
  // 🔴 Y NO SE METIÓ DENTRO DE `esc`: darle dos trabajos garantiza que un día haga mal uno de los
  // dos. Vive aquí pegada para que quien busque `esc` para un href se tropiece con ella.
  //
  // 🔴 LISTA BLANCA, NUNCA LISTA NEGRA. Las seis cargas de aquel censo enseñan por qué: bastaron
  // las MAYÚSCULAS (`JaVaScRiPt:`) y un ESPACIO delante para pasar por encima de cualquier
  // prohibición escrita a mano. Una lista negra es un censo de lo que se le ocurrió a alguien un
  // martes; una lista blanca es lo que la aplicación necesita de verdad, que aquí es poco:
  //   · un camino propio (`/outbox/…`, que es lo que produce el flujo real), y
  //   · http/https, para un enlace externo legítimo.
  // Todo lo demás sale `'#'`: un ancla inerte, que no es copy sino la forma estándar de no ir
  // a ninguna parte. Se prefiere a borrar el enlace porque no cambia el texto de nadie.
  //
  // `//evil.example` y `/\evil.example` NO cuentan como camino propio: el navegador los lleva a
  // OTRO ORIGEN. Por eso se mira el segundo carácter, y no sólo el primero.
  const ESQUEMAS_DE_HREF_PERMITIDOS = new Set(['http:', 'https:']);

  export function hrefSeguro(v?: string | null): string {
    const s = String(v ?? '').trim();
    if (!s) return '#';
    if (s.startsWith('/')) return s[1] === '/' || s[1] === '\\' ? '#' : s;
    try {
      return ESQUEMAS_DE_HREF_PERMITIDOS.has(new URL(s).protocol) ? s : '#';
    } catch {
      return '#'; // ni camino propio ni URL absoluta que el navegador entienda
    }
  }
  