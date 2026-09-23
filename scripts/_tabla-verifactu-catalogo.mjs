// scripts/_tabla-verifactu-catalogo.mjs — SCRUM-524b · LOS 41 CÓDIGOS, CON SU VEREDICTO Y SUS ANCLAS.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// QUÉ ES ESTO
//
// La tabla de SCRUM-524 (`docs/master/SCRUM-524.md`) convertida en DATOS que el repo puede correr.
// Aquí se DECLARA qué comprueba el árbol; `scripts/tabla-verifactu.mjs` lo MIDE contra `src/` cada
// vez, y `tests/scrum524b-trinquete-de-la-tabla.test.mjs` impide que la cifra baje.
//
// ── LA POBLACIÓN ES LA DEL TICKET, CÓDIGO A CÓDIGO ─────────────────────────────────────────────
// 41 códigos del catálogo oficial de la AEAT que SCRUM-524 recoge en Jira. Ni uno más: 1118/1119,
// 1124, 4112 y los límites del XSD NO están en ese catálogo y por eso van aparte
// (`FUERA_DEL_CATALOGO`), vigilados igual pero sin contar en «N de 41». Mezclarlos es el error que
// cometió la tabla del 17-sep, y se cuenta en su anexo.
//
// ── CUÁNDO UN CÓDIGO CUENTA COMO «COMPROBADA» ──────────────────────────────────────────────────
// Cuando el árbol tiene, en una puerta viva (el arranque, la entrada del producto o el constructor
// del registro que usa producción), un punto IDENTIFICABLE que impide producir el valor
// prohibido: una función o constante que rechaza o excluye, una condición que decide si el campo
// se escribe, o el propio constructor escribiendo el único valor válido.
//
// Lo que se cumple SÓLO porque un campo no se escribe nunca NO cuenta: una ausencia no tiene
// ancla, y el día que alguien escriba el campo nada lo va a parar. Esos van a «no comprobada» con
// clase `por-ausencia`, y el instrumento vigila que sigan ausentes.
//
// Donde dudé, al lado malo. Un «parcial» cuenta como comprobada, pero lleva su HUECO escrito.
//
// ── LAS ANCLAS: POR IDENTIDAD, NUNCA POR LÍNEA ─────────────────────────────────────────────────
// Cada ancla nombra un fichero, un ámbito (la función o constante donde vive) y una FORMA del AST:
// una llamada, una condición, una declaración, un elemento XML con su valor. «Referenciar por
// posición caduca. Referenciar por identidad no.»
//
// Si un refactor que CONSERVA la comprobación rompe un ancla, se reescribe el ancla. Si la
// comprobación se ha ido, el trinquete tiene razón, y bajar el suelo para ponerlo en verde es
// relajar un guard (regla 41).
// ═════════════════════════════════════════════════════════════════════════════════════════════

export const FUENTE =
  'SCRUM-524 (Jira) · «Documento de validaciones y errores» de VERI*FACTU, AEAT, obtenido el 19-ago-2026';

/** Los 41 códigos del catálogo del ticket, en el orden en que los recoge. */
export const POBLACION = Object.freeze([
  '2000', '2002', '2003', '2004', '2005', '2006', '2007', '2008',
  '1150', '1189', '1190', '1116', '1117', '1114', '1115', '1108', '1112', '1133', '1152',
  '1138', '1139', '1157', '1195', '1196', '1207', '1237', '1238',
  '1287', '1130',
  '1176', '1177', '1179', '1220', '1221', '1223', '1212', '1213', '1226', '1241', '1242',
  '4141',
]);

export const CATEGORIAS = Object.freeze(['comprobada', 'no-comprobada', 'fuera-de-alcance']);

/** Por qué una no comprobada lo es. Todas cuentan del lado malo; la clase dice qué haría falta. */
export const CLASES_NO_COMPROBADA = Object.freeze({
  'sin-mecanismo': 'nada en el árbol lo impide',
  'por-ausencia': 'hoy se cumple sólo porque el campo no se escribe nunca',
  'no-decidible': 'no se puede decidir desde el repositorio',
  'requiere-aeat': 'sólo la AEAT puede comprobarlo, y no hay remisión',
});

/**
 * El canario de las ausencias: un elemento que el árbol SÍ escribe. Si el barrido no lo ve,
 * sus ceros no valen nada y el instrumento se declara CIEGO.
 */
