// scripts/sobre-soap-prueba-aeat.mjs — SCRUM-1110.
//
// DEJA UN FICHERO LISTO PARA SUBIR A MANO al invocador de servicios web del entorno de
// PRUEBAS de la AEAT (`preportal.aeat.es` → VERI*FACTU → «Cliente de servicio web»).
//
// ─────────────────────────────────────────────────────────────────────────────────────
// PARA QUÉ EXISTE
//
// Hasta hoy, la única forma de saber si la AEAT ACEPTA nuestros registros era construir
// S1-D entero (cliente + cola + reintentos + backoff) y probar al final. El 24-sep-2026
// el fundador entró en el entorno de pruebas con su certificado, y esa pantalla permite
// preguntárselo por UN registro, a mano, antes de construir nada.
//
// 🔴 El XSD dice que la FORMA es correcta. NO dice que la AEAT lo acepte. Son dos
// preguntas distintas y la segunda no se la habíamos hecho nunca.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// 🔴 LA PRECONDICIÓN QUE DECIDE SI LA PRUEBA MIDE ALGO
//
// La AEAT autentica por mTLS con el certificado del navegador. Si el registro declara un
// ObligadoEmision DISTINTO del titular del certificado, rechaza por AUTORIZACIÓN — y ese
// rechazo NO dice nada sobre nuestro XML. Sería un rojo que no significa lo que parece.
//
// `gen-registros-sample.mjs` usa `B12345678`, un NIF inventado: sirve para validar contra
// el XSD, NO para enviar. Por eso este script existe aparte y EXIGE el NIF por parámetro.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// LO QUE NO HACE, a propósito
//
//   · NO firma nada. En modalidad VERI*FACTU la AEAT NO exige XAdES (S1-0b, SIF_SPEC_NOTES §1).
//   · NO envía. No toca la red, no lee certificados, no los pide. El envío lo hace una
//     persona desde su navegador.
//   · NO toca `src/`. Importa los builders ya construidos y auditados en S1-A (regla 38:
//     leer el camino de emisión no es STOP; modificarlo sí lo es, regla 40).
//   · UN SOLO registro. Cuanto menos haya en el sobre, más claro será de qué se queja.
//
// Uso:
//   npm run build
//   node scripts/sobre-soap-prueba-aeat.mjs --nif 05292751Z --nombre "Javier Pereira Fernández"

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Rutas tomadas de `gen-registros-sample.mjs`, que es la llamada que YA produce XML
// válido contra el XSD oficial. No se deducen: se copian de lo que funciona.
const { buildRegistroAlta, buildRegistroAnulacion, construirSobreRegFactu } =
  require(path.join(raiz, 'dist/modules/fiscal/verifactu/registro.builder.js'));
const { computeVeriFactuHash, computeVeriFactuHashAnulacion } =
  require(path.join(raiz, 'dist/modules/invoicing/domain/verifactu.service.js'));
const productor =
  require(path.join(raiz, 'dist/modules/fiscal/verifactu/productor.js'));

// ───────────────────────────────────────────────────────────────── argumentos

function arg(nombre) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const NIF = arg('nif');
const NOMBRE = arg('nombre');

// 🔴 EL DESTINATARIO TAMBIÉN TIENE QUE EXISTIR EN EL CENSO DE LA AEAT.
//
// Medido el 24-sep-2026 contra el entorno de pruebas REAL: con `12345678Z` (un NIF
// inventado) la AEAT proceso el registro y contesto `CodigoErrorRegistro 1239`:
//   «Error en el bloque Destinatario.. El NIF no esta identificado en el censo de la AEAT»
//
// Es un error de DATO, no de estructura — todo lo demas (huella, encadenamiento,
// SistemaInformatico, sobre SOAP) lo dio por bueno. Por defecto el destinatario es el
// PROPIO emisor, que por definicion esta en el censo: para una prueba de conformidad lo
// que importa es que el registro se acepte, no a quien se factura.
const DEST_NIF = arg('dest-nif') ?? NIF;
const DEST_NOMBRE = arg('dest-nombre') ?? NOMBRE;

