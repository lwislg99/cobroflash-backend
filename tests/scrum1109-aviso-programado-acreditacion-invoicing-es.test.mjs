// tests/scrum1109-aviso-programado-acreditacion-invoicing-es.test.mjs
//
// Prueba `scripts/aviso-programado-acreditacion-invoicing-es.mjs` SIN base de datos ni SMTP
// reales: `prisma` y `transportador` llegan inyectados (mismo patrón que
// `tests/scrum1097-guard-acreditacion-invoicing-es.test.mjs`). Cubre las TRES cosas nuevas de
// SCRUM-1109 que el guard original no tenía: la configuración obligatoria de aviso, el aviso en
// sí (asunto/cuerpo), y la cuarta causa de ceguera (medición limpia, aviso NO entregado).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validarConfiguracion,
  validarHost,
  construirAviso,
  ejecutarPasada,
  CONSULTA_TEXTO,
} from '../scripts/aviso-programado-acreditacion-invoicing-es.mjs';
import { PROD_HOST, STAGING_HOST } from '../scripts/_db-guard.mjs';

const RUTA_GUARD_REAL = fileURLToPath(new URL('../scripts/guard-acreditacion-invoicing-es.mjs', import.meta.url));
const AHORA_FIJA = () => new Date('2026-09-23T06:00:00.000Z');

// ── validarConfiguracion ─────────────────────────────────────────────────────────────────────

test('SCRUM-1109 · validarConfiguracion: ok cuando están las tres variables', () => {
  const r = validarConfiguracion({
    DATABASE_URL_PROD_RO: 'x',
    SMTP_URL: 'x',
    AVISO_ACREDITACION_EMAIL_DESTINO: 'x',
  }, 'DATABASE_URL_PROD_RO');
  assert.deepEqual(r, { ok: true, faltan: [] });
});

test('SCRUM-1109 · validarConfiguracion: declara CADA variable ausente, una por una', () => {
  assert.deepEqual(validarConfiguracion({}, 'DATABASE_URL_PROD_RO').faltan.sort(), [
    'AVISO_ACREDITACION_EMAIL_DESTINO', 'DATABASE_URL_PROD_RO', 'SMTP_URL',
  ].sort());
  assert.deepEqual(validarConfiguracion({ DATABASE_URL_PROD_RO: 'x', SMTP_URL: 'x' }, 'DATABASE_URL_PROD_RO').faltan, [
    'AVISO_ACREDITACION_EMAIL_DESTINO',
  ]);
  assert.deepEqual(validarConfiguracion({ DATABASE_URL_STAGING: 'x', SMTP_URL: 'x', AVISO_ACREDITACION_EMAIL_DESTINO: 'x' }, 'DATABASE_URL_STAGING'), { ok: true, faltan: [] });
});

// ── validarHost ───────────────────────────────────────────────────────────────────────────────

test('SCRUM-1109 · validarHost: acepta el host de producción cuando se espera producción', () => {
  assert.deepEqual(validarHost(`postgresql://u:p@${PROD_HOST}:5432/railway`, PROD_HOST), { ok: true });
});

test('SCRUM-1109 · validarHost: EN ROJO — rechaza staging cuando se espera producción (no es "probablemente el que toca")', () => {
  const r = validarHost(`postgresql://u:p@${STAGING_HOST}:5432/railway`, PROD_HOST);
  assert.equal(r.ok, false);
  assert.match(r.motivo, new RegExp(STAGING_HOST));
});

test('SCRUM-1109 · validarHost: URL ilegible se declara así, nunca se intenta adivinar', () => {
  assert.equal(validarHost('no-es-una-url', PROD_HOST).ok, false);
});

// ── construirAviso ────────────────────────────────────────────────────────────────────────────

