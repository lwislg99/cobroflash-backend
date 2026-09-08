// src/modules/jobs/domain/parteTrabajo.ts — SCRUM-652 (T3 · fase B)
//
// EL PARTE DE TRABAJO. Puro: sin BD, sin red, sin Express.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL PARTE NO ES UN ALBARÁN, Y LA DIFERENCIA ESTÁ EN LO QUE SE FIRMA
//
// El reconocimiento de la fase A (`docs/master/SCRUM-652.md`) midió que el canónico del albarán
// mete `precioUnitario` y `tipoIva` DENTRO del hash sellado (`albaran.service.ts:368-376`), y que
// por eso cambiar un precio después de firmar rompe la huella. Ahí eso es correcto: **un albarán
// VALORADO se firma con sus precios delante**, así que el precio es parte de lo que se firmó.
//
// En el parte NO. En el papel real que el técnico lleva a la obra **la columna de importe está
// vacía**: el cliente firma que le pusieron dos cámaras y sesenta metros de cable. No firma el
// precio. Así que **el precio no entra en el sello, porque no es lo que se firmó** — y ésa es la
// razón entera de que este fichero exista en vez de reutilizar el sellador del albarán.
//
// De ahí salen los DOS CANDADOS, y son en momentos distintos:
//
//     CONTENIDO  →  se congela AL FIRMAR      (lo que el cliente vio y firmó)
//     PRECIOS    →  siguen abiertos           (los pone la oficina, hasta FACTURAR)
//
// ⛔ **El canónico del albarán NO SE TOCA.** Son dos documentos con dos sellos distintos, y
// unificarlos rompería uno de los dos.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// ⚠️ SI HAS VENIDO A COMPARTIR CÓDIGO CON `albaran.service.ts`, LEE ESTO PRIMERO
//
// `contenidoCanonicoParte` se parece a `contenidoCanonico` del albarán y parece que los dos
// piden un helper común. **NO LO PIDEN**, y el motivo lo dejó escrito aquel fichero
// (`albaran.service.ts:378-400`), medido y con su ticket:
//
//   `JSON.stringify` serializa las claves **en su orden de inserción**. Un helper compartido ata
//   el orden de un documento al del otro, así que el día que alguien añada un campo al parte —o
//   reordene los del helper— **cambiaría el hash de albaranes ya firmados**. Y no se rompería
//   nada en el momento: se rompe DESPUÉS, cuando alguien verifique uno y le salga «no coincide»
//   sobre un documento intacto. O sea, una acusación de falsificación contra un papel que nadie
//   tocó.
//
// El hash de un parte firmado hoy tiene que poder recalcularse IGUAL dentro de diez años. Unas
// líneas duplicadas son el precio de que romperlo sea IMPOSIBLE en vez de estar vigilado.
// **Una versión cerrada no se refactoriza.**
import crypto from 'crypto';

/** La versión del contenido sellado que se escribe HOY. Nace en 1. */
// 🔴 SCRUM-653 · 1 → 2. Lo que cambia es QUÉ SE SELLA, y el motivo está en
// `contenidoCanonicoParte`: con DOS firmas, sellar la identidad del firmante hacía que la huella
// del documento dependiera de QUIÉN FIRMA PRIMERO. La v:1 se conserva entera e intacta — un parte
// ya sellado con ella se sigue verificando con ella.
export const PARTE_CONTENIDO_VERSION_ACTUAL = 2;

/**
 * LOS DOS BLOQUES, cerrados.
 *
 * El papel los lleva separados y con su total aparte, así que **no son una etiqueta de la línea:
 * son su sitio**. Una lista plana con un campo «tipo» daría el mismo dato y perdería el orden del
 * documento, que es lo que el cliente lee de arriba abajo.
 */
export const BLOQUES_PARTE = ['mano_obra', 'materiales'] as const;
export type BloqueParte = (typeof BLOQUES_PARTE)[number];

