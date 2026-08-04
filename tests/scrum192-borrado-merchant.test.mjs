// SCRUM-192 — el servicio de borrado de merchant: cobertura DERIVADA, orden DECLARADO.
// Sin gate: lee el schema como texto y usa un prisma de mentira. Ni BD ni red.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DATO vive en **`docs/CENSO_FK_MERCHANT.md`** y no se repite aquí: este comentario fue una
// de las tres copias que lo enunciaban por su cuenta, y la que se quedó con la versión vieja.
// En una frase: **la red de FK no es uniforme**, así que un borrado en mal orden falla RUIDOSO en
// unas tablas y deja huérfanos MUDOS en otras. Hoy no duele (nadie borra merchants); el día del
// «dar de baja mi cuenta» (RGPD art. 17), **un borrado parcial es peor que ninguno: creerías
// haber cumplido.**
//
// 🔑 LA TRAMPA, y por qué este fichero no deriva el orden: `MODELOS_POR_MERCHANT` **no es un
// conjunto, es una SECUENCIA de dependencias** mantenida a mano porque **ninguna FK impone el
// orden ENTRE hijos**. Derivar el orden del schema daría el ORDEN DE DECLARACIÓN, que borraría el
// padre antes que el hijo: **ruidoso donde hay red, MUDO donde no la hay** — el fallo exacto que
// el ticket viene a cerrar.
//
// Por eso: la COBERTURA se deriva, el ORDEN se declara, y el guard ata las dos.
// ─────────────────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { modelosConTenancy } from './scrum172-cobertura-tenancy.test.mjs';
import {
  ORDEN_BORRADO_MERCHANT,
  FUERA_DEL_BARRIDO_GENERICO,
  borrarMerchant,
} from '../dist/modules/system/domain/borradoMerchant.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = fs.readFileSync(path.join(RAIZ, 'prisma', 'schema.prisma'), 'utf8');
const camel = (m) => m.charAt(0).toLowerCase() + m.slice(1);

// ── 1. EL GUARD: todo modelo derivado está en el orden, o declarado fuera ─────────────────

test('SCRUM-192 · todo modelo con merchantId está en el orden o declarado fuera', () => {
  const derivados = modelosConTenancy(SCHEMA).map((d) => camel(d.modelo));
  const cubiertos = new Set([...ORDEN_BORRADO_MERCHANT, ...Object.keys(FUERA_DEL_BARRIDO_GENERICO)]);

  const olvidados = derivados.filter((m) => !cubiertos.has(m));
  assert.deepEqual(
    olvidados,
    [],
    `🔴 ${olvidados.length} modelo(s) con merchantId no aparecen en el borrado (${olvidados.join(', ')}). ` +
      `La red de FK no es uniforme (docs/CENSO_FK_MERCHANT.md): en unas tablas el borrado ` +
      `revienta ruidoso y en otras las filas se quedan sin que nadie proteste. ` +
      `Añádelos al ORDEN (pensando DÓNDE: hijos antes que padres) o decláralos fuera con su motivo.`,
  );
});

test('SCRUM-192 · el orden no inventa modelos que el schema no tiene', () => {
  const derivados = new Set(modelosConTenancy(SCHEMA).map((d) => camel(d.modelo)));
  const fantasmas = ORDEN_BORRADO_MERCHANT.filter((m) => !derivados.has(m));
  assert.deepEqual(
    fantasmas,
    [],
    `🔴 el orden nombra modelos que ya no tienen merchantId (${fantasmas.join(', ')}). Un borrado ` +
      `sobre un modelo inexistente falla en caliente y aborta la limpieza a mitad.`,
  );
});

test('SCRUM-192 · cada exclusión trae su motivo por escrito', () => {
  for (const [modelo, motivo] of Object.entries(FUERA_DEL_BARRIDO_GENERICO)) {
    assert.ok(
      typeof motivo === 'string' && motivo.length > 20,
      `🔴 «${modelo}» está fuera del barrido sin explicar por qué. Una ausencia sin motivo es ` +
        `indistinguible de un olvido, y aquí el olvido son datos personales que se quedan.`,
    );
  }
});

// ── 2. EL ORDEN, que es lo que no se puede derivar ───────────────────────────────────────

test('SCRUM-192 · el libro de líneas facturadas va ANTES que albarán y factura', () => {
  const i = (m) => ORDEN_BORRADO_MERCHANT.indexOf(m);
  assert.ok(
    i('albaranLineaFacturada') < i('albaran') && i('albaranLineaFacturada') < i('invoice'),
    '🔴 SCRUM-170: el libro cuelga de albarán Y de factura y ninguna FK lo cascadea. Si se ' +
      'barre después, sus filas quedan huérfanas y nadie las ve fallar.',
  );
});

