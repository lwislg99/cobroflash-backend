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
const SERIE = 'PRUEBA-AEAT-001';
const FECHA = '24-06-2026';             // dd-mm-aaaa, el formato del registro
const TS = '2026-06-24T10:00:00+02:00'; // ISO con huso (S1-A)

const huella = computeVeriFactuHash({
  nif: NIF, serie: SERIE, fecha: FECHA, tipoFactura: 'F1',
  cuotaTotal: '21.00', importeTotal: '121.00', prevHash: '', timestamp: TS,
});

const registro = buildRegistroAlta({
  idEmisorFactura: NIF,
  numSerieFactura: SERIE,
  fechaExpedicion: FECHA,
  nombreRazonEmisor: NOMBRE,
  tipoFactura: 'F1',
  descripcionOperacion: 'Prueba de conformidad del envio VERI*FACTU',
  destinatario: { nombreRazon: 'Cliente de prueba', nif: '12345678Z' },
  desglose: [{
    claveRegimen: '01', calificacion: 'S1', tipoImpositivo: '21',
    baseImponible: '100.00', cuotaRepercutida: '21.00',
  }],
  cuotaTotal: '21.00',
  importeTotal: '121.00',
  encadenamiento: { primerRegistro: true },
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

console.log(JSON.stringify({
  veredicto: 'GENERADO',
  fichero: salida,
  bytes: Buffer.byteLength(soap),
  obligado: NIF,
  endpointParaElFormulario: '/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP',
  controles,
  suelo: 'Bien formado y con los controles de arriba. NO probado contra la AEAT: este script no envia.',
}, null, 2));
