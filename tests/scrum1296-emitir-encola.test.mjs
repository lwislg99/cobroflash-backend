// tests/scrum1296-emitir-encola.test.mjs — SCRUM-1296
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EMITIR UNA FACTURA NO DISPARA NADA HACIA LA AEAT
//
// El programa sabe construir el registro con su huella y su QR (`applyVeriFactu`) y sabe mandarlo
// (`sif.client.ts`, `sif.cola.ts`, SCRUM-1127/1228b). Pero entre las dos cosas no hay nada: sellar
// una factura no deja ningún registro pendiente de remitir. SCRUM-1127 lo dejó escrito («NO está
// cableado. Nada en `src/` llama al cliente»).
//
// Este fichero mide ese hueco por el camino REAL de la emisión: `sellarTrasEmision`, el único
// punto por el que una factura entra en la cadena (SCRUM-205).
//
// ── EL BANCO, Y QUÉ NO SE DOBLA ──────────────────────────────────────────────────────────────
// Se dobla la BASE: un cliente que APUNTA cada llamada `modelo.método` y contesta lo mínimo para
// que el sellado ocurra (líneas presentes, sin huella anterior, zona por defecto). El mismo doble
// sustituye a `dist/core/db/prisma.js`, para que ningún efecto lateral (la auditoría) busque una
// base de verdad.
// **No se dobla**: `sellarTrasEmision` ni `applyVeriFactu`. Son el camino real.
//
// ⛔ Ni una base, ni un byte de red, ni un certificado.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

const NIF = 'B12345678';

const FACTURA = Object.freeze({
  id: 4101, number: '2026-CF-0001', total: { toString: () => '121.00' },
  createdAt: new Date('2026-09-29T10:00:00Z'), merchantId: 77, type: 'F1',
});
const FACTURA_BASE = { ...FACTURA, total: '121.00', vfHash: null, vfPrevHash: null, vfTimestamp: null, vfAnulHash: null, vfAnulTimestamp: null, vfAnulPrevHash: null };

/**
 * Un cliente de Prisma que apunta TODO lo que se le pide. Cualquier modelo existe (también uno
 * que el esquema de hoy no tiene, como `vfSubmission`): así lo que se mide es si el código LO
 * PIDE, no si el cliente generado lo conoce.
 */
function dobleQueApunta({ lineas = [{ concept: 'Obra', qty: 1, price: 100, tax: 0.21 }], cliente: cli = { name: 'Cliente', taxId: 'A11111111' }, falla = {} } = {}) {
  const llamadas = [];
  // La fila de la factura, CON ESTADO: lo que el sellado escribe (`invoice.update`) es lo que la
  // cola lee después. La versión del rojo contestaba `findUnique` sólo con las líneas; la cola lee
  // la factura YA SELLADA (huella, sello, eslabón) porque encola el registro tal como se selló.
  const fila = { ...FACTURA_BASE, lines: lineas, customer: cli, rectifies: null };
  const respuestas = {
    'invoice.findUnique': () => fila,
    'invoice.findFirst': () => null, // primer registro de la cadena
    'invoice.update': (args) => { Object.assign(fila, args?.data ?? {}); return fila; },
    'merchant.findUnique': () => ({ id: FACTURA_BASE.merchantId, country: 'ES', taxId: NIF, name: 'Fontanería', legalName: 'Fontanería S.L.', timezone: null }),
  };
  const modelo = (m) => new Proxy({}, {
    get: (_, metodo) => async (args) => {
      const k = `${m}.${String(metodo)}`;
      llamadas.push({ clave: k, args });
      if (falla[k]) throw new Error(falla[k]);
      const r = respuestas[k];
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
      if (k === 'then') return undefined; // no es una promesa
      if (typeof k === 'symbol') return undefined;
      return modelo(String(k));
    },
  });
  return { cliente, llamadas, fila };
}

function cargar(doble) {
  const fPrisma = rutaDe('dist/core/db/prisma.js');
  requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble.cliente } };
  for (const m of [
    'dist/modules/system/audit.service.js',
    'dist/modules/invoicing/domain/verifactu.service.js',
    'dist/modules/invoicing/domain/encolarRemision.js',
    'dist/modules/invoicing/domain/selladoEstado.js',
  ]) { try { delete requiere.cache[rutaDe(m)]; } catch { /* aún no existe */ } }
  return requiere(rutaDe('dist/modules/invoicing/domain/selladoEstado.js'));
}


