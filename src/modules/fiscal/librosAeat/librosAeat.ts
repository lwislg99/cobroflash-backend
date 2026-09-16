// src/modules/fiscal/librosAeat/librosAeat.ts — SCRUM-325 (E4).
//
// ENTREGA por periodo el libro que CONSTRUYE A6 (SCRUM-296). No lo recalcula.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA FRONTERA DE ESTE FICHERO, y es la razón de que exista aparte
//
// A6 decide QUÉ es un asiento (base, cuota, desglose por tipo, enlaces). Aquí solo se decide
// CÓMO SALE: qué columnas, en qué orden, con qué formato y de qué periodo. Si algún día una
// cifra de aquí no cuadra con el libro, el defecto está en este fichero — nunca al revés,
// porque aquí no se suma nada.
//
// Por eso NO se importa `calcVatBreakdown` ni se toca el camino de emisión (regla 38): este
// módulo recibe el libro ya construido y lo formatea.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ✅ EL LIBRO DE RECIBIDAS YA ENTRA — SCRUM-426 (10-ago-2026)
//
// > **Registro de lo que decía esta cabecera hasta el 10-ago, porque explica el diseño y no se
// > borra:** «NO hay libro de facturas RECIBIDAS, y no se puede construir hoy. No es una omisión
// > de alcance: el dato no existe. Medido en SCRUM-321 (E0, Q2) sobre el DMMF, de los ocho datos
// > que pide un asiento de compra hay dos completos, uno a medias y cinco que no existen: NIF del
// > proveedor, base imponible, tipo de IVA, cuota, deducible y nº del proveedor. Por eso
// > `LIBROS_DISPONIBLES` tiene UN elemento y no dos. El día que `Expense` gane esos campos, se
// > añade aquí.»
//
// **Ese día fue el 10-ago-2026**: la migración del lote metió las seis columnas de `Expense` y
// `Provider.taxId` en las tres bases. Y el dato lo construye **A6** —`construirLibroRecibidas`,
// SCRUM-426—, no este fichero: aquí se LLAMA al motor y se pinta lo que devuelve. Eso no cruza la
// frontera, la ejerce. Cruzarla sería leer `Expense` y armar los asientos aquí.
//
// ⚠️ SIGUE FALTANDO, y no se disimula: `Provider.legalName` (hoy solo hay el nombre COMERCIAL) y
// la respuesta a P15 —¿cuota deducible como importe en vez de booleano? ¿número de recepción
// propio?—. Y sobre todo: **no hay especificación oficial del formato en el repositorio**, así que
// las columnas de recibidas son las del motor y el fichero lo DECLARA en su propio contenido.
import type { LibroRegistro, AsientoLibro } from '../../invoicing/domain/libroRegistro';
// SCRUM-426: E4 CONSUME el motor de A6. No lo recalcula -- lo llama y pinta lo que devuelve.
import { exigirLibroRecibidasLegible, type LibroRecibidas } from '../../invoicing/domain/libroRecibidas';

/**
 * ⚠️ MICROCOPY SIN APROBAR (regla 30). Los rótulos van con marcador Y con la propuesta porque un
 * fichero con doce cabeceras idénticas no se puede ni revisar. Nada de esto llega al profesional
 * sin que el fundador apruebe el texto: mientras el marcador esté, el fichero se ve provisional
 * de un vistazo, que es justo lo que se quiere.
 *
 * 🔴 Y NO se llama «Libro Registro de la AEAT» en ninguna parte del código ni de la UI. Ese
 * nombre es una PROMESA (regla 7 y el propio ticket: «la palabra es la promesa»), y no hay en
 * este árbol ningún documento oficial contra el que se haya contrastado el formato. Las columnas
 * son las del libro de A6, ordenadas como las pide un libro de expedidas; declararlo conforme es
 * una decisión del fundador, no de este fichero.
 */
export const MARCA_PENDIENTE = '[PENDIENTE]';

/**
 * Las columnas, con su CLAVE estable (la que usan los tests y no cambia al aprobar el texto) y su
 * rótulo provisional. Separar las dos cosas es lo que permite aprobar microcopy sin tocar ni un
 * test: el vector congelado de R1 se ancla en las claves.
 */