export const CANARIO_AUSENCIA = 'FacturasRectificadas';

const F = {
  entrada: 'src/core/validation/fiscalInput.ts',
  esquemas: 'src/core/validation/schemas.ts',
  app: 'src/app.ts',
  exports: 'src/modules/exports/app/routes/exports.routes.ts',
  servicio: 'src/modules/invoicing/domain/verifactu.service.ts',
  builder: 'src/modules/fiscal/verifactu/registro.builder.ts',
  env: 'src/core/config/env.ts',
  arranque: 'src/index.ts',
};

// El constructor del registro que usa producción: `construirRegistro`, dentro de
// `buildVerifactuRegistrosXml`. Lo llaman `/verifactu.xml` y `datos.zip`.
const REG = { fichero: F.servicio, dentroDe: 'construirRegistro' };

const ES_RECTIFICATIVA = {
  tipo: 'declaracion', ...REG, nombre: 'esRectificativa', valor: "inv.type==='R1'&&!!inv.rectifies",
};

export const CATALOGO = Object.freeze([
  // ── 2xxx · ACEPTADOS CON ERRORES ─────────────────────────────────────────────────────────
  {
    codigo: '2000', que: 'el cálculo de la huella suministrada es incorrecto',
    categoria: 'no-comprobada', clase: 'sin-mecanismo',
    porque: 'la huella se calcula, pero ningún test la contrasta con el ejemplo oficial de la AEAT '
      + '(medido: hay hashes de 64 hex en tests/, ninguno junto a «oficial», «ejemplo» o «AEAT»)',
  },
  {
    codigo: '2002', que: 'longitud de la huella del registro anterior',
    categoria: 'no-comprobada', clase: 'no-decidible',
    porque: 'el ticket no trae el literal; la huella anterior es un SHA-256 por construcción, sin '
      + 'comprobación de longitud',
  },
  {
    codigo: '2003', que: 'contenido de la huella del registro anterior',
    categoria: 'no-comprobada', clase: 'no-decidible',
    porque: 'sin el literal. `verifactu_cadena_rota` exige que la huella anterior sea de una factura '
      + 'propia, pero no que sea la inmediatamente anterior: no lo cuento',
  },
  {
    codigo: '2004', que: '`FechaHoraHusoGenRegistro` debe ser la hora de la AEAT, con margen',
    categoria: 'no-comprobada', clase: 'requiere-aeat',
    porque: 'el sello sale de `new Date()` y nada lo contrasta con una referencia externa',
  },
  {
    codigo: '2005', que: '`ImporteTotal` recalculado por la AEAT a partir del desglose',
    categoria: 'no-comprobada', clase: 'sin-mecanismo',
    porque: '`ImporteTotal` sale de `inv.total` y el desglose de las líneas: dos fuentes, y nada '
      + 'comprueba que cuadren',
  },
  {
    codigo: '2006', que: '`CuotaTotal` recalculada por la AEAT a partir del desglose',
    categoria: 'no-comprobada', clase: 'sin-mecanismo',
    porque: '`CuotaTotal` y el desglose salen del mismo `calcVatBreakdown`, pero ninguna '
      + 'comprobación los ata; no está medido que el redondeo cuadre',
  },
  {
    codigo: '2007', que: 'no puede declararse primer registro si la AEAT ya tiene facturas del sistema',
    categoria: 'no-comprobada', clase: 'requiere-aeat',
    porque: 'se valida contra el histórico de la AEAT, no contra el nuestro',
  },
  {
    codigo: '2008', que: 'la huella del registro anterior debe ser distinta de la actual',
    categoria: 'no-comprobada', clase: 'sin-mecanismo',
    porque: 'lo da el SHA-256, no una comprobación',
  },

  // ── RESTRICCIONES DE NEGOCIO ─────────────────────────────────────────────────────────────
  {
    codigo: '1150', que: 'una F2 sin acuerdo ni art. 61.d no puede superar 3.000 €',
    categoria: 'no-comprobada', clase: 'sin-mecanismo',
    porque: 'hoy no se emite F2 (`MODO_SIN_DESTINATARIO` = SIN_DICTAMEN). Si el dictamen P11 elige '
      + '`SIMPLIFICADA_F2`, `resolverSinDestinatario` no mira el importe: saldría una F2 de más de 3.000 €',
  },
  {
    codigo: '1189', que: '`Destinatarios` obligatorio en F1, F3 y R1–R4',
    categoria: 'comprobada', capa: 'construcción',
    anclas: [
      { tipo: 'condicional', ...REG, condicion: '!destinatario.taxId', asignadaA: 'sinDestinatario',
        siVerdad: { llamada: 'resolverSinDestinatario' } },
      { tipo: 'lanza', fichero: F.builder, dentroDe: 'resolverSinDestinatario', cuando: "modo==='SIN_DICTAMEN'" },
    ],
  },
  {
    codigo: '1190', que: '`Destinatarios` prohibido en F2 y R5',
    categoria: 'comprobada', capa: 'construcción',
    anclas: [
      // La F2 sólo nace en la rama SIN NIF…
      { tipo: 'condicional', ...REG, condicion: '!destinatario.taxId', asignadaA: 'sinDestinatario' },
      { tipo: 'declaracion', ...REG, nombre: 'tipoFactura', valor: 'sinDestinatario?sinDestinatario.tipoFactura:tipoBase' },
      // …y `Destinatarios` sólo se escribe en la rama CON NIF. Mismo predicado, lados opuestos.
      { tipo: 'condicional', ...REG, condicion: 'destinatario.taxId', asignadaA: 'destinatarios',
        siVerdad: { contiene: '<sum1:Destinatarios>' } },
    ],
  },
  {
    codigo: '1116', que: '`FacturasSustituidas` sólo en una F3',
    categoria: 'no-comprobada', clase: 'por-ausencia', ausente: 'FacturasSustituidas',
    porque: 'el producto no modela la F3 ni escribe `FacturasSustituidas`',
  },
  {
    codigo: '1117', que: '`FacturasRectificadas` sólo en una rectificativa',
    categoria: 'comprobada', capa: 'construcción',
    anclas: [
      ES_RECTIFICATIVA,
      { tipo: 'condicional', ...REG, condicion: 'esRectificativa', asignadaA: 'rectificadas',
        siVerdad: { contiene: '<sum1:FacturasRectificadas>' } },
    ],
  },
  {
    codigo: '1114', que: '`TipoRectificativa` obligatorio en una rectificativa',
    categoria: 'comprobada', capa: 'construcción',
    anclas: [
      ES_RECTIFICATIVA,
      { tipo: 'condicional', ...REG, condicion: 'esRectificativa', asignadaA: 'rectificativa',
        siVerdad: { llamada: 'resolverTipoRectificativa' } },
      { tipo: 'lanza', fichero: F.builder, dentroDe: 'resolverTipoRectificativa', cuando: "modo==='SIN_CONFIRMAR'" },
    ],
    hueco: 'una factura con `type` R1 y SIN `rectifies` se declara R1 y sin `TipoRectificativa`: '
      + '`esRectificativa` exige las dos cosas y `tipoBase` sólo el tipo. La única ruta que crea R1 '
      + '(`invoicesAdmin.routes.ts`) le pone `rectifiesId`, pero la columna es opcional y el '
      + 'constructor no lo exige',
  },
  {
    codigo: '1115', que: '`TipoRectificativa` prohibido si la factura no es rectificativa',
    categoria: 'comprobada', capa: 'construcción',
    anclas: [
      ES_RECTIFICATIVA,
      { tipo: 'condicional', ...REG, condicion: 'esRectificativa', asignadaA: 'rectificativa',
        siFalso: "{tipoXml:'',importeXml:''}" },
    ],
  },
  {
    codigo: '1108', que: 'el NIF de `IDEmisorFactura` debe coincidir con el de `ObligadoEmision`',
    categoria: 'no-comprobada', clase: 'sin-mecanismo',
    porque: 'los dos salen de `merchant.taxId`, pero en dos expresiones sueltas: coinciden porque '
      + 'nadie ha cambiado una sin la otra, no porque algo lo imponga',
  },
  {
    codigo: '1112', que: 'fecha de expedición posterior a hoy',
    categoria: 'no-comprobada', clase: 'sin-mecanismo',
    porque: 'la fecha de expedición es `createdAt`, el instante del alta; nada impide una futura. '
      + '`invalidAnioFiscal` sólo mira el AÑO del export',
  },
  {
    codigo: '1133', que: 'fecha de expedición anterior a hoy menos 20 años',
    categoria: 'no-comprobada', clase: 'sin-mecanismo',
    porque: 'hoy lo implica `ANIO_MINIMO_FISCAL` (2024) hasta 2044, y sólo en `/verifactu.xml`: no '
      + 'es un mecanismo propio',
  },
  {
    codigo: '1152', que: 'fecha de expedición anterior al 28-oct-2024',
    categoria: 'comprobada', capa: 'entrada',
    anclas: [
      { tipo: 'constante', fichero: F.entrada, nombre: 'ANIO_MINIMO_FISCAL', valor: 2024 },
      { tipo: 'referencia', fichero: F.entrada, dentroDe: 'invalidAnioFiscal', identificador: 'ANIO_MINIMO_FISCAL' },
      { tipo: 'llamada', fichero: F.exports, llamada: 'invalidAnioFiscal' },
    ],
    hueco: 'compara el AÑO, no el día: una factura del 1-ene al 27-oct-2024 pasa. Y sólo guarda '
      + '`/verifactu.xml`: `datos.zip` llama a `buildVerifactuRegistrosXml` con los años que salen '
      + 'de las facturas, sin pasar por `invalidAnioFiscal`',
  },
  {
    codigo: '1138', que: '`Macrodato` = S si `ImporteTotal` ≥ 100.000.000 €',
    categoria: 'fuera-de-alcance', ausente: 'Macrodato',
    motivo: 'el producto cobra reparaciones de oficios. Fuera por NEGOCIO, no por mecanismo: la '
      + 'entrada no tiene tope de importe (`price` y `qty` sin `max`), así que un error de tecleo de '
      + 'ese tamaño llegaría al registro sin `Macrodato`',
  },
  {
    codigo: '1139', que: '`Macrodato` = S sólo por encima de ese importe',
    categoria: 'fuera-de-alcance', ausente: 'Macrodato',
    motivo: 'el reverso de 1138; `Macrodato` no se escribe nunca',
  },
  {
    codigo: '1157', que: '`Cupon` = S sólo en R1 o R5',
    categoria: 'no-comprobada', clase: 'por-ausencia', ausente: 'Cupon',
    porque: '`Cupon` no se escribe nunca',
  },
  {
    codigo: '1195', que: '`OperacionExenta` o `CalificacionOperacion`: al menos uno',
    categoria: 'comprobada', capa: 'construcción',
    anclas: [
      { tipo: 'elementoSiempre', fichero: F.builder, dentroDe: 'buildDetallesDesgloseXml', elemento: 'CalificacionOperacion' },
      { tipo: 'llamada', ...REG, llamada: 'buildDetallesDesgloseXml' },
    ],
  },
  {
    codigo: '1196', que: '`OperacionExenta` y `CalificacionOperacion` nunca los dos',
    categoria: 'no-comprobada', clase: 'por-ausencia', ausente: 'OperacionExenta',
    porque: '`OperacionExenta` no se escribe nunca. `clasificarDetalleDesglose` rechaza el 0 % para no '
      + 'declarar como S1 una posible exenta, pero eso no decide sobre el par',
  },
  {
    codigo: '1207', que: '`CuotaRepercutida` distinta de 0 sólo con `CalificacionOperacion` = S1',
    categoria: 'comprobada', capa: 'construcción',
    anclas: [
      { tipo: 'constante', fichero: F.builder, nombre: 'CALIFICACION_SUJETA_NO_EXENTA', valor: 'S1' },
      { tipo: 'propiedadLigada', fichero: F.builder, dentroDe: 'clasificarDetalleDesglose',
        si: 'cuotaRepercutida', entonces: { nombre: 'calificacion', valor: 'CALIFICACION_SUJETA_NO_EXENTA' } },
      { tipo: 'llamada', ...REG, llamada: 'clasificarDetalleDesglose' },
    ],
  },
  {
    codigo: '1237', que: 'operación no sujeta o exenta: sin tipo, cuota ni recargo',
    categoria: 'no-comprobada', clase: 'no-decidible',
    porque: 'hoy `clasificarDetalleDesglose` resuelve S1 (régimen general) y, desde SCRUM-1051, S2 '
      + '(inversión del sujeto pasivo) — ninguna de las dos es «no sujeta ni exenta». `OperacionExenta` '
      + 'sigue sin escribirse nunca, pero el ticket agrupa 1237 y 1238 y sin el literal de cada uno no '
      + 'sé qué mitad cubre cada código',
  },
  {
    codigo: '1238', que: 'operación no sujeta o exenta: sin tipo, cuota ni recargo',
    categoria: 'no-comprobada', clase: 'no-decidible',
    porque: 'el mismo caso que 1237',
  },

  // ── SANEAMIENTO DE TEXTO LIBRE ───────────────────────────────────────────────────────────
  {
    codigo: '1287', que: 'caracteres no válidos (< > " \' =) en el valor de un campo',
    categoria: 'no-comprobada', clase: 'sin-mecanismo',
    porque: '`concept` sólo tiene `min(1)`, y `DescripcionOperacion` recibe un escape XML, que no es '
      + 'un saneamiento. La lista de 1287 existe (`PROHIBIDOS_SERIE`), pero protege `NumSerieFactura`',
  },
  {
    codigo: '1130', que: '`NumSerieFactura` con caracteres no permitidos',
    categoria: 'comprobada', capa: 'entrada',
    anclas: [
      { tipo: 'constante', fichero: F.entrada, nombre: 'PROHIBIDOS_SERIE', contiene: ['"', "'", '<', '>', '='] },
      { tipo: 'referencia', fichero: F.entrada, dentroDe: 'invalidPrefijoSerie', identificador: 'PROHIBIDOS_SERIE' },
      { tipo: 'llamada', fichero: F.esquemas, llamada: 'invalidPrefijoSerie' },
      { tipo: 'llamada', fichero: F.app, llamada: 'invalidPrefijoSerie' },
    ],
  },

  // ── EL BLOQUE `SistemaInformatico` ───────────────────────────────────────────────────────
  // El 17-sep estos nueve fueron a «no decidible» porque «dependen de configuración que no vive en
  // el código». Es FALSO desde SCRUM-247 (2-ago-2026): el productor son constantes del repo
  // (`productor.ts`). Se deciden uno a uno.
  {
    codigo: '1176', que: 'NIF del bloque `SistemaInformatico` incorrecto',
    categoria: 'no-comprobada', clase: 'sin-mecanismo',
    porque: 'el NIF del productor es una constante del repo y un test exige que no esté vacía; nada '
      + 'valida su formato',
  },
  {
    codigo: '1177', que: '`IdSistemaInformatico` incorrecto',
    categoria: 'comprobada', capa: 'arranque',
    anclas: [
      { tipo: 'llamada', fichero: F.arranque, llamada: 'assertVerifactuIdSistema' },
      { tipo: 'llamada', fichero: F.env, dentroDe: 'assertVerifactuIdSistema', llamada: 'invalidVerifactuIdSistema',
        primerArgumento: 'VERIFACTU_ID_SISTEMA' },
      { tipo: 'lanza', fichero: F.env, dentroDe: 'assertVerifactuIdSistema', cuando: "config.NODE_ENV==='production'" },
      { tipo: 'expresion', fichero: F.env, dentroDe: 'invalidVerifactuIdSistema', texto: 'v.length!==2' },
    ],
  },
  {
    codigo: '1179', que: 'error en el bloque `SistemaInformatico`',
    categoria: 'no-comprobada', clase: 'no-decidible',
    porque: 'error genérico del bloque, sin una condición concreta que comprobar',
  },
  {
    codigo: '1220', que: '`NombreSistemaInformatico` incorrecto',
    categoria: 'no-comprobada', clase: 'no-decidible',
    porque: 'se escribe fijo (`YaQu`), pero el ticket no dice qué lo hace «incorrecto»',
  },
  {
    codigo: '1221', que: '`IDType` incorrecto',
    categoria: 'no-comprobada', clase: 'por-ausencia', ausente: 'IDOtro',
    porque: '`IDType` vive dentro de `IDOtro`, y `IDOtro` no se escribe nunca',
  },
  {
    codigo: '1223', que: '`NIF` o `IDOtro`: uno obligatorio, nunca los dos',
    categoria: 'comprobada', capa: 'construcción',
    anclas: [
      { tipo: 'lanza', fichero: F.servicio, dentroDe: 'buildVerifactuRegistrosXml', cuando: '!productor.nif',
        mensaje: 'verifactu_productor_no_configurado' },
    ],
    hueco: '«uno obligatorio» lo decide el `throw`; «nunca los dos» se cumple sólo porque `IDOtro` no '
      + 'se escribe en ningún sitio: ausencia, no comprobación',
  },
  {
    codigo: '1212', que: '`TipoUsoPosibleSoloVerifactu` sólo N o S',
    categoria: 'comprobada', capa: 'construcción',
    anclas: [{ tipo: 'elementoFijo', ...REG, elemento: 'TipoUsoPosibleSoloVerifactu', valor: 'S' }],
  },
  {
    codigo: '1213', que: '`TipoUsoPosibleMultiOT` sólo N o S',
    categoria: 'comprobada', capa: 'construcción',
    anclas: [{ tipo: 'elementoFijo', ...REG, elemento: 'TipoUsoPosibleMultiOT', valor: 'S' }],
  },
  {
    codigo: '1226', que: '`IndicadorMultiplesOT` sólo N o S',
    categoria: 'comprobada', capa: 'construcción',
    anclas: [{ tipo: 'elementoFijo', ...REG, elemento: 'IndicadorMultiplesOT', valor: 'S' }],
  },
  {
    codigo: '1241', que: 'error técnico al obtener el `SistemaInformatico`',
    categoria: 'no-comprobada', clase: 'requiere-aeat',
    porque: 'es un error del lado de la AEAT',
  },
  {
    codigo: '1242', que: 'no existe el sistema informático',
    categoria: 'no-comprobada', clase: 'requiere-aeat',
    porque: 'pregunta abierta de SCRUM-524 ④.1: ¿se refiere a la consulta o al alta?',
  },

  // ── ACCESO ───────────────────────────────────────────────────────────────────────────────
  {
    codigo: '4141', que: 'acceso a VERI*FACTU suspendido temporalmente',
    categoria: 'no-comprobada', clase: 'requiere-aeat',
    porque: 'no hay remisión (eslabones 8 y 9 de la auditoría del camino de emisión)',
  },
]);

