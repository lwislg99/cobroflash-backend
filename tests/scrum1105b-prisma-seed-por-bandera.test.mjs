// SCRUM-1105b · El cuarto sembrador, `prisma/seed.ts` (`npm run db:seed`, que es `prisma db seed`), también
// elige su base por BANDERA. PR #1762 cubrió `seed-demo`, `seed-video` y `seed-staging`; éste se quedó
// pidiendo `DATABASE_URL=<la de dev> npm run db:seed`, que es justo copiar una credencial a mano.
//
// Se ejecuta el fichero REAL en un proceso hijo, pero SIN BASE POSIBLE, por dos vías a la vez:
//   · un `-r` que sustituye `@prisma/client` por un cliente de pega: la primera consulta imprime
//     `host/base` de la `DATABASE_URL` que ve el proceso y lanza (CONTROL: el marcador tiene que salir
//     en los casos que llegan a consultar, o el test cae);
//   · `PRISMA_QUERY_ENGINE_LIBRARY` apuntando a un fichero que no existe: si el cliente de pega no
//     llegara a cargarse, el motor de verdad tampoco.
// El `.env` es de pega, en un temporal FUERA del repo (no es un repo git: solo se mira ese fichero),
// con URLs `u:p` derivadas del mapa declarado, como en `scrum1105-semilla-destino-por-bandera`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { temporal } from './_temporal.mjs';
import { DESTINOS_ESPERADOS } from '../scripts/_clave-vs-destino.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED = path.join(RAIZ, 'prisma', 'seed.ts');
// El BINARIO de ts-node, que es lo que acaba lanzando `prisma db seed`. Con `node -r ts-node/register` el hijo
// salió mudo y con código 0 (medido): un verde que no habría ejecutado nada.
const TS_NODE = path.join(path.dirname(createRequire(path.join(RAIZ, 'package.json')).resolve('ts-node/package.json')), 'dist', 'bin.js');

const url = (host, base) => `postgresql://u:p@${host}:5432/${base}`;
const { DATABASE_URL_DEV: D, DATABASE_URL_STAGING: S, DATABASE_URL: P } = DESTINOS_ESPERADOS;
const DEV = url(D.host, D.base);
const STAGING = url(S.host, S.base);
const PROD = url(P.host, 'railway');

const MARCA = 'STUB-CONSULTA';
const STUB = `
const Module = require('module');
const cargar = Module._load;
function consulta() {
  let destino = 'sin-url';
  try { const u = new URL(process.env.DATABASE_URL); destino = u.hostname + u.pathname; } catch {}
  console.log('${MARCA} ' + destino);
  throw new Error('cliente de pega: aquí no hay base');
}
const modelo = new Proxy({}, { get: () => consulta });
class PrismaClient {
  constructor() {
    return new Proxy(this, { get: (_, k) => (k === '$disconnect' ? async () => {} : k === 'then' ? undefined : modelo) });
  }
}
Module._load = function (pedido, ...resto) {
  if (pedido === '@prisma/client') return { PrismaClient };
  return cargar.call(this, pedido, ...resto);
};
`;

