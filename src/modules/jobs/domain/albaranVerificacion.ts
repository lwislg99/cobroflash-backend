// src/modules/jobs/domain/albaranVerificacion.ts — SCRUM-369
//
// EL VERIFICADOR DEL SELLO DE LA FIRMA. Recalcula el hash de un albarán firmado CON LAS REGLAS
// DE SU VERSIÓN DE SOBRE y dice si cuadra. Nada más: no arregla, no migra, no reescribe.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO QUE CIERRA
//
// `computeAlbaranContentHash` se invocaba en UN SOLO SITIO del árbol —al firmar, dentro de
// `buildFirmaEvidencia`— y NADA lo recalculaba. Teníamos una huella guardada que nadie comparaba
// con nada: **un hash que nadie recalcula no detecta ninguna manipulación**. El PDF ya imprime
// «El hash certifica la integridad del contenido firmado» (albaranPdf.service.ts, certificado de
// evidencias), y hasta este fichero esa frase describía un archivador, no una comprobación.
//
// Es «un rojo que no se ejecuta se lee igual que uno que pasa» aplicado a una garantía de
// producto: **el sello sin verificador se lee igual que un sello que funciona.**
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ LO PRIMERO, PORQUE ES LO QUE MÁS IMPORTA: AQUÍ NO SE REESCRIBE NINGÚN SOBRE
//
// Si un albarán no cuadra, este módulo lo DECLARA. No lo recalcula «para dejarlo bien», no lo
// migra a la versión de hoy, no toca la evidencia. Mismo espíritu que la regla 29 con las
// facturas: **lo firmado no se toca, NI SIQUIERA PARA ARREGLARLO** — un sobre reescrito deja de
// ser prueba de nada, y el arreglo destruiría justo el dato que documenta el incidente.
//
// Por eso este fichero no importa `prisma` ni nada que escriba: no es una promesa, es que no
// tiene con qué. `tests/scrum369-verificador-sello.test.mjs` lo comprueba sobre el AST.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EL DESPACHO POR VERSIÓN ES OBLIGATORIO Y NO UNA PRECAUCIÓN
//
// SCRUM-300 (C5) cambia la ENTRADA del hash: `obra` deja de salir de `Job.direccion` y pasa a
// `Albaran.lugarEntrega`, y el sobre sube a v:2. A partir de ahí conviven DOS POBLACIONES de
// albaranes firmados. Un verificador que aplicase las reglas de v:2 a un sobre v:1 declararía
// manipulados TODOS los albaranes anteriores: una acusación de falsificación contra papeles que
// nadie tocó. **Ese es el peor resultado posible de esta herramienta**, peor que no tenerla.
//
// De ahí las dos reglas duras de aquí abajo:
//   ① la versión se LEE del sobre guardado, jamás se supone;
//   ② una versión sin receta NO se aproxima con la más parecida: se declara `version_no_soportada`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ LAS RECETAS ESTÁN ESCRITAS AQUÍ Y NO LLAMAN AL SELLADOR
//
// Podrían llamar a `computeAlbaranContentHash` y ahorrarse la repetición. NO lo hacen, y el
// motivo es el mismo que llevó a escribir cada versión canónica entera y aparte en
// `albaran.service.ts`: **una versión cerrada no se refactoriza.** Un verificador que derive sus
// reglas del código de sellado de HOY hereda cualquier cambio futuro de ese código — y el día que
// alguien reordene una clave (`JSON.stringify` serializa en orden de inserción), el verificador
// diría «no coincide» sobre albaranes intactos, sin que nada se hubiera roto en el momento de
// tocarlo.
//
// Al estar escritas por separado, sellador y verificador son DOS TESTIGOS INDEPENDIENTES: el test
// los cara contra el mismo vector congelado, así que si alguien toca el cálculo de v:1 el rojo
// sale EN EL COMMIT QUE LO TOCA, no diez años después delante de un juez.
import crypto from 'crypto';
import type { AlbaranLinea } from './albaran.service';