/**
 * Comprobaciones que el árbol SÍ hace pero que NO son códigos del catálogo del ticket. La tabla
 * del 17-sep las contó dentro de sus «8 de 41»; aquí se vigilan igual, pero aparte.
 */
export const FUERA_DEL_CATALOGO = Object.freeze([
  {
    id: '1124', que: 'tipo de IVA español válido', capa: 'entrada',
    anclas: [
      { tipo: 'constante', fichero: F.entrada, nombre: 'TIPOS_IVA_ES_BP', exactamente: [0, 200, 400, 500, 750, 1000, 2100] },
      { tipo: 'referencia', fichero: F.entrada, dentroDe: 'invalidTipoIva', identificador: 'TIPOS_IVA_ES_BP' },
      { tipo: 'llamada', fichero: F.esquemas, llamada: 'invalidTipoIva' },
    ],
  },
  {
    id: 'tipos-declarables', que: 'sólo se declaran los tipos del catálogo (hoy F1 y R1)', capa: 'construcción',
    anclas: [
      { tipo: 'llamada', fichero: F.servicio, dentroDe: 'applyVeriFactu', llamada: 'exigirTipoDeclarable' },
      { tipo: 'llamada', ...REG, llamada: 'declarabilidadDe' },
    ],
  },
  {
    id: 'tipo-huella-01', que: '`TipoHuella` = 01 (SHA-256)', capa: 'construcción',
    anclas: [
      { tipo: 'elementoFijo', ...REG, elemento: 'TipoHuella', valor: '01' },
      { tipo: 'elementoFijo', fichero: F.builder, dentroDe: 'buildRegistroAlta', elemento: 'TipoHuella', valor: '01' },
      { tipo: 'elementoFijo', fichero: F.builder, dentroDe: 'buildRegistroAnulacion', elemento: 'TipoHuella', valor: '01' },
    ],
  },
  {
    id: '1118-1119', que: '`ImporteRectificacion`: prohibido con I, obligatorio con S', capa: 'construcción',
    anclas: [
      { tipo: 'propiedad', fichero: F.builder, dentroDe: 'resolverTipoRectificativa', nombre: 'importeXml', valor: "''" },
      { tipo: 'lanza', fichero: F.builder, dentroDe: 'resolverTipoRectificativa', cuando: '!importeRectificado' },
    ],
  },
  {
    id: 'tope-1000', que: 'máximo 1.000 registros por envío (XSD)', capa: 'construcción',
    anclas: [
      { tipo: 'constante', fichero: F.builder, nombre: 'MAX_REGISTROS_POR_ENVIO', valor: 1000 },
      { tipo: 'lanza', fichero: F.servicio, dentroDe: 'buildVerifactuRegistrosXml',
        cuando: 'invoices.length>MAX_REGISTROS_POR_ENVIO' },
    ],
  },
]);
