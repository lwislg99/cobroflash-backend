// tests/scrum762-el-pdf-emitido-se-rehace.test.mjs — SCRUM-762 · el documento que el cliente
// descarga hoy no es necesariamente el que descargó ayer.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA VÍCTIMA, EN UNA LÍNEA
//
// Una factura EMITIDA y SELLADA no guarda su PDF: lo REHACE cada vez que el fichero de disco no
// está, con el generador que esté desplegado en ese momento. Y el fichero de disco no está
// después de cada despliegue, porque el `fs` de Railway es efímero — lo dice el propio
// `src/lib/invoicing.ts`. El número no cambia, la huella verifica, y el papel es otro.
//
// ── POR QUÉ ESTE FICHERO EXISTE, HABIENDO YA UNA MEDICIÓN ────────────────────────────────────
//
// `docs/master/SCRUM-762.md` (commit 988c40b3, ya en `main`) midió esto el 6-sep-2026 y lo midió
// bien. Pero lo midió A MANO: mutando el generador en el árbol y restaurándolo, contra la base de
// DESARROLLO, en dos procesos. Eso no corre en CI, así que **no vigila nada**: el día que alguien
// cambie la condición, nadie se entera. Un artefacto que no corre en `npm test` no existe.
//
// Y aquella medición dejó UN HUECO DECLARADO que aquí se cierra: el control positivo sobre la
// huella **no se pudo ejercer**, porque en desarrollo no había ninguna factura sellada (0 de 5).
// Con `prisma` inyectado, la factura de este fichero SÍ está sellada — y su huella se recomputa
// con `computeVeriFactuHash`, la misma función que la escribió.
//
// ── DOS CORRECCIONES AL ENUNCIADO, QUE SIGUEN VIGENTES ───────────────────────────────────────
//
// · `contentHash` NO EXISTE en `Invoice` (leído el modelo entero). En la factura la integridad
//   canónica es `vfHash`, la huella de la cadena VeriFactu. Un test que leyera `f.contentHash`
//   compararía `undefined` contra `undefined` y saldría verde para siempre.
// · `ensureQuotePdf` NO EXISTE. El presupuesto no tiene un «ensure»: tiene CUATRO bocas que
//   llaman al generador sin condición ninguna. Lo cuenta el trinquete del final.
//
// ── LO QUE ESTE FICHERO NO TOCA ──────────────────────────────────────────────────────────────
//
// Nada del camino de emisión. Sólo LEE (regla 38): importa `ensureInvoicePdf` tal cual está,
// le inyecta un `prisma` de mentira y lee el papel que sale. El «despliegue» se modela
// sustituyendo la EXPORTACIÓN del generador en el módulo ya cargado — el árbol no se toca, ni
// temporalmente. Ninguna dependencia nueva: `typescript` y `zlib` ya los usa la suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';

import { ensureInvoicePdf } from '../dist/lib/invoicing.js';
import { computeVeriFactuHash } from '../dist/modules/invoicing/domain/verifactu.service.js';
import { puedeProducirDocumento } from '../dist/modules/invoicing/domain/selladoEstado.js';
import { puedeSalirDocumento } from '../dist/modules/invoicing/domain/portonDocumento.js';
import { textoDePdf, contiene } from './_pdf-texto.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── EL «DESPLIEGUE» ──────────────────────────────────────────────────────────────────────────
//
// `dist/lib/invoicing.js` llama al generador como `pdf_1.generateInvoicePdf(...)`: una lectura de
// propiedad EN EL MOMENTO DE LA LLAMADA sobre el objeto de módulo. Reasignar esa exportación es
// exactamente lo que hace un despliegue — el mismo llamador, otro generador detrás — y es
// reversible, que es lo que no era mutar el fichero del árbol.
//
// (Se reasigna en `pdf.service.js`, el módulo de origen, y no en `lib/pdf.js`: ahí la propiedad
// es un getter definido sin `configurable`, así que redefinirla revienta. Medido, no supuesto.)
const require_ = createRequire(import.meta.url);
const SERVICIO = require_('../dist/modules/invoicing/infra/pdf/pdf.service.js');
const GENERADOR_DE_HOY = SERVICIO.generateInvoicePdf;