// Falla CERRADO: sin NIF explícito no se genera nada. Un valor por defecto aquí sería la
// forma más fácil de acabar enviando el NIF inventado y no entender el rechazo.
if (!NIF || !NOMBRE) {
  console.error('Falta --nif o --nombre.\n');
  console.error('🔴 El NIF tiene que ser el del TITULAR DEL CERTIFICADO con el que se sube.');
  console.error('   Si no coincide, la AEAT rechaza por AUTORIZACION y la prueba no mide nada.\n');
  console.error('   node scripts/sobre-soap-prueba-aeat.mjs --nif 05292751Z --nombre "Nombre Apellidos"');
  process.exit(1);
}

// ─────────────────────────────────────────── el sistema informático (productor)

// Del fichero real (SCRUM-870), no inventado. Las tres últimas claves son las que el
// builder espera con ese nombre exacto, copiadas de la muestra que ya valida.
const sistema = {
  nombreRazonProductor: productor.VERIFACTU_PRODUCTOR_NOMBRE,
  nifProductor: productor.VERIFACTU_PRODUCTOR_NIF,
  nombreSistema: 'YaQu',
  idSistema: productor.VERIFACTU_ID_SISTEMA,
  version: productor.VERIFACTU_VERSION,
  numeroInstalacion: productor.VERIFACTU_NUM_INSTALACION,
  soloVerifactu: 'S',
  multiOT: 'S',
  indicadorMultiplesOT: 'S',
};

// ═══════════════════════════════════════════════════════════════════════════════════
// SCRUM-1140 · LOS TRES TIPOS, porque S1-D no se cierra sólo con altas
//
// El criterio de S1-D son ≥10 registros aceptados de ALTA, ANULACIÓN y R1. Este script
// consiguió el primer `Correcto` de la AEAT el 24-sep, pero sólo sabía hacer altas.
//
// 🔴 DOS CADENAS DISTINTAS, y confundirlas rompe la tanda:
//   · `tmp/ultimo-registro.json` → EL ÚLTIMO REGISTRO, sea del tipo que sea. Es el puntero
//     de ENCADENAMIENTO, y así debe ser: la cadena de huellas no distingue tipos.
//   · `tmp/ultima-alta.json` → LA ÚLTIMA ALTA. Es sobre lo que se anula o se rectifica.
//
// Si se reutilizara el puntero de la cadena para las dos cosas, una R1 lanzada después de
// una anulación acabaría RECTIFICANDO UNA ANULACIÓN — que no es una factura. Son dos
// preguntas distintas y tienen dos respuestas distintas.
// ═══════════════════════════════════════════════════════════════════════════════════

const TIPOS = ['alta', 'anulacion', 'r1'];
// Se usa el ayudante `arg()` que este fichero ya tiene, no un segundo lector de argv.
const TIPO = arg('tipo') || 'alta';
if (!TIPOS.includes(TIPO)) {
  console.error(`Tipo desconocido: «${TIPO}». Valores: ${TIPOS.join(' | ')} (por defecto: alta).`);
  process.exit(1);
}

const RUTA_ULTIMA_ALTA = path.join(raiz, 'tmp', 'ultima-alta.json');

/**
 * El alta sobre la que se opera al anular o rectificar.
 *
 * 🔴 FALLA CERRADO. Sin alta previa y sin --serie/--fecha, ABORTA en vez de inventarse una
 * serie: un sobre con una factura que no existe no lo rechaza la AEAT por lo que uno cree,
 * y el rechazo mandaría a buscar el defecto donde no está.
 */
function altaObjetivo() {
  const s = arg('serie');
  const f = arg('fecha');
  if (s && f) {
    return { numSerieFactura: s, fechaExpedicion: f, origen: 'argumentos' };
  }
  if (s || f) {
    console.error('🔴 --serie y --fecha van JUNTAS: una sola no identifica una factura.');
    process.exit(1);
  }
  if (!fs.existsSync(RUTA_ULTIMA_ALTA)) {
    console.error(`🔴 No hay ninguna ALTA registrada, así que no hay nada que ${TIPO === 'r1' ? 'rectificar' : 'anular'}.`);
    console.error('   Manda primero un alta (--tipo alta), o apunta a una con --serie y --fecha.');
    process.exit(1);
  }
  const a = JSON.parse(fs.readFileSync(RUTA_ULTIMA_ALTA, 'utf8'));
  return { numSerieFactura: a.numSerieFactura, fechaExpedicion: a.fechaExpedicion, origen: 'tmp/ultima-alta.json' };
}

