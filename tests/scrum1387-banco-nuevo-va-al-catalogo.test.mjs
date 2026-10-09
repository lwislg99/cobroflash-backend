// tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs — SCRUM-1387 ②
//
// Sin gate: ni BD, ni red, ni navegador, ni `dist/`. Lee `docs/evidencias/` y `docs/master/evidencias/`.
//
// Un banco de mutación NUEVO que traiga su lista propia y no nombre el catálogo del meta-guard CAE,
// y el rojo dice qué banco y qué fichero. Los que ya estaban fuera viven en una lista que sólo
// mengua. Decisión del fundador: comentario 18016 de SCRUM-1387 (2-oct-2026).
//
// ⚠️ LÍMITE: «banco» y «fuera» son la heurística de TEXTO de SCRUM-1394 (ver
// `tests/_catalogo-obligatorio.mjs`). Este guard no ejecuta ningún banco ni compara mutaciones.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  leerFicherosDeMutacion, clasificar, juicio, FUERA_DECLARADOS, TECHO_DE_LA_LISTA,
} from './_catalogo-obligatorio.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Nada está fuera nunca: el guard deja de ver los bancos con lista propia.
    fichero: 'tests/_catalogo-obligatorio.mjs',
    de: 'const fuera = guiones.length > 0 && !usaCatalogo;',
    a: 'const fuera = false;',
    cae: 'el clasificador separa el banco con lista propia del que toma las del test',
  },
  {
    // Un banco nuevo sin declarar deja de salir.
    fichero: 'tests/_catalogo-obligatorio.mjs',
    de: 'const sinDeclarar = fuera.filter((b) => !nombres.has(b.carpeta));',
    a: 'const sinDeclarar = fuera.filter(() => false);',
    cae: 'un banco nuevo sin declarar sale nombrado, con su carpeta y su guion',
  },
  {
    // Una entrada que ya no hace falta deja de sobrar: la lista dejaría de menguar.
    fichero: 'tests/_catalogo-obligatorio.mjs',
    de: 'const sobran = declaradas.filter((d) => !estan.has(d));',
    a: 'const sobran = declaradas.filter(() => false);',
    cae: 'una entrada declarada que ya no está fuera sobra',
  },
];

// Un árbol fabricado en memoria: uno fuera, uno que toma las del test, uno sólo con salidas.
const FABRICADO = [
  { ruta: 'docs/master/evidencias/scrumA/mutar.mjs', texto: 'const LISTA = [{ de: "x", a: "y" }];' },
  { ruta: 'docs/master/evidencias/scrumA/salida-mut.txt', texto: '' },
  { ruta: 'docs/master/evidencias/scrumB/mutar.mjs', texto: 'import { MUTACIONES_QUE_ME_TUMBAN } from "../../../../tests/x.test.mjs";' },
  { ruta: 'docs/evidencias/scrumC/salida-mutada.txt', texto: '' },
];

test('SCRUM-1387 · el clasificador separa el banco con lista propia del que toma las del test', () => {
  const r = clasificar(FABRICADO);
  assert.equal(r.ficheros, 4);
  assert.deepEqual(r.bancos.map((b) => b.carpeta), [
    'docs/evidencias/scrumC', 'docs/master/evidencias/scrumA', 'docs/master/evidencias/scrumB',
  ]);
  assert.deepEqual(r.fuera.map((b) => b.carpeta), ['docs/master/evidencias/scrumA']);
});

test('SCRUM-1387 · un banco nuevo sin declarar sale nombrado, con su carpeta y su guion', () => {
  const { fuera } = clasificar(FABRICADO);
  const j = juicio({ fuera, declaradas: [] });
  assert.deepEqual(j.sinDeclarar.map((b) => b.carpeta), ['docs/master/evidencias/scrumA']);
  assert.deepEqual(j.sinDeclarar[0].guiones, ['docs/master/evidencias/scrumA/mutar.mjs']);
  // Y declarado, ya no sale.
  assert.deepEqual(juicio({ fuera, declaradas: ['docs/master/evidencias/scrumA'] }).sinDeclarar, []);
});

test('SCRUM-1387 · una entrada declarada que ya no está fuera sobra', () => {
  const { fuera } = clasificar(FABRICADO);
  const j = juicio({ fuera, declaradas: ['docs/master/evidencias/scrumA', 'docs/master/evidencias/scrumB'] });
  assert.deepEqual(j.sobran, ['docs/master/evidencias/scrumB']);
  assert.deepEqual(juicio({ fuera, declaradas: ['docs/master/evidencias/scrumA'] }).sobran, []);
});

test('SCRUM-1387 · 🔴 en el árbol: ningún banco de mutación nuevo queda fuera del catálogo, y en la lista no sobra ninguna entrada', () => {
  const ficheros = leerFicherosDeMutacion(RAIZ);
  const { bancos, fuera } = clasificar(ficheros);
  // SUELO: no haber visto nada no es estar limpio.
  assert.ok(ficheros.length > 0 && bancos.length > 0,
    `CIEGO: he leído ${ficheros.length} ficheros con «mut» en el nombre en ${bancos.length} carpetas. No he mirado nada.`);
  const j = juicio({ fuera, declaradas: FUERA_DECLARADOS.map((x) => x.carpeta) });
  const poblacion = `(población: ${ficheros.length} ficheros con «mut» en el nombre · ${bancos.length} bancos · ${fuera.length} fuera · ${FUERA_DECLARADOS.length} declarados)`;
  assert.deepEqual(j.sinDeclarar.map((b) => `${b.carpeta} → ${b.guiones.join(', ')}`), [],
    'ESTE banco de mutación trae su lista propia y su guion no nombra el catálogo del meta-guard '
    + `${poblacion}. Regístralo: que el test del ticket exporte MUTACIONES_QUE_ME_TUMBAN y el guion `
    + 'las tome de ahí. ⛔ No lo añadas a FUERA_DECLARADOS: esa lista sólo mengua (SCRUM-1387, comentario 18016).');
  assert.deepEqual(j.sobran, [],
    `Esta entrada de FUERA_DECLARADOS ya no está fuera ${poblacion}: quítala de `
    + 'tests/_catalogo-obligatorio.mjs y baja TECHO_DE_LA_LISTA. Si no la has retirado tú, mira antes '
    + 'si la carpeta se ha movido o el guard ha dejado de verla.');
});

test('SCRUM-1387 · la lista no sube de su techo, y cada entrada dice motivo, quién la retira y desde cuándo', () => {
  assert.equal(FUERA_DECLARADOS.length, TECHO_DE_LA_LISTA,
    'La lista y su techo van juntos: al retirar una entrada baja el techo. Subirlo es añadir una '
    + 'excepción, y el comentario 18016 de SCRUM-1387 dice que la lista sólo mengua.');
  assert.ok(TECHO_DE_LA_LISTA <= 23, 'El techo nació en 23 (7-oct-2026) y no sube.');
  assert.equal(new Set(FUERA_DECLARADOS.map((x) => x.carpeta)).size, FUERA_DECLARADOS.length, 'hay una carpeta repetida');
  for (const x of FUERA_DECLARADOS) {
    assert.ok(['anterior', 'posterior'].includes(x.motivo), `${x.carpeta}: motivo «${x.motivo}»`);
    assert.ok(typeof x.retira === 'string' && x.retira.trim().length > 1, `${x.carpeta}: falta quién la retira`);
    assert.match(x.desde, /^\d{4}-\d{2}-\d{2}$/, `${x.carpeta}: «desde» es la fecha de entrada en la lista`);
  }
});