/**
 * El marcador que imprime «la versión siguiente» del generador. No puede ser subcadena de nada
 * del documento ni al revés (la lección de SCRUM-452): si lo fuera, `contiene` mediría una
 * coincidencia de texto en vez de qué versión pintó el papel.
 */
const MARCA_DESPLIEGUE = 'ZZDESPLIEGUE762';

/**
 * La «versión siguiente» del generador: el generador REAL, los MISMOS parámetros que salen de la
 * fila, y un cambio visible decidido por el generador. No es un juguete que escribe otro PDF —
 * es el motor de verdad imprimiendo algo más, que es la forma que tiene un cambio de generador
 * (SCRUM-593 añadió cabecera y pie a los documentos exactamente así).
 */
const generadorSiguienteVersion = (params) =>
  GENERADOR_DE_HOY({ ...params, watermark: MARCA_DESPLIEGUE });

// ── LA FACTURA: EMITIDA, SELLADA, Y CON LA HUELLA QUE DE VERDAD LE CORRESPONDE ────────────────

const MERCHANT_ID = 762900;
const FACTURA_ID = 76290001;
const NUMERO = '2026-S762-001';
const RUTA_PUBLICA = `/admin/invoices/${FACTURA_ID}/pdf`;
const DISCO = path.join(process.cwd(), 'storage', 'invoices', `${MERCHANT_ID}-${NUMERO}.pdf`);

const NIF = 'B12345678';
const SELLO_TS = '2026-09-01T10:00:00+02:00';
const IMPORTE_TOTAL = '121.00';

/** La huella se CALCULA con la función que la escribe, no se inventa una cadena de 64 hex. */
const VF_HASH = computeVeriFactuHash({
  nif: NIF,
  serie: NUMERO,
  fecha: '01-09-2026',
  tipoFactura: 'F1',
  cuotaTotal: '21.00',
  importeTotal: IMPORTE_TOTAL,
  prevHash: '',
  timestamp: SELLO_TS,
});

const MERCHANT = Object.freeze({
  id: MERCHANT_ID,
  name: 'Fontaneria Prueba',
  legalName: 'Fontaneria Prueba SL',
  taxId: NIF,
  country: 'ES',
  address: 'Calle Uno 1',
  logoUrl: null,
  whatsappPhone: null,
  // NO es el merchant demo (id 1 / demo@yaqu.app): si lo fuera, el documento saldría con
  // watermark de serie y el marcador del despliegue no distinguiría nada.
  email: 'no-demo-762@ejemplo.test',
});

function filaRecienEmitida() {
  return {
    id: FACTURA_ID,
    merchantId: MERCHANT_ID,
    customerId: 1,
    number: NUMERO,
    total: IMPORTE_TOTAL,
    currency: 'EUR',
    type: 'F1',
    stageLabel: null,
    // Ya apunta al endpoint canónico: lo ÚNICO que puede disparar la regeneración es el fichero.
    pdfUrl: RUTA_PUBLICA,
    qrData: 'https://ejemplo.test/qr',
    createdAt: new Date('2026-09-01T08:00:00Z'),
    lines: [{ concept: 'Reparacion de bajante', qty: 1, price: 100, tax: 21 }],
    vfEstado: 'sellado',
    vfHash: VF_HASH,
    vfPrevHash: '',
    vfTimestamp: new Date(SELLO_TS),
    merchant: { ...MERCHANT },
    customer: { id: 1, name: 'Cliente Prueba', legalName: null, email: null, phone: null },
    rectifies: null,
  };
}

/**
 * `prisma` de mentira. Existe por dos razones, y la segunda es la que importa: además de quitar
 * la BD de en medio, REGISTRA todo lo que se escribe. Sin ese registro, «no se ha tocado nada
 * canónico» sería una creencia; con él es una lista de claves.
 */
