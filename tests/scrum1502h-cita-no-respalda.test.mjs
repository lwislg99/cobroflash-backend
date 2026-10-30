// tests/scrum1502h-cita-no-respalda.test.mjs — SCRUM-1502h
//
// LO QUE UN REGISTRO DECLARA COMO CITA NO RESPALDA UNA MARCA.
//
// `_respaldo-de-firma.mjs` da por «documental» una marca cuyo literal aparece en una fuente del
// repo (el máster, el registro congelado, `docs/master/`, `docs/microcopy/`) que atribuye la
// decisión. Medido dos veces (SCRUM-1502 c.18795 y c.20636): un registro que COPIABA la frase
// entre `[[cita]]` y `[[/cita]]` la absolvía igual que uno que la documentaba. Desde 1502h cada
// fuente se lee con `sinCitas`, y lo citado no aporta ni el literal ni la atribución.
//
// Decisión: SCRUM-1502 comentario 20690. Población y recuento de antes y de después, en el
// tramo 1502h de `docs/master/SCRUM-1502.md`.
//
// ⚠️ La frase copiada A PELO sigue respaldando, y aquí hay un caso que lo fija para que no se
// lea como cerrado: es la misma forma que el respaldo documental legítimo (ver el helper).
//
// La cobaya se SIEMBRA en un árbol de mentira, no se toma del real: un positivo prestado del
// árbol se jubila el día que alguien arregla el defecto.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { indiceDeFuentes, respaldoDe, respaldoDocumental, RE_ANCLA_JIRA } from './_respaldo-de-firma.mjs';
import { ABRE, CIERRA } from './_cita-declarada.mjs';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El defecto que este fichero existe para cazar: la fuente se vuelve a leer entera.
    fichero: 'tests/_respaldo-de-firma.mjs',
    de: "    const texto = sinCitas(fs.readFileSync(path.join(raiz, ruta), 'utf8'));",
    a: "    const texto = fs.readFileSync(path.join(raiz, ruta), 'utf8');",
    cae: 'SCRUM-1502h · 🔴 POSITIVO SEMBRADO: la frase entre [[cita]] deja de absolver',
  },
  {
    // La atribución se da por buena aunque sólo esté dentro de una cita.
    fichero: 'tests/_respaldo-de-firma.mjs',
    de: '    return { ruta, texto, atribuye: RE_ATRIBUCION.test(texto) };',
    a: '    return { ruta, texto, atribuye: true };',
    cae: 'SCRUM-1502h · una atribución entre [[cita]] tampoco atribuye',
  },
];

// La atribución se escribe partida para que este fichero no la contenga como texto.
const ATRIBUYE = 'Literal del ' + 'fundador:';
const FRASE = 'Frase sembrada como cobaya del respaldo citado en un registro';
const MARCA = { texto: '// bloque sin ticket ni documento', literales: [FRASE] };

/** Un árbol de mentira con UN registro en docs/master/, y su índice. */
function arbolCon(registro) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1502h-'));
  fs.mkdirSync(path.join(raiz, 'docs', 'master'), { recursive: true });
  fs.writeFileSync(path.join(raiz, 'docs', 'master', 'SCRUM-1.md'), registro);
  try {
    const indice = indiceDeFuentes(raiz);
    // SUELO: el índice tiene que haber visto el registro sembrado, o el veredicto no habla de él.
    assert.deepEqual(indice.map((f) => f.ruta), ['docs/master/SCRUM-1.md'], 'CIEGO: el índice no ve la cobaya');
    assert.equal(indice[0].texto.length, registro.length, 'sinCitas tiene que conservar cada posición');
    return indice;
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true });
  }
}
/** El índice tal y como se leía ANTES de 1502h: el texto entero. */
const comoAntes = (registro) => [{ ruta: 'docs/master/SCRUM-1.md', texto: registro, atribuye: true }];

test('SCRUM-1502h · 🔴 POSITIVO SEMBRADO: la frase entre [[cita]] deja de absolver', () => {
  const registro = `${ATRIBUYE}\n\n${ABRE} ${FRASE} ${CIERRA}\n`;
  // Antes absolvía: es la marca absuelta por una cita que pide c.20690.
  assert.ok(respaldoDocumental(comoAntes(registro), FRASE), 'la cobaya tiene que absolver leída entera');
  assert.equal(respaldoDe(MARCA, arbolCon(registro)).nivel, 'sin-respaldo');
});

test('SCRUM-1502h · una atribución entre [[cita]] tampoco atribuye', () => {
  const registro = `${ABRE} ${ATRIBUYE} ${CIERRA}\n\n${FRASE}\n`;
  const indice = arbolCon(registro);
  assert.equal(indice[0].atribuye, false);
  assert.equal(respaldoDe(MARCA, indice).nivel, 'sin-respaldo');
});

test('SCRUM-1502h · CONTROL: la misma fuente sin delimitador sigue respaldando', () => {
  // Sin este control, el positivo pasaría también con un índice que no respaldara nada.
  const r = respaldoDe(MARCA, arbolCon(`${ATRIBUYE}\n\n${FRASE}\n`));
  assert.deepEqual(r, { nivel: 'documental', donde: 'docs/master/SCRUM-1.md', frase: FRASE });
});

test('SCRUM-1502h · ⚠️ NO HECHO: la frase copiada A PELO sigue absolviendo, y se dice', () => {
  // La forma del respaldo documental legítimo y la de una copia a pelo son la misma. Si alguien
  // cierra este hueco, este caso cae y le obliga a escribir con qué criterio, y a medir cuántas
  // marcas cambian de nivel (c.20690: ninguna puede).
  const copia = `Registro de otra sesión.\n\n${ATRIBUYE} se cita aquí «${FRASE}» de pasada.\n`;
  assert.equal(respaldoDe(MARCA, arbolCon(copia)).nivel, 'documental');
});

test('SCRUM-1502h · el ancla «Consta en: SCRUM-N comentario M» sigue contando', () => {
  const ancla = { ...MARCA, texto: '// Consta en: SCRUM-1502 comentario 20690.' };
  assert.ok(RE_ANCLA_JIRA.test(ancla.texto));
  assert.equal(respaldoDe(ancla, arbolCon(`${ABRE} ${FRASE} ${CIERRA}\n`)).nivel, 'anclado');
});
