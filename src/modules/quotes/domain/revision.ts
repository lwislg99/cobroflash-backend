// src/modules/quotes/domain/revision.ts — SCRUM-655 (T6, sprint Tecnosel)
//
// LA REVISIÓN DE UN PRESUPUESTO: UN NÚMERO APARTE, Y EL «P2004226.1» SE DERIVA AL PINTARLO.
//
// ── POR QUÉ NO VIVE DENTRO DE LA CADENA DEL NÚMERO (decisión del fundador) ────────────────
// Si el «.1» viviera dentro del texto del número, saber qué revisiones hay obligaría a PARSEAR
// UN TEXTO ESCRITO PARA HUMANOS. Así se pierden los datos: alguien reescribe el formato un
// martes —un guion en vez de un punto, un «rev.2»— y el mecanismo muere en silencio, sin que
// falle nada. El número y la revisión son dos datos y se guardan como dos.
//
// Y «VIGENTE» TAMBIÉN SE DERIVA: es la revisión más alta. Una bandera `vigente` sería un tercer
// dato que puede contradecir a los otros dos —dos filas marcadas vigentes, o ninguna— y esta casa
// ya sabe cómo acaba eso.
//
// ── ⚠️ CADUCADO EL 2-sep-2026 (FASE B) · YA TIENE LLAMADOR ───────────────────────────────
// Lo de abajo se conserva porque explica POR QUÉ estuvo sin cable, y eso sigue siendo cierto de
// aquel día. Lo que ya NO es cierto es la premisa: `Quote` SÍ tiene campo de revisión desde
// SCRUM-674, y `getQuoteDetailAdmin` consume este módulo. El bloque «FASE B» de más abajo lo
// dice con lo que se midió.
// ── ⚠️ ESTE MÓDULO NO LO LLAMA NADIE TODAVÍA, Y ES DELIBERADO ─────────────────────────────
// `Quote` tiene `quoteNumber Int?` y NO tiene campo de revisión (medido). Añadirlo es tocar
// `prisma/schema.prisma`, que es del fundador: el diff va PREPARADO en `docs/master/SCRUM-655.md`
// y no se aplica aquí. Mismo trato que `retencionIrpf.ts` (A2) y `recargoEquivalencia.ts` (A3):
// el mecanismo construido y probado, esperando su campo. Cuando exista, se enchufa y no hay que
// volver a decidir nada de esto.

/** Un presupuesto, reducido a lo que hace falta para hablar de revisiones. */
export interface RevisionDePresupuesto {
  /** El identificador del documento, SIN la revisión. `P2004226`. */
  numero: string;
  /** 0 = original. 1 = primera revisión. Nunca se mete dentro de `numero`. */
  revision: number;
}

/**
 * El número tal y como se PINTA: `P2004226` la original, `P2004226.1` la primera revisión.
 *
 * La revisión 0 no se escribe. Un documento que pone «.0» le está diciendo al cliente que existe
 * otra versión, y no existe.
 */
export function numeroConRevision(q: RevisionDePresupuesto): string {
  const n = typeof q?.numero === 'string' ? q.numero : '';
  const r = Number(q?.revision);
  if (!Number.isFinite(r) || r <= 0) return n;
  return `${n}.${Math.trunc(r)}`;
}

/**
 * Cuál es la VIGENTE de un grupo de revisiones del mismo presupuesto: la de revisión más alta.
 *
 * 🔴 Y LAS DEMÁS SIGUEN AHÍ. Esta función no borra, no marca y no devuelve «la buena y basura»:
 * devuelve cuál está vigente HOY sobre una lista que no toca. Es la diferencia entre «revisar» y
 * «sobrescribir con otro nombre» — si crear la `.1` hiciera desaparecer la original, el cliente
 * que pregunta por lo que firmó no tendría dónde mirarlo.
 *
 * Con la lista vacía devuelve `null`: no hay vigente, y eso no es un error que haya que inventar.
 */
export function vigenteDe(revisiones: readonly RevisionDePresupuesto[] | null | undefined): RevisionDePresupuesto | null {
  const src = Array.isArray(revisiones) ? revisiones : [];
  let mejor: RevisionDePresupuesto | null = null;
  for (const q of src) {
    const r = Number(q?.revision);
    if (!Number.isFinite(r)) continue;          // ilegible: no compite, y no tumba al resto
    if (mejor === null || r > Number(mejor.revision)) mejor = q;
  }
  return mejor;
}