function prismaDeMentira(fila, escrituras) {
  return {
    invoice: {
      findUnique: async () => fila,
      update: async ({ data }) => {
        escrituras.push({ ...data });
        Object.assign(fila, data);
        return fila;
      },
    },
  };
}

/**
 * Lee el papel — y si NO HAY papel lo DICE, en vez de reventar con un `ENOENT` a medio medir.
 * No es cosmético: probando el rojo de este fichero (quitando el `existsSync` del compilado) la
 * primera versión moría con un `ENOENT` crudo, que es un rojo correcto contado de forma ilegible.
 */
const papel = (ruta) => (fs.existsSync(ruta)
  ? { existe: true, texto: textoDePdf(ruta), bytes: fs.readFileSync(ruta) }
  : { existe: false, texto: null, bytes: null });

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA MEDICIÓN — una sola pasada, con el orden que exige el encargo. Las afirmaciones van debajo.
// ═════════════════════════════════════════════════════════════════════════════════════════════

const M = await (async () => {
  const fila = filaRecienEmitida();
  const escrituras = [];
  const prisma = prismaDeMentira(fila, escrituras);
  let llamadasAlGenerador = 0;

  const espiando = (impl) => async (params) => {
    llamadasAlGenerador += 1;
    return impl(params);
  };

  const limpiar = () => fs.rmSync(DISCO, { force: true });

  SERVICIO.generateInvoicePdf = espiando(GENERADOR_DE_HOY);
  limpiar();

  // ① La factura se abre por primera vez: no hay fichero, se produce el documento de hoy.
  const abierta1 = await ensureInvoicePdf(FACTURA_ID, prisma);
  const tras1 = llamadasAlGenerador;
  const doc1 = papel(abierta1.diskPath);

  // ② Se abre OTRA VEZ sin que pase nada. Es el control del control: si aquí volviera a
  //    generar, lo de abajo no probaría que la causa es el fichero que falta.
  await ensureInvoicePdf(FACTURA_ID, prisma);
  const tras2SinDespliegue = llamadasAlGenerador;

  // ③ EL DESPLIEGUE, tal cual: el disco se vacía y el código que hay detrás es otro.
  limpiar();
  SERVICIO.generateInvoicePdf = espiando(generadorSiguienteVersion);

  const abierta3 = await ensureInvoicePdf(FACTURA_ID, prisma);
  const tras3 = llamadasAlGenerador;
  const doc3 = papel(abierta3.diskPath);

  // ④ SUELO DEL INSTRUMENTO: dos generaciones con el MISMO generador. Si esto diera distinto,
  //    la diferencia de ③ no probaría nada — mediría ruido.
  SERVICIO.generateInvoicePdf = GENERADOR_DE_HOY;
  limpiar();
  const mismoA = await ensureInvoicePdf(FACTURA_ID, prisma);
  const docMismoA = papel(mismoA.diskPath);
  limpiar();
  const mismoB = await ensureInvoicePdf(FACTURA_ID, prisma);
  const docMismoB = papel(mismoB.diskPath);

  limpiar();
  SERVICIO.generateInvoicePdf = GENERADOR_DE_HOY;

  return {
    fila,
    escrituras,
    tras1,
    tras2SinDespliegue,
    tras3,
    doc1,
    doc3,
    numero1: abierta1.number,
    numero3: abierta3.number,
    docMismoA,
    docMismoB,
    bytesIgualesMismoGenerador: docMismoA.bytes && docMismoB.bytes
      ? Buffer.compare(docMismoA.bytes, docMismoB.bytes) === 0
      : null,
  };
})();

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① SUELO — el escenario es una factura EMITIDA Y SELLADA de verdad, no una fila cualquiera
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-762 · SUELO: la factura del escenario está SELLADA y su huella verifica ANTES de nada', () => {
  assert.equal(puedeProducirDocumento('sellado'), true,
    'Si el estado no produjera documento, `ensureInvoicePdf` cortaría antes y este fichero no ' +
    'mediría la regeneración: mediría el portón.');
  assert.equal(puedeSalirDocumento({ number: NUMERO, vfHash: VF_HASH }, MERCHANT), true,
    'El portón de SCRUM-206 tiene que dejar salir el documento; si no, el rojo sería suyo.');

  // La huella se RECOMPUTA desde los ocho campos canónicos y tiene que dar la guardada. Esto es
  // lo que la medición del 6-sep NO PUDO ejercer: en desarrollo no había ninguna sellada.
  const recomputada = computeVeriFactuHash({
    nif: NIF, serie: NUMERO, fecha: '01-09-2026', tipoFactura: 'F1',
    cuotaTotal: '21.00', importeTotal: IMPORTE_TOTAL, prevHash: '', timestamp: SELLO_TS,
  });
  assert.equal(recomputada, VF_HASH);
  assert.match(VF_HASH, /^[0-9A-F]{64}$/, 'La huella es SHA-256 en 64 hex MAYÚSCULAS.');
});

