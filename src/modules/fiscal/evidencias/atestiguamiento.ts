// src/modules/fiscal/evidencias/atestiguamiento.ts — SCRUM-438 (fase 1)
//
// ATESTIGUAR UN SOBRE HOY, MIENTRAS TODAVÍA VERIFICA.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA VENTANA QUE ESTO APROVECHA, Y POR QUÉ SE CIERRA
//
// SCRUM-431 midió que el sobre de firma lee **cinco campos EN VIVO** al verificar: no guarda sus
// valores, los vuelve a leer de `Job`, `Customer` y `Merchant` cada vez. El día que alguien
// corrija la razón social de un cliente o renombre un Trabajo, el hash recalculado deja de
// coincidir y el verificador dice «EL CONTENIDO YA NO ES EL QUE SE FIRMÓ» sobre un documento que
// nadie ha tocado.
//
// En producción hay **UN SOLO sobre emitido, y es v:1**. Con doscientos esto no tendría salida;
// con uno, sí: **ejecutar la verificación AHORA, mientras cuadra, y dejar constancia fechada de
// que cuadraba y con qué valores.** Después de eso, un desajuste ya no es ambiguo — se puede
// decir qué campo cambió y cuándo.
//
// ⚠️ **CADUCA.** `Job.titulo` tiene escritor desde SCRUM-317 y `Job.direccion` desde SCRUM-424.
// En cuanto uno de los cinco se toque, esto ya no se puede hacer para ese albarán.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 QUÉ ES ESTO, Y QUÉ NO ES — y hay que decirlo con estas palabras
//
// Es una **VERIFICACIÓN FECHADA**. No es una firma, no es un sellado y **no equivale a haberlo
// sellado**: no añade ninguna garantía criptográfica que el sobre no tuviera. Lo único que añade
// es un testigo con fecha de que en ese instante el recálculo coincidía, y con qué valores.
//
// Si el texto que sale de aquí insinuara otra cosa, sería **peor que no tenerlo**: convertiría una
// nota interna en una prueba que nadie puede sostener.
//
// ⚠️ **NO ESCRIBE NADA.** Ni el sobre (regla 29: una evidencia emitida no se altera), ni el
// albarán, ni `AuditLog` — `AuditAction` es una unión CERRADA y ampliarla es decisión del fundador
// (guard de SCRUM-371). El producto de este módulo es un DOCUMENTO; dónde se guarda lo decide
// quien lo ejecuta.
import { entradaDesdeFilas, type FilaAlbaranFirmado, type FilaJob, type FilaCustomer, type FilaMerchant } from '../../jobs/domain/albaranBarrido';
import { verificarSobre, versionesSoportadas, type ResultadoSobre } from '../../jobs/domain/albaranVerificacion';

/** Versión del FORMATO de este documento. Nada que ver con la versión del sobre. */
export const ATESTIGUAMIENTO_FORMATO = 1;

/**
 * Los CINCO campos que el sobre lee en vivo (SCRUM-431 §1). Se guardan sus valores tal y como
 * estaban al atestiguar: son lo que hace comparable un desajuste futuro.
 *
 * ⚠️ La lista vive aquí y **se deriva de lo que el adaptador resuelve**, no de memoria: si un día
 * el sobre leyera un sexto campo vivo, este documento se quedaría corto en silencio. El test lo
 * cara contra `FuentesContenido`.
 */
export interface CamposVivos {
  jobDireccion: string | null;
  referenciaTrabajo: string | null;
  cliente: string | null;
  emisor: string | null;
  emisorNif: string | null;
}

export interface Atestiguamiento {
  formato: number;
  /** 🔴 Qué es esto. Va DENTRO del documento, no en un README que se separa de él. */
  queEsEsto: string;
  atestiguadoAt: string;
  albaran: { numero: string; id: number };
  sobre: { version: number | null; contentHash: string | null };
  resultado: { cuadra: boolean; motivo?: string; mensaje: string };
  camposVivos: CamposVivos;
  versionesQueSabeRecalcular: number[];
}

/** El texto que dice qué es. Se exporta para que un guard pueda exigir que siga estando. */
export const QUE_ES_ESTO =
  'VERIFICACIÓN FECHADA, NO UNA FIRMA. Deja constancia de que en la fecha indicada el hash del ' +
  'sobre se recalculó y coincidía, y de con qué valores de los campos que el sobre lee en vivo. ' +
  'NO es un sellado, NO equivale a haber sellado esos valores y NO añade ninguna garantía ' +
  'criptográfica que el sobre no tuviera ya.';

export class SobreIlegibleError extends Error {
  constructor(numero: string, motivo: string) {
    super(
      `atestiguamiento_ciego: no se puede atestiguar ${numero} — ${motivo}. ` +
      'Un atestiguamiento cuyo producto ES una afirmación de integridad NO puede salir en verde ' +
      'cuando no ha podido mirar: «verificado» y «no supe mirar» son lo contrario.',
    );
    this.name = 'SobreIlegibleError';
  }
}

