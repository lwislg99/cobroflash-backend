// SCRUM-230 · QR-PAGINA-1 — opciones del QR de la PÁGINA PÚBLICA del profesional.
//
// 🔒 NO es el QR fiscal. El de VeriFactu se construye aparte (`pdf.service.ts` con el dato de
// `buildVeriFactuQrUrl`), su contenido lo fija la AEAT y no se personaliza. Los dos usan la
// librería `qrcode`, pero cada uno la llama con sus propias opciones inline: no hay wrapper ni
// configuración compartida, así que este fichero no puede alterar aquél. Queda escrito para que
// nadie lo dé por supuesto al leer «QR» en un diff.
//
// ── LO QUE ESTE MÓDULO EXISTE PARA IMPEDIR ───────────────────────────────────────────────
// Dejar elegir color es fácil; el trabajo es NO entregar un QR que no se escanea. Un gris suave
// «que pega con la marca» es perfectamente elegible en un selector y perfectamente ilegible para
// un lector. Y el pro no se entera al descargarlo: se entera cuando un cliente, delante de la
// furgoneta, no consigue escanear. Eso no es un defecto estético — es el producto afirmando que
// le ha dado un QR válido cuando no lo es.
//
// Por eso el validador es FAIL-CLOSED y PURO: se prueba con el color exacto que hoy pasaría, sin
// levantar servidor ni generar imágenes.

/** Formatos que se sirven. `svg` es el que pide una rotulación (vectorial, escala sin perder). */
export const FORMATOS_QR = ['png', 'svg'] as const;
export type FormatoQr = (typeof FORMATOS_QR)[number];

/** Tamaños en px del lado. Lista cerrada: un `?size=99999` es una bomba de memoria gratis. */
export const TAMANOS_QR = [512, 1024, 2048] as const;
export type TamanoQr = (typeof TAMANOS_QR)[number];

/**
 * Ratio mínimo de contraste entre módulos y fondo.
 *
 * 4,5:1 es el umbral AA de WCAG para texto normal. Se adopta ESE y no uno inventado por dos
 * motivos: es un número con fuente, y va sobrado para un lector de QR —que necesita menos que
 * un ojo humano leyendo texto pequeño—. Preferimos rechazar de más: un QR rechazado se corrige
 * en dos clics; uno que no escanea se descubre en la calle.
 */
export const CONTRASTE_MINIMO = 4.5;

const NEGRO = '#000000';
const BLANCO = '#ffffff';

export class ErrorQr extends Error {
  constructor(public readonly codigo: string, mensaje: string) {
    super(mensaje);
  }
}

/** #abc → #aabbcc. Devuelve null si no es un hex válido (no lanza: quien llama decide). */
function normalizarHex(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const v = valor.trim().toLowerCase();
  const corto = /^#?([0-9a-f]{3})$/.exec(v);
  if (corto) return '#' + corto[1].split('').map((c) => c + c).join('');
  const largo = /^#?([0-9a-f]{6})$/.exec(v);
  return largo ? '#' + largo[1] : null;
}

/** Luminancia relativa (WCAG 2.x). Es la base del ratio de contraste. */
export function luminanciaRelativa(hex: string): number {
  const n = normalizarHex(hex);
  if (!n) throw new ErrorQr('color_invalido', `Color no válido: ${String(hex)}`);
  const canal = (i: number) => {
    const s = parseInt(n.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2);
}

/** Ratio de contraste WCAG entre dos colores. 21 = negro sobre blanco, 1 = iguales. */
export function ratioContraste(a: string, b: string): number {
  const la = luminanciaRelativa(a);
  const lb = luminanciaRelativa(b);
  const [claro, oscuro] = la >= lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (oscuro + 0.05);
}

export interface OpcionesQr {
  formato: FormatoQr;
  size: number;
  dark: string;
  light: string;
  /** `false` = previsualizar en línea; `true` = forzar descarga (el comportamiento de siempre). */
  descargar: boolean;
}

/**
 * Traduce los parámetros de la petición a opciones válidas, o lanza `ErrorQr` con código estable.
 *
 * Sin parámetros devuelve EXACTAMENTE lo que el endpoint hacía antes (1024 px, PNG, negro sobre
 * blanco, descarga): quien no personaliza nada no nota ningún cambio.
 */
export function resolverOpcionesQr(
  q: Record<string, unknown>,
  ctx: { brandColor?: string | null },
): OpcionesQr {
  const formatoRaw = typeof q.formato === 'string' ? q.formato.toLowerCase() : 'png';
  if (!(FORMATOS_QR as readonly string[]).includes(formatoRaw)) {
    throw new ErrorQr('formato_invalido', `Formato no admitido: ${formatoRaw}. Usa ${FORMATOS_QR.join(' o ')}.`);
  }

  const size = q.size === undefined ? 1024 : Number(q.size);
  if (!(TAMANOS_QR as readonly number[]).includes(size)) {
    throw new ErrorQr('tamano_invalido', `Tamaño no admitido: ${String(q.size)}. Usa ${TAMANOS_QR.join(', ')}.`);
  }

  // `marca` = el color de marca ya configurado por el merchant. Si no lo tiene, se cae al negro
  // en vez de fallar: pedir el color de marca cuando no hay ninguno no es un error del usuario.
  const resolverColor = (valor: unknown, pordefecto: string): string => {
    if (valor === undefined || valor === '') return pordefecto;
    if (valor === 'marca') return normalizarHex(ctx.brandColor) ?? pordefecto;
    const hex = normalizarHex(valor);
    if (!hex) throw new ErrorQr('color_invalido', `Color no válido: ${String(valor)}`);
    return hex;
  };

  const dark = resolverColor(q.dark, NEGRO);
  const light = resolverColor(q.light, BLANCO);

  // ⚠️ DOS COMPROBACIONES, y hacen falta LAS DOS.
  //
  // El contraste solo NO basta: blanco sobre negro da 21:1 —el máximo posible— y aun así muchos
  // lectores no lo leen, porque el estándar espera módulos OSCUROS sobre fondo CLARO. Un QR
  // invertido con contraste perfecto pasaría el primer filtro y seguiría sin escanearse.
  // ⚠️ Los DOS mensajes de abajo los APROBÓ el fundador el 29-jul-2026 (regla 30). Son los que
  // ve el profesional tal cual —la UI los muestra sin reescribirlos—, así que NO se reformulan
  // ni se les añade el dato técnico: el ratio exacto le dice al pro lo mismo que nada.
  if (luminanciaRelativa(dark) >= luminanciaRelativa(light)) {
    throw new ErrorQr(
      'qr_invertido',
      'El código tiene que ir oscuro sobre fondo claro. Al revés, muchos móviles no lo leen.',
    );
  }

  if (ratioContraste(dark, light) < CONTRASTE_MINIMO) {
    throw new ErrorQr(
      'contraste_insuficiente',
      'Este color no se distingue del fondo y el QR dejaría de escanearse. Elige uno más oscuro.',
    );
  }

  const preview = q.preview === '1' || q.preview === 'true';
  return { formato: formatoRaw as FormatoQr, size, dark, light, descargar: !preview };
}