/**
 * Todo lo que hace falta para recalcular un sello, ya resuelto. Sin BD a propósito: quien lo
 * llame decide de dónde salen las filas (una ruta, un export, una herramienta interna), y este
 * módulo se puede probar entero sin base de datos.
 *
 * ⚠️ Las dos fuentes de `obra` viajan JUNTAS y sin elegir. Elegir es trabajo de la receta, porque
 * la respuesta depende de la versión del sobre: v:1 selló `Job.direccion`; v:2 sella
 * `Albaran.lugarEntrega`.
 */
export interface FuentesContenido {
  numero: string;
  fecha: Date | string;
  modoValoracion: string;
  lineas: unknown;
  notas: string | null;
  jobDireccion: string | null;
  lugarEntrega: string | null;
  referenciaTrabajo: string | null;
  cliente: string | null;
  emisor: string | null;
  emisorNif: string | null;
  firmadoPorNombre?: string | null;
  firmadoPorCalidad?: string | null;
}

/** El sobre tal y como quedó guardado en `Albaran.evidenciaFirma` (Json, sin garantías de forma). */
export interface SobreGuardado {
  v?: unknown;
  contentHash?: unknown;
  hashAlg?: unknown;
}

export interface EntradaVerificacion {
  evidencia: SobreGuardado | null | undefined;
  contenido: FuentesContenido;
}

export type MotivoNoVerificado =
  | 'sin_evidencia'
  | 'version_ausente'
  | 'version_no_soportada'
  | 'sin_hash'
  | 'hash_no_coincide'
  | 'error_al_recalcular';

export type ResultadoSobre =
  | { cuadra: true; numero: string; v: number }
  | { cuadra: false; numero: string; v: number | null; motivo: MotivoNoVerificado; mensaje: string };

/** Una receta recalcula el hash de UNA versión de sobre. Pura: mismas fuentes, mismo hash. */
export type RecetaSobre = (fuentes: FuentesContenido) => string;
export type Recetario = Readonly<Record<number, RecetaSobre>>;

function sha256(texto: string): string {
  return crypto.createHash('sha256').update(texto, 'utf8').digest('hex');
}

/**
 * Lo que el sellador colapsa ANTES de construir el objeto canónico. `buildFirmaEvidencia` resuelve
 * cada campo con una cadena `||` (`job?.direccion || null`, `customer?.legalName || customer?.name
 * || null`, …), así que una cadena vacía NUNCA llegó a un hash sellado: llegó como `null`.
 *
 * Normalizar aquí evita el peor error de un verificador: acusar de manipulación a un albarán
 * intacto porque quien lo consulta pasó `''` donde el sellado guardó `null`. `notas` NO se
 * normaliza — el sellador usa `?? null` con ella, así que una nota vacía se selló como `''`.
 */
function normalizar(f: FuentesContenido): FuentesContenido {
  return {
    ...f,
    jobDireccion: f.jobDireccion || null,
    lugarEntrega: f.lugarEntrega || null,
    referenciaTrabajo: f.referenciaTrabajo || null,
    cliente: f.cliente || null,
    emisor: f.emisor || null,
    emisorNif: f.emisorNif || null,
  };
}

function fechaCanonica(fecha: Date | string): string {
  return fecha instanceof Date ? fecha.toISOString() : String(fecha);
}

// ─── LAS RECETAS, UNA POR VERSIÓN DE SOBRE ───────────────────────────────────────────────
//
// ┌─ SI HAS VENIDO A DEDUPLICAR ESTO, LEE PRIMERO ─────────────────────────────────────────┐
// │ Cada receta se escribe ENTERA, con sus claves EN SU ORDEN, y no se toca nunca más.      │
// │ `JSON.stringify` serializa por orden de inserción: un helper compartido ataría el orden  │
// │ de una versión al de otra, y añadir un campo a la nueva cambiaría el hash de la vieja.   │
// │ Nadie lo notaría en el momento —los ya firmados no se vuelven a sellar— y aparecería     │
// │ después, como un «no coincide» sobre un documento intacto.                               │
// └─────────────────────────────────────────────────────────────────────────────────────────┘