/**
 * Construye el atestiguamiento de UN albarán firmado.
 *
 * 🔴 SUELO. Lanza —no devuelve un documento con un hueco— cuando no puede mirar:
 *   · sin sobre, o sobre que no es un objeto;
 *   · sin versión legible, o versión que este verificador no sabe recalcular;
 *   · sin `contentHash` guardado.
 * En los tres casos el documento diría «no cuadra» y se leería como una acusación, cuando lo que
 * pasa es que no se pudo comprobar. Son cosas distintas y no pueden salir por la misma puerta.
 *
 * ⚠️ Un hash que NO cuadra **sí** produce documento: eso sí se ha podido mirar, y es un hallazgo
 * que hay que poder registrar con su fecha.
 */
export function construirAtestiguamiento(params: {
  albaran: FilaAlbaranFirmado & { id: number };
  job: FilaJob | null;
  customer: FilaCustomer | null;
  merchant: FilaMerchant | null;
  ahora: Date;
}): Atestiguamiento {
  const { albaran: a, job, customer, merchant } = params;
  const entrada = entradaDesdeFilas(a, job, customer, merchant);
  const ev = entrada.evidencia as { v?: unknown; contentHash?: unknown } | null | undefined;

  if (!ev || typeof ev !== 'object') throw new SobreIlegibleError(a.numero, 'no tiene sobre de evidencias');
  const version = typeof ev.v === 'number' && Number.isFinite(ev.v) ? ev.v : null;
  if (version === null) throw new SobreIlegibleError(a.numero, 'el sobre no dice de qué versión es');
  if (!versionesSoportadas().includes(version)) {
    throw new SobreIlegibleError(a.numero, `el sobre es v:${version} y el verificador solo sabe v:${versionesSoportadas().join(', v:')}`);
  }
  if (typeof ev.contentHash !== 'string' || !ev.contentHash) {
    throw new SobreIlegibleError(a.numero, 'el sobre no guardó contentHash');
  }

  // La MISMA función que verifica en el paquete de evidencias y en el barrido. Una segunda
  // receta declararía manipulado lo que está intacto (SCRUM-369).
  const r: ResultadoSobre = verificarSobre(entrada);

  return {
    formato: ATESTIGUAMIENTO_FORMATO,
    queEsEsto: QUE_ES_ESTO,
    atestiguadoAt: params.ahora.toISOString(),
    albaran: { numero: a.numero, id: a.id },
    sobre: { version, contentHash: ev.contentHash },
    resultado: r.cuadra
      ? { cuadra: true, mensaje: `El hash del sobre v:${version} se recalculó y COINCIDE.` }
      : { cuadra: false, motivo: r.motivo, mensaje: r.mensaje },
    camposVivos: {
      jobDireccion: entrada.contenido.jobDireccion,
      referenciaTrabajo: entrada.contenido.referenciaTrabajo,
      cliente: entrada.contenido.cliente,
      emisor: entrada.contenido.emisor,
      emisorNif: entrada.contenido.emisorNif,
    },
    versionesQueSabeRecalcular: versionesSoportadas(),
  };
}

/**
 * Compara un atestiguamiento con los valores VIVOS de hoy y dice cuáles cambiaron.
 *
 * Es la mitad que le da sentido a lo anterior: sin esto, el atestiguamiento es un papel; con esto,
 * un desajuste futuro deja de ser ambiguo — **se puede nombrar qué campo cambió y decir que el
 * atestiguamiento es ANTERIOR a ese cambio.**
 */
export function compararConHoy(
  a: Atestiguamiento,
  hoy: CamposVivos,
): { iguales: true } | { iguales: false; cambiados: { campo: keyof CamposVivos; entonces: string | null; ahora: string | null }[] } {
  const campos: (keyof CamposVivos)[] = ['jobDireccion', 'referenciaTrabajo', 'cliente', 'emisor', 'emisorNif'];
  const cambiados = campos
    .filter((c) => (a.camposVivos[c] ?? null) !== (hoy[c] ?? null))
    .map((c) => ({ campo: c, entonces: a.camposVivos[c] ?? null, ahora: hoy[c] ?? null }));
  return cambiados.length ? { iguales: false, cambiados } : { iguales: true };
}

/** El informe humano de una comparación. Dice que el atestiguamiento es ANTERIOR al cambio. */
export function explicarCambio(
  a: Atestiguamiento,
  cambiados: { campo: keyof CamposVivos; entonces: string | null; ahora: string | null }[],
): string {
  const lista = cambiados
    .map((c) => `   · ${c.campo}: «${c.entonces ?? '(vacío)'}» → «${c.ahora ?? '(vacío)'}»`)
    .join('\n');
  return (
    `El albarán ${a.albaran.numero} se atestiguó el ${a.atestiguadoAt} y entonces su sobre ` +
    `v:${a.sobre.version} CUADRABA. Desde entonces han cambiado ${cambiados.length} de los cinco ` +
    `campos que el sobre lee en vivo:\n${lista}\n` +
    'El atestiguamiento es ANTERIOR a esos cambios: un desajuste de hash a partir de aquí se ' +
    'explica por ellos, no por una manipulación del documento.'
  );
}
