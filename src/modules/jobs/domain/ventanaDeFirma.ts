// src/modules/jobs/domain/ventanaDeFirma.ts — SCRUM-359 (H4) · LOS TRES RELOJES
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL DEFECTO: LA FECHA DE UNA FIRMA DEPENDE HOY DE UN RELOJ QUE EL USUARIO CONTROLA
//
// Cuando se firma SIN RED, el trazo se queda en la cola del móvil (`colaDeFirmas.js`) y sube
// al abrir la aplicación — que puede ser días después (H5 midió el desalojo a 7 días en iOS).
// El servidor sella `firmadoAt = new Date()` **en el instante de la llegada**
// (`albaranes.routes.ts:697`, `albaranPublic.routes.ts:400`), así que el albarán acredita como
// hora de firma un momento en el que el cliente ya no estaba delante.
//
// Y la hora en que se firmó de verdad **existe**: `colaDeFirmas.js:88` la guarda al encolar
// (`encoladaEn`, «cuándo el cliente firmó, no cuándo se intentó subir»). Lo que pasa es que
// **no viaja** — su propio comentario lo dice: «`encoladaEn` son NUESTROS … no viajan».
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA DECISIÓN DEL FUNDADOR (11-ago-2026): SE GUARDAN LOS TRES, Y NO SE ELIGE ENTRE ELLOS
//
//   ① Hora de firma          ← reloj del DISPOSITIVO. Es la que dice cuándo se firmó de verdad.
//   ② Última conexión antes  ← NUESTRO reloj.  ┐ acotan una VENTANA VERIFICABLE dentro de la
//   ③ Llegada al servidor    ← NUESTRO reloj.  ┘ cual la firma ocurrió NECESARIAMENTE.
//
// ② y ③ no se pueden tocar desde un móvil. Por eso ① —que hasta hoy no era contrastable con
// nada— pasa a poder **contrastarse**: si cae dentro de la ventana es coherente con lo que
// podemos probar; si cae fuera, hay un RELOJ DESFASADO, cosa hoy inobservable.
//
// 🔴 EL DESFASE SE DECLARA, NUNCA SE CORRIGE. Corregir un dato de prueba es peor que tener un
// dato raro: un valor «arreglado» es indistinguible de uno correcto, y destruye justo la
// anomalía que hacía falta ver. Aquí no hay ninguna función que ajuste ①.
//
// ⚠️ NADA DE ESTO ENTRA EN EL SOBRE. El sobre v:3 congela CINCO campos (`albaranVerificacion.ts`)
// y meter tiempos dentro sería un v:4 del formato, que toca el sellado (regla 38). Los tres
// relojes van AL LADO. Este módulo es dominio puro: no lee la base, no escribe, y no lo llama
// todavía el camino de firma — ver `docs/master/SCRUM-359.md` §5.

/**
 * 🔴 LAS FUENTES ADMITIDAS PARA EL SUELO, Y LA LISTA ES EL MECANISMO.
 *
 * El suelo tiene que ser un evento de **NUESTRO** servidor. Si se colara una fecha que el
 * usuario controla —`Albaran.fecha` y `Albaran.fechaEntrega` son EDITABLES en borrador, medido
 * en el esquema— la ventana dejaría de probar nada: se estaría contrastando el reloj del
 * dispositivo contra un dato del propio dispositivo, y siempre saldría «coherente».
 *
 * Por eso el suelo no acepta una fecha suelta: acepta una fecha **con su procedencia**, y la
 * procedencia tiene que estar aquí. Una fuente nueva se añade a mano y a la vista de todos.
 */
export const FUENTES_DE_SUELO = Object.freeze([
  /** `Albaran.enviadoParaFirmaAt` — `albaranWhatsApp.service.ts:133`, `new Date()` del servidor. */
  'albaran_enviado_para_firma',
  /** `Albaran.updatedAt` — `@updatedAt` de Prisma. Leído ANTES de escribir la firma. */
  'albaran_actualizado',
  /** `Albaran.createdAt` — `@default(now())`. El suelo más ancho, y el único que siempre existe. */
  'albaran_creado',
  /** `AuthSession.createdAt` — `@default(now())`. La sesión con la que se firmó. */
  'sesion_creada',
  /** `AuditLog.createdAt` — `@default(now())`. Acciones registradas sobre ese albarán. */
  'auditoria',
  /**
   * La entrega del paquete de precarga a ese dispositivo. **HOY NO EXISTE**: `GET /admin/precarga`
   * no escribe nada (medido, `precargaAdmin.routes.ts:27`). Se declara porque es el suelo que
   * daría la ventana MÁS ESTRECHA en el caso offline, y su columna va en el diff que espera al
   * fundador. Mientras no exista, ningún candidato la usa.
   */
  'precarga_entregada',
  /** El último drenado con éxito de la cola. Misma situación que el anterior: sin registrar hoy. */
  'cola_drenada',
] as const);

export type FuenteDeSuelo = (typeof FUENTES_DE_SUELO)[number];

export interface CandidatoSuelo {
  fuente: FuenteDeSuelo;
  instante: Date | null | undefined;
}

export interface Ventana {
  /** El evento NUESTRO más reciente anterior a la llegada. */
  suelo: Date;
  fuenteSuelo: FuenteDeSuelo;
  /** La llegada al servidor. NUESTRO reloj. */
  techo: Date;
  /** Lo que duró la desconexión, en ms. Es el ancho de lo que podemos probar. */
  anchoMs: number;
}

