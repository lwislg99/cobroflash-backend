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
  /** SCRUM-300 · solo v:2. El día de la ENTREGA, distinto del de emisión (`fecha`). */
  fechaEntrega?: Date | string | null;
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
  // SCRUM-415: el hash NO cuadra con la receta de su versión, pero SÍ con la de otra. No es lo
  // mismo y no puede decirse igual: `hash_no_coincide` acusa de manipulación, y esto dice que el
  // contenido está intacto y lo que no encaja es la VERSIÓN declarada.
  | 'hash_de_otra_version'
  // SCRUM-431: el hash cuadra si se recalcula con un dato VIVO vacío. El albarán no se ha tocado:
  // lo que ha cambiado es una fila de OTRA tabla (`Job`, `Customer`, `Merchant`) que la receta lee
  // al verificar. No es lo mismo que una manipulación y no puede decirse igual.
  | 'dato_vivo_cambiado'
  | 'error_al_recalcular';

export type ResultadoSobre =
  | { cuadra: true; numero: string; v: number }
  | { cuadra: false; numero: string; v: number | null; motivo: MotivoNoVerificado; mensaje: string };

/**
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * SCRUM-431 · LOS CAMPOS QUE LA RECETA LEE **EN VIVO**, con la tabla de la que salen.
 *
 * La fila del albarán queda congelada al firmarse (`albaranes.routes.ts`, 409 `albaran_locked`),
 * así que sus campos no pueden cambiar bajo el sello. Éstos NO son suyos: salen de filas que
 * siguen vivas y que el producto permite editar por motivos legítimos —renombrar un Trabajo,
 * corregir la razón social de un cliente, arreglar una errata en el NIF—.
 *
 * Cambiar cualquiera de ellos altera el hash recalculado de TODOS los albaranes firmados que
 * cuelgan de esa fila, **en las dos versiones de sobre**. `obra` es el único que v:2 dejó de leer
 * (SCRUM-300 le cambió la fuente); los otros cuatro siguen vivos en v:1 y en v:2.
 *
 * ⚠️ Esta lista NO arregla el defecto —eso exige congelar el contenido dentro del sobre, que es
 * un sobre nuevo y decisión del fundador—. Sirve para **no acusar en falso** mientras tanto.
 */
const CAMPOS_VIVOS: readonly (keyof FuentesContenido)[] = Object.freeze([
  'jobDireccion',      // Job.direccion      — `obra` en v:1
  'referenciaTrabajo', // Job.titulo         — v:1 y v:2
  'cliente',           // Customer.legalName || name
  'emisor',            // Merchant.legalName || name
  'emisorNif',         // Merchant.taxId
]);

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

/** Las líneas de v:2, en su forma canónica congelada. */
function lineasCanonicasV2(lineas: unknown) {
  return (Array.isArray(lineas) ? (lineas as AlbaranLinea[]) : []).map((l) => ({
    concepto: l.concepto,
    cantidad: l.cantidad,
    unidad: l.unidad ?? null,
    precioUnitario: l.precioUnitario ?? null,
    tipoIva: l.tipoIva ?? null,
  }));
}

/**
 * RECETA v:2 — CONGELADA (SCRUM-300 · C5).
 *
 * ⚠️ SE ESCRIBE ENTERA Y APARTE, incluidas las líneas, aunque hoy sea CARÁCTER POR CARÁCTER igual
 * a la de v:1 en sus once primeras claves y `lineasCanonicasV2` sea idéntica a `lineasCanonicasV1`.
 * Eso NO es un descuido pendiente de deduplicar: es el precio de que romper v:1 sea IMPOSIBLE en
 * vez de estar vigilado. El día que v:3 añada un campo a las líneas, tocará SU copia y las de
 * v:1 y v:2 no se moverán. Lee el recuadro de arriba antes de «arreglar» esta repetición.
 *
 * Qué cambia respecto de v:1, y por qué la versión sube:
 *
 *  · `obra` CAMBIA DE FUENTE: v:1 lo tomaba de `Job.direccion` (que no escribe nadie, así que
 *    llevaba meses sellando vacío); v:2 lo toma de `Albaran.lugarEntrega`, columna propia. Un
 *    cambio de significado de un campo YA SELLADO es exactamente lo que obliga a una versión
 *    nueva: sin ella, dos hashes calculados con reglas distintas serían indistinguibles.
 *  · Se AÑADEN tres claves al final, en este orden: `fechaEntrega`, `firmadoPorNombre`,
 *    `firmadoPorCalidad`. Van al final y en bloque para que el delta con v:1 se lea de un
 *    vistazo. `JSON.stringify` serializa por orden de inserción: este orden queda congelado.
 *
 * ⚠️ `firmadoPorCalidad` sella el `id` de la ranura (`encargado_o_personal_de_obra`), NO su
 * etiqueta. Es deliberado y es lo que permite que aprobar la microcopy —hoy pendiente— no
 * reescriba el sello de ningún documento ya firmado.
 */
