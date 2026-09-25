// SCRUM-1105 · El sembrador elige su base por BANDERA (`--dev` / `--staging`) y resuelve la
// credencial por dentro: nadie la exporta a mano.
//
// Puro: el helper recibe `argv`, `env` y `cwd`, así que se ejercita con un `.env` de pega en un
// directorio temporal FUERA del repo, sin base de datos y sin tocar el entorno del proceso.
// Las URLs son de pega (`u:p`), el mismo convenio que `scrum418-credencial-de-produccion`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { temporal } from './_temporal.mjs';
import {
  fijarDestinoPorBandera, BANDERAS_DE_DESTINO, SIN_BANDERA, FIJADO, RECHAZADO,
} from '../scripts/_destino-de-semilla.mjs';
import { DESTINOS_ESPERADOS } from '../scripts/_clave-vs-destino.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Derivadas del mapa declarado, no escritas a mano: si el mapa cambia, el test lo sigue.
const url = (host, base) => `postgresql://u:p@${host}:5432/${base}`;
const { DATABASE_URL_DEV: D, DATABASE_URL_STAGING: S, DATABASE_URL: P } = DESTINOS_ESPERADOS;
const DEV = url(D.host, D.base);
const STAGING = url(S.host, S.base);
const PROD = url(P.host, 'railway');

/** Un `.env` de pega en un temporal (lo borra `_temporal.mjs` al salir). No es un repo git: solo se mira ese fichero. */
function conEnv(claves) {
  const dir = temporal('scrum1105-');
  fs.writeFileSync(path.join(dir, '.env'),
    Object.entries(claves).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
  return dir;
}

test('SCRUM-1105 · solo dos banderas, y ninguna nombra producción', () => {
  assert.deepEqual(Object.keys(BANDERAS_DE_DESTINO).sort(), ['--dev', '--staging']);
  for (const clave of Object.values(BANDERAS_DE_DESTINO)) {
    assert.notEqual(DESTINOS_ESPERADOS[clave].host, P.host, `🔴 ${clave} apunta al host de producción`);
  }
});

test('SCRUM-1105 · sin bandera no toca nada (el camino de antes sigue igual)', () => {
  const env = {};
  const r = fijarDestinoPorBandera({ argv: [], env, cwd: conEnv({ DATABASE_URL_DEV: DEV }) });
  assert.equal(r.estado, SIN_BANDERA);
  assert.deepEqual(env, {}, 'sin bandera no se carga ni se fija nada');
});

test('SCRUM-1105 · CONTROL POSITIVO: --dev y --staging con su base correcta fijan DATABASE_URL', () => {
  for (const [bandera, valor, esperada] of [['--dev', DEV, D], ['--staging', STAGING, S]]) {
    const env = {};
    const cwd = conEnv({ DATABASE_URL_DEV: DEV, DATABASE_URL_STAGING: STAGING });
    const r = fijarDestinoPorBandera({ argv: [bandera], env, cwd });
    assert.equal(r.estado, FIJADO, r.mensaje);
    assert.equal(env.DATABASE_URL, valor);
    assert.equal(r.etiqueta, `${esperada.host}/${esperada.base}`);
    assert.ok(!JSON.stringify(r).includes('u:p'), '🔴 el resultado lleva la credencial');
  }
});

test('SCRUM-1105 · 🔴 --dev apuntando a la base de STAGING aborta, y dice que falla la BASE', () => {
  // El caso peligroso: mismo host, otra base. Un control solo de host lo daría por bueno.
  const env = {};
  const r = fijarDestinoPorBandera({ argv: ['--dev'], env, cwd: conEnv({ DATABASE_URL_DEV: STAGING }) });
  assert.equal(r.estado, RECHAZADO);
  assert.match(r.mensaje, /Falla: la BASE\./);
  assert.equal(env.DATABASE_URL, undefined, '🔴 se fijó un destino rechazado');
  assert.ok(!r.mensaje.includes('u:p'), '🔴 el rechazo imprime la credencial');
});

test('SCRUM-1105 · 🔴 --staging apuntando a PRODUCCIÓN aborta, y dice que falla el HOST', () => {
  const env = {};
  const r = fijarDestinoPorBandera({ argv: ['--staging'], env, cwd: conEnv({ DATABASE_URL_STAGING: PROD }) });
  assert.equal(r.estado, RECHAZADO);
  assert.match(r.mensaje, /Falla: el HOST/);
  assert.equal(env.DATABASE_URL, undefined);
  assert.ok(!r.mensaje.includes('u:p'));
});

test('SCRUM-1105 · 🔴 las dos banderas a la vez, o la clave ausente, abortan', () => {
  const cwd = conEnv({ DATABASE_URL_DEV: DEV, DATABASE_URL_STAGING: STAGING });
  const dos = fijarDestinoPorBandera({ argv: ['--dev', '--staging'], env: {}, cwd });
  assert.equal(dos.estado, RECHAZADO);

  const env = {};
  const falta = fijarDestinoPorBandera({ argv: ['--staging'], env, cwd: conEnv({ DATABASE_URL_DEV: DEV }) });
  assert.equal(falta.estado, RECHAZADO);
  assert.match(falta.mensaje, /DATABASE_URL_STAGING/);
  assert.match(falta.mensaje, /fichero\(s\) mirado\(s\)/, 'el rechazo declara dónde miró');
  assert.equal(env.DATABASE_URL, undefined);
});

test('SCRUM-1105 · con bandera, una DATABASE_URL heredada se IGNORA y se avisa', () => {
  const env = { DATABASE_URL: STAGING };
  const r = fijarDestinoPorBandera({ argv: ['--dev'], env, cwd: conEnv({ DATABASE_URL_DEV: DEV }) });
  assert.equal(r.estado, FIJADO, r.mensaje);
  assert.equal(env.DATABASE_URL, DEV);
  assert.equal(r.avisos.length, 1);
  assert.ok(!r.avisos[0].includes('u:p'));
});

test('SCRUM-1105 · los tres sembradores resuelven la bandera ANTES de leer DATABASE_URL', () => {
  for (const f of ['seed-demo.mjs', 'seed-video.mjs', 'seed-staging.mjs']) {
    const src = fs.readFileSync(path.join(RAIZ, 'scripts', f), 'utf8');
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true);
    let posBandera = -1;
    let posLectura = -1;
    const visita = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) &&
          n.expression.text === 'fijarDestinoPorBandera' && posBandera < 0) posBandera = n.getStart(sf);
      if (ts.isPropertyAccessExpression(n) && n.name.text === 'DATABASE_URL' &&
          n.expression.getText(sf) === 'process.env' && posLectura < 0) posLectura = n.getStart(sf);
      ts.forEachChild(n, visita);
    };
    visita(sf);
    assert.ok(posBandera >= 0, `🔴 ${f} no llama a fijarDestinoPorBandera: sigue exigiendo exportar la URL a mano`);
    assert.ok(posLectura >= 0, `SUELO: ${f} ya no lee process.env.DATABASE_URL — el control no mide nada`);
    assert.ok(posBandera < posLectura, `🔴 ${f} lee DATABASE_URL ANTES de resolver la bandera`);
  }
});
