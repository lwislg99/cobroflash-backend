import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esErrorRelevante, resumirErroresConsola, CONSOLA_ALLOWLIST } from '../scripts/_console-guard.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * SCRUM-183 — que un error de JS en la PÁGINA rompa el E2E.
 *
 * La decisión (qué cuenta como fallo) vive en `_console-guard.mjs` y se prueba aquí SIN navegador
 * ni BD; el cableado en el E2E se comprueba leyéndolo. Es la única forma de tener este guard
 * probado en rojo sin depender de Edge + staging.
 */

test('SCRUM-183: un ReferenceError de la página cuenta como fallo', () => {
  // El caso real: SCRUM-139 F6 lanzaba esto y el E2E ni se enteraba.
  assert.equal(esErrorRelevante({ tipo: 'error', texto: "ReferenceError: Cannot access 'plantillasRotulo' before initialization" }), true);
});

test('SCRUM-183: los warnings NO rompen el E2E', () => {
  // Convertir los avisos en fallo entrena a ignorar el guard entero, que es como mueren.
  assert.equal(esErrorRelevante({ tipo: 'warning', texto: 'algo deprecado' }), false);
  assert.equal(esErrorRelevante({ tipo: 'log', texto: 'ReferenceError en un log' }), false);
});

test('SCRUM-183: la allowlist es VISIBLE y cada excepción lleva su motivo', () => {
  // Regla de la casa: excepciones declaradas, nunca silenciosas.
  assert.ok(Array.isArray(CONSOLA_ALLOWLIST));
  for (const e of CONSOLA_ALLOWLIST) {
    assert.ok(e.patron instanceof RegExp, 'cada entrada de la allowlist necesita su patrón');
    assert.ok(typeof e.porque === 'string' && e.porque.length > 10, `la excepción ${e.patron} no explica por qué se tolera`);
  }
  // SCRUM-184: la allowlist conserva su papel de EXCEPCIÓN DECLARADA, pero ya no es el
  // mecanismo de clasificación — quién es recurso y quién es JS lo decide el tipo de evento.
  // Y la entrada MUERTA del favicon no vuelve: filtraba por un texto que el navegador nunca
  // manda (su mensaje no lleva la URL), o sea que aparentaba cubrir un caso que no reconocía.
  assert.ok(
    !CONSOLA_ALLOWLIST.some((e) => /favicon/i.test(String(e.patron))),
    '🔴 vuelve la entrada del favicon a la allowlist: no puede filtrar nada y MIENTE. Un 404 de ' +
    'recurso se clasifica por evento de red desde SCRUM-184, no por texto.',
  );
});

test('SCRUM-184: un 404 de RECURSO se informa con su URL y NO rompe el E2E', () => {
  // La distinción es el ticket entero: un recurso caído no aborta el render, solo deja la página
  // peor. Tumbar el recorrido por eso entrena a ignorar el guard — y entonces tampoco caza lo
  // grave, que es el mismo final que el rojo permanente que este ticket vino a quitar.
  const r = resumirErroresConsola([
    { tipo: 'recurso', url: 'http://127.0.0.1:3457/favicon.ico', status: 404, donde: 'http://127.0.0.1:3457/pay/quote/abc' },
    { tipo: 'error', texto: 'GET /icons/icon-192.png 404' }, // la misma clase, dicha en la consola
  ]);
  assert.equal(r.ok, true, '🔴 un recurso que no carga NO puede tumbar el recorrido');
  assert.equal(r.recursos.length, 2, 'las dos formas de anunciarlo cuentan como recurso');
  assert.match(r.avisoRecursos, /favicon\.ico/, 'el aviso tiene que decir QUÉ recurso falló');
  assert.match(r.avisoRecursos, /404/, 'y con qué estado');
  assert.match(r.avisoRecursos, /pay\/quote/, 'y en qué pantalla');
});

