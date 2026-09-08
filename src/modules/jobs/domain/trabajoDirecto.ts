// src/modules/jobs/domain/trabajoDirecto.ts — SCRUM-651 (T2)
//
// UN TRABAJO QUE NACE SIN PRESUPUESTO, Y NACE DE PRIMERA CLASE.
//
// ── EL CASO, QUE ES EL MÁS FRECUENTE DEL PRIMER CLIENTE REAL ──────────────────────────────
// Una empresa de electricidad. Llaman por una AVERÍA, va un técnico, la arregla. **Nadie
// presupuesta una urgencia.** Hasta hoy eso no cabía en el producto: el ÚNICO creador de Trabajos
// es `ensureJobForQuote`, que arranca en `quote → accepted`. No había `POST /jobs`.
//
// ⚠️ La exigencia era **DE HECHO, no del esquema**: `Job.quoteId` ya es `Int?` y el serializador
// ya contempla el Trabajo sin presupuesto (SCRUM-51, SCRUM-363). Lo que faltaba era la puerta.
//
// ── 🔴 LO QUE ESTE TRABAJO NO TIENE, Y NO SE DISIMULA ─────────────────────────────────────
// Un Trabajo sin presupuesto **no tiene red de seguridad**. Lo que en uno presupuestado es «te
// has pasado del presupuesto» aquí **no se puede detectar**: no hay contra qué contrastar. La
// pantalla no debe fingir que sí.
//
// Por eso `totalAceptado` se guarda **NULL y no 0**, y merece decirse en voz alta porque es la
// diferencia entera de este ticket:
//
//   · `null` = «no hay presupuesto» → la pantalla NO afirma nada sobre su dinero.
//   · `0`    = «presupuestaste cero» → una AFIRMACIÓN, y falsa.
//
// Con `null`, `importeDeReferencia` devuelve `null`, `estadoCobro` devuelve `null` y no se pinta
// chip (SCRUM-363). Con `0` se pintaría «Pendiente» sobre un eje inventado. **Ausente y cero no
// son lo mismo**, y aquí la diferencia se ve en la pantalla del profesional.

import { esTipoIntervencion, type TipoIntervencion } from './tipoIntervencion';

/** Lo que el profesional escribe al abrir un trabajo directo. */
export type EntradaTrabajoDirecto = {
  customerId: number;
  /** Dirección de OBRA. Puede no coincidir con la fiscal del cliente. */
  direccion: string | null;
  /** Qué hay que hacer. Va a `Job.notes`, que ya existe y ya se pinta. */
  descripcion: string | null;
  /** Nombre del Trabajo. Opcional: sin él, la pantalla se titula con el cliente (SCRUM-317). */
  titulo: string | null;
  /** Qué clase de intervención es. `null` = no consta; NO hay valor por defecto. */
  tipoIntervencion: TipoIntervencion | null;
};

export type ResultadoEntrada =
  | { ok: true; datos: EntradaTrabajoDirecto }
  | { ok: false; error: string };

/** Texto de formulario: se recorta, y vacío es `null` — «sin dato» tiene que ser UN solo estado. */
function texto(bruto: unknown, tope: number): string | null {
  if (bruto === undefined || bruto === null) return null;
  if (typeof bruto !== 'string') return null;
  const limpio = bruto.trim().slice(0, tope);
  return limpio.length > 0 ? limpio : null;
}

/**
 * Valida el cuerpo de `POST /admin/jobs`. Puro: no toca base ni red, así que se prueba entero.
 *
 * 🔴 `quoteId` NO SE ACEPTA, y no es un olvido. Este camino existe para el Trabajo SIN
 * presupuesto; dejar entrar un `quoteId` por aquí abriría una segunda forma de emparejar Trabajo
 * y presupuesto **en paralelo a `ensureJobForQuote`**, que es quien mantiene los dos sentidos de
 * la pertenencia (`Job.quoteId` y `Quote.jobId`, SCRUM-195). Dos escritores para el mismo hecho
 * discrepan, y aquí discrepar significa un Trabajo duplicado con el dinero repartido entre los dos
 * — que es exactamente el fallo que SCRUM-195 vino a cerrar.
 */
