// src/core/validation/nifEspanol.ts — SCRUM-575 (CONT-02)
//
// VALIDACIÓN DE NIF / CIF / NIE ESPAÑOL: **FORMA Y DÍGITO DE CONTROL**. Nada más.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTO ES FISCAL Y POR QUÉ SE ARREGLA AHORA, QUE NO DUELE
//
// Hoy el profesional teclea un NIF mal formado y nadie le dice nada. El día que se encienda
// `INVOICING_ES_ENABLED`, ese dato vuelve como **RECHAZO DE REGISTRO** —con la factura ya
// emitida detrás— y el camino de salida es el del runbook R7: `VfSubmission.lastError` → dato de
// factura → corregir por R1 si ya está emitida. Una factura emitida no se edita (regla 29).
//
// O sea: el coste de teclearlo mal se paga en el peor momento posible. Comprobar la aritmética
// mientras el flag está OFF es gratis; comprobarla después, no.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LOS DOS LÍMITES, Y EL PRIMERO ES EL TICKET ENTERO
//
//  1. **EL CAMPO SIGUE SIENDO OPCIONAL. VALIDAR NO ES OBLIGAR.** Vacío = VÁLIDO, sin queja.
//     Sólo se juzga lo que el profesional SÍ escribió. Convertir esto en un campo obligatorio
//     sería cambiar el producto sin permiso, y es el modo de fallo más fácil de introducir sin
//     querer al añadir una validación. Tiene test propio, y es el control negativo que más
//     importa.
//  2. **SE VALIDA LA FORMA, NO LA EXISTENCIA.** Ni una petición de red, ni una comprobación
//     contra ningún registro externo. Que un NIF esté bien construido no dice que exista; decir
//     lo contrario sería una promesa que este código no puede cumplir.
//
// Sin librerías (regla 36): el dígito de control es aritmética de una línea y se escribe.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA NORMALIZACIÓN VIVE AQUÍ, Y ES LA ÚNICA
//
// `identificadoresDuplicados` (SCRUM-578) la IMPORTA de aquí en vez de tener la suya. Dos
// normalizaciones del mismo dato son dos sitios donde divergir — es el defecto que SCRUM-578
// documentó con los teléfonos, y no se comete otra vez con los NIF.

/**
 * Un NIF se escribe con espacios, guiones y en minúsculas sin dejar de ser el mismo documento.
 * Se normaliza en vez de rechazar: hacer fallar a alguien por teclear `b-1234 5678` sería
 * pedantería, no validación. Es también la forma con la que se compara y se guarda.
 */
export function normalizarNif(valor?: string | null): string {
  return String(valor ?? '').toUpperCase().replace(/[\s.-]/g, '');
}

/** La tabla de letras del DNI. Es una constante publicada, no un cálculo: se escribe tal cual. */
const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';

/** Letras de entidad admitidas al principio de un CIF. */
const LETRAS_CIF = 'ABCDEFGHJKLMNPQRSUVW';
/** Entidades cuyo control es SIEMPRE una letra. */
const CIF_CONTROL_LETRA = 'KPQRSNW';
/** Entidades cuyo control es SIEMPRE un dígito. */
const CIF_CONTROL_DIGITO = 'ABEH';

export type TipoDocumento = 'DNI' | 'NIE' | 'CIF';

export interface ResultadoNif {
  /** `true` también cuando está VACÍO: el campo es opcional. */
  valido: boolean;
  /** `null` cuando está vacío o cuando no se reconoce la forma. */
  tipo: TipoDocumento | null;
  /**
   * Código estable del motivo, NUNCA un texto de pantalla. El mensaje que lee el profesional es
   * del fundador (regla 30) y lo pone el formulario con su marcador.
   */
  motivo: 'vacio' | 'ok' | 'forma' | 'control' | null;
}