const MERCHANT_ES = Object.freeze({ country: 'ES', taxId: NIF });

const escriturasEnCola = (llamadas) =>
  llamadas.filter((l) => /^vfSubmission\.(create|createMany|upsert)$/.test(l.clave));

// ═══ ① SUELO — el sellado ocurre de verdad, o nada de lo de abajo mide algo ═════════════════════

test('SCRUM-1296 · SUELO: sellarTrasEmision SELLA por el camino real (huella escrita, estado `sellado`)', async () => {
  const d = dobleQueApunta();
  const { sellarTrasEmision } = cargar(d);
  const r = await sellarTrasEmision({ ...FACTURA }, MERCHANT_ES, d.cliente);
  assert.equal(r.estado, 'sellado', `🔴 CIEGO: el sellado no llegó a hacerse (${JSON.stringify(r)})`);
  const conHuella = d.llamadas.find((l) => l.clave === 'invoice.update' && l.args?.data?.vfHash);
  assert.ok(conHuella, '🔴 CIEGO: no se escribió ninguna huella; el banco no ejercita la emisión');
  assert.match(conHuella.args.data.vfHash, /^[0-9A-F]{64}$/);
});

// ═══ ② EL HUECO — sellar tiene que dejar el registro pendiente de remitir ═════════════════════════

test('SCRUM-1296 · 🔴 sellar una factura DEJA su registro de alta en la cola de remisión', async () => {
  const d = dobleQueApunta();
  const { sellarTrasEmision } = cargar(d);
  const r = await sellarTrasEmision({ ...FACTURA }, MERCHANT_ES, d.cliente);
  assert.equal(r.estado, 'sellado', '🔴 CIEGO: sin sellado no hay nada que encolar');

  const enCola = escriturasEnCola(d.llamadas);
  assert.equal(enCola.length, 1,
    `🔴 EMITIR NO ENCOLA NADA: ${enCola.length} escrituras en \`vfSubmission\` tras sellar.\n`
    + '  La factura tiene huella y QR, y ningún registro pendiente de remitir a la AEAT:\n'
    + '  el cliente de envío existe (SCRUM-1127) y nadie le pasa nada.\n'
    + `  Llamadas vistas: ${d.llamadas.map((l) => l.clave).join(', ')}`);

  const fila = enCola[0].args?.data ?? {};
  const huella = d.llamadas.find((l) => l.clave === 'invoice.update' && l.args?.data?.vfHash).args.data.vfHash;
  assert.equal(fila.invoiceId, FACTURA.id);
  assert.equal(fila.merchantId, FACTURA.merchantId, 'regla dura 2: la fila es de su comercio');
  assert.equal(fila.obligadoNif, NIF, 'el flujo de control de la AEAT es por NIF del obligado');
  assert.equal(fila.tipoOperacion, 'Alta');
  assert.ok(fila.status === undefined || fila.status === 'pending', `nace pendiente, no ${fila.status}`);
  // 🔴 El registro TAL COMO SE SELLÓ: reenviar «los mismos registros» obliga a guardarlos, nunca a
  // regenerarlos (SCRUM-1127 §④). Lleva la huella que se acaba de escribir en la factura.
  assert.equal(typeof fila.registroXml, 'string');
  assert.ok(fila.registroXml.includes(huella), '🔴 el registro encolado no lleva la huella sellada');
  assert.ok(fila.registroXml.includes(FACTURA.number));
});

// ═══ ③ CONTROLES — lo que NO debe encolarse ════════════════════════════════════════════════════

test('SCRUM-1296 · ✅ lo que no entra en la cadena (merchant no ES) no se encola', async () => {
  const d = dobleQueApunta();
  const { sellarTrasEmision } = cargar(d);
  const r = await sellarTrasEmision({ ...FACTURA }, { country: 'AR', taxId: '20-12345678-9' }, d.cliente);
  assert.equal(r.estado, 'no_aplica');
  assert.equal(escriturasEnCola(d.llamadas).length, 0);
});

test('SCRUM-1296 · ✅ un justificante (J-…) no se encola (regla 24/26: no es factura)', async () => {
  const d = dobleQueApunta();
  const { sellarTrasEmision } = cargar(d);
  const r = await sellarTrasEmision({ ...FACTURA, number: 'J-20260929-AB12' }, MERCHANT_ES, d.cliente);
  assert.equal(r.estado, 'no_aplica');
  assert.equal(escriturasEnCola(d.llamadas).length, 0);
});

