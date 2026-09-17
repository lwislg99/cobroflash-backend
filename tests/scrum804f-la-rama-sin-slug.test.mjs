// SCRUM-804f · UNA RAMA `scrum-<n>` SIN SLUG ES DEL TICKET <n>. No se pierde.
//
// Sin gate: `agruparRamas` y `numeroDeRama` con poblaciones fabricadas, más los refs que `git` ya
// tiene en local. Ni BD, ni red.
//
// EL DEFECTO, medido el 17-sep-2026 sobre 2be8fe16: `main` salió ROJO en el check obligatorio
// (run 35226536503) por «SCRUM-804 · CONTROL POSITIVO DERIVADO: la agrupación no pierde ni inventa
// ramas». La rama remota `scrum-904` (PR #1423) no lleva slug, y las dos reglas no decían lo mismo:
//
//   · el test de 804 la considera canónica ........... /^scrum-(\d+)[a-z]?(?:-|$)/  → 904
//   · el instrumento (`numeroDeRama`) la descartaba ... /^scrum-0*(\d+)[a-z]?-/     → null
//
// Resultado: el censo decía SIN RASTRO sobre un ticket con rama viva, y la puerta de `main` se
// cerró para todos los PR. Si la rama se renombra, el rojo se va solo; la SIGUIENTE rama sin slug
// lo volvería a traer. Esto lo cierra en la regla, no en la rama.
//
// Por qué el guion final era obligatorio (SCRUM-738) y por qué ya no hace falta: evitaba que
// `scrum-72` casara con el principio de `scrum-727-x`. Eso lo garantiza igual el fin de cadena
// (`$`): `\d+` es voraz, así que `scrum-727-x` sigue siendo 727 y `scrum-72` es 72. Medido sobre
// los 831 nombres de rama de hoy (remotos + locales): cambia de número EXACTAMENTE 1, `scrum-904`.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { agruparRamas } from '../scripts/_censo-reparto.mjs';
import { numeroDeRama } from '../scripts/_numero-de-rama.mjs';

const RAIZ = path.join(import.meta.dirname, '..');

test('SCRUM-804f · 🔴 una rama `scrum-<n>` sin slug se agrupa bajo SU ticket, no se pierde', () => {
  const agrupadas = agruparRamas([
    'aaa\trefs/heads/scrum-904',
    'bbb\trefs/heads/scrum-300-con-slug',
    'ccc\trefs/heads/scrum-905b',
  ], () => false);
  // SUELO: la rama con slug se agrupa como siempre; si no, lo de abajo no mediría nada.
  assert.deepEqual(agrupadas.porTicket.get(300)?.map((r) => r.nombre), ['scrum-300-con-slug'],
    '🔴 NO PUDE MIRAR: ni siquiera la rama con slug se agrupa');

  assert.deepEqual(agrupadas.porTicket.get(904)?.map((r) => r.nombre), ['scrum-904'],
    '🔴 `scrum-904` no está bajo SCRUM-904: el censo dirá SIN RASTRO de un ticket con rama viva, '
    + 'y el control de 804 cerrará `main`');
  assert.deepEqual(agrupadas.porTicket.get(905)?.map((r) => r.nombre), ['scrum-905b'],
    '🔴 una fase sin slug (`scrum-905b`) no está bajo su ticket');
  assert.deepEqual(agrupadas.sinNumero, [], '🔴 hay ramas de ticket en «sin número»');
});

test('SCRUM-804f · ✅ NEGATIVO: una rama SIN NÚMERO no se atribuye a ningún ticket, y se declara', () => {
  // El límite, fijado por el orquestador (17-sep): el número lo leen las máquinas; tolerar su falta
  // sería INVENTAR a qué ticket pertenece. `scrum-paso0-dinero` existe hoy en el remoto (medido por
  // Javier sobre 150 ramas vivas).
  assert.equal(numeroDeRama('scrum-paso0-dinero'), null, '🔴 una rama sin número se ha atribuido a un ticket');
  assert.equal(numeroDeRama('scrum-'), null);
  assert.equal(numeroDeRama('scrum'), null);
  const agrupadas = agruparRamas(['aaa\trefs/heads/scrum-paso0-dinero', 'bbb\trefs/heads/scrum-904'], () => false);
  assert.deepEqual(agrupadas.sinNumero.map((r) => r.nombre), ['scrum-paso0-dinero'],
    '🔴 la rama sin número no queda DECLARADA en «sin número»: o se ha atribuido a un ticket o se ha descartado en silencio');
  assert.equal(agrupadas.total, 2, '🔴 el total no cuenta la rama sin número: se está perdiendo en silencio');
  assert.equal([...agrupadas.porTicket.values()].flat().some((r) => r.nombre === 'scrum-paso0-dinero'), false);
});

test('SCRUM-804f · ⛔ la identidad no se afloja: 72 ≠ 727, anclada, y un revert sigue sin ticket', () => {
  assert.equal(numeroDeRama('scrum-72'), 72);
  assert.equal(numeroDeRama('scrum-727'), 727, '🔴 `scrum-727` se está leyendo como 72');
  assert.equal(numeroDeRama('scrum-727-x'), 727);
  assert.equal(numeroDeRama('scrum-72b'), 72, 'la letra de fase es del mismo ticket');
  assert.equal(numeroDeRama('scrum-72bb'), null, '🔴 dos letras no son una fase');
  assert.equal(numeroDeRama('scrum-72.1'), null, '🔴 un punto tras el número no es un delimitador');
  assert.equal(numeroDeRama('feature/scrum-72'), null, '🔴 ha dejado de estar anclada al principio');
  assert.equal(numeroDeRama('revert-1192-scrum-824b'), null, '🔴 un revert vuelve a atribuirse al ticket (SCRUM-829)');
});

test('SCRUM-804f · ✅ POSITIVO sobre los refs de hoy: sólo cambian de número las ramas sin slug', () => {
  // La regla ANTERIOR, copiada aquí a propósito como referencia de lo retirado (no se usa en ningún
  // otro sitio): lo que este control mide es que el cambio no mueva a NADIE más.
  const anterior = (s) => { const m = /^scrum-0*(\d+)[a-z]?-/.exec(String(s).trim()); return m ? Number(m[1]) : null; };
  const nombres = [...new Set(
    execFileSync('git', ['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin/', 'refs/heads/'],
      { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .split('\n').map((l) => l.trim().replace(/^origin\//, '')).filter(Boolean),
  )];
  // SUELO: sin población, «no se mueve nadie» sería cierto por no mirar.
  assert.ok(nombres.filter((n) => anterior(n) !== null).length > 0,
    '🔴 NO PUDE MIRAR: `git for-each-ref` no trae ninguna rama `scrum-<n>-…`');

  const movidas = nombres.filter((n) => anterior(n) !== numeroDeRama(n));
  const noSonSinSlug = movidas.filter((n) => !/^scrum-\d+[a-z]?$/i.test(n));
  assert.deepEqual(noSonSinSlug, [],
    '🔴 el cambio de regla ha movido de número ramas que SÍ llevan slug (o que no son de ticket):\n   · '
    + noSonSinSlug.map((n) => `${n}: ${anterior(n)} → ${numeroDeRama(n)}`).join('\n   · '));
});