const OK = (tipo: TipoDocumento): ResultadoNif => ({ valido: true, tipo, motivo: 'ok' });
const MAL = (tipo: TipoDocumento | null, motivo: 'forma' | 'control'): ResultadoNif =>
  ({ valido: false, tipo, motivo });

/** Letra que le corresponde a un número de 8 dígitos (DNI, y NIE tras sustituir su inicial). */
function letraDe(numero: number): string {
  return LETRAS_DNI[numero % 23];
}

/**
 * El control del CIF: se doblan las cifras de las posiciones IMPARES y se suman sus dígitos; las
 * PARES se suman tal cual. El control es lo que falta para llegar a la decena siguiente.
 *
 * Comprobado a mano con un caso publicado (`A58818501`): dígitos `5881850` → impares 5,8,8,0
 * doblados 10,16,16,0 → suma de sus cifras 1+7+7+0 = 15; pares 8,1,5 → 14; total 29;
 * control = (10 − 29 % 10) % 10 = **1**. Coincide.
 */
function controlCif(sieteDigitos: string): number {
  let pares = 0;
  let impares = 0;
  for (let i = 0; i < 7; i += 1) {
    const d = Number(sieteDigitos[i]);
    if (i % 2 === 0) {              // posiciones 1ª, 3ª, 5ª, 7ª (índices pares)
      const doble = d * 2;
      impares += Math.floor(doble / 10) + (doble % 10);
    } else {
      pares += d;
    }
  }
  return (10 - ((pares + impares) % 10)) % 10;
}

/**
 * ¿Es un NIF/CIF/NIE español bien formado y con el control correcto?
 *
 * 🔴 VACÍO ES VÁLIDO. El campo es opcional y esta función no lo convierte en obligatorio.
 */
export function validarNifEspanol(valor?: string | null): ResultadoNif {
  const v = normalizarNif(valor);
  if (!v) return { valido: true, tipo: null, motivo: 'vacio' };

  // ── DNI: 8 dígitos + letra ────────────────────────────────────────────────────────────
  if (/^\d{8}[A-Z]$/.test(v)) {
    return letraDe(Number(v.slice(0, 8))) === v[8] ? OK('DNI') : MAL('DNI', 'control');
  }

  // ── NIE: X/Y/Z + 7 dígitos + letra. La inicial vale 0, 1 y 2 respectivamente. ─────────
  if (/^[XYZ]\d{7}[A-Z]$/.test(v)) {
    const inicial = String('XYZ'.indexOf(v[0]));
    return letraDe(Number(inicial + v.slice(1, 8))) === v[8] ? OK('NIE') : MAL('NIE', 'control');
  }

  // ── CIF: letra de entidad + 7 dígitos + control (dígito o letra) ──────────────────────
  if (/^[A-Z]\d{7}[0-9A-J]$/.test(v)) {
    const entidad = v[0];
    if (LETRAS_CIF.indexOf(entidad) === -1) return MAL(null, 'forma');

    const esperado = controlCif(v.slice(1, 8));
    const control = v[8];
    // El control se puede expresar como dígito o como letra: `JABCDEFGHI`[n]. Qué forma admite
    // cada entidad NO es libre — hay letras que exigen una y otras que exigen la otra.
    const comoDigito = String(esperado);
    const comoLetra = 'JABCDEFGHI'[esperado];

    if (CIF_CONTROL_LETRA.indexOf(entidad) !== -1) {
      return control === comoLetra ? OK('CIF') : MAL('CIF', 'control');
    }
    if (CIF_CONTROL_DIGITO.indexOf(entidad) !== -1) {
      return control === comoDigito ? OK('CIF') : MAL('CIF', 'control');
    }
    return (control === comoDigito || control === comoLetra) ? OK('CIF') : MAL('CIF', 'control');
  }

  // Ni DNI, ni NIE, ni CIF: la FORMA ya no encaja (longitud mala, letra donde va número…).
  return MAL(null, 'forma');
}