test('SCRUM-1109 · construirAviso: CIEGO nunca lleva la palabra "limpio" en el asunto', () => {
  const a = construirAviso({ resultado: { ciego: true, motivo: 'la consulta falló' }, host: 'h/b', ahora: AHORA_FIJA() });
  assert.equal(a.ciego, true);
  assert.equal(a.limpio, false);
  assert.doesNotMatch(a.asunto, /limpio/);
  assert.match(a.cuerpo, /fecha: 2026-09-23T06:00:00\.000Z/);
  assert.match(a.cuerpo, /host: h\/b/);
  assert.match(a.cuerpo, new RegExp(CONSULTA_TEXTO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(a.cuerpo, /motivo: la consulta falló/);
});

test('SCRUM-1109 · construirAviso: HALLAZGO lista los ids de los merchants acreditados', () => {
  const a = construirAviso({
    resultado: { ciego: false, floor: 3, filas: [{ id: 42 }, { id: 7 }] },
    host: 'h/b', ahora: AHORA_FIJA(),
  });
  assert.equal(a.limpio, false);
  assert.match(a.asunto, /HALLAZGO/);
  assert.match(a.cuerpo, /merchant id\(s\): 42, 7/);
  assert.match(a.cuerpo, /recuento: 2/);
});

test('SCRUM-1109 · construirAviso: limpio declara el suelo (control positivo) y no solo el cero', () => {
  const a = construirAviso({ resultado: { ciego: false, floor: 9, filas: [] }, host: 'h/b', ahora: AHORA_FIJA() });
  assert.equal(a.limpio, true);
  assert.match(a.asunto, /limpio — 0\/9/);
  assert.match(a.cuerpo, /suelo: 9 merchant/);
});

// ── ejecutarPasada — control positivo del auto-check AST heredado del guard original ───────────

test('SCRUM-1109 · ejecutarPasada: EN ROJO — un guard importado que no es solo-lectura aborta SIN conectar ni avisar', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1109-rojo-'));
  const rutaRoja = path.join(tmp, 'guard-falso.mjs');
  fs.writeFileSync(rutaRoja, "export async function x(prisma) { return prisma.merchant.update({ where: { id: 1 }, data: {} }); }\n");
  try {
    let conectado = false;
    const prisma = { merchant: { findMany: async () => { conectado = true; return []; } } };
    let enviado = false;
    const transportador = { sendMail: async () => { enviado = true; } };
    const r = await ejecutarPasada({ prisma, transportador, remitente: 'a@a', destinatario: 'b@b', rutaGuard: rutaRoja, host: 'h/b', ahora: AHORA_FIJA });
    assert.equal(r.exitCode, 2);
    assert.equal(conectado, false, 'no debe consultar la BD si el guard importado no pasa el auto-check');
    assert.equal(enviado, false, 'no debe avisar de una medición que no se hizo');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('SCRUM-1109 · ejecutarPasada: control positivo — el guard REAL sí pasa su propio auto-check', async () => {
  const prisma = { merchant: { findMany: async () => [] } };
  const transportador = { sendMail: async () => {} };
  const r = await ejecutarPasada({ prisma, transportador, remitente: 'a@a', destinatario: 'b@b', rutaGuard: RUTA_GUARD_REAL, host: 'h/b', ahora: AHORA_FIJA });
  // Con findMany devolviendo [], medirAcreditacion es CIEGO por "cero candidatos" — lo que prueba
  // que SÍ llegó a conectar (superó el auto-check), y no que quedó abortado antes de intentarlo.
  assert.equal(r.exitCode, 2);
  assert.match(r.rastro, /CIEGO/);
});

// ── ejecutarPasada — los cuatro desenlaces ──────────────────────────────────────────────────────

test('SCRUM-1109 · ejecutarPasada: medición CIEGA (la consulta falla) → exit 2, y SÍ intenta avisar', async () => {
  const prisma = { merchant: { findMany: async () => { throw new Error('conexión rota'); } } };
  let payload = null;
  const transportador = { sendMail: async (p) => { payload = p; } };
  const r = await ejecutarPasada({ prisma, transportador, remitente: 'a@a', destinatario: 'b@b', rutaGuard: RUTA_GUARD_REAL, host: 'h/b', ahora: AHORA_FIJA });
  assert.equal(r.exitCode, 2);
  assert.equal(r.avisoEnviado, true);
  assert.match(payload.subject, /CIEGO/);
});

test('SCRUM-1109 · ejecutarPasada: HALLAZGO (≥1 acreditado) → exit 1 SIEMPRE, aunque el aviso falle al enviarse', async () => {
  const prisma = { merchant: { findMany: async () => [{ id: 4575, flags: { INVOICING_ES_ENABLED: true }, Invoice: [] }] } };
  const transportador = { sendMail: async () => { throw new Error('SMTP caído'); } };
  const r = await ejecutarPasada({ prisma, transportador, remitente: 'a@a', destinatario: 'b@b', rutaGuard: RUTA_GUARD_REAL, host: 'h/b', ahora: AHORA_FIJA });
  assert.equal(r.exitCode, 1, 'un hallazgo real no se puede tapar porque el email también falló');
  assert.equal(r.avisoEnviado, false);
  assert.match(r.rastro, /NO ENTREGADO/);
});

test('SCRUM-1109 · ejecutarPasada: limpio (0 acreditados) CON aviso entregado → exit 0', async () => {
  const prisma = { merchant: { findMany: async () => [{ id: 2, flags: null, Invoice: [] }] } };
  const transportador = { sendMail: async () => {} };
  const r = await ejecutarPasada({ prisma, transportador, remitente: 'a@a', destinatario: 'b@b', rutaGuard: RUTA_GUARD_REAL, host: 'h/b', ahora: AHORA_FIJA });
  assert.equal(r.exitCode, 0);
  assert.equal(r.avisoEnviado, true);
});

test('SCRUM-1109 · ejecutarPasada: limpio (0 acreditados) SIN aviso entregado → exit 2, no exit 0', () => {
  const prisma = { merchant: { findMany: async () => [{ id: 2, flags: null, Invoice: [] }] } };
  const transportador = { sendMail: async () => { throw new Error('destinatario rechazado'); } };
  return ejecutarPasada({ prisma, transportador, remitente: 'a@a', destinatario: 'b@b', rutaGuard: RUTA_GUARD_REAL, host: 'h/b', ahora: AHORA_FIJA })
    .then((r) => {
      assert.equal(r.exitCode, 2, 'un 0 que no llegó a nadie no se puede llamar visto');
      assert.match(r.rastro, /se trata como CIEGO/);
    });
});