test('SCRUM-762 · SUELO del instrumento: el MISMO generador dos veces imprime el MISMO texto', () => {
  // 🔴 Por qué no se comparan BYTES, y es la corrección que costó un rojo falso el 6-sep: el PDF
  // lleva fecha de creación embebida, así que dos generaciones idénticas dan ficheros distintos.
  // Un `sha` que cambia no prueba que el documento cambie; se compara el TEXTO extraído.
  assert.equal(M.docMismoA.existe && M.docMismoB.existe, true,
    '🔴 Falta alguno de los dos documentos: no se ha llegado a medir el instrumento.');
  assert.notEqual(M.docMismoA.texto, null, 'El lector de PDF se declaró CIEGO: no se ha medido nada.');
  assert.equal(M.docMismoA.texto, M.docMismoB.texto,
    '🔴 Dos generaciones con el MISMO generador dan textos distintos. El instrumento tiene ruido ' +
    'propio y el control de abajo estaría midiendo ese ruido, no el cambio de generador.');
  assert.equal(M.bytesIgualesMismoGenerador, false,
    'Registro, no exigencia de producto: los bytes SÍ cambian con el mismo generador. Es la ' +
    'razón por la que comparar bytes da un rojo que no significa nada.');
});

test('SCRUM-762 · CONTROL DEL CONTROL: con el fichero en disco NO se vuelve a generar', () => {
  assert.equal(M.tras1, 1, 'La primera apertura tiene que producir el documento.');
  assert.equal(M.tras2SinDespliegue, 1,
    '🔴 La segunda apertura, con el fichero presente, ha vuelto a generar. Entonces la causa de ' +
    'la regeneración no es el fichero que falta y el control de abajo acusa a quien no es.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② 🔴 EL CONTROL QUE DECIDE — misma fila, mismo número, dos documentos
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-762 · 🔴 tras un despliegue, la MISMA factura emitida sale con OTRO documento', () => {
  assert.equal(M.tras3, 2,
    '🔴 Sin el fichero en disco, `ensureInvoicePdf` ha vuelto a llamar al generador sobre una ' +
    'factura EMITIDA Y SELLADA. Ese es el defecto: el documento no está congelado, se rehace.');

  assert.equal(M.doc1.existe && M.doc3.existe, true,
    '🔴 Alguna de las dos aperturas no ha dejado documento en disco. Si es la de después del ' +
    'despliegue, el PDF ya no se rehace — y eso significa que la factura se ha quedado SIN ' +
    'documento, que es la salida que el encargo prohíbe explícitamente.');
  assert.notEqual(M.doc3.texto, null, 'El lector de PDF se declaró CIEGO: no se ha medido nada.');
  assert.notEqual(M.doc1.texto, M.doc3.texto,
    '🔴 El texto del documento no ha cambiado. Si esto sale verde, el modelo del defecto está mal.');

  assert.equal(contiene(M.doc1.texto, MARCA_DESPLIEGUE), false,
    'El documento de ANTES del despliegue no puede llevar el marcador; si lo lleva, el escenario ' +
    'está contaminado y la diferencia no viene de donde se cree.');
  assert.equal(contiene(M.doc3.texto, MARCA_DESPLIEGUE), true,
    '🔴 Lo que el cliente descarga DESPUÉS del despliegue lo ha pintado la versión nueva del ' +
    'generador — sobre una factura que se emitió antes de que esa versión existiera.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ③ ✅ CONTROL POSITIVO — lo que NO cambia: el contenido canónico
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-762 · ✅ el CONTENIDO canónico no se mueve: número, importe y huella siguen iguales', () => {
  assert.equal(M.numero1, M.numero3, 'Es la misma factura: el número no cambia.');
  assert.equal(M.numero3, NUMERO);
  assert.equal(M.fila.total, IMPORTE_TOTAL);
  assert.equal(M.fila.vfHash, VF_HASH,
    'La huella no se toca al rehacer el papel. Es justo lo que hace INVISIBLE al defecto.');

  // Y verifica DESPUÉS, no sólo antes: se recomputa desde la fila tal y como quedó.
  const trasTodo = computeVeriFactuHash({
    nif: M.fila.merchant.taxId, serie: M.fila.number, fecha: '01-09-2026',
    tipoFactura: M.fila.type, cuotaTotal: '21.00', importeTotal: M.fila.total.toString(),
    prevHash: M.fila.vfPrevHash, timestamp: SELLO_TS,
  });
  assert.equal(trasTodo, M.fila.vfHash,
    '✅ La verificación de la firma sigue dando LO MISMO. Queda separado lo que cambia (el ' +
    'ASPECTO) de lo que no (el CONTENIDO canónico): por eso nadie se entera.');
});

test('SCRUM-762 · ✅ rehacer el papel NO escribe ningún campo canónico en la fila', () => {
  const PERMITIDAS = new Set(['pdfUrl', 'qrData']);
  const escritas = [...new Set(M.escrituras.flatMap((d) => Object.keys(d)))].sort();
  const canonicas = escritas.filter((k) => !PERMITIDAS.has(k));
  assert.deepEqual(canonicas, [],
    `🔴 Al regenerar el PDF se han escrito campos fuera de {pdfUrl, qrData}: ${canonicas.join(', ')}. ` +
    'Eso ya no sería «sólo cambia el aspecto» — sería una factura emitida modificándose (regla 29).');
  assert.ok(M.escrituras.length >= 2, 'Se esperaba una escritura por cada generación.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ④ TRINQUETE — el censo por AST de quién rehace un documento al abrirlo
//
// Cuenta las bocas y cómo están guardadas. Va a ponerse ROJO en dos casos, y los dos quieren
// que alguien mire:
//   · aparece una boca nueva          → más superficie del mismo defecto;
//   · la boca de la factura deja de guardarse por `existsSync` → o es la SALIDA ① (congelar el
//     PDF al emitir) aterrizando, y entonces esto se re-mide y se re-escribe, o es alguien
//     quitando el `existsSync` a pelo, que deja facturas SIN PDF.
// ═════════════════════════════════════════════════════════════════════════════════════════════

const GENERADORES = new Set(['generateInvoicePdf', 'generateQuotePdf']);

const esFuncion = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n)
  || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);

const nombreLlamada = (n) => {
  const c = n.expression;
  return ts.isPropertyAccessExpression(c) ? c.name.text : ts.isIdentifier(c) ? c.text : null;
};

function ficherosTs(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosTs(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

function contieneLlamadaA(nodo, nombre) {
  let hay = false;
  const v = (n) => {
    if (hay) return;
    if (ts.isCallExpression(n) && nombreLlamada(n) === nombre) { hay = true; return; }
    ts.forEachChild(n, v);
  };
  ts.forEachChild(nodo, v);
  return hay;
}

/**
 * Toda llamada a un generador de documento bajo `<raiz>/src`, con la pregunta que importa:
 * ¿alguna de las funciones que la ENVUELVEN mira si el fichero ya existe?
 *
 * ⛔ Lo que no ve, dicho aquí y no en un rojo raro: el generador invocado por alias
 * (`const g = generateQuotePdf; g(...)`), y un `existsSync` que viviera en un ayudante llamado
 * desde fuera de la función. Falla CERRADO: eso saldría como «no guarda», que es la lectura
 * pesimista, y se corrige enseñándole el caso — nunca bajando el listón.
 */
function censoDeBocas(raiz) {
  const filas = [];
  for (const fichero of ficherosTs(path.join(raiz, 'src'))) {
    const sf = ts.createSourceFile(
      fichero, fs.readFileSync(fichero, 'utf8'), ts.ScriptTarget.Latest, true);
    const pila = [];
    const v = (n) => {
      if (esFuncion(n)) pila.push(n);
      if (ts.isCallExpression(n) && GENERADORES.has(nombreLlamada(n))) {
        filas.push({
          fichero: path.relative(raiz, fichero).split(path.sep).join('/'),
          linea: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1,
          generador: nombreLlamada(n),
          guardaExistencia: pila.some((fn) => contieneLlamadaA(fn, 'existsSync')),
        });
      }
      ts.forEachChild(n, v);
      if (esFuncion(n)) pila.pop();
    };
    ts.forEachChild(sf, v);
  }
  return filas.sort((a, b) => `${a.fichero}:${String(a.linea).padStart(6, '0')}`
    .localeCompare(`${b.fichero}:${String(b.linea).padStart(6, '0')}`));
}

const CENSO = censoDeBocas(RAIZ);

/**
 * LA IDENTIDAD DE UNA BOCA NO LLEVA EL NÚMERO DE LÍNEA DENTRO (SCRUM-710b), y esto no es estilo:
 * la primera versión de este fichero anclaba a `…invoicing.ts:101` y el trinquete de 710b la tumbó
 * en la tanda completa. Un número de línea es una POSICIÓN — doce líneas añadidas por encima la
 * caducan sin que cambie nada de lo que se vigila. Lo que distingue «una boca MÁS en ese fichero»
 * de «la misma, movida» es la CUENTA. La línea vive sólo en el mensaje del rojo.
 */
const clave = (f) => `${f.fichero} ${f.generador}${f.guardaExistencia ? ' [existsSync]' : ''}`;
const pinta = (f) => `${clave(f)}  (línea ${f.linea})`;

/** El censo colapsado a `identidad xN`, que es lo único que se compara. */
function porIdentidad(filas) {
  const m = new Map();
  for (const f of filas) m.set(clave(f), (m.get(clave(f)) ?? 0) + 1);
  return [...m].map(([k, n]) => `${k} x${n}`).sort();
}

test('SCRUM-762 · TRINQUETE: la factura emitida se rehace cuando falta el fichero — 1 boca', () => {
  const guardadas = CENSO.filter((f) => f.guardaExistencia);
  assert.deepEqual(porIdentidad(guardadas), ['src/lib/invoicing.ts generateInvoicePdf [existsSync] x1'],
    '🔴 El censo de bocas guardadas por `existsSync` ha cambiado.\n' +
    'Si es porque el PDF ya se CONGELA al emitir (salida ① firmada el 7-sep-2026), esto no se ' +
    'ajusta: se re-mide y se reescribe `docs/master/SCRUM-762.md`.\n' +
    `Censo actual:\n${CENSO.map(pinta).join('\n')}`);
});

test('SCRUM-762 · TRINQUETE: no existe `ensureQuotePdf` — el presupuesto se rehace SIEMPRE', () => {
  // La pregunta del encargo era «¿regenera `ensureQuotePdf` igual que el de factura?». La
  // respuesta medida es que ese nombre NO EXISTE en el árbol, y que lo que hay es peor: cuatro
  // bocas sin condición ninguna. Un presupuesto ya FIRMADO cambia de aspecto en CADA apertura,
  // no sólo tras un despliegue.
  const enElArbol = ficherosTs(path.join(RAIZ, 'src'))
    .filter((f) => fs.readFileSync(f, 'utf8').includes('ensureQuotePdf'));
  assert.deepEqual(enElArbol, [], '`ensureQuotePdf` ha aparecido: hay que re-medir el presupuesto.');

  const presupuesto = CENSO.filter((f) => f.generador === 'generateQuotePdf');
  assert.equal(presupuesto.length, 4, `Bocas de presupuesto:\n${presupuesto.map(pinta).join('\n')}`);
  assert.deepEqual(porIdentidad(presupuesto.filter((f) => f.guardaExistencia)), [],
    'Ninguna boca de presupuesto mira si el fichero ya existe. Si alguna empieza a mirarlo, el ' +
    'presupuesto habrá pasado a comportarse como la factura y esto hay que re-escribirlo.');

  assert.deepEqual(porIdentidad(CENSO), [
    'src/lib/invoicing.ts generateInvoicePdf [existsSync] x1',
    'src/lib/invoicing.ts generateInvoicePdf x1',
    'src/modules/quotes/app/routes/quotes.routes.ts generateQuotePdf x2',
    'src/modules/system/app/routes/invoicesAdmin.routes.ts generateInvoicePdf x1',
    'src/modules/system/app/routes/quoteDecisionLanding.routes.ts generateQuotePdf x1',
    'src/modules/system/app/routes/quotesAdmin.routes.ts generateQuotePdf x1',
  ], `El censo entero:\n${CENSO.map(pinta).join('\n')}`);
});

test('SCRUM-762 · SUELO del censo: sobre el fichero REAL con un cambio quirúrgico, el veredicto gira', () => {
  // Sin esto, los dos trinquetes de arriba podrían estar contando cero cosas y saliendo verdes.
  // Se copian los ficheros REALES a un árbol de usar y tirar y se les hace UN cambio: nada del
  // repositorio se toca, ni siquiera un instante.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum762-'));
  try {
    const copiaCon = (relativo, buscar, poner) => {
      const origen = path.join(RAIZ, relativo);
      const texto = fs.readFileSync(origen, 'utf8');
      assert.ok(texto.includes(buscar),
        `🔴 «${buscar}» ya no está en ${relativo}: este suelo estaría calibrado contra una ` +
        'grafía que no existe, y su verde no significaría nada.');
      const destino = path.join(tmp, relativo);
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.writeFileSync(destino, texto.replace(buscar, poner));
    };

    // A la factura se le quita el `existsSync` (que es, literalmente, lo que NO hay que hacer).
    copiaCon('src/lib/invoicing.ts', '!fs.existsSync(diskPath)', '!true');
    // Y al presupuesto se le pone uno.
    copiaCon(
      'src/modules/system/app/routes/quotesAdmin.routes.ts',
      "const { generateQuotePdf } = await import('../../../../lib/pdf');",
      "if (fs.existsSync('x')) { /* suelo */ }\n    const { generateQuotePdf } = await import('../../../../lib/pdf');",
    );

    const roto = censoDeBocas(tmp);
    const factura = roto.find((f) => f.fichero === 'src/lib/invoicing.ts' && f.generador === 'generateInvoicePdf');
    assert.ok(factura, 'El censo no ha encontrado la boca de la factura en el árbol de prueba.');
    assert.equal(factura.guardaExistencia, false,
      '🔴 Quitado el `existsSync`, el censo sigue diciendo que la boca está guardada: es CIEGO.');

    const quote = roto.find((f) => f.fichero.endsWith('quotesAdmin.routes.ts'));
    assert.ok(quote, 'El censo no ha encontrado la boca de presupuesto en el árbol de prueba.');
    assert.equal(quote.guardaExistencia, true,
      '🔴 Puesto un `existsSync`, el censo sigue diciendo que la boca no lo tiene: es CIEGO.');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