// ────────────────────────────────────────────────────── el registro (UNO solo)

// Primer registro de la cadena → huella anterior VACÍA (conformidad verificada en S1-A).
// ═══════════════════════════════════════════════════════════════════════════════════
// SCRUM-1211b · --serie-propia / --fecha-propia: PARA MEDIR LA COLISIÓN, no por comodidad
//
// SCRUM-1211 DEDUJO —y lo declaró como deducción, no como medición— que la AEAT identifica
// un registro por Emisor + SerieYNúmero + FechaExpedición, y que por tanto DOS registros con
// la MISMA serie y número pero DISTINTA fecha se aceptarían los dos. De eso depende si la
// opción A de SCRUM-1203 tiene un agujero real o sólo teórico.
//
// 🔴 NOMBRES DISTINTOS A PROPÓSITO. `--serie` y `--fecha` ya existen y significan OTRA
// COSA: la factura SOBRE LA QUE se anula o se rectifica (`altaObjetivo`). Reutilizarlos aquí
// habría FUNCIONADO —`altaObjetivo` no se llama cuando el tipo es alta— y habría dejado una
// bandera que significa dos cosas según otra bandera. Eso se lee mal el día que falle.
//
// CONTROL POSITIVO, YA OBTENIDO, y no hay que gastar un envío en repetirlo: el 28-sep-2026
// se mandó dos veces PRUEBA-AEAT-970375 con la MISMA fecha y la AEAT contestó error 3000,
// «Registro de facturación duplicado». O sea que la AEAT SÍ detecta duplicados. Si ahora
// acepta dos con distinta fecha, no es que no mire: es que la FECHA forma parte de la
// identidad, y entonces el agujero de la opción A es real.
// ═══════════════════════════════════════════════════════════════════════════════════
const SERIE_FORZADA = arg('serie-propia');
const SERIE = SERIE_FORZADA || ('PRUEBA-AEAT-' + String(Date.now()).slice(-6));

// 🔴 LA HORA ES AHORA, NO UNA CONSTANTE. Medido contra la AEAT real el 24-sep-2026: con un
// sello escrito a mano (junio) contesto 'AceptadoConErrores' + codigo 2004:
//   «El valor del campo FechaHoraHusoGenRegistro debe ser la fecha actual del sistema de la
//    AEAT, admitiendose un margen de error de: 240 segundos.»
// Eso CIERRA el [VALIDAR] de SIF_SPEC_NOTES §4 sobre los 240 s: lo dice la fuente primaria.
const ahora = new Date();

// El desfase se saca de 'longOffset', que ya trae el horario de verano. Calcularlo a mano
// da +00:00 en septiembre (comprobado: la primera version de este script lo hizo), y eso son
// DOS HORAS en el futuro para la AEAT -> vuelta al error 2004.
const _p = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  timeZoneName: 'longOffset',
}).formatToParts(ahora);
const _g = (k) => _p.find((x) => x.type === k).value;
const _off = _g('timeZoneName').replace('GMT', '') || '+00:00';
const TS = `${_g('year')}-${_g('month')}-${_g('day')}T${_g('hour')}:${_g('minute')}:${_g('second')}${_off}`;
const FECHA_FORZADA = arg('fecha-propia');
if (FECHA_FORZADA && !/^\d{2}-\d{2}-\d{4}$/.test(FECHA_FORZADA)) {
  // FALLA CERRADO: una fecha con otro formato la rechazaría la AEAT por el FORMATO, y ese
  // rechazo llevaría a concluir que la colisión no existe cuando lo que falló fue la sonda.
  console.error(`🔴 --fecha-propia debe ser dd-mm-aaaa. Recibido: «${FECHA_FORZADA}».`);
  process.exit(1);
}
const FECHA = FECHA_FORZADA || `${_g('day')}-${_g('month')}-${_g('year')}`;

