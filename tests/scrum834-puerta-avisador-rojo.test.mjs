// SCRUM-834 — la puerta del avisador de PR en rojo.
//
// LOS DOS CONTROLES QUE PIDIÓ EL ENCARGO, y son dos por un motivo: «un guardia que nunca has
// visto decir NO no sabes si sabe decirlo». Así que se ejercen las dos direcciones —el rojo
// propio que SÍ despierta, y el fork que NO— y además se comprueba que el «no» viene con su
// código, no con silencio.
//
// SIN GATE: función pura + lectura de dos ficheros. Ni BD, ni red, ni servidor.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decidir, esDeFork, cuerpoDespierta, BOT } from '../scripts/puerta-avisador-rojo.mjs';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WORKFLOW = path.join(REPO, '.github', 'workflows', 'avisador-rojo.yml');
const CLAUDE_YML = path.join(REPO, '.github', 'workflows', 'claude.yml');

const NUESTRO = 'lwislg99/cobroflash-backend';
/** Un PR nuestro, abierto por el bot, con el CI en rojo y sin avisos previos. */
const base = {
  conclusionCI: 'failure',
  repoBase: NUESTRO,
  repoOrigen: NUESTRO,
  autor: BOT,
  permisoAutor: '',
  marcasPrevias: [],
  marcaActual: 'abc1234:build + tests',
  tope: 3,
};

// ── CONTROL 1 · EL ROJO PROPIO DESPIERTA ───────────────────────────────────────────────────

test('CONTROL 1 · rojo en un PR NUESTRO abierto por el bot → AVISAR', () => {
  const r = decidir(base);
  assert.equal(r.avisar, true, 'si esto no despierta, el avisador no está hecho');
  assert.equal(r.codigo, 'AVISAR');
});

test('CONTROL 1b · también despierta si lo abrió una persona CON escritura', () => {
  const r = decidir({ ...base, autor: 'lwislg99', permisoAutor: 'admin' });
  assert.equal(r.avisar, true);
});

// ── CONTROL 2 · EL FORK NO DESPIERTA, Y LO DICE ────────────────────────────────────────────
// Es la condición sin la cual esto no se construye. `allowed_bots` desactiva la comprobación
// de permisos de la acción, y el repositorio es PÚBLICO: sin esta puerta, un desconocido
// podría despertar a Claude sobre un prompt que él controla.

test('CONTROL 2 · 🔴 PR de FORK con CI rojo → NO avisa, y lo DICE', () => {
  const r = decidir({ ...base, repoOrigen: 'desconocido/cobroflash-backend' });
  assert.equal(r.avisar, false, 'un PR de fork no despierta a Claude nunca');
  assert.equal(r.codigo, 'FORK-NO-DESPIERTA', 'el «no» tiene que venir con su código, no con silencio');
  assert.match(r.motivo, /fork/i);
});

test('CONTROL 2b · fork del MISMO dueño con otro nombre de repo → también fork', () => {
  // Se comparan nombres completos `owner/repo`: mirar solo el owner dejaría pasar un espejo.
  const r = decidir({ ...base, repoOrigen: 'lwislg99/otro-repo' });
  assert.equal(r.codigo, 'FORK-NO-DESPIERTA');
});

test('CONTROL 2c · `head.repo` a null (fork borrado) → se trata como fork', () => {
  assert.equal(esDeFork({ repoBase: NUESTRO, repoOrigen: null }), true);
  assert.equal(decidir({ ...base, repoOrigen: null }).codigo, 'FORK-NO-DESPIERTA');
});

// ── LA SEGUNDA MITAD DE LA PUERTA: EL PERMISO, PREGUNTADO OTRA VEZ ─────────────────────────

test('🔴 PR propio pero de una cuenta SIN escritura → no avisa', () => {
  const r = decidir({ ...base, autor: 'alguien', permisoAutor: 'read' });
  assert.equal(r.avisar, false);
  assert.equal(r.codigo, 'AUTOR-SIN-ESCRITURA');
});