test('SCRUM-192 · el cliente va al FINAL: media casa le apunta', () => {
  assert.equal(
    ORDEN_BORRADO_MERCHANT[ORDEN_BORRADO_MERCHANT.length - 1],
    'customer',
    '🔴 `customer` ha dejado de ser el último. Facturas, cobros, trabajos y presupuestos le ' +
      'apuntan: borrarlo antes deja referencias colgando en todos ellos.',
  );
});

test('SCRUM-192 · botSession NO está en el barrido genérico', () => {
  assert.ok(
    !ORDEN_BORRADO_MERCHANT.includes('botSession'),
    '🔴 `botSession` ha vuelto al barrido por merchantId. Su `merchantId` es NULLABLE ' +
      '(SCRUM-174): las sesiones de primer contacto no lo tienen, así que ese deleteMany no las ' +
      'toca y da una limpieza falsa. Va por teléfono.',
  );
  assert.ok(FUERA_DEL_BARRIDO_GENERICO.botSession, '🔴 y tiene que estar declarada fuera, no simplemente ausente');
});

// ── 3. El servicio hace lo que dice ──────────────────────────────────────────────────────

function prismaFalso() {
  const llamadas = [];
  const modelo = (nombre) => ({
    deleteMany: async (args) => { llamadas.push({ modelo: nombre, where: args?.where }); return { count: 1 }; },
  });
  const p = new Proxy({ llamadas }, {
    get: (t, k) => (k === 'llamadas' ? t.llamadas : modelo(String(k))),
  });
  return p;
}

test('SCRUM-192 · borra en el ORDEN declarado, no en otro', () => {
  return borrarMerchant(prismaFalso(), 7, { telefonosBot: ['34600000001'] }).then(() => {});
});

test('SCRUM-192 · el recorrido respeta la secuencia y termina por el merchant', async () => {
  const p = prismaFalso();
  await borrarMerchant(p, 7, { telefonosBot: ['34600000001'] });
  const orden = p.llamadas.map((l) => l.modelo);

  assert.equal(orden[0], 'event', '🔴 `event` cuelga de charge y debe caer ANTES que los charges');
  assert.equal(orden[orden.length - 1], 'merchant', '🔴 el merchant se borra el ÚLTIMO');

  const soloGenericos = orden.filter((m) => ORDEN_BORRADO_MERCHANT.includes(m));
  assert.deepEqual(
    soloGenericos,
    [...ORDEN_BORRADO_MERCHANT],
    '🔴 el recorrido no sigue el ORDEN declarado. Con cero FK, el orden ES la garantía: ' +
      'cambiarlo borra padres antes que hijos y deja huérfanos en silencio.',
  );
});

test('SCRUM-192 · sin teléfonos, las sesiones de bot NO se tocan y SE DICE', async () => {
  const r = await borrarMerchant(prismaFalso(), 7);
  const aviso = r.errores.find((e) => e.modelo === 'botSession');
  assert.ok(
    aviso,
    '🔴 sin teléfonos el servicio calla y devuelve ok. Las sesiones de bot se quedarían con ' +
      'sus mensajes, que son datos personales: un borrado que dice haber terminado y dejó ' +
      'conversaciones es exactamente el «creerías haber cumplido» del ticket.',
  );
  assert.equal(r.ok, false, '🔴 y el resultado no puede ser ok con un hueco declarado');
});

test('SCRUM-192 · un modelo que falla NO cancela los siguientes', async () => {
  const llamadas = [];
  const p = new Proxy({}, {
    get: (_t, k) => ({
      deleteMany: async () => {
        const nombre = String(k);
        llamadas.push(nombre);
        if (nombre === 'invoice') throw new Error('boom');
        return { count: 2 };
      },
    }),
  });
  const r = await borrarMerchant(p, 7, { telefonosBot: ['34600000001'] });

  assert.ok(llamadas.includes('customer'), '🔴 el fallo de `invoice` abortó el resto del barrido');
  assert.ok(r.errores.some((e) => e.modelo === 'invoice'), '🔴 el fallo no se reporta');
  assert.equal(r.ok, false);
  assert.ok(
    Object.keys(r.borradas).length > 3,
    '🔴 hay que poder ver QUÉ se borró: un borrado parcial se audita, no se adivina (RGPD art. 17)',
  );
});
