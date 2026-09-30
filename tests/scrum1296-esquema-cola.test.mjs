// tests/scrum1296-esquema-cola.test.mjs — SCRUM-1296 · tanda 1: la cola de remisión en el esquema.
//
// El modelo entra en `prisma/schema.prisma` con el ALTER YA aplicado en staging y producción
// (orden A5). Lo que este fichero fija es que el ESQUEMA y la COLA hablen de lo mismo:
//
//   · el enum `VfSubmissionStatus` tiene EXACTAMENTE los estados de `ESTADOS_VF_SUBMISSION`
//     (`sif.cola.ts`), en el mismo orden. SCRUM-1127b lo prometió («hay un test que los fija»)
//     y hasta hoy sólo había la mitad TS: con el enum en la base, una etiqueta de más o de menos
//     en un lado es una fila que la cola no sabe mover;
//   · las tablas y columnas se llaman como las creó el ALTER aplicado (SCRUM-1127 §④): un
//     `@map` distinto haría que el cliente pidiera una columna que la base no tiene;
//   · borrar un comercio o una factura con envíos está IMPEDIDO (`onDelete: Restrict`,
//     decisión 3 de 1127b: son registros presentados ante la AEAT).
//
// Y el control de lo que NO cambia: con la tabla dentro, el guard de afirmaciones fiscales
// sigue diciendo «envío NO construido» (SCRUM-1128: exige llamante Y `SIF_ENABLED` en ON).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { envioConstruido } from '../scripts/_guard-afirmacion-fiscal.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const cola = requiere(path.join(RAIZ, 'dist/modules/fiscal/verifactu/sif.cola.js'));
const ESQUEMA = fs.readFileSync(path.join(RAIZ, 'prisma/schema.prisma'), 'utf8');

/** El cuerpo de un bloque `model X { … }` o `enum X { … }` del esquema, o null si no está. */
function bloque(fuente, tipo, nombre) {
  const m = new RegExp(`^${tipo}\\s+${nombre}\\s*\\{([\\s\\S]*?)^\\}`, 'm').exec(fuente);
  return m ? m[1] : null;
}

/** Las etiquetas de un enum de Prisma, en orden: las líneas que son UN identificador y nada más. */
function etiquetas(cuerpo) {
  return cuerpo.split('\n').map((l) => l.trim()).filter((l) => /^[a-z_]+$/i.test(l));
}

/** `campo → columna` de un modelo: el `@map("…")` si lo lleva, el nombre del campo si no. */
function columnas(cuerpo) {
  const out = {};
  for (const linea of cuerpo.split('\n')) {
    const l = linea.trim();
    const m = /^([a-zA-Z]\w*)\s+([A-Z]\w*|String|Int|Boolean|DateTime)(\?|\[\])?\s*(.*)$/.exec(l);
    if (!m || l.startsWith('@@')) continue;
    if (/@relation/.test(m[4]) || m[3] === '[]') continue; // relaciones: sin columna
    const map = /@map\("([^"]+)"\)/.exec(m[4]);
    out[m[1]] = map ? map[1] : m[1];
  }
  return out;
}

test('SCRUM-1296 · SUELO: el esquema declara los tres bloques de la cola (o nada de abajo mide)', () => {
  for (const [tipo, nombre] of [['enum', 'VfSubmissionStatus'], ['model', 'VfSubmission'], ['model', 'VfFlujoObligado']]) {
    assert.ok(bloque(ESQUEMA, tipo, nombre), `🔴 CIEGO: no encuentro \`${tipo} ${nombre}\` en prisma/schema.prisma`);
  }
  // El lector de bloques no es ciego: sobre un modelo que no existe devuelve null.
  assert.equal(bloque(ESQUEMA, 'model', 'NoExisteEsteModelo'), null);
});

test('SCRUM-1296 · el enum del esquema = ESTADOS_VF_SUBMISSION de la cola, mismas etiquetas y mismo orden', () => {
  const enumEsquema = etiquetas(bloque(ESQUEMA, 'enum', 'VfSubmissionStatus'));
  assert.deepEqual(enumEsquema, [...cola.ESTADOS_VF_SUBMISSION],
    '🔴 el esquema y la cola no hablan de los mismos estados: una fila en un estado que la cola no conoce no se mueve nunca');
  // Control: el comparador SÍ ve una diferencia de orden (una igualdad por conjunto no la vería).
  assert.notDeepEqual([...enumEsquema].reverse(), [...cola.ESTADOS_VF_SUBMISSION]);
});

