// docs/master/evidencias/SCRUM-1510/fabricar-la-factura-del-segundo-porton.mjs — SCRUM-1510, punto ciego ②
//
// ¿PUEDE EXISTIR UNA FACTURA «PENDIENTE DE SELLADO» A LA QUE EL SEGUNDO PORTÓN DEJARÍA PASAR?
//
// `ensureInvoicePdf` tiene dos cortes seguidos: el primero pregunta por el ESTADO
// (`puedeProducirDocumento`), el segundo por la HUELLA (`exigirDocumentoEmitible`). Si toda factura
// pendiente fuera además una factura que el segundo niega, el primero sería redundante.
//
// Aquí no se razona si esa factura puede existir: se FABRICA. La fila la escribe el camino real
// compilado (`sellarTrasEmision` + `applyVeriFactu` de `dist/`), y después se le pide el PDF al
// `ensureInvoicePdf` compilado. Lo único doblado es la BASE, y lo único que se le hace a la base es
// que UNA escritura concreta falle: no se escribe a mano ningún campo de la fila.
//
//   node docs/master/evidencias/SCRUM-1510/fabricar-la-factura-del-segundo-porton.mjs
//   node docs/master/evidencias/SCRUM-1510/fabricar-la-factura-del-segundo-porton.mjs --dist <dir>
//
// `--dist` apunta a un ESPEJO del compilado (para ver qué pasa si el primer corte no está). Sin él,
// lee `dist/` del árbol. Sólo LEE `src/` y `prisma/schema.prisma`. No toca el camino de emisión.
// Los PDF que salgan van a un directorio temporal del sistema, nunca al árbol.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '../../../..');
const iDist = process.argv.indexOf('--dist');
const DIST = iDist > 0 ? path.resolve(process.argv[iDist + 1]) : path.join(RAIZ, 'dist');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

// `invoicesDir` se calcula al CARGAR `dist` desde el directorio del proceso: se cambia ANTES.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1510b-'));
process.chdir(TMP);
// Se borra PASE LO QUE PASE (también si un caso lanza): al salir el proceso, y volviendo antes al
// árbol, porque Windows no deja borrar el directorio en el que está el proceso.
process.on('exit', () => {
  try { process.chdir(RAIZ); fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* temporal del sistema */ }
});

const requiere = createRequire(path.join(DIST, 'x.js'));
const rutaDe = (r) => requiere.resolve(path.join(DIST, r));

const NIF = 'B12345678';
const ES = Object.freeze({ id: 77, country: 'ES', taxId: NIF, email: 'obra@example.test', name: 'Fontaneria', legalName: 'Fontaneria S.L.', address: null, logoUrl: null, whatsappPhone: null, timezone: null });

/**
 * La base doblada, CON ESTADO: lo que el camino real escribe es lo que se lee después. `falla` es
 * una lista de `{ clave, si, mensaje }`: la llamada `modelo.método` cuyo argumento cumple `si` lanza.
 */
