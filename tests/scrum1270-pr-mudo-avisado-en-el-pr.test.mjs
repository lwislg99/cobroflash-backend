// tests/scrum1270-pr-mudo-avisado-en-el-pr.test.mjs — SCRUM-1270
//
// EL PR MUDO ≥3 h SE AVISA DENTRO DEL PR, Y DICIENDO POR QUÉ.
//
// Medido del 22 al 29-sep-2026 (328 PR, 587 cabezas empujadas): 8 cabezas estuvieron ≥1 h sin el
// check obligatorio, 5 ≥3 h y 4 ≥12 h. 6 de las 8 se desatascaron mezclando `main`. El vigía de
// atascados ya lo clasificaba, pero lo contaba en un issue que nadie lee.
//
// 🔴 El caso que manda es REAL: `008fbd51` (#1943, 28-sep) tenía UN check-run —el de
// `abrir-pr-y-armar-automerge`, que corre en todo push— y el PR estaba en conflicto. Con la regla
// de `SIN-CHECKS` («cero checks») no se habría visto nunca.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { avisoEnElPR, UMBRAL_AVISO_EN_PR_HORAS } from '../scripts/vigia-atascados.mjs';
import { cuerpoNoDebeDespertar } from '../scripts/puerta-avisador-rojo.mjs';
import { nombreEscrito } from './_casos-escritos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PASADA = path.join(RAIZ, 'scripts', 'vigia-pasada.mjs');

// El rojo, declarado: lo ejecuta `npm run meta:mutaciones`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // «Mudo» vuelve a ser «cero checks»: el caso real de #1943 deja de verse.
    fichero: 'scripts/vigia-atascados.mjs',
    de: "const mudo = conocidos ? faltan.length > 0 : fila.causa === 'SIN-CHECKS';",
    a: "const mudo = fila.causa === 'SIN-CHECKS';",
    cae: 'SCRUM-1270 · 🔴 CASO REAL #1943: en conflicto y con UN check-run (no cero) → se avisa, y dice CONFLICTO',
  },
  {
    // Se avisa también lo que NO está mudo (el conflicto con el obligatorio ya corrido).
    fichero: 'scripts/vigia-atascados.mjs',
    de: '  if (!mudo) return null;',
    a: '  if (false) return null;',
    cae: 'SCRUM-1270 · un conflicto cuyo obligatorio SÍ corrió no está mudo: no se avisa aquí (es el verde olvidado)',
  },
  {
    // La pasada detecta el mudo pero no deja el aviso para publicar.
    fichero: 'scripts/vigia-pasada.mjs',
    de: '  avisosPR.push(a);',
    a: '  void a;',
    cae: 'SCRUM-1270 · 🔴 LABORATORIO: la pasada REAL deja el aviso del mudo, y solo el del mudo',
  },
];

const OBLIGATORIOS = ['build + tests (con banco desechable)'];
const SOLO_ABRIR_PR = [{ id: 1, name: 'abrir-pr-y-armar-automerge', status: 'completed', conclusion: 'success' }];
const CON_OBLIGATORIO = [...SOLO_ABRIR_PR, { id: 2, name: 'build + tests (con banco desechable)', status: 'completed', conclusion: 'success' }];
const SHA_1943 = '008fbd51' + '0'.repeat(32);

test('SCRUM-1270 · 🔴 CASO REAL #1943: en conflicto y con UN check-run (no cero) → se avisa, y dice CONFLICTO', () => {
  const a = avisoEnElPR({ fila: { numero: 1943, causa: 'DIRTY', sinPush: 3.5 }, sha: SHA_1943, checkRuns: SOLO_ABRIR_PR, obligatorios: OBLIGATORIOS });
  assert.ok(a, 'el mudo real de anoche tiene que avisarse');
  assert.equal(a.numero, 1943);
  assert.match(a.cuerpo, /CONFLICTO con `main`/);
  assert.match(a.cuerpo, /mezclando `main`/, 'dice cómo se arregla, no solo que está mudo');
  assert.match(a.cuerpo, /build \+ tests \(con banco desechable\)/, 'nombra el check que falta');
  assert.ok(a.marca.includes(SHA_1943) && a.cuerpo.includes(a.marca), 'la marca lleva la cabeza: una vez por cabeza');
  assert.ok(cuerpoNoDebeDespertar(a.cuerpo), 'no despierta a nadie');
});

test('SCRUM-1270 · sin conflicto y sin el obligatorio (el hueco de SIN-CHECKS) → se avisa como «no arrancó»', () => {
  const a = avisoEnElPR({ fila: { numero: 1761, causa: 'ESPERANDO', sinPush: 4 }, sha: 'b'.repeat(40), checkRuns: SOLO_ABRIR_PR, obligatorios: OBLIGATORIOS });
  assert.ok(a);
  assert.match(a.cuerpo, /Sin conflicto a la vista/);
  assert.match(a.marca, /:sin-checks -->$/);
});

test('SCRUM-1270 · un conflicto cuyo obligatorio SÍ corrió no está mudo: no se avisa aquí (es el verde olvidado)', () => {
  assert.equal(avisoEnElPR({ fila: { numero: 1907, causa: 'DIRTY', sinPush: 16 }, sha: 'c'.repeat(40), checkRuns: CON_OBLIGATORIO, obligatorios: OBLIGATORIOS }), null);
});