/** ¿Es ésta la vigente del grupo? Derivado, nunca almacenado. */
export function esVigente(q: RevisionDePresupuesto, grupo: readonly RevisionDePresupuesto[]): boolean {
  const v = vigenteDe(grupo);
  return v !== null && v.numero === q.numero && Number(v.revision) === Number(q.revision);
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// FASE B (2-sep-2026) · YA HAY CAMPO, Y YA HAY LLAMADOR
//
// El bloque de arriba decía «`Quote` … NO tiene campo de revisión (medido)». Eso dejó de ser
// cierto: `prisma/schema.prisma` trae `revision Int @default(0)` (SCRUM-674, medido en el árbol,
// no leído de un acta). Lo de abajo es lo que hacía falta para enchufarlo a una pantalla.
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Dos filas del mismo grupo se disputan el «vigente». No hay respuesta, y no se elige una. */
export class RevisionesAmbiguas extends Error {
  constructor(mensaje: string) { super(mensaje); this.name = 'RevisionesAmbiguas'; }
}

/** El censo de revisiones no se ve ni a sí mismo. */
export class CensoDeRevisionesCiego extends Error {
  constructor(mensaje: string) { super(mensaje); this.name = 'CensoDeRevisionesCiego'; }
}

/**
 * La vigente, EXIGIENDO que haya UNA.
 *
 * 🔴 POR QUÉ NO VALE `vigenteDe`. Aquélla resuelve el empate en silencio: recorre y se queda con
 * la primera que vio, así que dos filas con la MISMA revisión devuelven una respuesta con pinta de
 * buena. Y «cuál está vigente» con dos respuestas posibles no es una respuesta: es el momento en
 * que la pantalla le enseña al profesional una versión y el PDF le enseña otra, sin que nada falle.
 *
 * Aquí el empate PARA y nombra a las dos. `vigenteDe` se queda como estaba —hay sitios donde
 * «la más alta, y si no hay, null» es lo que se quiere— y ésta es la que usa quien tiene que
 * contestar la pregunta de la pantalla.
 */
export function vigenteUnicaDe<T extends RevisionDePresupuesto>(revisiones: readonly T[]): T {
  const src = Array.isArray(revisiones) ? revisiones : [];
  const legibles = src.filter((q) => Number.isFinite(Number(q?.revision)));
  if (legibles.length === 0) {
    throw new CensoDeRevisionesCiego(
      'CENSO CIEGO · se ha pedido la revisión vigente de un grupo SIN revisiones legibles. Todo '
      + 'presupuesto es al menos su propia revisión, así que un grupo vacío aquí no significa «no '
      + 'tiene revisiones»: significa que no se ha leído nada — grupo mal armado, `quoteNumber` '
      + 'nulo tratado como clave, o la consulta filtrando por otro merchant.',
    );
  }
  const alta = Math.max(...legibles.map((q) => Number(q.revision)));
  const empatadas = legibles.filter((q) => Number(q.revision) === alta);
  if (empatadas.length > 1) {
    const quienes = empatadas.map((q) => `${numeroConRevision(q)} (revisión ${q.revision})`).join(' y ');
    throw new RevisionesAmbiguas(
      `DOS VIGENTES A LA VEZ: ${quienes}.\n`
      + '  «Cuál está vigente» con dos respuestas no es una respuesta. Elegir una de las dos aquí\n'
      + '  sería peor que fallar: la pantalla enseñaría una y el PDF podría enseñar la otra, y nadie\n'
      + '  vería nunca que hay dos. La revisión es la CLAVE del grupo — dos filas con la misma no\n'
      + '  pueden convivir, y eso se arregla en los datos, no eligiendo aquí.',
    );
  }
  return empatadas[0];
}

/**
 * El censo de revisiones de UN presupuesto, con su suelo.
 *
 * 🔴 EL SUELO. Un listado de revisiones que devuelve CERO no puede pasar por «este presupuesto no
 * tiene revisiones»: todo presupuesto es al menos la suya. Un cero aquí es el síntoma de que el
 * grupo se armó mal —agrupar por un `quoteNumber` nulo mete a todos los sin numerar en el mismo
 * saco, o en ninguno— y con él la pantalla diría «no hay otras versiones» de un documento que sí
 * las tiene. Que es exactamente la frase que no se puede decir mal.
 */
export function revisionesDe<T extends RevisionDePresupuesto>(
  propia: RevisionDePresupuesto,
  grupo: readonly T[] | null | undefined,
): T[] {
  const src = Array.isArray(grupo) ? grupo.slice() : [];
  const seVeASiMisma = src.some(
    (q) => q?.numero === propia?.numero && Number(q?.revision) === Number(propia?.revision),
  );
  if (!seVeASiMisma) {
    throw new CensoDeRevisionesCiego(
      `CENSO CIEGO · el censo de revisiones de ${numeroConRevision(propia)} devuelve `
      + `${src.length} y NO SE INCLUYE A SÍ MISMO. Todo presupuesto es al menos su propia revisión, `
      + 'así que esto no es «no tiene otras versiones»: es que el grupo no se ha leído — agrupado '
      + 'por un `quoteNumber` nulo, por otro merchant, o simplemente vacío. Con este cero la '
      + 'pantalla diría «no hay otras versiones» de un documento que sí las tiene.',
    );
  }
  return src.sort((a, b) => Number(a.revision) - Number(b.revision));
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 CREAR UNA REVISIÓN NO ES EDITAR LA ANTERIOR
//
// Un presupuesto FIRMADO no se reescribe. Si el cliente pide cambios sobre uno que ya firmó, eso
// es una versión NUEVA — la firma cubre lo que el cliente VIO, igual que en el parte. Reescribir
// la firmada dejaría un trazo de tinta encima de un documento que ya no es el que se firmó, y el
// día que ese cliente diga «yo no pedí esto» no habría dónde mirarlo.
//
// Por eso esta función es PURA y devuelve LOS DATOS DE LA FILA NUEVA. No recibe un cliente de base
// de datos, no escribe, y no tiene forma de tocar la anterior aunque alguien se lo pidiera: lo que
// devuelve no lleva `id`, así que no hay a quién sobrescribir.
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * Los campos de `Quote` que una revisión HEREDA: el CONTENIDO, que es lo que el cliente pidió
 * cambiar y de lo que se parte para cambiarlo.
 */
export const REVISION_HEREDA = [
  'jobId', 'esAdicional', 'origin', 'validUntil', 'docFields', 'customerId', 'payMethods',
  'total', 'currency', 'lines', 'paymentTerms', 'customBillingPlan', 'tiers', 'selectedTierId',
  'internalNotes', 'teamMemberId', 'ivaModo', 'clausulasExcluidas',
  // ── 2-sep-2026 · LA CABECERA Y EL PIE DEL DOCUMENTO (SCRUM-593, PR #931 de Javier) ────────
  //
  // Entraron en `Quote` desde otro carril y el guard de abajo los cazó SIN CLASIFICAR, que es
  // exactamente para lo que está: un campo sin clasificar no viaja a la revisión, y eso no falla —
  // se descubre cuando el cliente echa de menos algo en el PDF.
  //
  // DECISIÓN DEL FUNDADOR (2-sep-2026): LAS DOS SE HEREDAN. Son contenido del documento. Una
  // revisión de «P2004226.1» es EL MISMO DOCUMENTO con cambios; si pierde la cabecera y el pie, el
  // cliente recibe algo que se ve distinto de lo que aprobó. Y heredar es REVERSIBLE —se puede
  // borrar— mientras que no heredar no lo es: el texto ya no está.
  //
  // ⚠️ PROVISIONAL hasta que Javier lo confirme (2-sep-2026). Si dice que son de la versión
  // anterior —como la firma o la decisión—, se mueven a `REVISION_NO_HEREDA` con su motivo.
  'docHeaderText', 'docFooterText',
] as const;

/**
 * Los que NO se heredan, con su motivo. Todos son lo MISMO: pertenecen a la versión anterior y a
 * ninguna otra. Heredar cualquiera de éstos es la forma silenciosa de reescribir lo firmado.
 */
export const REVISION_NO_HEREDA: Readonly<Record<string, string>> = Object.freeze({
  signatureUrl:    'el trazo del cliente cubre LO QUE VIO. Copiarlo a una versión distinta es firmar por él',
  evidence:        'la evidencia técnica de aquella decisión: hora, IP, canal. No es de este documento',
  acceptedAt:      'aceptó AQUELLO. Esta versión aún no la ha visto nadie',
  rejectedAt:      'rechazó AQUELLO, por lo mismo',
  decisionChannel: 'por dónde decidió aquella vez',
  decisionComment: 'lo que dijo al decidir aquella vez',
  rejectionReason: 'por qué rechazó aquella vez',
  chargeId:        'el cobro cuelga del documento que lo originó, y no se duplica al revisar',
  decisionToken:   'el enlace público es de UN documento: compartirlo llevaría al cliente a la versión vieja',
  pdfUrl:          'el PDF pintado de la versión anterior. La nueva se pinta cuando exista',
  reminderSentAt:  'los recordatorios ya enviados son de aquella versión',
});

/** Los que pone el sistema al crear la revisión — ni se heredan ni se copian: se calculan. */
export const REVISION_LA_PONE_EL_SISTEMA: Readonly<Record<string, string>> = Object.freeze({
  id:          'fila nueva: la anterior conserva la suya, y por eso sigue existiendo',
  merchantId:  'el del que la crea; se comprueba contra el anterior, no se arrastra a ciegas',
  quoteNumber: 'EL NÚMERO BASE NO CAMBIA: es lo que hace que esto sea «P2004226.1» y no otro presupuesto',
  revision:    'la siguiente del grupo. Es el dato del ticket',
  status:      'nace borrador: nadie la ha visto todavía',
  createdVia:  'queda marcado que nació como revisión, no como presupuesto suelto',
  createdAt:   'la fecha de la fila NUEVA. La anterior conserva la suya: es su fecha de emisión',
  updatedAt:   'la fecha de la fila NUEVA; arrastrar la anterior mentiría sobre cuándo se tocó qué',
});

/** Lo que hay que saber de la versión anterior para poder revisarla. */
export interface VersionAnterior {
  id: number;
  merchantId: number;
  quoteNumber: number | null;
  revision: number;
  signatureUrl?: string | null;
  [campo: string]: unknown;
}

/**
 * Los datos de la fila NUEVA. No toca la anterior — no puede: no devuelve su `id`.
 *
 * @param anterior la versión de la que se parte (normalmente la vigente).
 * @param siguienteRevision el número de la nueva, calculado sobre el grupo ENTERO y no sobre
 *        `anterior.revision + 1`: revisar la `.1` cuando ya existe una `.2` crearía una segunda
 *        `.2`, que es exactamente el empate que `vigenteUnicaDe` tiene que impedir.
 */
export function nuevaRevisionDe(
  anterior: VersionAnterior,
  siguienteRevision: number,
): Record<string, unknown> {
  if (!Number.isInteger(siguienteRevision) || siguienteRevision <= Number(anterior?.revision)) {
    throw new RevisionesAmbiguas(
      `LA REVISIÓN NUEVA (${siguienteRevision}) NO ES POSTERIOR A LA QUE SE REVISA `
      + `(${anterior?.revision}). Crearla así pondría dos filas con la misma revisión en el mismo `
      + 'grupo, y entonces «cuál está vigente» deja de tener respuesta. El número sale del grupo '
      + 'ENTERO, no de sumar uno a la que se está mirando.',
    );
  }
  const nueva: Record<string, unknown> = {
    merchantId: anterior.merchantId,
    quoteNumber: anterior.quoteNumber,   // el número base NO cambia
    revision: siguienteRevision,
    status: 'draft',
    createdVia: 'revision',
  };
  for (const campo of REVISION_HEREDA) {
    if (campo in anterior) nueva[campo] = (anterior as Record<string, unknown>)[campo];
  }
  return nueva;
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// LO QUE CONTESTA LA PANTALLA: QUÉ REVISIONES HAY Y CUÁL ESTÁ VIGENTE
//
// Vive aquí, y no dentro del endpoint, por una razón que no es de estilo: dentro del endpoint sólo
// se podría probar con base de datos, y entonces la regla del ticket —«dos vigentes no es una
// respuesta»— quedaría detrás de un gate. Aquí es una función pura y su test la CORRE.
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Una fila del grupo, con lo justo para pintarla. `firmado` ya viene derivado: el trazo NO viaja. */
export interface FilaDeRevision extends RevisionDePresupuesto {
  id: number;
  firmado: boolean;
}

export interface VistaDeRevisiones {
  /** Todas las versiones del mismo número base, de la más vieja a la más nueva. */
  revisiones: ReadonlyArray<FilaDeRevision & { esVigente: boolean }>;
  /** El `id` de la vigente. Uno, o esto no habría devuelto nada. */
  vigenteId: number;
  /** El número tal y como se pinta ESTA versión: `P2004226` o `P2004226.1`. */
  numero: string;
}

export function vistaDeRevisiones(propia: FilaDeRevision, grupo: readonly FilaDeRevision[]): VistaDeRevisiones {
  const ordenadas = revisionesDe(propia, grupo);   // el suelo de ceguera
  const laVigente = vigenteUnicaDe(ordenadas);     // el que no elige ante un empate
  return {
    // `esVigente` es la de arriba, no una comparación nueva: el grupo comparte `numero` y la
    // vigente es única (si no, `vigenteUnicaDe` no habría devuelto nada), así que preguntar por
    // {numero, revisión} y comparar `id` dicen lo mismo — y esto no duplica el criterio.
    revisiones: ordenadas.map((q) => ({ ...q, esVigente: esVigente(q, ordenadas) })),
    vigenteId: laVigente.id,
    numero: numeroConRevision(propia),
  };
}