function base({ numero, merchant, nace, falla = [] }) {
  const llamadas = [];
  const fila = {
    id: 4101, number: numero, total: '121.00', currency: 'EUR', type: 'F1', stageLabel: null,
    createdAt: new Date('2026-09-29T10:00:00Z'), merchantId: merchant.id, customerId: 9,
    lines: [{ concept: 'Obra', qty: 1, price: 100, tax: 0.21 }],
    pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR',
    vfEstado: nace, vfHash: null, vfPrevHash: null, vfTimestamp: null,
    vfAnulHash: null, vfAnulTimestamp: null, vfAnulPrevHash: null,
    merchantName: null, rectifies: null,
    merchant: { ...merchant },
    customer: { id: 9, name: 'Cliente', legalName: null, taxId: 'A11111111', email: null, phone: null, address: null },
  };
  const respuestas = {
    'invoice.findUnique': () => fila,
    'invoice.findFirst': () => null,
    'invoice.update': (a) => { Object.assign(fila, a?.data ?? {}); return fila; },
    'merchant.findUnique': () => ({ ...merchant }),
  };
  const modelo = (m) => new Proxy({}, {
    get: (_, metodo) => async (args) => {
      const clave = `${m}.${String(metodo)}`;
      llamadas.push({ clave, args });
      const f = falla.find((x) => x.clave === clave && x.si(args));
      if (f) throw new Error(f.mensaje);
      const r = respuestas[clave];
      if (r) return r(args);
      if (metodo === 'findMany') return [];
      if (metodo === 'count') return 0;
      return { id: llamadas.length, ...(args?.data ?? {}) };
    },
  });
  const cliente = new Proxy({}, {
    get: (_, k) => {
      if (k === '$transaction') return async (fn) => fn(cliente);
      if (k === '$executeRaw' || k === '$executeRawUnsafe') return async () => 1;
      if (k === '$queryRaw') return async () => [];
      if (k === 'then' || typeof k === 'symbol') return undefined;
      return modelo(String(k));
    },
  });
  return { cliente, llamadas, fila };
}

function cargar(doble) {
  const fPrisma = rutaDe('core/db/prisma.js');
  requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble.cliente } };
  for (const m of [
    'modules/system/audit.service.js',
    'modules/invoicing/domain/verifactu.service.js',
    'modules/invoicing/domain/encolarRemision.js',
    'modules/invoicing/domain/selladoEstado.js',
    'lib/invoicing.js',
  ]) { try { delete requiere.cache[rutaDe(m)]; } catch { /* aún no cargado */ } }
  return {
    estado: requiere(rutaDe('modules/invoicing/domain/selladoEstado.js')),
    porton: requiere(rutaDe('modules/invoicing/domain/portonDocumento.js')),
    lib: requiere(rutaDe('lib/invoicing.js')),
  };
}

const K = requiere(rutaDe('modules/invoicing/domain/selladoEstado.js'));
const tic = () => new Promise((r) => setImmediate(r));

// ── De dónde sale el estado con el que NACE la fila: del esquema, no de este guion ──────────────
const esquema = fs.readFileSync(path.join(RAIZ, 'prisma/schema.prisma'), 'utf8');
const defecto = /vfEstado\s+String\s+@default\("([^"]+)"\)/.exec(esquema)?.[1] ?? null;
const fuentes = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fuentes(p, out); else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
};
const src = fuentes(path.join(RAIZ, 'src'));
const sinComentarios = (t) => t.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
const cuenta = (re) => src.reduce((n, f) => n + (sinComentarios(fs.readFileSync(f, 'utf8')).match(re)?.length ?? 0), 0);
const usosDeEstadoAlNacer = cuenta(/\bestadoAlNacer\b/g);
const usosDeEntraEnLaCadena = cuenta(/\bentraEnLaCadena\b/g); // positivo: vecina del mismo módulo

console.log('POBLACION: 6 filas fabricadas por el camino real compilado · dist =', path.relative(RAIZ, DIST) || DIST);
console.log(`sha256 dist/lib/invoicing.js = ${sha(rutaDe('lib/invoicing.js'))}`);
console.log(`sha256 src/lib/invoicing.ts  = ${sha(path.join(RAIZ, 'src/lib/invoicing.ts'))}`);
console.log('');
console.log('── con qué estado NACE una factura ──');
console.log(`  @default de vfEstado en prisma/schema.prisma : ${defecto}  (constante SELLADO_PENDIENTE: ${K.SELLADO_PENDIENTE})`);
console.log(`  apariciones de \`estadoAlNacer\` en código de src/ (${src.length} ficheros .ts, sin comentarios): ${usosDeEstadoAlNacer}  ← 1 = sólo su declaración`);
console.log(`  control positivo, misma búsqueda, \`entraEnLaCadena\`: ${usosDeEntraEnLaCadena}`);
console.log('');