test('SCRUM-1296 · ✅ si el sellado FALLA no se encola nada (no hay registro que remitir)', async () => {
  const d = dobleQueApunta({ lineas: [] });
  const { sellarTrasEmision } = cargar(d);
  const r = await sellarTrasEmision({ ...FACTURA }, MERCHANT_ES, d.cliente);
  assert.equal(r.estado, 'pendiente_de_sellado', '🔴 CIEGO: el sellado tenía que fallar (sin líneas)');
  assert.equal(escriturasEnCola(d.llamadas).length, 0);
});

// ═══ ④ CONDICIÓN ①: EL SELLADO NO DEPENDE DE LA COLA ═════════════════════════════════════════════
//
// Emitir no envía: deja una fila `pending` y el envío es del procesador (su test,
// `tests/scrum1296-procesador-cola.test.mjs`, prueba que un envío que revienta no toca la factura).
// Lo que puede fallar EN LA EMISIÓN es escribir en la cola, y eso no puede des-sellar nada.

const constancias = (llamadas) => llamadas
  .filter((l) => l.clave === 'auditLog.create' && l.args?.data?.action === 'encolado_fallido')
  .map((l) => l.args.data);
const tic = () => new Promise((r) => setImmediate(r)); // `recordAudit` escribe sin esperar

test('SCRUM-1296 · ① si ESCRIBIR en la cola revienta, la factura queda SELLADA igual y queda constancia', async () => {
  const d = dobleQueApunta({ falla: { 'vfSubmission.create': 'la cola no responde' } });
  const { sellarTrasEmision } = cargar(d);
  const r = await sellarTrasEmision({ ...FACTURA }, MERCHANT_ES, d.cliente);
  await tic();
  assert.equal(r.estado, 'sellado', '🔴 un fallo de la COLA ha des-sellado la factura');
  assert.match(d.fila.vfHash ?? '', /^[0-9A-F]{64}$/, 'la huella sigue escrita');
  assert.equal(d.fila.vfEstado, 'sellado');
  assert.ok(!d.llamadas.some((l) => l.args?.data?.action === 'sellado_fallido'),
    '🔴 un fallo de la cola se ha registrado como fallo de SELLADO');
  const c = constancias(d.llamadas);
  assert.equal(c.length, 1, '🔴 no queda constancia del encolado fallido (fallo mudo)');
  assert.equal(c[0].meta.motivo, 'error');
  assert.equal(c[0].meta.numero, FACTURA.number);
  assert.equal(c[0].meta.tipoOperacion, 'Alta');
  assert.match(c[0].meta.errorMensaje, /la cola no responde/);
});

test('SCRUM-1296 · una factura que la exportación EXCLUYE (cliente sin NIF) queda sellada, sin fila y con constancia «excluida»', async () => {
  const d = dobleQueApunta({ cliente: { name: 'Particular', taxId: null } });
  const { sellarTrasEmision } = cargar(d);
  const r = await sellarTrasEmision({ ...FACTURA }, MERCHANT_ES, d.cliente);
  await tic();
  assert.equal(r.estado, 'sellado');
  assert.equal(escriturasEnCola(d.llamadas).length, 0, 'sin registro declarable no hay nada que encolar');
  const c = constancias(d.llamadas);
  assert.equal(c.length, 1, '🔴 la exclusión no deja rastro');
  assert.equal(c[0].meta.motivo, 'excluida');
});

test('SCRUM-1296 · el merchant DEMO sella y NO encola, y no es un fallo (sin constancia)', async () => {
  const d = dobleQueApunta();
  const { sellarTrasEmision } = cargar(d);
  const r = await sellarTrasEmision({ ...FACTURA, merchantId: 1 }, MERCHANT_ES, d.cliente);
  await tic();
  assert.equal(r.estado, 'sellado');
  assert.equal(escriturasEnCola(d.llamadas).length, 0, '🔴 el demo ha encolado: sus facturas irían a la AEAT');
  assert.equal(constancias(d.llamadas).length, 0);
  // Control: el mismo caso con otro merchant SÍ encola (el `0` de arriba no es un banco mudo).
  const e = dobleQueApunta();
  await cargar(e).sellarTrasEmision({ ...FACTURA }, MERCHANT_ES, e.cliente);
  assert.equal(escriturasEnCola(e.llamadas).length, 1);
});