/** Corre `prisma/seed.ts` con sus argumentos, un `.env` de pega y un entorno sin claves de BD. */
function siembra(argv, { claves = {}, heredada } = {}) {
  const dir = temporal('scrum1105b-');
  fs.writeFileSync(path.join(dir, '.env'),
    Object.entries(claves).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
  const stub = path.join(dir, 'stub-prisma.cjs');
  fs.writeFileSync(stub, STUB);
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (/^DATABASE_URL/.test(k) || ['YAQU_ENV_FILE', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT', 'FORCE_COLOR'].includes(k)) delete env[k];
  }
  if (heredada) env.DATABASE_URL = heredada;
  env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(dir, 'no-existe.node');
  const r = spawnSync(process.execPath, ['-r', stub, TS_NODE, SEED, ...argv],
    { cwd: dir, env, encoding: 'utf8', timeout: 120_000 });
  const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  assert.notEqual(r.status, null, `el hijo no terminó (señal ${r.signal}):\n${salida}`);
  const consulto = salida.split('\n').find((l) => l.startsWith(MARCA));
  return { status: r.status, salida, consulto: consulto ? consulto.slice(MARCA.length + 1).trim() : null };
}

test('SCRUM-1105b · prisma/seed.ts resuelve la bandera ANTES de leer DATABASE_URL', () => {
  const src = fs.readFileSync(SEED, 'utf8');
  const sf = ts.createSourceFile(SEED, src, ts.ScriptTarget.Latest, true);
  let posBandera = -1;
  let posLectura = -1;
  const pistas = [];
  const visita = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) &&
        n.expression.text === 'fijarDestinoPorBandera' && posBandera < 0) posBandera = n.getStart(sf);
    if (ts.isPropertyAccessExpression(n) && n.name.text === 'DATABASE_URL' &&
        n.expression.getText(sf) === 'process.env' && posLectura < 0) posLectura = n.getStart(sf);
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && /DATABASE_URL=/.test(n.text)) pistas.push(n.text);
    ts.forEachChild(n, visita);
  };
  visita(sf);
  assert.ok(posBandera >= 0, '🔴 prisma/seed.ts no llama a fijarDestinoPorBandera: sigue exigiendo exportar la URL a mano');
  assert.ok(posLectura >= 0, 'SUELO: prisma/seed.ts ya no lee process.env.DATABASE_URL — el control no mide nada');
  assert.ok(posBandera < posLectura, '🔴 prisma/seed.ts lee DATABASE_URL ANTES de resolver la bandera');
  assert.deepEqual(pistas, [], '🔴 un mensaje de prisma/seed.ts sigue enseñando a exportar DATABASE_URL a mano');
});

test('SCRUM-1105b · CONTROL POSITIVO: --dev y --staging llegan a consultar en SU base, sin imprimir la credencial', () => {
  for (const [bandera, esperada] of [['--dev', D], ['--staging', S]]) {
    const r = siembra([bandera], { claves: { DATABASE_URL_DEV: DEV, DATABASE_URL_STAGING: STAGING } });
    assert.equal(r.consulto, `${esperada.host}/${esperada.base}`, `${bandera} no llegó a su base:\n${r.salida}`);
    assert.notEqual(r.status, 0, 'el cliente de pega lanza: el seed no puede acabar en 0');
    assert.ok(!r.salida.includes('u:p'), `🔴 ${bandera} imprime la credencial:\n${r.salida}`);
  }
});

test('SCRUM-1105b · con bandera, una DATABASE_URL heredada se IGNORA: manda --dev', () => {
  const r = siembra(['--dev'], { claves: { DATABASE_URL_DEV: DEV }, heredada: STAGING });
  assert.equal(r.consulto, `${D.host}/${D.base}`, r.salida);
  assert.match(r.salida, /se IGNORA/);
  assert.ok(!r.salida.includes('u:p'));
});

test('SCRUM-1105b · 🔴 --staging que resuelve a PRODUCCIÓN se niega antes de la primera consulta', () => {
  const r = siembra(['--staging'], { claves: { DATABASE_URL_STAGING: PROD } });
  assert.equal(r.consulto, null, `🔴 consultó con un destino de producción:\n${r.salida}`);
  assert.equal(r.status, 1, r.salida);
  assert.match(r.salida, /NO SE SIEMBRA/);
  assert.match(r.salida, /Falla: el HOST/);
  assert.ok(!r.salida.includes('u:p'));
});

test('SCRUM-1105b · 🔴 `--prod` no existe: con producción heredada, se niega igual', () => {
  const r = siembra(['--prod'], { heredada: PROD });
  assert.equal(r.consulto, null, `🔴 consultó en producción:\n${r.salida}`);
  assert.equal(r.status, 1, r.salida);
  assert.match(r.salida, /NO SE SIEMBRA/);
  assert.ok(!r.salida.includes('u:p'));
});

test('SCRUM-1105b · 🔴 sin bandera y sin DATABASE_URL, se niega y dice cómo nombrar la base', () => {
  const r = siembra([], { claves: { DATABASE_URL_DEV: DEV } });
  assert.equal(r.consulto, null, r.salida);
  assert.equal(r.status, 1, r.salida);
  assert.match(r.salida, /--dev/);
});

test('SCRUM-1105b · 🔴 las dos banderas a la vez se niegan', () => {
  const r = siembra(['--dev', '--staging'], { claves: { DATABASE_URL_DEV: DEV, DATABASE_URL_STAGING: STAGING } });
  assert.equal(r.consulto, null, r.salida);
  assert.equal(r.status, 1, r.salida);
  assert.match(r.salida, /elige una/);
});