/**
 * LOS TRES TIPOS, y son EXCLUYENTES: en el papel son tres casillas y solo se marca una.
 *
 * Cerrado a propósito (regla 27): un tipo libre deja escribir «revisión» y entonces la pregunta
 * «¿cuántos mantenimientos hicimos?» depende de acertar cómo lo escribió cada técnico.
 */
export const TIPOS_PARTE = ['reparacion_asistencia', 'mantenimiento', 'instalacion'] as const;
export type TipoParte = (typeof TIPOS_PARTE)[number];

/**
 * LOS ESTADOS. `facturado` es el que cierra los precios — ver `puedeEditarPrecios`.
 *
 * ⚠️ NO se copian los del albarán (`borrador | emitido | firmado`): el parte no tiene «emitido»
 * porque no se emite, se firma en mano. Copiar un estado que no significa nada aquí obligaría a
 * mirar dos veces cada `if` para acordarse de cuál no se usa.
 */
export const ESTADOS_PARTE = ['borrador', 'firmado', 'facturado'] as const;
export type EstadoParte = (typeof ESTADOS_PARTE)[number];

/**
 * Una línea del parte.
 *
 * 🔴 `precioUnitario` y `tipoIva` son OPCIONALES Y NO ENTRAN EN EL SELLO. Los pone la oficina en
 * otra pantalla; el técnico no los ve nunca (`lineasParaElTecnico`).
 */
export interface LineaParte {
  bloque: BloqueParte;
  /** Unidades. El papel dice «UNDS». Admite fracción: 1,5 h de mano de obra es normal. */
  unds: number;
  descripcion: string;
  precioUnitario?: number | null;
  tipoIva?: number | null;
}

/** Lo que hace falta para sellar un parte. Todo lo que está aquí, y nada más, entra en el hash. */
export interface ParteContenidoParams {
  numero: string;
  fecha: Date | string;
  cliente: string | null;
  /** La dirección de la obra, tal cual iba en el papel. */
  obra: string | null;
  /** El «REF» del papel: la referencia del cliente para ese trabajo. */
  referencia: string | null;
  /** Horas de entrada y salida, como el técnico las escribió. */
  entrada: string | null;
  salida: string | null;
  desplazamientos: number | null;
  kilometros: number | null;
  /**
   * Los técnicos que fueron. ARRAY porque el papel admite varios.
   *
   * ⚠️ RANURA DECLARADA, SIN FUENTE VIVA (SCRUM-652 fase B): «varios técnicos» viene de la sesión 1
   * y HOY NO EXISTE — medido: el esquema solo tiene `teamMemberId`/`operarioId`, uno solo. Se sella
   * el array para que el día que exista no haya que estrenar una versión de contenido; hasta
   * entonces llegará con cero o un elemento. Que la ranura exista NO significa que esté cableada.
   */
  tecnicos: string[];
  tipo: TipoParte | null;
  lineas: LineaParte[];
  notas: string | null;
  firmadoPorNombre: string | null;
  firmadoPorCalidad: string | null;
}

/**
 * 🔴 LAS LÍNEAS, EN SU FORMA CANÓNICA — Y SIN NI UN PRECIO.
 *
 * Aquí está la decisión del ticket, en tres campos. Se escribe la lista ENTERA en vez de coger la
 * línea y borrarle dos claves, y no es estilo: con un `delete` o un `omit`, el día que alguien
 * añada un campo nuevo a `LineaParte` **entraría en el sello sin que nadie lo decidiera**. Así,
 * lo que se sella es exactamente lo que está escrito aquí.
 */
function lineasCanonicasParte(lineas: LineaParte[]) {
  return (Array.isArray(lineas) ? lineas : []).map((l) => ({
    bloque: l.bloque,
    unds: l.unds,
    descripcion: l.descripcion,
  }));
}