// 🔴 ENCADENAMIENTO. Medido contra la AEAT REAL el 24-sep-2026: al mandar un segundo
// registro con `primerRegistro: true` contestó código 2007 — «No debe informarse como
// primer registro, existen facturas emitidas con el obligado emisión y el sistema
// informático actual». NO era un defecto: era la cadena funcionando. Desde el segundo
// envío hay que apuntar al anterior, que es justo lo que VeriFactu exige.
const RUTA_ULTIMO = path.join(raiz, 'tmp', 'ultimo-registro.json');
const anterior = fs.existsSync(RUTA_ULTIMO)
  ? JSON.parse(fs.readFileSync(RUTA_ULTIMO, 'utf8'))
  : null;

// 🔴 SCRUM-1399 · UN PUNTERO DE ANULACIÓN DEL GUION VIEJO NO SE USA. FALLA CERRADO.
//
// Hasta SCRUM-1399 este script guardaba, tras una anulación, la serie y la fecha de la PASADA
// (ver abajo, donde se escribe el puntero). Ese fichero vive fuera de git y sobrevive al arreglo:
// encadenarse a él saca un sobre cuyo «registro anterior» nombra una serie que no es de ningún
// registro. Los punteros de alta y de R1 no llevan la marca y valen igual: su serie SÍ es la suya.
if (anterior && anterior.tipo === 'anulacion' && anterior.identifica !== 'factura-anulada') {
  console.error('🔴 SCRUM-1399 · El puntero de la cadena es de una ANULACIÓN generada con el guion viejo.');
  console.error(`   Nombra la serie «${anterior.numSerieFactura}» (${anterior.fechaExpedicion}), que es la de aquella pasada`);
  console.error('   y no la de la factura que se anuló: no identifica ningún registro. No se genera nada.');
  console.error('   Antes de seguir hay que saber qué factura anuló ese registro y qué fue lo último que');
  console.error('   aceptó la AEAT (docs/master/SCRUM-1399.md).');
  process.exit(1);
}

if (SERIE_FORZADA || FECHA_FORZADA) {
  console.log(`⚠️  SONDA DE COLISIÓN: serie=${SERIE} fecha=${FECHA} (forzadas a mano)`);
}
const objetivo = TIPO === 'alta' ? null : altaObjetivo();
const prevHash = anterior ? anterior.huella : '';

let huella;
let registro;

if (TIPO === 'anulacion') {
  // La huella de anulación tiene su PROPIA fórmula (campos ...Anulada). Usar la del alta
  // daría un SHA-256 válido de otra cosa: la AEAT lo rechazaría y el rechazo parecería un
  // problema de encadenamiento.
  huella = computeVeriFactuHashAnulacion({
    nif: NIF, serie: objetivo.numSerieFactura, fecha: objetivo.fechaExpedicion,
    prevHash, timestamp: TS,
  });
  registro = buildRegistroAnulacion({
    idEmisorFacturaAnulada: NIF,
    numSerieFacturaAnulada: objetivo.numSerieFactura,
    fechaExpedicionAnulada: objetivo.fechaExpedicion,
    encadenamiento: anterior ? { primerRegistro: false, anterior } : { primerRegistro: true },
    sistema,
    fechaHoraHusoGenRegistro: TS,
    huella,
  });
} else {
  // Alta y R1 comparten builder y fórmula de huella: una rectificativa ES un alta con otro
  // TipoFactura y las facturas rectificadas dentro. Lo que cambia es el CONTENIDO, no la forma.
  const tipoFactura = TIPO === 'r1' ? 'R1' : 'F1';
  huella = computeVeriFactuHash({
    nif: NIF, serie: SERIE, fecha: FECHA, tipoFactura,
    cuotaTotal: '21.00', importeTotal: '121.00', prevHash, timestamp: TS,
  });
  registro = buildRegistroAlta({
    idEmisorFactura: NIF,
    numSerieFactura: SERIE,
    fechaExpedicion: FECHA,
    nombreRazonEmisor: NOMBRE,
    tipoFactura,
    // 'I' = INCREMENTAL: la rectificativa lleva la DIFERENCIA, no el total corregido. Es el
    // modo que el repositorio ya declara en MODO_TIPO_RECTIFICATIVA, y mezclarlo con 'S'
    // (sustitutiva) daría importes válidos que dicen otra cosa.
    ...(TIPO === 'r1'
      ? { rectifica: { numSerieFactura: objetivo.numSerieFactura, fechaExpedicion: objetivo.fechaExpedicion }, tipoRectificativa: 'I' }
      : {}),
    descripcionOperacion: TIPO === 'r1'
      ? 'Rectificacion de prueba de conformidad VERI*FACTU'
      : 'Prueba de conformidad del envio VERI*FACTU',
    destinatario: { nombreRazon: DEST_NOMBRE, nif: DEST_NIF },
    desglose: [{
      claveRegimen: '01', calificacion: 'S1', tipoImpositivo: '21',
      baseImponible: '100.00', cuotaRepercutida: '21.00',
    }],
    cuotaTotal: '21.00',
    importeTotal: '121.00',
    encadenamiento: anterior ? { primerRegistro: false, anterior } : { primerRegistro: true },
    sistema,
    fechaHoraHusoGenRegistro: TS,
    huella,
  });
}

