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
const { buildRegistroAlta, construirSobreRegFactu } =
  require(path.join(raiz, 'dist/modules/fiscal/verifactu/registro.builder.js'));
const { computeVeriFactuHash } =
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

// ────────────────────────────────────────────────────── el registro (UNO solo)

// Primer registro de la cadena → huella anterior VACÍA (conformidad verificada en S1-A).
const SERIE = 'PRUEBA-AEAT-' + String(Date.now()).slice(-6);

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
const FECHA = `${_g('day')}-${_g('month')}-${_g('year')}`;

// 🔴 ENCADENAMIENTO. Medido contra la AEAT REAL el 24-sep-2026: al mandar un segundo
// registro con `primerRegistro: true` contestó código 2007 — «No debe informarse como
// primer registro, existen facturas emitidas con el obligado emisión y el sistema
// informático actual». NO era un defecto: era la cadena funcionando. Desde el segundo
// envío hay que apuntar al anterior, que es justo lo que VeriFactu exige.
const RUTA_ULTIMO = path.join(raiz, 'tmp', 'ultimo-registro.json');
const anterior = fs.existsSync(RUTA_ULTIMO)
  ? JSON.parse(fs.readFileSync(RUTA_ULTIMO, 'utf8'))
  : null;

const huella = computeVeriFactuHash({
  nif: NIF, serie: SERIE, fecha: FECHA, tipoFactura: 'F1',
  cuotaTotal: '21.00', importeTotal: '121.00', prevHash: anterior ? anterior.huella : '', timestamp: TS,
});

const registro = buildRegistroAlta({
  idEmisorFactura: NIF,
  numSerieFactura: SERIE,
  fechaExpedicion: FECHA,
  nombreRazonEmisor: NOMBRE,
  tipoFactura: 'F1',
  descripcionOperacion: 'Prueba de conformidad del envio VERI*FACTU',
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
  sinAnulacion: !soap.includes('RegistroAnulacion'),
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
fs.writeFileSync(RUTA_ULTIMO, JSON.stringify({
  idEmisorFactura: NIF, numSerieFactura: SERIE, fechaExpedicion: FECHA, huella,
}, null, 2));

console.log(JSON.stringify({
  veredicto: 'GENERADO',
  fichero: salida,
  bytes: Buffer.byteLength(soap),
  obligado: NIF,
  endpointParaElFormulario: '/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP',
  controles,
  suelo: 'Bien formado y con los controles de arriba. NO probado contra la AEAT: este script no envia.',
}, null, 2));
