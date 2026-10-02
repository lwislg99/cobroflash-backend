// SCRUM-1423 · las claves de base de datos de todos los árboles, por destino.
// TODO fabricado en el temporal: ningún caso lee un fichero de entorno de verdad.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';
import { medir, leerRutas, ES_FICHERO_DE_ENTORNO } from '../scripts/claves-bd-de-todos-los-arboles.mjs';
import { HOST_PRODUCCION, DESTINOS_ESPERADOS } from '../scripts/_clave-vs-destino.mjs';

// Credenciales de MENTIRA, con una contraseña reconocible para poder buscarla en la salida.
const SECRETO = 'contrasena-fabricada-9Zq';
const USUARIO = 'usuario-fabricado-7Kp';
const url = (host, base) => `postgresql://${USUARIO}:${SECRETO}@${host}:5432/${base}`;
const PROD = url(HOST_PRODUCCION, 'railway');
const STAGING = url(DESTINOS_ESPERADOS.DATABASE_URL_STAGING.host, 'railway');
const AHORA = Date.parse('2026-10-02T14:00:00Z');
const arbol = (ruta, ficheros) => ({ ruta, ficheros });
const LIMPIOS = [
  arbol('D:/wt-a', []),
  arbol('D:/wt-b', [{ nombre: '.env.local', env: { DATABASE_URL_STAGING: STAGING, OTRO_SECRETO: 'sk_no_es_una_url' } }]),
];

test('SCRUM-1423 · 🔴 una cadena que apunta al host de producción se CAZA, con árbol · fichero · variable, y sale 1', () => {
  const r = medir([...LIMPIOS, arbol('D:/wt-c', [{ nombre: '.env.guardado', env: { CUALQUIER_NOMBRE: PROD, DATABASE_URL_DEV: STAGING } }])], { ahora: AHORA });
  const t = r.lineas.join('\n');
  assert.equal(r.codigo, 1, t);
  assert.match(t, /APUNTAN A PRODUCCIÓN \(1\)/);
  assert.match(t, /· D:\/wt-c · \.env\.guardado · CUALQUIER_NOMBRE$/m, 'se decide por el DESTINO: la variable no se llama DATABASE_URL y se caza igual');
  assert.match(t, /árboles de trabajo mirados: 3 · sin fichero de entorno en su raíz: 1 · con alguno: 2/);
  assert.match(t, /cadenas de conexión: 3 · no son producción: 2 · APUNTAN A PRODUCCIÓN: 1 · sin poder decidir o leer: 0/);
  assert.match(t, /No se arregla ni se borra nada: se para y se le dice al fundador/);
});

test('SCRUM-1423 · el negativo: sin ninguna de producción sale 0, y la frase lleva su fecha y su población', () => {
  const r = medir(LIMPIOS, { ahora: AHORA });
  const t = r.lineas.join('\n');
  assert.equal(r.codigo, 0, t);
  assert.match(t, /APUNTAN A PRODUCCIÓN \(0\)[^\n]*\n {3}ninguna/);
  assert.match(t, /«Medido el 2026-10-02 sobre 2 árboles de trabajo \(1 ficheros de entorno, 1 cadenas de conexión\): ninguna apunta a producción\.»/);
  assert.match(t, /LÍMITES: solo los árboles que git conoce · solo la RAÍZ de cada uno/);
});

test('SCRUM-1423 · 🔴 NO IMPRIME NINGÚN VALOR: ni la contraseña, ni el usuario, ni el host, ni otro secreto del fichero', () => {
  const r = medir([...LIMPIOS, arbol('D:/wt-c', [{ nombre: '.env', env: { DATABASE_URL: PROD, ROTA: 'postgresql://sin-barra' } }])], { ahora: AHORA });
  const t = r.lineas.join('\n');
  // El positivo de las negaciones: lo que se busca SÍ está en lo que el script recibió.
  for (const s of [SECRETO, USUARIO, HOST_PRODUCCION]) assert.ok(PROD.includes(s));
  assert.ok(t.includes('DATABASE_URL') && t.includes('.env'), 'el nombre de la variable y el del fichero sí salen');
  for (const s of [SECRETO, USUARIO, HOST_PRODUCCION, HOST_PRODUCCION.split('.')[0], 'sk_no_es_una_url', 'sin-barra', 'postgres']) {
    assert.ok(!t.includes(s), `🔴 la salida contiene «${s}»`);
  }
});