/**
 * El objeto canónico del parte, ESCRITO ENTERO. Ver el aviso de la cabecera antes de tocarlo.
 *
 * ⚠️ **Sin rama por defecto, y LANZA ante una versión desconocida.** Es la lección de SCRUM-438:
 * un despachador que elige rama para una versión que no reconoce **está adivinando**, y un valor
 * adivinado en un documento firmado coincide por accidente hasta el día que no.
 */
function contenidoCanonicoParte(params: ParteContenidoParams, version: number): unknown {
  const fecha = params.fecha instanceof Date ? params.fecha.toISOString() : String(params.fecha);

  if (version === 1) {
    return {
      v: 1,
      numero: params.numero,
      fecha,
      cliente: params.cliente ?? null,
      obra: params.obra ?? null,
      referencia: params.referencia ?? null,
      entrada: params.entrada ?? null,
      salida: params.salida ?? null,
      desplazamientos: params.desplazamientos ?? null,
      kilometros: params.kilometros ?? null,
      tecnicos: Array.isArray(params.tecnicos) ? [...params.tecnicos] : [],
      tipo: params.tipo ?? null,
      lineas: lineasCanonicasParte(params.lineas),
      notas: params.notas ?? null,
      firmadoPorNombre: params.firmadoPorNombre ?? null,
      firmadoPorCalidad: params.firmadoPorCalidad ?? null,
    };
  }

  // ═══════════════════════════════════════════════════════
  // v:2 · SCRUM-653 · EL SELLO ES DEL CONTENIDO, Y NADIE MÁS ENTRA
  // ═══════════════════════════════════════════════════════
  //
  // 🔴 LA DECISIÓN DEL TICKET, Y ES ESTA LÍNEA: `firmadoPorNombre` y `firmadoPorCalidad`
  // ESTABAN en v:1 y SALEN en v:2.
  //
  // El papel lleva DOS firmas. Si la identidad del firmante entra en el sello, la huella se
  // calcula con lo que hay EN ESE MOMENTO:
  //
  //     firma el cliente  → técnico aún null  →  hash H1
  //     firma el técnico  → los dos rellenos   →  hash H2 ≠ H1
  //
  // Y al revés, otro par. O sea: **un documento cuya huella depende de quién firmó primero**, con
  // el MISMO contenido. Eso no es un sello: es un número que cambia solo.
  //
  // La alternativa era meter las dos y recalcular al completarse — pero entonces el hash que se
  // le enseñó al primer firmante deja de valer, que es peor.
  //
  // Así que el sello es del CONTENIDO: qué se hizo, cuánto y dónde. Las firmas son EVIDENCIA
  // ADHERIDA — cada una con su trazo, su fecha y su nombre, en la fila y FUERA del hash. Que el
  // contenido no cambie después lo garantiza `puedeEditarContenido`, no el sello.
  //
  // ⚠️ Escrito ENTERO y no derivado de v:1: si alguien añadiera un campo a una forma compartida,
  // entraría en v:2 sin que nadie lo decidiera y los partes ya sellados dejarían de verificar.
  if (version === 2) {
    return {
      v: 2,
      numero: params.numero,
      fecha,
      cliente: params.cliente ?? null,
      obra: params.obra ?? null,
      referencia: params.referencia ?? null,
      entrada: params.entrada ?? null,
      salida: params.salida ?? null,
      desplazamientos: params.desplazamientos ?? null,
      kilometros: params.kilometros ?? null,
      tecnicos: Array.isArray(params.tecnicos) ? [...params.tecnicos] : [],
      tipo: params.tipo ?? null,
      lineas: lineasCanonicasParte(params.lineas),
      notas: params.notas ?? null,
    };
  }

  throw new Error(`parteTrabajo: versión de contenido desconocida (${version}). No se adivina.`);
}