export const COLUMNAS_EXPEDIDAS = Object.freeze([
  { clave: 'fechaExpedicion', rotulo: 'Fecha de expedición' },
  { clave: 'serieNumero', rotulo: 'Serie y número' },
  { clave: 'tipoFactura', rotulo: 'Tipo de factura' },
  { clave: 'nifDestinatario', rotulo: 'NIF del destinatario' },
  { clave: 'nombreDestinatario', rotulo: 'Nombre del destinatario' },
  { clave: 'baseImponible', rotulo: 'Base imponible' },
  { clave: 'tipoIva', rotulo: 'Tipo de IVA (%)' },
  { clave: 'cuotaIva', rotulo: 'Cuota de IVA' },
  { clave: 'totalFactura', rotulo: 'Total de la factura' },
  /**
   * `Invoice.status` SE PARTE EN DOS COLUMNAS, una por eje (decisión del asesor, 7-ago-2026).
   *
   * Ese campo mezclaba cobro y anulación en una sola palabra, y «Estado: Pendiente» a secas se
   * lee como «pendiente de EMITIR» — el malentendido más caro posible en un documento que sale
   * de casa. No hay estado de emisión: una factura con número está emitida por definición, el
   * número ES la identidad fiscal. Cada columna, un eje.
   */
  { clave: 'cobro', rotulo: 'Cobro' },
  { clave: 'anulada', rotulo: 'Anulada' },
] as const);

/**
 * 🔴 EL CONJUNTO REAL DE `Invoice.status`, MEDIDO (7-ago-2026) — no supuesto.
 *
 * Derivado por AST sobre `src/` (7 escrituras en `invoice.create/update/updateMany/upsert`, CERO
 * asignaciones no literales) más el `@default("pending")` del schema, y contrastado con las tres
 * semillas (`seed-demo` ×2, `seed-video` ×1), que solo escriben `paid` y `pending`.
 *
 * ⚠️ **`already_paid` NO ES UN VALOR DE ESTE CAMPO.** Es un campo de RESPUESTA de la API
 * (`invoice.routes.ts:88`: `res.json({ ok: true, status: 'already_paid', … })`, la respuesta
 * idempotente de «esta factura ya estaba pagada»). Aparece en CUALQUIER grep de `status:` del
 * módulo de facturación y se lee como si fuera un estado — casi cuela en esta misma medición.
 * Si vas a censar estados, cuenta ESCRITURAS al modelo, no apariciones de la palabra.
 *
 * ⚠️ Y el alcance, dicho: esto deriva del CÓDIGO. Un valor escrito a mano contra la base con un
 * `UPDATE` en su día no aparecería aquí. Lo cubre el suelo de `celdasDeEstado`, que ante un valor
 * desconocido NO adivina.
 */
export const MAPA_ESTADO: Readonly<Record<string, { cobro: string; anulada: string }>> = Object.freeze({
  pending: { cobro: 'Pendiente', anulada: '—' },
  paid: { cobro: 'Cobrada', anulada: '—' },
  /**
   * 🔴 HALLAZGO AL PARTIR LA COLUMNA, y no se disimula: `annulled` PISA el estado de cobro.
   *
   * Como los dos ejes compartían un solo campo, en cuanto una factura se anula **se pierde si
   * estaba cobrada o no**. Por eso «Cobro» sale VACÍO aquí y no «Pendiente»: escribir «Pendiente»
   * sería afirmar que no se cobró, y eso no consta. Un hueco dice «no se sabe»; una palabra
   * afirma. Recuperar ese dato es un cambio de modelo y NO es de este ticket — queda declarado.
   */
  annulled: { cobro: '', anulada: 'Sí' },
});

/**
 * Las dos celdas de estado. **Un valor desconocido NO se adivina**: el suelo lanza nombrándolo.
 *
 * Si mañana alguien añade un cuarto estado y no le asigna columna, el mapeo mentiría en silencio
 * —la factura saldría como no anulada y sin cobro— sobre un documento que se entrega fuera.
 */
