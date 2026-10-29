// tests/scrum1575d-staging-por-destino.test.mjs — SCRUM-1575d
//
// Los recorridos de `tests/banco-scrum911/` escriben en staging y comprobaban sólo el HOST
// (`host !== STAGING_HOST`). Desarrollo vive en el MISMO host (`acela`), así que una
// `DATABASE_URL_STAGING` que apuntara a la base de desarrollo pasaba: `paso3` y `paso4` escribían en
// ella sin más comprobación (`limpiar`, `paso1`, `restaurar`, `paso2` y `paso6` miraban además
// `current_database()`, pero DESPUÉS de conectar). Ahora todos pasan por `exigirStaging` de
// `_entorno.mjs`, que compara por DESTINO —host Y base— con `exigirDestinoCorrecto`, antes de abrir.
//
// Y el censo de 1575 (`scripts/_censo-conexiones-a-base.mjs`) no veía a quien escribe a través de un
// SERVICIO de `dist/modules/` (`cambiar-flag-fiscal.mjs` salía «escribe: —»). Ahora lo ve, con siembra.
//
// ⛔ NINGÚN CASO CONECTA CON UNA BASE NI LANZA UN SCRIPT: funciones puras y AST sobre texto.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exigirStaging } from './banco-scrum911/_entorno.mjs';
import { parseBDSegura, STAGING_HOST } from '../scripts/_db-guard.mjs';
import { DESTINOS_ESPERADOS } from '../scripts/_clave-vs-destino.mjs';
import { analizarConexion, censarConexiones, SIEMBRA_SERVICIO, veSusSiembras } from '../scripts/_censo-conexiones-a-base.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fabricar = (host, base) => `postgresql://inventado:inventado@${host}:1/${base}`;
// Los destinos salen del mapa de la casa, no de un literal: si staging o dev se mueven, el caso se mueve.
const STG = DESTINOS_ESPERADOS.DATABASE_URL_STAGING;
const DEV = DESTINOS_ESPERADOS.DATABASE_URL_DEV;

test('SCRUM-1575d · el rojo sembrado: la base de desarrollo en el host de staging se niega (y el criterio viejo la dejaba pasar)', () => {
  assert.equal(STG.host, DEV.host, '🔴 dev y staging ya no comparten host: este caso deja de medir su hueco; revísalo.');
  const devEnStaging = fabricar(DEV.host, DEV.base);
  // El criterio de antes, tal cual estaba en `_entorno.mjs`: con esta URL decía «es staging».
  assert.equal(parseBDSegura(devEnStaging).host === STAGING_HOST, true);
  assert.throws(() => exigirStaging(devEnStaging), /NO APUNTA A DONDE DICE SU NOMBRE/);
  assert.throws(() => exigirStaging(fabricar('127.0.0.1', STG.base)), /NO APUNTA A DONDE DICE SU NOMBRE/);
  assert.throws(() => exigirStaging(undefined), /NO SE PUDO RESOLVER/);
});

test('SCRUM-1575d · el positivo: staging de verdad pasa, y devuelve la MISMA url que comprobó', () => {
  const url = fabricar(STG.host, STG.base);
  const r = exigirStaging(url);
  assert.deepEqual(r, { url, host: STG.host, base: STG.base });
});