// 🔴 CADA registro va envuelto en `<sum:RegistroFactura>`. Sin ese envoltorio el XSD lo
// RECHAZA — medido, no supuesto: la primera versión de este script lo omitió y el validador
// oficial contestó «tiene un elemento secundario 'RegistroAlta' … no válido. Lista esperada:
// 'RegistroFactura'». Si esto se hubiera subido a la AEAT, el rechazo habría parecido un
// problema del registro, no del sobre. La forma se copia de `gen-registros-sample.mjs`, que
// es la que ya valida.
const cuerpo = construirSobreRegFactu({
  obligado: { nombreRazon: NOMBRE, nif: NIF },
  registrosFacturaXml: [`  <sum:RegistroFactura>\n  ${registro}\n  </sum:RegistroFactura>`],
  declaracionXml: false, // la declaración la pone el sobre SOAP, no el cuerpo
});

// ─────────────────────────────────────────────────────────────── el sobre SOAP

// ⚠️ SOAP 1.1 (`http://schemas.xmlsoap.org/soap/envelope/`). El WSDL oficial está citado en
// `docs/SIF_SPEC_NOTES.md` §Fuentes; si la AEAT respondiera con un fallo de VERSIÓN, ÉSE es
// el primer sitio donde mirar — no el contenido del registro.
const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header/>
  <soapenv:Body>
${cuerpo.split('\n').map((l) => (l ? '    ' + l : l)).join('\n')}
  </soapenv:Body>