test('SCRUM-1270 · por debajo de 3 h no se avisa (la mayoría se resuelve sola)', (t) => {
  nombreEscrito(t, `SCRUM-1270 · por debajo de ${UMBRAL_AVISO_EN_PR_HORAS} h no se avisa (la mayoría se resuelve sola)`);
  assert.equal(avisoEnElPR({ fila: { numero: 1, causa: 'DIRTY', sinPush: UMBRAL_AVISO_EN_PR_HORAS - 0.1 }, sha: SHA_1943, checkRuns: SOLO_ABRIR_PR, obligatorios: OBLIGATORIOS }), null);
  assert.ok(avisoEnElPR({ fila: { numero: 1, causa: 'DIRTY', sinPush: UMBRAL_AVISO_EN_PR_HORAS }, sha: SHA_1943, checkRuns: SOLO_ABRIR_PR, obligatorios: OBLIGATORIOS }), 'justo en el umbral, sí');
});

test('SCRUM-1270 · 🔴 sin saber qué es obligatorio no se afirma que falte: solo con CERO checks', () => {
  assert.equal(avisoEnElPR({ fila: { numero: 1, causa: 'DIRTY', sinPush: 5 }, sha: SHA_1943, checkRuns: SOLO_ABRIR_PR, obligatorios: null }), null);
  assert.ok(avisoEnElPR({ fila: { numero: 1, causa: 'SIN-CHECKS', sinPush: 5 }, sha: SHA_1943, checkRuns: [], obligatorios: null }));
  assert.equal(avisoEnElPR({ fila: { numero: 1, causa: 'DIRTY', sinPush: 5 }, sha: null, checkRuns: SOLO_ABRIR_PR, obligatorios: OBLIGATORIOS }), null, 'sin cabeza no hay marca: no se avisa');
});

// ── LABORATORIO: la pasada REAL, con las reglas en la forma que devuelve la API ───────────────
function pr(numero, sha, horas = 20) {
  const hace = new Date(Date.now() - horas * 3600000).toISOString();
  return { number: numero, title: `PR ${numero}`, author: { login: 'yaqu-bot[bot]' }, isDraft: false, labels: [], autoMergeRequest: { enabledAt: hace }, createdAt: hace, updatedAt: hace, headRefOid: sha };
}

test('SCRUM-1270 · 🔴 LABORATORIO: la pasada REAL deja el aviso del mudo, y solo el del mudo', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vigia-1270-'));
  try {
    const prs = [pr(1943, SHA_1943), pr(1907, 'c'.repeat(40)), pr(1999, 'd'.repeat(40))];
    fs.writeFileSync(path.join(dir, 'prs.json'), JSON.stringify(prs));
    // numero|mergeStateStatus|nº check-runs|minutos desde el push|sonda
    fs.writeFileSync(path.join(dir, 'estados.txt'), ['1943|DIRTY|1|300|true', '1907|DIRTY|2|960|true', '1999|DIRTY|1|60|true'].join('\n') + '\n');
    fs.writeFileSync(path.join(dir, 'reglas.json'), JSON.stringify([{ type: 'required_status_checks', parameters: { required_status_checks: OBLIGATORIOS.map((context) => ({ context })) } }]));
    fs.mkdirSync(path.join(dir, 'checks'));
    fs.writeFileSync(path.join(dir, 'checks', '1943.json'), JSON.stringify({ total_count: 1, check_runs: SOLO_ABRIR_PR }));
    fs.writeFileSync(path.join(dir, 'checks', '1907.json'), JSON.stringify({ total_count: 2, check_runs: CON_OBLIGATORIO }));
    fs.writeFileSync(path.join(dir, 'checks', '1999.json'), JSON.stringify({ total_count: 1, check_runs: SOLO_ABRIR_PR }));
    execFileSync(process.execPath, [PASADA], { cwd: dir, encoding: 'utf8', stdio: 'pipe', env: { ...process.env, ANTES: '[]', DUENO: 'lwislg99' } });
    const avisos = JSON.parse(fs.readFileSync(path.join(dir, 'avisos-pr.json'), 'utf8'));
    assert.deepEqual(avisos.map((a) => a.numero), [1943],
      '#1943 (mudo 5 h) sí; #1907 (el obligatorio corrió) no; #1999 (mudo 1 h, bajo el umbral) no');
    assert.match(avisos[0].cuerpo, /CONFLICTO/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('SCRUM-1270 · el workflow publica en el PR, una vez por cabeza, y no avisa a ciegas', () => {
  const yml = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'vigia-atascados.yml'), 'utf8');
  const codigo = yml.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.match(codigo, /pull-requests: write/, 'sin este permiso el comentario en el PR no sale');
  assert.match(codigo, /gh pr comment "\$N" --body-file aviso-pr\.md/);
  assert.match(codigo, /grep -qF -- "\$MARCA"/, 'la marca de la cabeza evita repetir en cada pasada');
  assert.match(codigo, /NO-SE-PUDO-MIRAR/, 'si no puede leer los comentarios, lo dice y no publica');
});