export function datosDeTrabajoDirecto(cuerpo: unknown): ResultadoEntrada {
  const c = (cuerpo ?? {}) as Record<string, unknown>;

  if ('quoteId' in c || 'quote_id' in c) return { ok: false, error: 'quote_id_no_admitido' };

  // ── TIPO DE INTERVENCION (aprobado 2-sep-2026, regla 27) ───────────────────────────
  //
  // El vocabulario CERRADO vive en `./tipoIntervencion` y se IMPORTA: el parte de trabajo
  // (SCRUM-652) usa exactamente el mismo, y dos listas para el mismo hecho se separan.
  //
  // 🔴 LA PUERTA ESTUVO CERRADA A PROPOSITO, Y AHORA SE ABRE. Mientras la columna no existia,
  // un `tipoIntervencion` valido TAMPOCO entraba: aceptarlo y no guardarlo habria sido el fallo
  // mudo entero de este ticket —el profesional elige «Mantenimiento», el producto contesta 201,
  // y ese dato no existe en ninguna parte—. La columna ya esta (`jobs.tipo_intervencion`), asi
  // que se acepta Y SE PERSISTE.
  //
  // Lo que NO cambia: un valor de fuera del vocabulario cerrado se sigue rechazando por su
  // nombre. Y sigue sin haber valor por defecto — el tipo se elige, no se hereda.
  let tipoIntervencion: TipoIntervencion | null = null;
  if (c.tipoIntervencion !== undefined && c.tipoIntervencion !== null && c.tipoIntervencion !== '') {
    if (!esTipoIntervencion(c.tipoIntervencion)) return { ok: false, error: 'tipo_intervencion_invalido' };
    tipoIntervencion = c.tipoIntervencion;
  }

  // El cliente es el ÚNICO obligatorio: sin él el Trabajo no es de nadie, y todo lo demás
  // —dirección, descripción, nombre— se puede añadir después con el PATCH que ya existe.
  const id = Number(c.customerId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'customer_required' };

  return {
    ok: true,
    datos: {
      customerId: id,
      direccion: texto(c.direccion, 500),
      descripcion: texto(c.descripcion, 2000),
      titulo: texto(c.titulo, 200),
      tipoIntervencion,
    },
  };
}

/**
 * Lo que se escribe en la fila. Se separa de la validación para que el test pueda leer **lo que
 * de verdad va a la base** sin levantar una.
 *
 * 🔴 `totalAceptado` NO APARECE, a propósito: la columna es nullable y no escribirla la deja en
 * `null`. Escribir `0` aquí sería afirmar «presupuestaste cero», y esa afirmación viaja hasta el
 * semáforo de cobro y hasta la barra de progreso.
 *
 * 🔴 `operarioId` SÍ, Y ES LO QUE EVITA UN FALLO MUDO. Medido: un técnico solo ve los Trabajos
 * donde es `operarioId` **o** `assignedUserId` (SCRUM-467). Si este camino lo dejara en `null`,
 * **el técnico crearía el Trabajo y dejaría de verlo en el mismo instante** — sin error, sin
 * aviso, y con la avería ya abierta. Se guarda quién lo abrió.
 *
 * No es inventar un criterio: `operarioId` es AUTORÍA (SCRUM-52). En el camino del presupuesto el
 * autor es quien lo redactó (`quote.teamMemberId`); aquí no hay presupuesto que redactar, así que
 * el autor es quien abre el Trabajo. Y `null` sigue significando «el propietario», que es la
 * misma convención de siempre: un admin lo ve todo igualmente.
 */
export function filaDeTrabajoDirecto(
  merchantId: number,
  datos: EntradaTrabajoDirecto,
  operarioId: number | null,
) {
  return {
    merchantId,
    customerId: datos.customerId,
    status: 'pendiente_agendar' as const,  // el mismo arranque de la FSM (Parte L)
    titulo: datos.titulo,
    direccion: datos.direccion,
    notes: datos.descripcion,
    // 🔴 SE PERSISTE. Mientras no habia columna, esto no estaba y la puerta rechazaba el campo
    // entero; ahora entra. `null` cuando no consta: ausente y «reparacion» no son lo mismo.
    tipoIntervencion: datos.tipoIntervencion,
    operarioId,
  };
}

/**
 * El nombre con el que se presenta un Trabajo que todavia no tiene uno puesto.
 *
 * 🔴 SIN PRESUPUESTO NO SE LLAMA «Presupuesto #N», y este era el respaldo de antes:
 *
 *     `Presupuesto #${quote ? quote.quoteNumber : job.id}`
 *
 * Sin presupuesto metia **el ID DEL TRABAJO donde va el numero del presupuesto**, asi que una
 * averia abierta sin presupuesto se presentaba como «Presupuesto #12»: un documento que no
 * existe, con un numero que es de otra cosa. Es la pantalla fingiendo que hay presupuesto
 * detras — justo lo que este ticket prohibe.
 *
 * Sin presupuesto se titula con el CLIENTE, que es lo que SCRUM-317 ya dejo escrito como regla:
 * «mientras no lo ponga, la pantalla se titula con el cliente».
 *
 * ⚠️ Vive aqui y NO en linea dentro del serializador porque en linea solo se podia probar
 * leyendo el fuente — y un guard que compara texto pasa en verde en cuanto alguien reescribe la
 * expresion sin cambiar el defecto. Medido: la primera version de este guard hizo exactamente
 * eso (SCRUM-651, tanda de rojos).
 */
export function tituloDeTrabajo(entrada: {
  titulo?: string | null;
  quote?: { quoteNumber?: number | string | null; id: number } | null;
  customer?: { name?: string | null } | null;
  jobId: number;
}): string {
  if (entrada.titulo) return entrada.titulo;   // el que puso el profesional manda siempre
  const cliente = entrada.customer?.name;
  if (entrada.quote) {
    const num = entrada.quote.quoteNumber ?? entrada.quote.id;
    return `Presupuesto #${num}${cliente ? ` · ${cliente}` : ''}`;
  }
  return cliente || `#${entrada.jobId}`;
}