export function celdasDeEstado(status: string | null): { cobro: string; anulada: string } {
  if (status == null || status === '') return { cobro: '', anulada: '' };
  const m = MAPA_ESTADO[status];
  if (!m) {
    throw new Error(
      `🔴 ESTADO DE FACTURA SIN COLUMNA ASIGNADA: «${status}».\n\n` +
        `  Conocidos: ${Object.keys(MAPA_ESTADO).join(', ')}.\n` +
        '  Alguien ha añadido un estado a `Invoice.status` y no ha dicho a qué eje pertenece —\n' +
        '  ¿cobro o anulación?—. Sin esa decisión, la factura saldría en el libro como NO anulada\n' +
        '  y sin cobro, que es una afirmación que nadie ha hecho. Añádelo a `MAPA_ESTADO`.',
    );
  }
  return m;
}

/**
 * SCRUM-426 · LAS COLUMNAS DE RECIBIDAS: **una por cada campo que devuelve el motor, en el orden
 * del motor**. Ni una inventada.
 *
 * No hay especificación del formato en el repositorio (medido el 10-ago-2026: ni diseño de
 * registro, ni orden ministerial; los seis XSD son de VeriFactu y no mencionan «recibida» ni
 * «proveedor» ni una vez). Así que aquí NO se decide qué columnas pide un libro de recibidas: se
 * pinta lo que el motor de A6 sabe, tal cual. Cuando P15.1 tenga respuesta, el cambio es
 * **renombrar cabeceras**, no rehacer el fichero.
 *
 * ⚠️ LA ÚNICA EXCEPCIÓN al 1:1, dicha aquí para que se pueda recortar de una línea: el motor
 * devuelve `proveedorId`, que es un id interno y no dice nada en un libro. Se resuelve a **NIF y
 * nombre**, exactamente como el de expedidas resuelve `clienteId`, y por el motivo que declara
 * `librosAeat.repo.ts`: resolver un id contra la ficha es ENTREGA, no cálculo — no suma, no
 * reparte IVA y no toca un asiento.
 *
 * ⚠️ `nombreProveedor` sale hoy de `Provider.name`, que es el nombre **comercial**: `Provider` no
 * tiene `legalName` (pendiente de schema). Un libro identifica por razón social, así que esta
 * columna está **incompleta a sabiendas** y no se disimula.
 */
export const COLUMNAS_RECIBIDAS = Object.freeze([
  { clave: 'numeroProveedor', rotulo: 'Serie y número del proveedor' },
  { clave: 'fechaExpedicion', rotulo: 'Fecha de expedición del proveedor' },
  { clave: 'fechaApunte', rotulo: 'Fecha del apunte' },
  { clave: 'nifProveedor', rotulo: 'NIF del proveedor' },
  { clave: 'nombreProveedor', rotulo: 'Nombre del proveedor' },
  { clave: 'concepto', rotulo: 'Concepto' },
  { clave: 'base', rotulo: 'Base imponible' },
  { clave: 'tipoIva', rotulo: 'Tipo de IVA (%)' },
  { clave: 'cuota', rotulo: 'Cuota de IVA soportada' },
  { clave: 'deducible', rotulo: '¿Deducible?' },
  { clave: 'total', rotulo: 'Importe del apunte' },
  { clave: 'moneda', rotulo: 'Moneda' },
] as const);

/**
 * Los DOS libros. Pasa de uno a dos porque el motor de recibidas **existe y está conectado**
 * (SCRUM-426): lo que faltaba nunca fue el formato, era quién construyera el dato.
 */
export const LIBROS_DISPONIBLES = Object.freeze([
  { clave: 'expedidas', rotulo: 'Facturas emitidas', columnas: COLUMNAS_EXPEDIDAS },
  { clave: 'recibidas', rotulo: 'Facturas recibidas', columnas: COLUMNAS_RECIBIDAS },
]);

/** Lo que hace falta saber del proveedor para el libro. Se RESUELVE, no se calcula. */
export interface DatosProveedor {
  nombre: string | null;
  nif: string | null;
}