const ESCRIBE_ESTADO = (valor) => (a) => a?.data?.vfEstado === valor;

const CASOS = [
  { id: 'A', que: 'CONTROL · factura ES, sin fallo: se sella entera',
    numero: '2026-CF-0001', merchant: ES, falla: [] },
  { id: 'B', que: 'CONTROL · factura ES, el sellado revienta ANTES de la huella (caso normal del fallo)',
    numero: '2026-CF-0002', merchant: ES,
    falla: [{ clave: 'invoice.update', si: (a) => !!a?.data?.vfHash, mensaje: 'la base no responde (huella)' }] },
  { id: 'C', que: 'factura ES: la HUELLA se escribe y la escritura siguiente, la del estado, falla',
    numero: '2026-CF-0003', merchant: ES,
    falla: [{ clave: 'invoice.update', si: ESCRIBE_ESTADO(K.SELLADO_HECHO), mensaje: 'la base no responde (estado)' }] },
  { id: 'D', que: 'justificante J- de un comercio ES: la escritura de «no aplica» falla',
    numero: 'J-20260929-AB12', merchant: ES,
    falla: [{ clave: 'invoice.update', si: ESCRIBE_ESTADO(K.SELLADO_NO_APLICA), mensaje: 'la base no responde (no aplica)' }] },
  { id: 'E', que: 'factura de un comercio NO español: la escritura de «no aplica» falla',
    numero: '2026-CF-0005', merchant: { ...ES, country: 'PT', taxId: 'PT509999999' },
    falla: [{ clave: 'invoice.update', si: ESCRIBE_ESTADO(K.SELLADO_NO_APLICA), mensaje: 'la base no responde (no aplica)' }] },
  { id: 'F', que: 'justificante J-: el proceso muere entre el commit y el sellado (no se llama a la puerta)',
    numero: 'J-20260929-CD34', merchant: ES, falla: [], sinPuerta: true },
];

const filas = [];
for (const c of CASOS) {
  const d = base({ numero: c.numero, merchant: c.merchant, nace: defecto, falla: c.falla });
  const { estado, porton, lib } = cargar(d);

  // ① EL CAMINO REAL ESCRIBE LA FILA
  let puerta = '(no se llama)';
  if (!c.sinPuerta) {
    try {
      const r = await estado.sellarTrasEmision(
        { id: d.fila.id, number: d.fila.number, total: { toString: () => d.fila.total }, createdAt: d.fila.createdAt, merchantId: d.fila.merchantId, type: d.fila.type },
        c.merchant, d.cliente);
      puerta = `devuelve ${r.estado}${r.error ? ` (${r.error})` : ''}`;
    } catch (e) { puerta = `LANZA ${e.message}`; }
    await tic();
  }
  const trasPuerta = d.llamadas.length;

  // ② QUÉ DIRÍA CADA CORTE DE ESA FILA, preguntado a los dos predicados reales
  const primero = estado.puedeProducirDocumento(d.fila.vfEstado);
  const segundo = porton.puedeSalirDocumento({ number: d.fila.number, vfHash: d.fila.vfHash }, d.fila.merchant);

  // ③ Y SE LE PIDE EL PDF AL `ensureInvoicePdf` COMPILADO
  let pdf; let error = null;
  try { pdf = await lib.ensureInvoicePdf(d.fila.id, d.cliente); } catch (e) { error = e; }
  await tic();
  const escritasDespues = d.llamadas.slice(trasPuerta).filter((l) => /\.(update|create|upsert|delete)/.test(l.clave)).map((l) => l.clave);
  const enDisco = path.join(TMP, 'storage', 'invoices', `${d.fila.merchantId}-${d.fila.number}.pdf`);
  const bytes = fs.existsSync(enDisco) ? fs.statSync(enDisco).size : 0;
  const cabecera = bytes ? fs.readFileSync(enDisco).subarray(0, 5).toString('latin1') : '';

  filas.push({ c, puerta, fila: d.fila, primero, segundo, pdf, error, escritasDespues, bytes, cabecera, porton });
  console.log(`── ${c.id} · ${c.que}`);
  console.log(`   la puerta ${puerta}`);
  console.log(`   fila que queda:  vfEstado=${d.fila.vfEstado}  huella=${d.fila.vfHash ? `sí (${String(d.fila.vfHash).length} car.)` : 'no'}`);
  console.log(`   1er corte (estado) la dejaría pasar: ${primero ? 'SÍ' : 'no'}   ·   2º portón (huella) la dejaría pasar: ${segundo ? 'SÍ' : 'no'}`);
  console.log(`   ensureInvoicePdf: ${error ? `SE NIEGA con «${error.message}»` : `ENTREGA ${pdf.pdfUrl}`}`
    + `   · escrituras después: ${escritasDespues.length ? escritasDespues.join(', ') : 'ninguna'}   · PDF en disco: ${bytes} B ${cabecera ? `(empieza por ${JSON.stringify(cabecera)})` : ''}`);
  if (error) console.log(`   ¿la ruta pública lo reconoce como «sin sellar» (esErrorSinSellar)? ${porton.esErrorSinSellar(error) ? 'sí' : 'NO'}`);
  console.log('');
}