/** Las líneas de v:1, en su forma canónica congelada. */
function lineasCanonicasV1(lineas: unknown) {
  return (Array.isArray(lineas) ? (lineas as AlbaranLinea[]) : []).map((l) => ({
    concepto: l.concepto,
    cantidad: l.cantidad,
    unidad: l.unidad ?? null,
    precioUnitario: l.precioUnitario ?? null,
    tipoIva: l.tipoIva ?? null,
  }));
}

/**
 * RECETA v:1 — CONGELADA. Sella `obra` desde `Job.direccion`, que es lo que hizo el código de
 * entonces (y por eso llevaba meses sellando el lugar de obra vacío: nadie escribe ese campo).
 * Ese vacío es un defecto del contenido, no del sello: el verificador reproduce lo que se selló,
 * no lo que habría estado bien sellar.
 */
const recetaV1: RecetaSobre = (f) =>
  sha256(
    JSON.stringify({
      v: 1,
      numero: f.numero,
      fecha: fechaCanonica(f.fecha),
      modoValoracion: f.modoValoracion,
      obra: f.jobDireccion ?? null,
      referenciaTrabajo: f.referenciaTrabajo ?? null,
      cliente: f.cliente ?? null,
      emisor: f.emisor ?? null,
      emisorNif: f.emisorNif ?? null,
      notas: f.notas ?? null,
      lineas: lineasCanonicasV1(f.lineas),
    }),
  );

/**
 * El recetario que este verificador sabe despachar.
 *
 * ⚠️ HOY SOLO ESTÁ v:1, Y ESO ESTÁ MEDIDO, NO SUPUESTO: en este árbol el sellador solo puede
 * emitir v:1 (`albaran.service.ts` construye un único objeto canónico). SCRUM-300 sube a v:2 y
 * todavía NO está en `main` — espera una migración de esquema que es turno humano.
 *
 * Cuando v:2 entre, el guard de `tests/scrum369-verificador-sello.test.mjs` se pone ROJO hasta que
 * su receta se añada aquí con su vector congelado. No hace falta acordarse: la suite lo exige.
 * Mientras tanto, un sobre v:2 no se aproxima con la receta de v:1 — se declara no soportado.
 */
export const RECETAS_POR_VERSION: Recetario = Object.freeze({
  1: recetaV1,
});

/** Las versiones que este verificador sabe recalcular, ordenadas. */
export function versionesSoportadas(recetario: Recetario = RECETAS_POR_VERSION): number[] {
  return Object.keys(recetario).map(Number).sort((a, b) => a - b);
}

// ─── VERIFICAR UN SOBRE ──────────────────────────────────────────────────────────────────

/**
 * ¿El contenido actual del albarán sigue cuadrando con el sello que se guardó al firmarlo?
 *
 * NUNCA lanza: un barrido que revienta a mitad deja de ser un censo y pasa a ser un accidente, y
 * el albarán raro es precisamente el que hay que poder nombrar. Todo problema sale como resultado
 * con motivo.
 */