const recetaV2: RecetaSobre = (f) =>
  sha256(
    JSON.stringify({
      v: 2,
      numero: f.numero,
      fecha: fechaCanonica(f.fecha),
      modoValoracion: f.modoValoracion,
      obra: f.lugarEntrega ?? null,
      referenciaTrabajo: f.referenciaTrabajo ?? null,
      cliente: f.cliente ?? null,
      emisor: f.emisor ?? null,
      emisorNif: f.emisorNif ?? null,
      notas: f.notas ?? null,
      lineas: lineasCanonicasV2(f.lineas),
      fechaEntrega:
        f.fechaEntrega instanceof Date
          ? f.fechaEntrega.toISOString()
          : f.fechaEntrega
            ? String(f.fechaEntrega)
            : null,
      firmadoPorNombre: f.firmadoPorNombre ?? null,
      firmadoPorCalidad: f.firmadoPorCalidad ?? null,
    }),
  );

/**
 * El recetario que este verificador sabe despachar.
 *
 * ⚠️ LAS DOS VERSIONES ESTÁN MEDIDAS, NO SUPUESTAS: `albaran.service.ts` construye hoy DOS objetos
 * canónicos (v:1 y v:2) y el guard de `tests/scrum369-verificador-sello.test.mjs` lo lee del AST,
 * no de este comentario. Si el sellador estrenara un v:3, ese guard se pondría ROJO hasta que su
 * receta apareciese aquí con su vector congelado.
 *
 * Y lo que NO se hace jamás: que una versión nueva reutilice la receta de otra. Dos hashes con
 * reglas distintas bajo el mismo número son indistinguibles.
 */
export const RECETAS_POR_VERSION: Recetario = Object.freeze({
  1: recetaV1,
  2: recetaV2,
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
    // ── SCRUM-415 · ANTES DE ACUSAR, SE PRUEBAN LAS OTRAS RECETAS ────────────────────────────
    //
    // Un sobre cuyo `v` dice 1 pero cuyo hash es el que da la receta de v:2 **no es un albarán
    // manipulado**: es un sello cuya versión declarada no corresponde a la regla con la que se
    // calculó. Sin esta comprobación las dos cosas salen por el mismo sitio y con el mismo
    // texto —«EL CONTENIDO YA NO ES EL QUE SE FIRMÓ»—, que es la acusación más grave que este
    // verificador sabe hacer.
    //
    // Costó media mañana localizar exactamente eso en `scrum297-evidencias-postgres`. El
    // diagnóstico no es un lujo: es la diferencia entre «investiga una manipulación» y «arregla
    // el número de versión de esa fila».
    for (const otra of versionesSoportadas(recetario)) {
      if (otra === v) continue;
      let conLaOtra: string;
      try {
        conLaOtra = recetario[otra](normalizar(entrada.contenido));
      } catch {
        continue;                       // esa receta no aplica a estas fuentes: no dice nada
      }
      if (conLaOtra === hashGuardado) {
        return {
          cuadra: false, numero, v, motivo: 'hash_de_otra_version',
          mensaje: `${numero}: el sobre declara v:${v}, pero su hash es EXACTAMENTE el que da la ` +
            `receta de v:${otra}. El contenido NO está manipulado —cuadra al bit con otra regla—: ` +
            `lo que no encaja es la versión declarada. Se selló con v:${otra} y se guardó v:${v}, o ` +
            'al revés. Se corrige la VERSIÓN de la fila, nunca el hash: lo sellado no se toca.',
        };
      }
    }

    // ── SCRUM-431 · ¿Y SI LO QUE CAMBIÓ NO ES EL ALBARÁN? ──────────────────────────────────
    //
    // La receta lee cinco campos de filas VIVAS (`CAMPOS_VIVOS`). Si el hash guardado cuadra al
    // recalcularlo con uno de ellos VACÍO, queda **demostrado** que el sobre se selló cuando ese
    // dato estaba vacío y que lo único que ha cambiado desde entonces es esa otra fila.
    //
    // No se supone nada: o cuadra al bit, o no se dice. Y cuando cuadra, el veredicto sigue siendo
    // `cuadra: false` —no se puede demostrar la integridad de lo que no viaja con la firma— pero
    // el MOTIVO deja de acusar de manipulación a un documento que nadie ha tocado.
    //
    // El caso real que lo motiva: los albaranes v:1 se sellaron con `obra` vacía porque nadie
    // escribía `Job.direccion`. El día que ese Job gana dirección, el sobre pasa a decir
    // «EL CONTENIDO YA NO ES EL QUE SE FIRMÓ» sobre una entrega intacta.
    for (const campo of CAMPOS_VIVOS) {
      if ((entrada.contenido as any)?.[campo] == null) continue;   // ya estaba vacío: no dice nada
      let conElCampoVacio: string;
      try {
        conElCampoVacio = receta(normalizar({ ...entrada.contenido, [campo]: null }));
      } catch {
        continue;
      }
      if (conElCampoVacio === hashGuardado) {
        return {
          cuadra: false, numero, v, motivo: 'dato_vivo_cambiado',
          mensaje: `${numero}: el albarán NO se ha tocado. El sello v:${v} cuadra EXACTAMENTE si se ` +
            `recalcula con «${campo}» vacío, que es como estaba al firmar: lo que ha cambiado es ese ` +
            'dato en OTRA tabla (Trabajo, cliente o emisor), y la receta de esta versión lo lee en ' +
            'vivo. No se puede DEMOSTRAR la integridad —el dato no viaja con la firma—, pero tampoco ' +
            'hay manipulación que declarar.',
        };
      }
    }

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