</soapenv:Envelope>
`;

// ────────────────────────────────────────────────────────────────── controles

const controles = {
  nifEnObligado: soap.includes(`<sum1:NIF>${NIF}</sum1:NIF>`),
  nifEnEmisor: soap.includes(`<sum1:IDEmisorFactura>${NIF}</sum1:IDEmisorFactura>`),
  // 🔴 El NIF inventado del generador de muestras NO puede aparecer por ningún lado.
  sinNifDeMuestra: !soap.includes('B12345678'),
  // 🔴 Medido: la AEAT rechazo este NIF por censo (codigo 1239) el 24-sep-2026.
  sinDestinatarioInventado: !soap.includes('12345678Z'),
  // El productor es el real de SCRUM-870, no el marcador «PRODUCTOR DEMO SL».
  productorReal: soap.includes(productor.VERIFACTU_PRODUCTOR_NIF) && !soap.includes('PRODUCTOR DEMO'),
  unSoloRegistro: (soap.match(/<sum:RegistroFactura>/g) || []).length === 1,
  // El envoltorio que el XSD exige y que la primera version omitio.
  registroEnvuelto: soap.includes("<sum:RegistroFactura>") && soap.includes("</sum:RegistroFactura>"),
  // 🔴 SCRUM-1140 · EL SOBRE LLEVA EL TIPO QUE SE PIDIO, Y SOLO ESE.
  //
  // Antes este control era `sinAnulacion: !soap.includes(...)`, y era CORRECTO: el script
  // solo sabia hacer altas, asi que una anulacion ahi dentro solo podia ser un accidente.
  // Dejo de serlo al anadir --tipo. No se relaja (regla 41): se hace MAS preciso — antes
  // comprobaba que no hubiera UNA cosa, ahora comprueba que haya EXACTAMENTE la pedida.
  //
  // Importa porque el error silencioso aqui es pedir una anulacion y mandar un alta: la AEAT
  // la aceptaria tan contenta, y la tanda de S1-D contaria un tipo que nunca se envio.
  tipoPedidoEsElQueVa: TIPO === 'anulacion'
    ? soap.includes('RegistroAnulacion') && !soap.includes('RegistroAlta')
    : soap.includes('RegistroAlta') && !soap.includes('RegistroAnulacion'),
  // Y una R1 sin las facturas rectificadas dentro es un alta con otra etiqueta.
  r1LlevaLoRectificado: TIPO !== 'r1' || /FacturasRectificadas/.test(soap),
  // Sin firma: en modalidad VERI*FACTU no se exige, y meterla sería un error.
  sinFirma: !/Signature|XAdES|<ds:/.test(soap),
  sobreCerrado: soap.trimEnd().endsWith('</soapenv:Envelope>'),
  cuerpoDentro: soap.includes('<soapenv:Body>') && soap.includes('RegFactuSistemaFacturacion'),
};

const ok = Object.values(controles).every(Boolean);
if (!ok) {
  console.log(JSON.stringify({ veredicto: 'ABORTA', controles }, null, 2));
  process.exit(1);
}

const salida = path.join(raiz, 'tmp', 'sobre-soap-prueba-aeat.xml');
fs.mkdirSync(path.dirname(salida), { recursive: true });
fs.writeFileSync(salida, soap, 'utf8');

// El siguiente envío se encadena a éste. Se guarda DESPUÉS de que pasen los controles:
// si el sobre no sale, la cadena no avanza.
//
// 🔴 SCRUM-1399 · SE GUARDA LA IDENTIDAD DEL REGISTRO, QUE NO SIEMPRE ES LA SERIE DE LA PASADA.
//
// Lo que se guarda aquí es lo que el sobre SIGUIENTE escribe en su `RegistroAnterior`. Un alta
// y una R1 se identifican por su propia serie y su propia fecha. Una ANULACIÓN no tiene serie
// propia: se identifica por la factura que anula (`NumSerieFacturaAnulada` y su fecha). Antes se
// guardaban `SERIE` y `FECHA` para los tres tipos, y el sobre que seguía a una anulación nombraba
// como anterior una serie que no era de ningún registro. La huella no cambia: es la de la
// anulación, que es a lo que se encadena.
const identidad = TIPO === 'anulacion'
  ? { serie: objetivo.numSerieFactura, fecha: objetivo.fechaExpedicion, identifica: 'factura-anulada' }
  : { serie: SERIE, fecha: FECHA, identifica: 'registro' };
fs.writeFileSync(RUTA_ULTIMO, JSON.stringify({
  idEmisorFactura: NIF, numSerieFactura: identidad.serie, fechaExpedicion: identidad.fecha, huella, tipo: TIPO,
  identifica: identidad.identifica,
}, null, 2));

// 🔴 El puntero de ALTA sólo avanza con ALTAS. Una anulación o una R1 NO se convierten en
// «la última factura»: no son facturas nuevas, son operaciones SOBRE una.
if (TIPO === 'alta') {
  fs.writeFileSync(RUTA_ULTIMA_ALTA, JSON.stringify({
    idEmisorFactura: NIF, numSerieFactura: SERIE, fechaExpedicion: FECHA, huella,
  }, null, 2));
}

console.log(JSON.stringify({
  veredicto: 'GENERADO',
  fichero: salida,
  bytes: Buffer.byteLength(soap),
  obligado: NIF,
  endpointParaElFormulario: '/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP',
  controles,
  suelo: 'Bien formado y con los controles de arriba. NO probado contra la AEAT: este script no envia.',
}, null, 2));
