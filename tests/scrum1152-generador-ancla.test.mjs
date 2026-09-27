// tests/scrum1152-generador-ancla.test.mjs — SCRUM-1152
//
// El ancla de SCRUM-267 tumbó cinco veces en dos días por el mismo motivo: un dato a mano del que
// se olvida la mitad. Este fichero comprueba que `scripts/equipo/ancla.mjs` deriva el sha y la
// hora en vez de dejarlos a que alguien los teclee, y que lo que imprime CASA de verdad con el
// `RE_ANCLA` real del guard — no una copia del patrón, el mismo que usa `npm run guards:entrada`.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generarAncla, shaDeOriginMain, instanteDeGithub } from '../scripts/equipo/ancla.mjs';
import { RE_ANCLA } from './scrum267-ancla-de-medicion.test.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHA_BUENO = '9d66dd2585e25c307d3f4f1f469223b2e91c179b';

const gitQueDevuelve = (stdout, status = 0) => () => ({ status, stdout, error: null });
const ghQueDevuelve = (stdout, status = 0) => () => ({ status, stdout, error: null });
const ghQueNoExiste = () => ({ status: null, stdout: '', error: { code: 'ENOENT' } });

test('SCRUM-1152 · el camino feliz: sha de 40 + hora ISO con `Z`, y CASA con el RE_ANCLA real del guard', () => {
  const git = gitQueDevuelve(`${SHA_BUENO}\n`);
  const gh = ghQueDevuelve('HTTP/2 200\r\ndate: Sat, 26 Sep 2026 12:14:55 GMT\r\n\r\n"algo"');
  const r = generarAncla({ git, gh });
  assert.equal(r.ok, true, `🔴 ${JSON.stringify(r)}`);
  assert.equal(r.linea, `**Medido contra:** \`origin/main\` = \`${SHA_BUENO}\` · 2026-09-26T12:14:55Z`);
  const cuerpo = `# SCRUM-9999 · prueba\n\n**Fecha:** x\n${r.linea}\n**Rama:** x\n`;
  assert.match(cuerpo, RE_ANCLA, '🔴 el ancla generada no casa con el RE_ANCLA real: el guard la rechazaría igual');
});

test('SCRUM-1152 · un `gh` que no existe (ENOENT) prueba el SIGUIENTE de la lista', () => {
  const git = gitQueDevuelve(`${SHA_BUENO}\n`);
  let llamadas = 0;
  const gh = (bin) => {
    llamadas += 1;
    if (bin === 'gh') return ghQueNoExiste();
    return { status: 0, stdout: 'date: Sat, 26 Sep 2026 12:14:55 GMT\r\n', error: null };
  };
  const r = generarAncla({ git, gh, rutasGh: ['gh', 'C:\\ruta\\de-verdad\\gh.exe'] });
  assert.equal(r.ok, true, `🔴 ${JSON.stringify(r)}`);
  assert.equal(llamadas, 2, '🔴 no probó el segundo binario tras el ENOENT del primero');
});

test('SCRUM-1152 · 🔴 FAIL-CLOSED: si NINGÚN `gh` responde, NO PUDE MIRAR — nunca el reloj local', () => {
  const git = gitQueDevuelve(`${SHA_BUENO}\n`);
  const gh = () => ghQueNoExiste();
  const r = generarAncla({ git, gh });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /ningún .gh. respondió/);
});

test('SCRUM-1152 · 🔴 FAIL-CLOSED: un `gh` que existe pero falla (status≠0) NO prueba otro binario, ni inventa la hora', () => {
  const git = gitQueDevuelve(`${SHA_BUENO}\n`);
  let llamadas = 0;
  const gh = () => { llamadas += 1; return { status: 1, stdout: '', error: null }; };
  const r = generarAncla({ git, gh, rutasGh: ['gh', 'otro-mas'] });
  assert.equal(r.ok, false);
  assert.equal(llamadas, 1, '🔴 un fallo de verdad (no ENOENT) se enmascaró reintentando con otro binario');
});

test('SCRUM-1152 · 🔴 FAIL-CLOSED: `git rev-parse` sin un sha de 40 hex → NO PUDE MIRAR', () => {
  const git = gitQueDevuelve('no-es-un-sha\n');
  const gh = ghQueDevuelve('date: Sat, 26 Sep 2026 12:14:55 GMT\r\n');
  const r = generarAncla({ git, gh });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /sha de 40 hex/);
});

test('SCRUM-1152 · 🔴 FAIL-CLOSED: `git rev-parse` con status≠0 (no es un repo, o no existe `origin/main`) → NO PUDE MIRAR', () => {
  const git = gitQueDevuelve('', 128);
  const r = shaDeOriginMain(git);
  assert.equal(r, null);
});

test('SCRUM-1152 · una cabecera `Date:` que no se puede parsear → NO PUDE MIRAR, no un `Invalid Date`', () => {
  const gh = ghQueDevuelve('date: esto-no-es-una-fecha\r\n');
  assert.equal(instanteDeGithub(gh), null);
});

test('SCRUM-1152 · SUELO: el script real, ejecutado de verdad contra ESTE repo, imprime un ancla que casa con RE_ANCLA', async (t) => {
  // Sin dobles: el control de que el generador funciona en la máquina real, no solo con stubs.
  // El `git rev-parse` SIEMPRE tiene que responder (el checkout ya trae el repo); el `gh api`
  // puede no responder en un runner sin `GH_TOKEN` para llamadas ad-hoc — eso es un hueco del
  // ENTORNO, no del generador (que ya se probó fail-closed arriba con dobles), así que se declara
  // y se salta en vez de fallar.
  const url = pathToFileURL(path.join(RAIZ, 'scripts', 'equipo', 'ancla.mjs')).href;
  const { generarAncla: real, shaDeOriginMain: shaReal } = await import(url);
  assert.notEqual(shaReal(), null, '🔴 `git rev-parse origin/main` no respondió en ESTE checkout: eso sí es un fallo real');
  const r = real();
  if (!r.ok) {
    t.skip(`el entorno no deja leer la hora de GitHub aquí: ${r.motivo}`);
    return;
  }
  const cuerpo = `# SCRUM-9999 · prueba\n\n**Fecha:** x\n${r.linea}\n**Rama:** x\n`;
  assert.match(cuerpo, RE_ANCLA);
});