export type Veredicto =
  /** ① cae dentro de la ventana: coherente con lo que podemos probar. */
  | { estado: 'coherente'; ventana: Ventana; horaDispositivo: Date }
  /** ① es POSTERIOR a la llegada: el móvil va adelantado. Imposible: no se firma tras llegar. */
  | { estado: 'desfase_adelantado'; ventana: Ventana; horaDispositivo: Date; desfaseMs: number }
  /** ① es ANTERIOR al suelo: el móvil va atrasado. Imposible: no se firma antes de conectar. */
  | { estado: 'desfase_atrasado'; ventana: Ventana; horaDispositivo: Date; desfaseMs: number }
  /** No hay ningún evento nuestro anterior: la ventana NO se calcula. No es una ventana ancha. */
  | { estado: 'ventana_desconocida'; motivo: 'sin_suelo'; techo: Date; horaDispositivo: Date | null }
  /** Llegó una firma sin hora de dispositivo (versión vieja del cliente, o firma con cobertura). */
  | { estado: 'sin_hora_dispositivo'; ventana: Ventana };

const esFechaUtil = (d: unknown): d is Date =>
  d instanceof Date && Number.isFinite(d.getTime());

/**
 * El suelo es **el MÁS RECIENTE** de los candidatos que existan, nunca el primero que se
 * encuentre: cuanto más reciente, más estrecha la ventana y más dice el contraste.
 *
 * Se descartan los posteriores al techo. Un evento nuestro registrado DESPUÉS de que la firma
 * llegara no acota nada hacia atrás, y usarlo daría un suelo mayor que el techo — una ventana
 * imposible que haría «desfasadas» todas las firmas.
 */
export function elegirSuelo(
  candidatos: readonly CandidatoSuelo[] | null | undefined,
  techo: Date,
): { suelo: Date; fuente: FuenteDeSuelo } | null {
  if (!esFechaUtil(techo)) return null;
  let mejor: { suelo: Date; fuente: FuenteDeSuelo } | null = null;
  for (const c of candidatos || []) {
    if (!c || !FUENTES_DE_SUELO.includes(c.fuente)) continue;
    if (!esFechaUtil(c.instante)) continue;
    if (c.instante.getTime() > techo.getTime()) continue;
    if (!mejor || c.instante.getTime() > mejor.suelo.getTime()) {
      mejor = { suelo: c.instante, fuente: c.fuente };
    }
  }
  return mejor;
}

/**
 * Contrasta el reloj del dispositivo contra la ventana que sí controlamos.
 *
 * 🔴 SIN SUELO NO HAY VENTANA, Y ESO SE DICE. «Ventana desconocida» y «ventana estrecha» son
 * opuestos: el primero significa que no sabemos acotar nada, el segundo que lo acotamos muy
 * bien. Devolver una ventana con un suelo inventado —el principio del día, la fecha del
 * albarán— convertiría «no lo sé» en una afirmación, que es la mentira que este carril lleva
 * evitando desde SCRUM-285.
 */
export function contrastarReloj(params: {
  horaDispositivo: Date | null | undefined;
  candidatosSuelo: readonly CandidatoSuelo[] | null | undefined;
  llegadaAlServidor: Date;
}): Veredicto {
  const techo = params.llegadaAlServidor;
  const hora = esFechaUtil(params.horaDispositivo) ? params.horaDispositivo : null;

  const elegido = elegirSuelo(params.candidatosSuelo, techo);
  if (!elegido) return { estado: 'ventana_desconocida', motivo: 'sin_suelo', techo, horaDispositivo: hora };

  const ventana: Ventana = {
    suelo: elegido.suelo,
    fuenteSuelo: elegido.fuente,
    techo,
    anchoMs: techo.getTime() - elegido.suelo.getTime(),
  };

  if (!hora) return { estado: 'sin_hora_dispositivo', ventana };

  // Los bordes CUENTAN como dentro. Firmar en el mismo milisegundo en que la petición llega es
  // el caso normal de una firma CON cobertura, y llamarlo desfase sería marcar como sospechosa
  // la mitad de las firmas del producto.
  if (hora.getTime() > techo.getTime()) {
    return { estado: 'desfase_adelantado', ventana, horaDispositivo: hora, desfaseMs: hora.getTime() - techo.getTime() };
  }
  if (hora.getTime() < ventana.suelo.getTime()) {
    return { estado: 'desfase_atrasado', ventana, horaDispositivo: hora, desfaseMs: ventana.suelo.getTime() - hora.getTime() };
  }
  return { estado: 'coherente', ventana, horaDispositivo: hora };
}

/**
 * ⚠️ LA VENTANA QUE CRUZA DÍAS — se detecta, y aquí NO se resuelve.
 *
 * El ancho de la ventana es la duración de la desconexión, y H5 midió que puede ser de días.
 * Un albarán acredita una entrega de **un día concreto**, así que una ventana que empieza el
 * martes y acaba el jueves no permite afirmar desde nuestros datos en qué día se firmó: solo
 * el reloj del dispositivo lo dice, y es justo el que no controlamos.
 *
 * Qué hacer con eso —si el documento debe advertirlo, y con qué texto— es microcopy y decisión
 * del fundador: `docs/master/SCRUM-359.md` §7. Esto solo lo hace **observable**, que es lo que
 * impide que se descubra dentro de tres meses en una discusión con un cliente.
 *
 * Se compara en la zona horaria que se pase (por defecto la de España, que es donde se factura):
 * «qué día fue» es una pregunta local, y en UTC una firma de las 23:30 de Madrid cae en otro día.
 */
export function cruzaDias(ventana: Ventana, zona = 'Europe/Madrid'): boolean {
  const dia = (d: Date) => d.toLocaleDateString('es-ES', { timeZone: zona });
  return dia(ventana.suelo) !== dia(ventana.techo);
}