test('🔴 permiso desconocido o vacío → no avisa (falla cerrado)', () => {
  assert.equal(decidir({ ...base, autor: 'x', permisoAutor: '' }).codigo, 'AUTOR-SIN-ESCRITURA');
  assert.equal(decidir({ ...base, autor: 'x', permisoAutor: 'triage' }).codigo, 'AUTOR-SIN-ESCRITURA');
});

// ── QUE NO AVISE DOS VECES, Y QUE EL BUCLE TENGA TOPE ──────────────────────────────────────

test('el MISMO rojo no se avisa dos veces', () => {
  const r = decidir({ ...base, marcasPrevias: ['abc1234:build + tests'] });
  assert.equal(r.avisar, false);
  assert.equal(r.codigo, 'YA-AVISADO');
});

test('un rojo NUEVO sobre un commit nuevo SÍ avisa (la marca lleva el sha dentro)', () => {
  const r = decidir({ ...base, marcasPrevias: ['abc1234:build + tests'], marcaActual: 'def5678:build + tests' });
  assert.equal(r.avisar, true, 'si no, un arreglo que falla otra vez no avisaría nunca');
});

test('🔴 el tope corta el bucle CI→aviso→push→CI', () => {
  const previas = ['a:x', 'b:y', 'c:z'];
  const r = decidir({ ...base, marcasPrevias: previas, marcaActual: 'd:w', tope: 3 });
  assert.equal(r.avisar, false);
  assert.equal(r.codigo, 'TOPE-ALCANZADO');
});

test('sin marca no se puede saber si ya se avisó → no se avisa', () => {
  assert.equal(decidir({ ...base, marcaActual: '' }).codigo, 'SIN-MARCA');
});

// ── Y QUE NO SE DISPARE CUANDO NO HAY ROJO ────────────────────────────────────────────────

test('CI verde → SIN-ROJOS (no es asunto del avisador)', () => {
  assert.equal(decidir({ ...base, conclusionCI: 'success' }).codigo, 'SIN-ROJOS');
});

test('CI cancelado no es un rojo', () => {
  assert.equal(decidir({ ...base, conclusionCI: 'cancelled' }).codigo, 'SIN-ROJOS');
});

// ── EL ESPEJO DE LA REGLA DEL VIGÍA ───────────────────────────────────────────────────────

test('🔴 un cuerpo SIN `@claude` no despierta a nadie: el avisador debe abortar', () => {
  assert.equal(cuerpoDespierta('El CI de este PR está en rojo.'), false,
    'sin esa cadena, claude.yml no dispara: el comentario saldría y no pasaría nada');
  assert.equal(cuerpoDespierta(''), false);
});

test('un cuerpo CON la mención sí despierta', () => {
  assert.equal(cuerpoDespierta('@claude el CI está en rojo'), true);
});

// ── QUE EL WORKFLOW SIGA USANDO ESTA PUERTA ───────────────────────────────────────────────
// Una puerta correcta que el workflow no invoca no protege de nada.

test('el workflow invoca la puerta y comprueba el cuerpo antes de publicar', () => {
  const yml = fs.readFileSync(WORKFLOW, 'utf8');
  assert.match(yml, /puerta-avisador-rojo\.mjs/, 'el workflow debe llamar a la puerta');
  assert.match(yml, /cuerpoDespierta/, 'debe comprobar el cuerpo DENTRO del script, no en un README');
});

test('🔴 `allowed_bots` nombra al bot LITERAL y nunca un comodín', () => {
  const yml = fs.readFileSync(CLAUDE_YML, 'utf8');
  // Sin comentarios: la prosa que explica la prohibición escribe el comodín y se cazaría sola.
  const soloCodigo = yml.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.match(soloCodigo, /allowed_bots:\s*["']?yaqu-bot\[bot\]/,
    'sin allowed_bots el aviso se publica y no despierta a nadie');
  assert.ok(!/allowed_bots:\s*["']?\*/.test(soloCodigo),
    'JAMÁS el comodín: a los bots permitidos no se les comprueban los permisos, y el repo es público');
});