test('SCRUM-1575d · árbol real · los recorridos del banco 911 comprueban staging ANTES de abrir, y ninguno por host a mano', () => {
  const dir = path.join(RAIZ, 'tests/banco-scrum911');
  const { filas } = censarConexiones(RAIZ);
  const delBanco = filas.filter((f) => f.rel.startsWith('tests/banco-scrum911/'));
  assert.ok(delBanco.length >= 9, `🔴 sólo ${delBanco.length} recorridos del banco 911 en el censo; el 23-oct eran 9.`);
  for (const f of delBanco) assert.equal(f.clase, 'protegido', `🔴 ${f.rel}: ${f.clase}`);
  // El orden, en los que abren con sus manos: la comprobación va antes que el primer cliente.
  const antesDe = { '_entorno.mjs': 'new PrismaClient', 'paso2-ciclo.mjs': "imp('dist/", 'paso3-botones.mjs': "imp('dist/",
    'paso4-api-y-ficha.mjs': "imp('dist/", 'paso6-iva-929.mjs': "imp('dist/" };
  for (const [f, cliente] of Object.entries(antesDe)) {
    const t = fs.readFileSync(path.join(dir, f), 'utf8');
    // En `_entorno.mjs` se mide dentro de `prismaStaging`: la primera aparición es la DECLARACIÓN de
    // `exigirStaging`, que va antes siempre (con ella, abrir antes de comprobar salía verde).
    const desde = f === '_entorno.mjs' ? t.indexOf('async function prismaStaging') : 0;
    const g = t.indexOf('exigirStaging(', desde);
    assert.ok(desde >= 0 && g >= 0 && g < t.indexOf(cliente, desde), `🔴 ${f}: exigirStaging no va antes de «${cliente}».`);
  }
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.mjs'))) {
    assert.doesNotMatch(fs.readFileSync(path.join(dir, f), 'utf8'), /\.host\s*!==\s*STAGING_HOST/,
      `🔴 ${f} vuelve a comprobar staging sólo por host.`);
  }
});

function arbolFabricado(ficheros) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1575d-'));
  for (const [rel, texto] of Object.entries(ficheros)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), texto);
  }
  return dir;
}

test('SCRUM-1575d · el censo ve la escritura a través de un servicio de dist/modules (siembra propia + árbol fabricado)', () => {
  const a = analizarConexion(SIEMBRA_SERVICIO.rel, SIEMBRA_SERVICIO.fuente);
  assert.deepEqual([a.abre, a.escribe.length > 0, a.guardas.length], [true, true, 0], `🔴 ${JSON.stringify(a)}`);
  assert.equal(veSusSiembras(), true, '🔴 el CLI saldría CIEGO: no ve alguna de sus tres siembras.');

  const llama = (fn, mod) => `process.env.DATABASE_URL = process.env.DATABASE_URL_STAGING;\n` +
    `const { ${fn} } = await import('../dist/modules/x/${mod}.js');\nawait ${fn}({ id: 1 });\n`;
  const dir = arbolFabricado({
    'src/modules/x/escribe.service.ts': "import { prisma } from '../../core/db/prisma';\nexport async function guardar() { await prisma.quote.update({}); }\n",
    'src/modules/x/puro.ts': 'export function calcular(x: number) { return x * 2; }\n',
    'scripts/por-servicio.mjs': llama('guardar', 'escribe.service'),
    'scripts/servicio-puro.mjs': llama('calcular', 'puro'),
    'scripts/sin-fuente.mjs': llama('otro', 'no-existe'),
    // Control de cero: el mismo servicio en un fichero que no nombra ninguna base no es una conexión.
    'scripts/unitario.mjs': "const { guardar } = await import('../dist/modules/x/escribe.service.js');\nawait guardar({ id: 1 });\n",
  });
  try {
    const { filas, poblacion } = censarConexiones(dir);
    const clase = Object.fromEntries(filas.map((f) => [f.rel, f.clase]));
    assert.deepEqual(clase, { 'scripts/por-servicio.mjs': 'sin_guard_escribe', 'scripts/sin-fuente.mjs': 'sin_guard_escribe' },
      `🔴 ${JSON.stringify(filas)}`);
    assert.deepEqual(poblacion.servicios, {
      usaBase: ['dist/modules/x/escribe.service.js'], noUsaBase: ['dist/modules/x/puro.js'], sinFuente: ['dist/modules/x/no-existe.js'],
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SCRUM-1575d · árbol real · cambiar-flag-fiscal sale como escritor por su servicio', () => {
  const { filas, poblacion } = censarConexiones(RAIZ);
  const fila = filas.find((f) => f.rel === 'scripts/cambiar-flag-fiscal.mjs');
  assert.ok(fila, '🔴 cambiar-flag-fiscal ya no sale en el censo.');
  assert.ok(fila.escribe.some((e) => e.startsWith('cambiarFlagFiscal()')), `🔴 escribe=${fila.escribe.join(',')}`);
  assert.ok(poblacion.servicios.usaBase.length > 0 && poblacion.servicios.noUsaBase.length > 0,
    `🔴 el censo no distingue servicios: ${JSON.stringify(poblacion.servicios).slice(0, 200)}`);
});