// ── RESUMEN: las que el primer corte para y el segundo dejaría pasar ────────────────────────────
const soloElPrimero = filas.filter((f) => !f.primero && f.segundo);
const losDos = filas.filter((f) => !f.primero && !f.segundo);
const ninguno = filas.filter((f) => f.primero && f.segundo);
console.log('── RESUMEN ──');
console.log(`  pendientes que el 2º portón dejaría pasar (sólo las para el 1er corte): ${soloElPrimero.length} de ${filas.length} → ${soloElPrimero.map((f) => f.c.id).join(', ') || '—'}`);
console.log(`  pendientes que niegan los dos cortes: ${losDos.length} → ${losDos.map((f) => f.c.id).join(', ') || '—'}`);
console.log(`  no pendientes, pasan los dos: ${ninguno.length} → ${ninguno.map((f) => f.c.id).join(', ') || '—'}`);
console.log(`  PDF que han salido: ${filas.filter((f) => f.bytes > 0).map((f) => `${f.c.id} (${f.bytes} B)`).join(', ') || 'ninguno'}`);

// ── CONTROLES: sin ellos, los números de arriba no dicen nada ───────────────────────────────────
const fallos = [];
const A = filas.find((f) => f.c.id === 'A');
const B = filas.find((f) => f.c.id === 'B');
if (defecto !== K.SELLADO_PENDIENTE) fallos.push(`el @default del esquema (${defecto}) no es SELLADO_PENDIENTE`);
if (usosDeEntraEnLaCadena < 2) fallos.push('CIEGO: la búsqueda por nombre no ve `entraEnLaCadena`, que tiene llamadores');
if (!(A.fila.vfEstado === K.SELLADO_HECHO && A.bytes > 0 && A.cabecera === '%PDF-')) fallos.push('POSITIVO: el banco no sabe producir un PDF de una factura bien sellada');
if (!(B.fila.vfEstado === K.SELLADO_PENDIENTE && !B.fila.vfHash && !B.segundo)) fallos.push('CONTROL: el fallo normal no deja la fila pendiente, sin huella y negada por el 2º portón');
if (filas.length !== CASOS.length) fallos.push('no corrieron todos los casos');
console.log('');
console.log(fallos.length ? `CONTROLES: ${fallos.length} FALLAN\n  · ${fallos.join('\n  · ')}` : 'CONTROLES: los 5 pasan (estado de nacimiento, búsqueda con positivo, PDF del caso sano, fallo normal, población)');

console.log(`EXIT=${fallos.length ? 1 : 0}`);
process.exit(fallos.length ? 1 : 0);