test('SCRUM-1423 · 🔴 fail-closed: un árbol sin abrir, un fichero sin leer y una cadena sin decidir son CIEGOS con nombre, y sale 2', () => {
  const r = medir([
    ...LIMPIOS, arbol('D:/wt-cerrado', undefined),
    arbol('D:/wt-d', [{ nombre: '.env', env: undefined }, { nombre: '.env.local', env: { DATABASE_URL_TESTS: 'postgresql://[' } }]),
  ], { ahora: AHORA });
  const t = r.lineas.join('\n');
  assert.equal(r.codigo, 2, t);
  assert.match(t, /NO SE PUDO MIRAR \(3\)/);
  assert.match(t, /· D:\/wt-cerrado · el árbol no se pudo abrir/);
  assert.match(t, /· D:\/wt-d · \.env · el fichero no se pudo leer/);
  assert.match(t, /· D:\/wt-d · \.env\.local · DATABASE_URL_TESTS · no se pudo decidir su destino/);
  assert.match(t, /NO HAY FRASE: 3 cosa\(s\) no se pudieron mirar/);
  // Y el positivo de ese «no hay frase»: con todo a la vista, la frase SÍ sale.
  assert.match(medir(LIMPIOS, { ahora: AHORA }).lineas.join('\n'), /ninguna apunta a producción/);
  assert.ok(!t.includes('ninguna apunta a producción'), 'con ciegos no se afirma que no hay ninguna');
});

test('SCRUM-1423 · 🔴 con hallazgo Y ciegos manda el hallazgo (1), y se dice que la lista no es completa', () => {
  const r = medir([arbol('D:/wt-c', [{ nombre: '.env', env: { DATABASE_URL: PROD } }]), arbol('D:/wt-cerrado', undefined)], { ahora: AHORA });
  assert.equal(r.codigo, 1);
  assert.match(r.lineas.join('\n'), /NO es la lista completa/);
});

test('SCRUM-1423 · sin árboles que mirar no hay «ninguna»: sale 2', () => {
  for (const nada of [undefined, null, []]) {
    const r = medir(nada, { ahora: AHORA });
    assert.equal(r.codigo, 2);
    assert.match(r.lineas.join('\n'), /no se pudo listar ningún árbol/);
  }
});

test('SCRUM-1423 · qué es un fichero de entorno: `.env` y `.env.<algo>`, y nada que solo se le parezca', () => {
  assert.deepEqual(['.env', '.env.local', '.env.prod.guardado', '.env.example'].map((n) => ES_FICHERO_DE_ENTORNO.test(n)), [true, true, true, true]);
  assert.deepEqual(['env', '.envrc', 'mi.env', '.environment', '.env.'].map((n) => ES_FICHERO_DE_ENTORNO.test(n)), [false, false, false, false, false]);
});

test('SCRUM-1423 · 🔴 el lector de verdad, sobre carpetas FABRICADAS en el temporal: lee la raíz, no las subcarpetas, y una ruta que no existe es un árbol sin abrir', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1423-'));
  try {
    const a = path.join(tmp, 'a'); const b = path.join(tmp, 'b');
    fs.mkdirSync(path.join(a, 'sub'), { recursive: true }); fs.mkdirSync(b);
    fs.writeFileSync(path.join(a, '.env.prod.guardado'), `# copia\nDATABASE_URL="${PROD}"\nTOKEN=abc\n`);
    fs.writeFileSync(path.join(a, 'sub', '.env'), `DATABASE_URL=${PROD}\n`);
    fs.writeFileSync(path.join(a, 'notas.txt'), PROD);
    fs.mkdirSync(path.join(b, '.env'));  // una CARPETA que se llama `.env` no es un fichero de entorno
    const arboles = leerRutas([a, b, path.join(tmp, 'no-existe')], dotenv.parse);
    assert.deepEqual(arboles.map((x) => (x.ficheros ? x.ficheros.map((f) => f.nombre) : undefined)), [['.env.prod.guardado'], [], undefined]);
    const r = medir(arboles, { ahora: AHORA });
    assert.equal(r.codigo, 1);
    assert.equal(r.datos.produccion.length, 1, 'la de la raíz se caza; la de la subcarpeta y la del .txt quedan fuera, y los LÍMITES lo dicen');
    assert.match(r.lineas.join('\n'), /\.env\.prod\.guardado · DATABASE_URL$/m);
    assert.match(r.lineas.join('\n'), /no-existe · el árbol no se pudo abrir/);
    assert.ok(!r.lineas.join('\n').includes(SECRETO));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
