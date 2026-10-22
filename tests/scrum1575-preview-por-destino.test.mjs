// tests/scrum1575-preview-por-destino.test.mjs — SCRUM-1575
//
// ¿EL PREVIEW DE MIGRACIONES MIRA ADÓNDE VA ANTES DE CONECTAR?
//
// Hasta el 22-oct-2026, `scripts/preview-migracion.mjs` no importaba `_clave-vs-destino.mjs`:
// conectaba con el `DATABASE_URL` del entorno, fuera adonde fuera, mientras `CLAUDE.md` decía que
// «desde SCRUM-418 el guard lo hace cumplir por DESTINO».
//
// ⚠️ Ningún caso de aquí conecta con ninguna base. Las URLs son INVENTADAS. Los casos de función
// son puros; el del proceso hijo usa sólo un loopback al puerto 1 y, con el arreglo, se niega antes
// de lanzar Prisma. La URL de producción NO se pasa nunca al hijo: si alguien quitara el guard, el
// hijo intentaría conectar con ella.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { destinoDelPreview, urlDelHijo, URL_QUE_NO_LLEVA_A_NADA } from '../scripts/preview-migracion.mjs';
import { HOST_PRODUCCION, DESTINOS_ESPERADOS } from '../scripts/_clave-vs-destino.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(RAIZ, 'scripts', 'preview-migracion.mjs');

// Hosts y bases derivados de la tabla, no copiados: si la tabla cambia, los casos la siguen.
const fabricar = (host, base) => `postgresql://inventado:inventado@${host}:1/${base}`;
const PROD = fabricar(HOST_PRODUCCION, 'railway');
const DEV = fabricar(DESTINOS_ESPERADOS.DATABASE_URL_DEV.host, DESTINOS_ESPERADOS.DATABASE_URL_DEV.base);
const STAGING = fabricar(DESTINOS_ESPERADOS.DATABASE_URL_STAGING.host, DESTINOS_ESPERADOS.DATABASE_URL_STAGING.base);
const NADIE = 'postgresql://inventado:inventado@127.0.0.1:1/scrum1575_no_declarada';

test('SCRUM-1575 · sin --desde: producción, un destino sin declarar y la falta de URL SE NIEGAN', () => {
  const casos = [
    { url: PROD, veredicto: 'produccion_en_arbol' },
    { url: NADIE, veredicto: 'destino_no_reconocido' },
    { url: undefined, veredicto: 'sin_url' },
  ];
  for (const c of casos) {
    const r = destinoDelPreview({ env: c.url ? { DATABASE_URL: c.url } : {} });
    assert.equal(r.ok, false, `${c.veredicto}: tenía que negarse`);
    assert.equal(r.veredicto, c.veredicto);
    assert.ok(r.motivo && r.motivo.includes('🔴'), `${c.veredicto}: se niega sin decir por qué`);
    assert.ok(!r.motivo.includes('inventado'), 'el motivo imprime la credencial (R7)');
  }
});

test('SCRUM-1575 · sin --desde: dev y staging SIGUEN', () => {
  for (const url of [DEV, STAGING]) {
    const r = destinoDelPreview({ env: { DATABASE_URL: url } });
    assert.equal(r.ok, true, `${url.split('@')[1]}: tenía que seguir`);
    assert.equal(r.veredicto, 'cuadra');
  }
});

test('SCRUM-1575 · con --desde no se pide URL: sigue sin ella, y con una de producción también (no conecta)', () => {
  for (const env of [{}, { DATABASE_URL: PROD }]) {
    const r = destinoDelPreview({ desde: 'viejo.prisma', env });
    assert.equal(r.ok, true);
    assert.equal(r.veredicto, 'offline');
  }
});

test('SCRUM-1575 · el guard mira la MISMA url que recibe el hijo', () => {
  assert.equal(urlDelHijo({ DATABASE_URL: DEV }), DEV);
  assert.equal(urlDelHijo({}), URL_QUE_NO_LLEVA_A_NADA);
});

// El script de verdad, como proceso: que la llamada esté montada en su arranque y no sólo exista
// la función. Sin el guard, este hijo lanzaría Prisma (o se plantaría por no encontrarlo) y su
// salida no traería la frase del guard.
function lanzar(env) {
  const limpio = { ...process.env };
  for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'DATABASE_URL']) delete limpio[k];
  return spawnSync(process.execPath, [SCRIPT], { cwd: RAIZ, encoding: 'utf8', env: { ...limpio, ...env }, timeout: 60_000 });
}

test('SCRUM-1575 · el script se niega ANTES de lanzar Prisma: destino sin declarar y sin URL', () => {
  const casos = [
    { env: { DATABASE_URL: NADIE }, frase: 'DESTINO NO RECONOCIDO' },
    { env: {}, frase: 'NO HAY DATABASE_URL' },
  ];
  for (const c of casos) {
    const r = lanzar(c.env);
    assert.equal(r.error, undefined, `el hijo no arrancó: ${r.error?.message}`);
    assert.equal(r.status, 1, `salida ${r.status}; stderr: ${r.stderr}`);
    assert.ok(r.stderr.includes(c.frase), `no se negó el guard; stderr: ${r.stderr.slice(0, 400)}`);
    assert.ok(!r.stdout.includes('control positivo'), 'llegó a lanzar Prisma antes de mirar el destino');
  }
});