/** La huella del CONTENIDO del parte. Sin precios: ver la cabecera. */
export function computeParteContentHash(
  params: ParteContenidoParams,
  version: number = PARTE_CONTENIDO_VERSION_ACTUAL,
): string {
  return crypto.createHash('sha256')
    .update(JSON.stringify(contenidoCanonicoParte(params, version)), 'utf8')
    .digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS DOS CANDADOS
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * El CONTENIDO se congela al firmar. Es lo que el cliente vio y firmó.
 *
 * 🔴 SCRUM-653 · SE CONGELA CON LA **PRIMERA** FIRMA, Y NO SE CAMBIA NADA AQUÍ. Medido antes de
 * tocar: hoy cualquier estado distinto de `borrador` cierra el contenido, o sea que ya congelaba
 * con la primera. Se conserva, y con dos firmas el motivo es más fuerte que con una:
 *
 *   · lo que el PRIMER firmante avaló no puede cambiar después. Si el contenido siguiera abierto
 *     hasta la segunda firma, se podría modificar lo que el otro ya había firmado — y no volvería
 *     a mirarlo;
 *   · la segunda firma es una ADICIÓN: pone su trazo, su fecha y su nombre, y no toca el
 *     contenido, así que el sello (v:2, sólo contenido) no se mueve.
 *
 * En el papel se rellena, se firma y se firma. Lo que queda prohibido es rellenar ENTRE las dos
 * firmas, que es justo lo que no se ve.
 *
 * Devuelve el motivo en vez de un booleano pelado: quien lo llame tiene que poder decir POR QUÉ
 * no se puede, y «no se puede» a secas manda al profesional a adivinar.
 */
export function puedeEditarContenido(estado: EstadoParte): { ok: boolean; motivo: string | null } {
  if (estado === 'borrador') return { ok: true, motivo: null };
  return {
    ok: false,
    motivo: 'el parte está firmado: su contenido es lo que el cliente firmó y no se puede cambiar',
  };
}

/**
 * 🔴 LOS PRECIOS SIGUEN ABIERTOS DESPUÉS DE FIRMAR, y esto es la mitad del ticket.
 *
 * El técnico cierra el parte en la obra sin importes; la oficina los pone después, las veces que
 * haga falta, **hasta que se factura**. Si esto devolviera `false` en `firmado`, el producto sería
 * inservible — y desde fuera se vería idéntico a haberlo hecho bien.
 */
/**
 * LOS DOS GRUPOS DE CAMPOS, y cada uno lo cierra SU candado.
 *
 * 🔴 EL DEFECTO QUE ESTO CIERRA, medido: el `PATCH` comprobaba `puedeEditarContenido` para la
 * PETICIÓN ENTERA, así que un parte FIRMADO devolvía 409 a todo — incluido un cambio que solo
 * tocaba precios. Y `puedeEditarPrecios` existía, se calculaba y se devolvía… pero no cerraba
 * ninguna escritura. Resultado: **un parte firmado no se podía valorar por ninguna vía**, y sin
 * valorar no se cobra.
 *
 * El contenido lo escribe el técnico en la obra y se cierra AL FIRMAR: lo firmado no cambia.
 * Los precios los pone la oficina DESPUÉS, y se cierran AL FACTURAR (regla 29).
 */
const CAMPOS_CONTENIDO = [
  'obra', 'referencia', 'entrada', 'salida', 'notas', 'tipo',
  'desplazamientos', 'kilometros', 'tecnicos', 'lineas',
] as const;

/** Los precios viajan en SU PROPIA clave, no mezclados en `lineas`: así «mixta» no es opinable. */
const CAMPOS_PRECIOS = ['precios'] as const;

type CampoDelParte = (typeof CAMPOS_CONTENIDO)[number] | (typeof CAMPOS_PRECIOS)[number];

/**
 * ¿Se pueden tocar ESTOS campos en ESTE estado?
 *
 * ⚠️ Devuelve el PRIMER campo que lo impide, y quien llama **no aplica nada**: una petición
 * mixta sobre un parte firmado se rechaza ENTERA. Aplicarla a medias dejaría el documento en un
 * estado que nadie pidió, y el que la mandó creyendo que fue entera no se enteraría.
 */
export function permisoDeCampos(
  estado: EstadoParte,
  campos: readonly string[],
): { ok: true } | { ok: false; campo: string; grupo: 'contenido' | 'precios'; motivo: string } {
  const contenido = puedeEditarContenido(estado);
  const precios = puedeEditarPrecios(estado);
  for (const campo of campos) {
    if ((CAMPOS_CONTENIDO as readonly string[]).includes(campo) && !contenido.ok) {
      return { ok: false, campo, grupo: 'contenido', motivo: contenido.motivo ?? '' };
    }
    if ((CAMPOS_PRECIOS as readonly string[]).includes(campo) && !precios.ok) {
      return { ok: false, campo, grupo: 'precios', motivo: precios.motivo ?? '' };
    }
  }
  return { ok: true };
}

export function puedeEditarPrecios(estado: EstadoParte): { ok: boolean; motivo: string | null } {
  if (estado === 'facturado') {
    return {
      ok: false,
      motivo: 'el parte ya está facturado: los importes los fija la factura, y una factura emitida no se edita',
    };
  }
  return { ok: true, motivo: null };
}

/**
 * SUELO: un parte sin ni una línea NO se firma.
 *
 * Una firma sobre un documento vacío no prueba nada y, peor, PARECE que prueba algo: queda un
 * papel firmado que no dice qué se hizo. Se comprueban LOS DOS bloques juntos —basta una línea en
 * cualquiera de ellos—, porque una instalación puede ser solo material y una asistencia solo mano
 * de obra.
 */
export function puedeFirmarse(lineas: LineaParte[]): { ok: boolean; motivo: string | null } {
  const cuantas = Array.isArray(lineas) ? lineas.length : 0;
  if (cuantas === 0) {
    return {
      ok: false,
      motivo: 'un parte sin ninguna línea no se puede firmar: no dice qué se hizo',
    };
  }
  return { ok: true, motivo: null };
}

// ───────────────────────────────────────────────────────
// SCRUM-653 · LAS DOS FIRMAS
// ───────────────────────────────────────────────────────

/** Lo que hace falta saber de un parte para decidir sobre sus firmas. */
export interface FirmasDelParte {
  firmadoAt?: Date | string | null;
  firmadoTecnicoAt?: Date | string | null;
}

const yaFirmo = (v: Date | string | null | undefined) => v !== null && v !== undefined;

/**
 * ¿Está el parte COMPLETO? Las dos firmas puestas.
 *
 * Se DERIVA de las dos fechas, y no es una bandera nueva: una bandera puede contradecir a los
 * datos —decir «completo» con una firma sin poner— y entonces hay dos verdades. Además
 * `ESTADOS_PARTE` es vocabulario CERRADO (Parte L): añadirle un cuarto estado es cambio de
 * máster, no una línea aquí.
 */
export function firmasCompletas(parte: FirmasDelParte): boolean {
  return yaFirmo(parte.firmadoAt) && yaFirmo(parte.firmadoTecnicoAt);
}

/**
 * ¿Puede firmar el CLIENTE? Una vez, y no dos.
 *
 * Una segunda firma sobre la misma ranura pisaría el trazo ya recogido, y de eso no queda ni
 * rastro: la fila no guarda historial. Devuelve el motivo, como los demás candados.
 */
export function puedeFirmarCliente(parte: FirmasDelParte): { ok: boolean; motivo: string | null } {
  if (yaFirmo(parte.firmadoAt)) {
    return { ok: false, motivo: 'el cliente ya ha firmado este parte' };
  }
  return { ok: true, motivo: null };
}

/** ¿Puede firmar el TÉCNICO? Mismo criterio, ranura propia. */
export function puedeFirmarTecnico(parte: FirmasDelParte): { ok: boolean; motivo: string | null } {
  if (yaFirmo(parte.firmadoTecnicoAt)) {
    return { ok: false, motivo: 'el técnico ya ha firmado este parte' };
  }
  return { ok: true, motivo: null };
}

/**
 * 🔴 EL ORDEN NO IMPORTA, Y ESO ES UNA DECISIÓN ESCRITA.
 *
 * En la obra firma quien esté libre primero. Exigir un orden obligaría a uno de los dos a esperar
 * con el móvil en la mano, y no protege de nada: el sello es del CONTENIDO (v:2), así que la
 * huella es la misma firme quien firme primero. Esta función existe para que la decisión viva en
 * UN sitio y no repartida por dos rutas.
 */
export function ordenDeFirmaExigido(): null {
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS DOS BLOQUES
// ─────────────────────────────────────────────────────────────────────────────────────────

/** Las líneas de un bloque, EN SU ORDEN. El orden del papel es el orden en que se lee. */
export function lineasDelBloque(lineas: LineaParte[], bloque: BloqueParte): LineaParte[] {
  return (Array.isArray(lineas) ? lineas : []).filter((l) => l.bloque === bloque);
}

export interface TotalBloque {
  baseCents: number;
  cuotaCents: number;
  totalCents: number;
}

/**
 * Los totales, **por bloque y aparte**, y el total como suma de los dos.
 *
 * ⚠️ En CÉNTIMOS ENTEROS, igual que `calcAlbaranTotales` (`albaran.service.ts:181`): sumar euros
 * en coma flotante pierde céntimos, y un céntimo en un documento que acaba en factura es una
 * discrepancia que alguien tiene que explicar.
 *
 * Una línea sin precio **no suma y no rompe**: el parte pasa por un estado en el que el técnico ya
 * cerró y la oficina aún no ha valorado, y ahí lo correcto es un total parcial, no un error.
 */
export function totalesPorBloque(lineas: LineaParte[]): {
  mano_obra: TotalBloque;
  materiales: TotalBloque;
  total: TotalBloque;
} {
  const suma = (deBloque: LineaParte[]): TotalBloque => {
    let baseCents = 0;
    let cuotaCents = 0;
    for (const l of deBloque) {
      if (l.precioUnitario === undefined || l.precioUnitario === null) continue;
      const lineaBaseCents = Math.round(Number(l.precioUnitario) * Number(l.unds) * 100);
      baseCents += lineaBaseCents;
      cuotaCents += Math.round(lineaBaseCents * (Number(l.tipoIva || 0) / 100));
    }
    return { baseCents, cuotaCents, totalCents: baseCents + cuotaCents };
  };

  const manoObra = suma(lineasDelBloque(lineas, 'mano_obra'));
  const materiales = suma(lineasDelBloque(lineas, 'materiales'));

  return {
    mano_obra: manoObra,
    materiales,
    // El total es LA SUMA DE LOS DOS, no un recuento aparte sobre todas las líneas: si algún día
    // naciera un tercer bloque, un recuento global lo incluiría en silencio y los dos subtotales
    // dejarían de cuadrar con él sin que nadie lo viera.
    total: {
      baseCents: manoObra.baseCents + materiales.baseCents,
      cuotaCents: manoObra.cuotaCents + materiales.cuotaCents,
      totalCents: manoObra.totalCents + materiales.totalCents,
    },
  };
}

/**
 * 🔴 LO QUE VE EL TÉCNICO EN LA OBRA: unidades y descripción. NI UN IMPORTE.
 *
 * Es el mismo mecanismo que `albaranDetailView.js:490` usa para la firma en el aparato: **que los
 * importes NO LLEGUEN hasta la pantalla es lo que hace imposible que se pinten por descuido.** Una
 * pantalla que los recibe y decide no enseñarlos está a un `console.log` de enseñarlos.
 */
export function lineasParaElTecnico(lineas: LineaParte[]): Array<{
  bloque: BloqueParte; unds: number; descripcion: string;
}> {
  return (Array.isArray(lineas) ? lineas : []).map((l) => ({
    bloque: l.bloque,
    unds: l.unds,
    descripcion: l.descripcion,
  }));
}