test('SCRUM-183: el informe dice QUÉ se rompió y DÓNDE', () => {
  const r = resumirErroresConsola([
    { tipo: 'error', texto: 'ReferenceError: x', donde: 'http://127.0.0.1:3457/dashboard' },
    { tipo: 'recurso', url: '/favicon.ico', status: 404, donde: 'http://127.0.0.1:3457/dashboard' },
    { tipo: 'warning', texto: 'ruido' },
  ]);
  assert.equal(r.ok, false, 'el error de JS SÍ rompe: es el que aborta el render');
  assert.equal(r.relevantes.length, 1, 'solo el error de JS — ni el recurso ni los warnings');
  assert.match(r.informe, /ReferenceError: x/);
  assert.match(r.informe, /dashboard/, 'el informe debe decir en qué pantalla pasó');
  assert.match(r.informe, /favicon\.ico/, 'el recurso caído también se informa, aunque no sea lo que rompió');
});

test('SCRUM-183: sin errores de JS, el E2E sigue verde', () => {
  const r = resumirErroresConsola([
    { tipo: 'warning', texto: 'x' },
    { tipo: 'recurso', url: '/favicon.ico', status: 404 },
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.informe, '', 'sin errores de JS no hay informe de fallo…');
  assert.match(r.avisoRecursos, /favicon\.ico/, '…pero el recurso caído no se calla');
});

test('SCRUM-183: entradas basura no rompen el guard', () => {
  for (const basura of [null, undefined, 'texto', 42, {}, { tipo: 'error' }, { tipo: 'error', texto: '   ' }]) {
    assert.equal(esErrorRelevante(basura), false, `entrada ${JSON.stringify(basura)} no debe contar como fallo`);
  }
  assert.equal(resumirErroresConsola(null).ok, true);
});

// 🔴 DESDE EL 13-oct-2026 ESTA DECISIÓN NO LA APLICA NADIE (SCRUM-1521).
//
// Aquí había un caso, «el E2E ESCUCHA la consola y comprueba al final», que leía el guion
// `e2e-critico` y exigía que tuviera el guard enchufado. Ese guion se retiró por decisión del
// fundador (Jira, SCRUM-1521 c.19145): llevaba once semanas sin correr y, cerrada el alta
// pública, ya no podía. El caso se va CON el comportamiento que comprobaba; no se relaja.
//
// Lo que queda arriba prueba QUÉ cuenta como fallo, y sigue valiendo. Lo que ya no existe es
// un recorrido que escuche una página y se lo pregunte: `_console-guard.mjs` se conserva
// (Jira, SCRUM-1521 c.19152) y está SIN CONSUMIDOR. El caso de abajo lo mide, para que el
// día que alguien lo enchufe esta nota no se quede diciendo lo contrario.
test('SCRUM-1521: `_console-guard.mjs` está sin consumidor, y se sabe', () => {
  const NOMBRE = '_console-guard.mjs';
  const miro = [];
  const lo_importan = [];
  for (const d of ['scripts', 'tests']) {
    for (const f of fs.readdirSync(path.join(raiz, d))) {
      if (!f.endsWith('.mjs') || f === NOMBRE) continue;
      miro.push(f);
      const txt = fs.readFileSync(path.join(raiz, d, f), 'utf8');
      if (new RegExp(`from\\s+['"][^'"]*${NOMBRE.replace('.', '\\.')}['"]`).test(txt)) lo_importan.push(`${d}/${f}`);
    }
  }
  assert.ok(miro.length > 0, '🔴 CIEGO: no he leído ningún .mjs de scripts/ ni de tests/.');
  // POSITIVO: este mismo fichero lo importa. Si no sale, el patrón no ve imports y el «sin
  // consumidor» de abajo sería «no he mirado».
  assert.ok(lo_importan.includes('tests/scrum183-consola-e2e.test.mjs'),
    '🔴 CIEGO: no veo ni mi propio import de `_console-guard.mjs`.');
  assert.deepEqual(lo_importan, ['tests/scrum183-consola-e2e.test.mjs'],
    '`_console-guard.mjs` vuelve a tener consumidor. Buena noticia: quita la nota de arriba y la\n' +
    'de su cabecera («SIN CONSUMIDOR desde el 13-oct-2026»), que ya no son verdad, y deja aquí un\n' +
    'caso que compruebe que el recorrido nuevo lo tiene enchufado.');
});
