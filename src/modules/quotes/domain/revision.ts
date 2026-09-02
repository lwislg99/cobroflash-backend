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