/**
 * 🔴 LO QUE EL LIBRO DE RECIBIDAS DECLARA EN SU PROPIO CONTENIDO, y no en una nota aparte.
 *
 * Dos cosas que quien reciba el fichero tiene que leer SIN preguntar:
 *
 *   ① el formato es **provisional** — no contrastado contra ninguna especificación oficial
 *      (P15.1). Un fichero entregado a un despacho sin decirlo se lee como definitivo;
 *   ② cuántos gastos **quedaron fuera** por no estar clasificados, y **cuánto dinero** son. Un
 *      gasto excluido en silencio es un libro vacío pequeño: se verían 10 asientos y se leería
 *      «compré diez cosas» teniendo 190 sin clasificar.
 *
 * ✅ MICROCOPY APROBADA por el fundador el 10-ago-2026, los tres textos tal cual se propusieron.
 * Por eso van SIN `MARCA_PENDIENTE`: el marcador es para lo que espera aprobación, y dejarlo
 * puesto sobre texto ya aprobado haría que dejara de significar nada — que es como muere un
 * marcador. El de las CABECERAS sigue siendo otra cosa y no se toca aquí.
 */
export function avisosLibroRecibidas(libro: {
  sinClasificar: number;
  sinClasificarImporte: number;
}): string[] {
  const avisos = ['Formato provisional: no contrastado contra especificación oficial.'];
  if (libro.sinClasificar > 0) {
    // ⚠️ Sin «gasto(s)»: el plural perezoso lo caza el trinquete de SCRUM-377 y se lee como
    // software a medio hacer. Se resuelve el plural de verdad, que además es una frase mejor.
    const cuantos = libro.sinClasificar === 1
      ? '1 gasto sin datos de IVA no figura'
      : `${libro.sinClasificar} gastos sin datos de IVA no figuran`;
    avisos.push(`${cuantos} en este libro. Importe total: ${libro.sinClasificarImporte}.`);
  }
  return avisos;
}

/**
 * Las filas del libro de recibidas. `proveedores` resuelve `proveedorId` → NIF y nombre; lo que no
 * se pueda resolver sale VACÍO, nunca inventado ni rellenado con el id.
 *
 * ⚠️ Aquí NO se suma, no se reparte IVA y no se deriva ninguna cuota: se pinta lo que el motor
 * devolvió. Si una cifra de este fichero no cuadra con el libro, el defecto está AQUÍ.
 */
export function filasLibroRecibidas(
  libro: LibroRecibidas,
  proveedores: Map<number, DatosProveedor>,
): FilaLibro[] {
  exigirLibroRecibidasLegible(libro);
  return libro.asientos.map((a) => {
    const p = (a.proveedorId != null ? proveedores.get(a.proveedorId) : null)
      ?? { nombre: null, nif: null };
    return {
      numeroProveedor: a.numeroProveedor,
      fechaExpedicion: a.fechaExpedicion ? String(a.fechaExpedicion).slice(0, 10) : null,
      fechaApunte: a.fechaApunte ? String(a.fechaApunte).slice(0, 10) : null,
      nifProveedor: p.nif,
      nombreProveedor: p.nombre,
      concepto: a.concepto,
      base: a.base,
      tipoIva: a.tipoIva,
      cuota: a.cuota,
      // `null` NO se aplana a «No»: «nunca se clasificó» y «se decidió que no» son cosas
      // distintas, y en un libro que se entrega, confundirlas afirma algo que nadie dijo.
      deducible: a.deducible === null ? null : (a.deducible ? 'Sí' : 'No'),
      total: a.total,
      moneda: a.moneda,
    };
  });
}

/** Lo que hace falta saber del cliente para el libro. Se RESUELVE, no se calcula. */
export interface DatosDestinatario {
  nombre: string | null;
  nif: string | null;
}

export interface FilaLibro {
  [clave: string]: string | number | null;
}

/**
 * 🔴 EL SUELO, y en este módulo es el asunto entero.
 *
 * Un periodo sin asientos y un lector que no supo mirar producen **el mismo fichero en blanco**, y
 * significan lo contrario: el primero es correcto y el segundo se le manda a Hacienda diciendo que
 * no facturaste. `LibroRegistro.miradas` es lo que los separa —A6 lo expone justo para esto— así
 * que aquí se EXIGE: sin ese número no se emite fichero, se lanza.
 *
 * No se «arregla» devolviendo cero filas: cero filas es una respuesta legítima y por eso no puede
 * ser también la respuesta al fallo.
 */