test('SCRUM-1296 · tablas y columnas con los nombres del ALTER aplicado (SCRUM-1127 §④)', () => {
  const sub = bloque(ESQUEMA, 'model', 'VfSubmission');
  const flujo = bloque(ESQUEMA, 'model', 'VfFlujoObligado');
  assert.match(sub, /@@map\("vf_submissions"\)/);
  assert.match(flujo, /@@map\("vf_flujo_obligado"\)/);
  assert.deepEqual(Object.values(columnas(sub)).sort(), [
    'attempts', 'created_at', 'csv', 'estado_registro', 'id', 'invoice_id', 'last_envio_id',
    'last_error', 'last_sent_at', 'merchant_id', 'next_attempt_at', 'obligado_nif',
    'registro_xml', 'status', 'subsanar', 'tipo_operacion', 'updated_at',
  ], '🔴 vf_submissions: las 17 columnas del ALTER aplicado');
  assert.deepEqual(Object.values(columnas(flujo)).sort(), [
    'obligado_nif', 'siguiente_envio_desde', 'tiempo_espera_envio_s', 'ultimo_envio_id', 'updated_at',
  ], '🔴 vf_flujo_obligado: las 5 columnas del ALTER aplicado');
  // Control: el lector de columnas descarta las relaciones (si no, `merchant` y `invoice` entrarían).
  assert.equal(columnas(sub).merchant, undefined);
});

test('SCRUM-1296 · borrar un comercio o una factura con envíos está IMPEDIDO (onDelete: Restrict)', () => {
  const sub = bloque(ESQUEMA, 'model', 'VfSubmission');
  const relaciones = sub.split('\n').filter((l) => /@relation\(/.test(l));
  assert.equal(relaciones.length, 2, `CIEGO: esperaba 2 relaciones y veo ${relaciones.length}`);
  for (const r of relaciones) {
    assert.match(r, /onDelete:\s*Restrict/, `🔴 un borrado dejaría envíos presentados sin titular: ${r.trim()}`);
  }
});

test('SCRUM-1296 · con la tabla dentro, el guard sigue diciendo «envío NO construido» (SCRUM-1128)', () => {
  const h = envioConstruido(RAIZ);
  // Control positivo: el guard SÍ ve la tabla — no está ciego al esquema.
  assert.ok(h.señales.some((s) => s.tipo === 'cola'), '🔴 CIEGO: el guard no ve `model VfSubmission`');
  assert.equal(h.flag.leido, true, 'CIEGO: el guard no lee SIF_ENABLED');
  assert.equal(h.construido, false,
    '🔴 STOP regla 26: la tabla sola desbloquearía afirmaciones fiscales en la landing');
});

// ═══ «Eliminar datos de ejemplo» con la cola dentro (D3b del orquestador = F1) ═══════════════════
//
// `vfSubmission` está FUERA del barrido genérico (RESTRICT: un comercio con envíos no se borra),
// pero `barridoDemo` no consulta esa lista, así que el botón del demo la barre con un paso propio,
// acotado al demo. El guard de SCRUM-314 comprueba la FORMA del `where` sobre un espía que no
// filtra; aquí se comprueba el EFECTO, sobre una cola con filas de DOS comercios.
const { barridoDemo } = requiere(path.join(RAIZ, 'dist/modules/system/domain/barridoDemo.js'));
const DEMO = 1;
const OTRO = 77;

/** Una cola en memoria cuyo `deleteMany` APLICA el `where` de verdad (sólo `merchantId`). */
function colaConFilas() {
  let filas = [
    { id: 1, merchantId: DEMO }, { id: 2, merchantId: DEMO },
    { id: 3, merchantId: OTRO }, { id: 4, merchantId: OTRO },
  ];
  const vacio = { deleteMany: async () => ({ count: 0 }) };
  const p = new Proxy({}, { get: (_, k) => (typeof k === 'string' ? vacio : undefined) });
  const vfSubmission = {
    deleteMany: async ({ where } = {}) => {
      const antes = filas.length;
      filas = filas.filter((f) => !(where?.merchantId === undefined || f.merchantId === where.merchantId));
      return { count: antes - filas.length };
    },
  };
  return { prisma: new Proxy(p, { get: (t, k) => (k === 'vfSubmission' ? vfSubmission : t[k]) }), filas: () => filas };
}

test('SCRUM-1296 · el botón del demo borra la cola DEL DEMO, antes que sus facturas', async () => {
  const c = colaConFilas();
  const { modelos, porModelo } = await barridoDemo(c.prisma, DEMO);
  assert.ok(modelos.includes('vfSubmission'), '🔴 el barrido del demo no recorre la cola');
  assert.ok(modelos.indexOf('vfSubmission') < modelos.indexOf('invoice'),
    '🔴 la cola va DESPUÉS que las facturas: con RESTRICT, el borrado de `invoice` revienta');
  assert.equal(porModelo.vfSubmission, 2);
  assert.deepEqual(c.filas().filter((f) => f.merchantId === DEMO), []);
});

test('SCRUM-1296 · 🔴 CONTROL NEGATIVO: la cola de OTRO comercio NO se toca', async () => {
  const c = colaConFilas();
  await barridoDemo(c.prisma, DEMO);
  assert.deepEqual(c.filas().filter((f) => f.merchantId === OTRO).map((f) => f.id), [3, 4],
    '🔴 el botón del demo se ha llevado registros de la cola de otro comercio: son registros presentados ante la AEAT');
  // Control del propio doble: un `deleteMany` sin `where` SÍ se lo llevaría todo.
  const d = colaConFilas();
  await d.prisma.vfSubmission.deleteMany({});
  assert.equal(d.filas().length, 0, 'CIEGO: el doble no borraría nada ni sin filtro');
});