export function verificarSobre(
  entrada: EntradaVerificacion,
  recetario: Recetario = RECETAS_POR_VERSION,
): ResultadoSobre {
  const numero = entrada.contenido?.numero ?? '(sin número)';
  const ev = entrada.evidencia;

  if (!ev || typeof ev !== 'object') {
    return {
      cuadra: false, numero, v: null, motivo: 'sin_evidencia',
      mensaje: `${numero}: firmado sin sobre de evidencias — no hay nada contra lo que comparar.`,
    };
  }

  const v = typeof ev.v === 'number' && Number.isFinite(ev.v) ? ev.v : null;
  if (v === null) {
    return {
      cuadra: false, numero, v: null, motivo: 'version_ausente',
      mensaje: `${numero}: el sobre no dice de qué versión es. Sin versión no se puede elegir regla, ` +
        'y elegir una por defecto es justo lo que convertiría un documento intacto en un «no coincide».',
    };
  }

  const receta = Object.prototype.hasOwnProperty.call(recetario, v) ? recetario[v] : undefined;
  if (typeof receta !== 'function') {
    return {
      cuadra: false, numero, v, motivo: 'version_no_soportada',
      mensaje: `${numero}: sobre v:${v} y este verificador solo sabe recalcular ` +
        `v:${versionesSoportadas(recetario).join(', v:')}. NO se aproxima con la más parecida: ` +
        'aplicar la regla de otra versión daría «no coincide» sobre un albarán posiblemente intacto.',
    };
  }

  const hashGuardado = typeof ev.contentHash === 'string' ? ev.contentHash : null;
  if (!hashGuardado) {
    return {
      cuadra: false, numero, v, motivo: 'sin_hash',
      mensaje: `${numero}: el sobre v:${v} no guardó contentHash.`,
    };
  }

  let recalculado: string;
  try {
    recalculado = receta(normalizar(entrada.contenido));
  } catch (e: any) {
    return {
      cuadra: false, numero, v, motivo: 'error_al_recalcular',
      mensaje: `${numero}: la receta de v:${v} no pudo recalcular el hash (${e?.message || e}). ` +
        'Esto NO es una manipulación demostrada: es que no se pudo mirar.',
    };
  }

  if (recalculado !== hashGuardado) {
    return {
      cuadra: false, numero, v, motivo: 'hash_no_coincide',
      mensaje: `${numero}: EL CONTENIDO YA NO ES EL QUE SE FIRMÓ. Sello v:${v} guardado ` +
        `${hashGuardado.slice(0, 16)}…, recalculado ${recalculado.slice(0, 16)}…. ` +
        'El sobre NO se toca: se declara y se investiga.',
    };
  }

  return { cuadra: true, numero, v };
}

// ─── VERIFICAR UNA POBLACIÓN ─────────────────────────────────────────────────────────────

export interface InformeVerificacion {
  /** Cuántos albaranes se han MIRADO. Es el suelo: sin esto, «cero fallos» no significa nada. */
  examinados: number;
  cuadran: number;
  /** Cuántos sobres de cada versión hay en la población. Retrocompatibilidad medida, no supuesta. */
  censoPorVersion: Record<string, number>;
  /** Los que NO cuadran, cada uno con su motivo y el número del albarán en el mensaje. */
  hallazgos: ResultadoSobre[];
  /** Versiones presentes en la población que este verificador no sabe recalcular. */
  versionesNoSoportadas: number[];
  conclusion: 'no_se_pudo_mirar' | 'hay_hallazgos' | 'todo_cuadra';
}

/**
 * Barre una población de albaranes firmados y devuelve el informe.
 *
 * ⚠️ EL SUELO ESTÁ EN EL TIPO, no en la buena voluntad de quien lo lea: con cero albaranes
 * examinados la conclusión es `no_se_pudo_mirar`, NUNCA `todo_cuadra`. «Cero manipulados» y «no
 * supe mirar» son el mismo número con significados opuestos, y un verificador que los confunde
 * es peor que ninguno: da tranquilidad medida sobre nada.
 */
export function verificarPoblacion(
  entradas: Iterable<EntradaVerificacion>,
  recetario: Recetario = RECETAS_POR_VERSION,
): InformeVerificacion {
  const censoPorVersion: Record<string, number> = {};
  const hallazgos: ResultadoSobre[] = [];
  const noSoportadas = new Set<number>();
  let examinados = 0;
  let cuadran = 0;

  for (const entrada of entradas) {
    examinados++;
    const r = verificarSobre(entrada, recetario);
    const clave = r.v === null ? 'sin_version' : String(r.v);
    censoPorVersion[clave] = (censoPorVersion[clave] || 0) + 1;
    if (r.cuadra) {
      cuadran++;
    } else {
      hallazgos.push(r);
      if (r.motivo === 'version_no_soportada' && r.v !== null) noSoportadas.add(r.v);
    }
  }

  return {
    examinados,
    cuadran,
    censoPorVersion,
    hallazgos,
    versionesNoSoportadas: [...noSoportadas].sort((a, b) => a - b),
    conclusion: examinados === 0 ? 'no_se_pudo_mirar' : hallazgos.length > 0 ? 'hay_hallazgos' : 'todo_cuadra',
  };
}