export function exigirLibroLegible(libro: unknown): asserts libro is LibroRegistro {
  const l = libro as LibroRegistro | null | undefined;
  if (!l || typeof l !== 'object' || !Array.isArray(l.asientos) || typeof l.miradas !== 'number') {
    throw new Error(
      '🔴 NO SE PUDO LEER EL LIBRO DE REGISTRO (`leerLibroRegistro`, SCRUM-296/A6). No se emite ' +
        'fichero.\n\n' +
        '  Un periodo SIN facturas y un libro que no se pudo leer dan el MISMO fichero vacío, y ' +
        'significan lo contrario: el primero es correcto, el segundo declara ante un tercero que ' +
        'no se facturó. `miradas` es lo que los distingue (cuántas facturas se examinaron), así ' +
        'que si no viene, no hay nada que entregar.',
    );
  }
}

/** ¿Entra el asiento en el periodo? La comparación es por INSTANTE, con los dos extremos dentro. */
export function entraEnPeriodo(fechaIso: string | null, desde: Date, hasta: Date): boolean {
  if (!fechaIso) return false;
  const t = new Date(fechaIso).getTime();
  if (!Number.isFinite(t)) return false;
  return t >= desde.getTime() && t <= hasta.getTime();
}

/**
 * Una fila por TIPO DE IVA, no por factura: un libro de expedidas desglosa por tipo, y una factura
 * con 21 % y 10 % son dos apuntes. El desglose lo trae A6 en `porTipo` — aquí no se recalcula.
 *
 * ⚠️ Una factura con el importe ILEGIBLE (`importeIlegible`) no sale como `0,00`: sale con las
 * celdas de importe VACÍAS. Un cero es una afirmación —«facturó cero»— y aquí no se sabe.
 */
export function filasDeAsiento(a: AsientoLibro, destinatario: DatosDestinatario): FilaLibro[] {
  const estado = celdasDeEstado(a.estado);
  const comun = {
    fechaExpedicion: a.fecha ? String(a.fecha).slice(0, 10) : null,
    serieNumero: a.numero,
    tipoFactura: a.tipo,
    nifDestinatario: destinatario.nif,
    nombreDestinatario: destinatario.nombre,
    cobro: estado.cobro,
    anulada: estado.anulada,
  };

  if (a.importeIlegible) {
    return [{ ...comun, baseImponible: null, tipoIva: null, cuotaIva: null, totalFactura: null }];
  }

  const porTipo = Array.isArray(a.porTipo) ? a.porTipo : [];
  if (porTipo.length === 0) {
    return [{ ...comun, baseImponible: a.base, tipoIva: null, cuotaIva: a.cuota, totalFactura: a.total }];
  }

  // El total va SOLO en la primera fila del desglose: repetirlo en cada tipo haría que una suma
  // de la columna diera el total multiplicado por el número de tipos.
  return porTipo.map((t, i) => ({
    ...comun,
    baseImponible: t.base,
    tipoIva: t.tipo,
    cuotaIva: t.cuota,
    totalFactura: i === 0 ? a.total : null,
  }));
}

/**
 * El libro de expedidas del periodo, ya en filas. `destinatarios` resuelve `clienteId` → NIF y
 * nombre; lo que no se pueda resolver sale VACÍO, nunca inventado ni rellenado con el id.
 */
export function filasLibroExpedidas(
  libro: LibroRegistro,
  destinatarios: Map<number, DatosDestinatario>,
  periodo?: { desde: Date; hasta: Date },
): FilaLibro[] {
  exigirLibroLegible(libro);
  const dentro = periodo
    ? libro.asientos.filter((a) => entraEnPeriodo(a.fecha, periodo.desde, periodo.hasta))
    : libro.asientos;

  return dentro.flatMap((a) => {
    const d = (a.clienteId != null ? destinatarios.get(a.clienteId) : null) ?? { nombre: null, nif: null };
    return filasDeAsiento(a, d);
  });
}
