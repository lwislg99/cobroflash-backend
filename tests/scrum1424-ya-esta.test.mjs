// SCRUM-1424 · «¿ESTO YA ESTÁ HECHO?» — el comando que se corre antes de repartir un ticket.
//
// El 2-oct-2026 se encargaron cinco veces cosas ya hechas (el detalle, en `docs/master/SCRUM-1424.md`).
// `scripts/equipo/ya-esta.mjs` contesta una de TRES cosas, y lo que aquí se sujeta es que la tercera
// —«no he podido mirar»— no se pueda leer nunca como la segunda —«no está»—.
//
// Dos mitades: lo PURO, con casos fabricados (el veredicto y el informe), y el COMANDO de verdad,
// lanzado contra un repositorio de juguete que se crea y se tira aquí. No se lanza contra el
// repositorio real: lo que hay en `main` cambia cada hora, y en CI el clon puede ser superficial.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  veredictoDe, informe, ultimaAncla, YA_ESTA, NO_ESTA, NO_PUDE, SALIDA_MIRADO, SALIDA_CIEGO,
} from '../scripts/equipo/ya-esta.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GUION = path.join(RAIZ, 'scripts', 'equipo', 'ya-esta.mjs');
const nada = (extra = {}) => ({ ciegos: [], registros: [], evidencias: [], commits: [], ramasEnMain: [], ramasVivas: [], cierresAjenos: [], citas: [], ...extra });
const SHA = 'a'.repeat(40);

// ── lo puro ──────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1424 · YA ESTÁ: cualquier trabajo propio en main basta, y dice DESDE la fecha más antigua', () => {
  const v = veredictoDe(nada({
    registros: [{ fichero: 'docs/master/SCRUM-7.md', primera: '2026-09-29', ultima: '2026-10-02', ancla: null }],
    commits: [{ sha: 'abc1234', fecha: '2026-09-27', asunto: 'SCRUM-7: x' }, { sha: 'def5678', fecha: '2026-10-01', asunto: 'SCRUM-7: y' }],
  }));
  assert.equal(v.respuesta, YA_ESTA);
  assert.equal(v.desde, '2026-09-27');
  assert.equal(v.salida, SALIDA_MIRADO);
  for (const solo of [
    { evidencias: [{ carpeta: 'docs/master/evidencias/SCRUM-7', ficheros: 3, primera: '2026-10-01' }] },
    { commits: [{ sha: 'abc1234', fecha: '2026-10-01', asunto: 'SCRUM-7: x' }] },
    { ramasEnMain: [{ nombre: 'scrum-7-x', fecha: '2026-10-01' }] },
  ]) assert.equal(veredictoDe(nada(solo)).respuesta, YA_ESTA, JSON.stringify(Object.keys(solo)));
});

test('SCRUM-1424 · NO ESTÁ: sin nada propio en main; una rama VIVA o una cita ajena no lo convierten en «ya está»', () => {
  assert.equal(veredictoDe(nada()).respuesta, NO_ESTA);
  const v = veredictoDe(nada({
    ramasVivas: [{ nombre: 'scrum-7-x', fecha: '2026-10-02', adelanto: 3 }],
    citas: [{ fichero: 'docs/master/SCRUM-9.md', lineas: 2 }],
    cierresAjenos: [{ fichero: 'docs/master/SCRUM-9.md', linea: 4, texto: 'SCRUM-7 queda cubierto aquí' }],
  }));
  assert.equal(v.respuesta, NO_ESTA);
  assert.equal(v.salida, SALIDA_MIRADO);
});

test('SCRUM-1424 · NO HE PODIDO MIRAR gana a todo: con un ciego, ni «ya está» ni «no está», y sale 2', () => {
  // Aunque haya trabajo visto: si algo no se pudo mirar, la respuesta entera no vale.
  const conTrabajo = veredictoDe(nada({ ciegos: ['no se pudo traer origin'], commits: [{ sha: 'abc1234', fecha: '2026-10-01', asunto: 'SCRUM-7: x' }] }));
  const sinTrabajo = veredictoDe(nada({ ciegos: ['no se pudo listar docs/master'] }));
  for (const v of [conTrabajo, sinTrabajo]) {
    assert.equal(v.respuesta, NO_PUDE);
    assert.equal(v.salida, SALIDA_CIEGO);
    assert.notEqual(v.salida, SALIDA_MIRADO);
  }
});

test('SCRUM-1424 · el informe lleva la respuesta en la PRIMERA línea y no calla lo que no mira', () => {
  const h = nada({
    registros: [{ fichero: 'docs/master/SCRUM-7.md', primera: '2026-09-29', ultima: '2026-10-02', ancla: { sha: SHA, cuando: '2026-10-02T12:00:00Z' } }],
    evidencias: [{ carpeta: 'docs/master/evidencias/SCRUM-7', ficheros: 12, primera: '2026-09-30' }],
    ramasVivas: [{ nombre: 'scrum-7b-otra', fecha: '2026-10-02', adelanto: 2 }],
    cierresAjenos: [{ fichero: 'docs/master/SCRUM-9.md', linea: 4, texto: 'SCRUM-7 queda cubierto aquí' }],
    citas: [{ fichero: 'docs/master/SCRUM-9.md', lineas: 2 }, { fichero: 'docs/master/evidencias/SCRUM-9/a.tsv', lineas: 40 }],
  });
  const ya = informe(7, h, veredictoDe(h), { main: SHA, ms: 2100 });
  assert.match(ya[0], /SCRUM-7 · YA ESTÁ en origin\/main · DESDE el 2026-09-29/);
  const texto = ya.join('\n');
  assert.match(texto, /NO dice que esté TERMINADO/);
  assert.match(texto, /última ancla aaaaaaaa · 2026-10-02T12:00:00Z/);
  assert.match(texto, /evidencias\/SCRUM-7\/ · 12 fichero\(s\)/);
  assert.match(texto, /scrum-7b-otra · 🟡 VIVA, SIN MERGEAR · 2 commit/);
  assert.match(texto, /docs\/master\/SCRUM-9\.md:4 «SCRUM-7 queda cubierto aquí»/);
  // Un registro ajeno se nombra; un fichero de datos se cuenta aparte y no encabeza la lista.
  assert.match(texto, /1 registro\(s\) AJENO\(S\) lo nombran/);
  assert.match(texto, /y en datos · 1 fichero/);
  assert.match(texto, /NO MIRADO {2}· Jira/);

  const no = informe(8, nada(), veredictoDe(nada()), { main: SHA, ms: 900 });
  assert.match(no[0], /SCRUM-8 · NO ESTÁ en origin\/main con ese número$/);
  assert.match(no.join('\n'), /NO es «sin hacer»/);
  assert.match(no.join('\n'), /NO MIRADO {2}· Jira/);

  const viva = nada({ ramasVivas: [{ nombre: 'scrum-8-x', fecha: '2026-10-02', adelanto: 1 }] });
  assert.match(informe(8, viva, veredictoDe(viva), {})[0], /NO ESTÁ.*PERO hay 1 rama\(s\) suya\(s\) VIVA\(S\)/);

  const ciego = nada({ ciegos: ['no se pudo traer `origin`'] });
  const c = informe(9, ciego, veredictoDe(ciego), {});
  assert.match(c[0], /SCRUM-9 · NO HE PODIDO MIRAR/);
  assert.match(c.join('\n'), /no se pudo traer `origin`/);
  assert.match(c.join('\n'), /NO quiere decir que no esté hecho/);
  assert.doesNotMatch(c.join('\n'), /NO ESTÁ en origin/);
});

test('SCRUM-1424 · la última ancla de un registro es la ÚLTIMA, y sin ancla es null (no una fecha inventada)', () => {
  const dos = `**Medido contra:** \`origin/main\` = \`${'b'.repeat(40)}\` · 2026-09-30T10:00:00Z\n\ntexto\n\n**Medido contra:** \`origin/main\` = \`${SHA}\` · 2026-10-02T12:28:18Z\n`;
  assert.deepEqual(ultimaAncla(dos), { sha: SHA, cuando: '2026-10-02T12:28:18Z' });
  assert.equal(ultimaAncla('# SCRUM-7\n\nsin ancla'), null);
  assert.equal(ultimaAncla(''), null);
});

// ── el comando de verdad, contra un repositorio de juguete ─────────────────────────────────────

/** Un `origin` y un clon suyo, con un ticket (41) hecho en main, otro (42) sólo en rama viva. */
function juguete() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-ya-esta-'));
  const origen = path.join(base, 'origen.git'); const clon = path.join(base, 'clon');
  const g = (dir, ...a) => execFileSync('git', ['-C', dir, '-c', 'user.name=prueba', '-c', 'user.email=prueba@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  execFileSync('git', ['init', '--quiet', '--bare', '--initial-branch=main', origen]);
  execFileSync('git', ['clone', '--quiet', origen, clon], { stdio: 'ignore' });
  const escribir = (rel, txt) => { const r = path.join(clon, rel); fs.mkdirSync(path.dirname(r), { recursive: true }); fs.writeFileSync(r, txt); };
  g(clon, 'checkout', '--quiet', '-b', 'main');
  escribir('docs/master/SCRUM-41.md', `# SCRUM-41 · una cosa hecha\n\n**Medido contra:** \`origin/main\` = \`${SHA}\` · 2026-10-01T09:00:00Z\n\nhecho.\n`);
  escribir('docs/master/evidencias/SCRUM-41/datos.tsv', 'a\tb\n1\t2\n');
  escribir('docs/master/SCRUM-40.md', '# SCRUM-40 · otra\n\nSCRUM-43 queda cubierto aquí, no hace falta otro ticket.\n');
  g(clon, 'add', '-A'); g(clon, 'commit', '--quiet', '-m', 'SCRUM-41: una cosa hecha');
  g(clon, 'push', '--quiet', 'origin', 'main');
  g(clon, 'checkout', '--quiet', '-b', 'scrum-42-a-medias');
  escribir('a-medias.txt', 'x\n'); g(clon, 'add', '-A'); g(clon, 'commit', '--quiet', '-m', 'SCRUM-42: a medias');
  g(clon, 'push', '--quiet', 'origin', 'scrum-42-a-medias');
  g(clon, 'checkout', '--quiet', 'main'); g(clon, 'fetch', '--quiet', 'origin');
  return { base, clon, origen };
}
const lanzar = (clon, ...args) => spawnSync(process.execPath, [GUION, ...args, '--raiz', clon], { encoding: 'utf8', timeout: 60000 });

test('SCRUM-1424 · el COMANDO: un ticket que SÍ está sale YA ESTÁ con su fecha, su registro y sus evidencias', (t) => {
  const j = juguete(); t.after(() => fs.rmSync(j.base, { recursive: true, force: true }));
  const r = lanzar(j.clon, '41');
  assert.equal(r.status, SALIDA_MIRADO, r.stdout + r.stderr);
  const primera = r.stdout.split('\n')[0];
  assert.match(primera, /SCRUM-41 · YA ESTÁ en origin\/main · DESDE el \d{4}-\d{2}-\d{2}/);
  assert.match(r.stdout, /registro {3}· docs\/master\/SCRUM-41\.md .* última ancla aaaaaaaa · 2026-10-01T09:00:00Z/);
  assert.match(r.stdout, /evidencias · docs\/master\/evidencias\/SCRUM-41\/ · 1 fichero/);
  assert.match(r.stdout, /commits {4}· 1 en main lo nombran/);
});

test('SCRUM-1424 · el COMANDO: uno inventado sale NO ESTÁ; uno con sólo rama viva, NO ESTÁ y lo avisa; uno cubierto por otro, se enseña la línea', (t) => {
  const j = juguete(); t.after(() => fs.rmSync(j.base, { recursive: true, force: true }));
  const inventado = lanzar(j.clon, '99');
  assert.equal(inventado.status, SALIDA_MIRADO, inventado.stdout + inventado.stderr);
  assert.match(inventado.stdout.split('\n')[0], /SCRUM-99 · NO ESTÁ en origin\/main con ese número$/);

  const viva = lanzar(j.clon, '42');
  assert.equal(viva.status, SALIDA_MIRADO, viva.stdout + viva.stderr);
  assert.match(viva.stdout.split('\n')[0], /SCRUM-42 · NO ESTÁ .* PERO hay 1 rama\(s\) suya\(s\) VIVA\(S\)/);
  assert.match(viva.stdout, /scrum-42-a-medias · 🟡 VIVA, SIN MERGEAR · 1 commit/);

  const cubierto = lanzar(j.clon, '43');
  assert.match(cubierto.stdout.split('\n')[0], /SCRUM-43 · NO ESTÁ/);
  assert.match(cubierto.stdout, /OTROS registros lo dan por hecho o cubierto \(1 línea/);
  assert.match(cubierto.stdout, /docs\/master\/SCRUM-40\.md:3 «SCRUM-43 queda cubierto aquí/);
});

test('SCRUM-1424 · el COMANDO, CIEGO: con el acceso cortado dice NO HE PODIDO MIRAR y sale 2, nunca «no está»', (t) => {
  const j = juguete(); t.after(() => fs.rmSync(j.base, { recursive: true, force: true }));
  // ① el remoto desaparece: no se puede traer, y lo que hay en disco puede ser viejo.
  fs.rmSync(j.origen, { recursive: true, force: true });
  const sinRemoto = lanzar(j.clon, '41');
  assert.equal(sinRemoto.status, SALIDA_CIEGO, sinRemoto.stdout + sinRemoto.stderr);
  assert.match(sinRemoto.stdout.split('\n')[0], /SCRUM-41 · NO HE PODIDO MIRAR/);
  assert.match(sinRemoto.stdout, /no se pudo traer `origin`/);
  assert.doesNotMatch(sinRemoto.stdout, /YA ESTÁ|NO ESTÁ en origin/);
  // ② la referencia no existe.
  const sinRef = lanzar(j.clon, '41', '--sin-traer', '--ref', 'origin/no-existe');
  assert.equal(sinRef.status, SALIDA_CIEGO);
  assert.match(sinRef.stdout.split('\n')[0], /NO HE PODIDO MIRAR/);
  // ③ la carpeta no es un repositorio.
  const vacio = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-ya-esta-vacio-'));
  t.after(() => fs.rmSync(vacio, { recursive: true, force: true }));
  const sinRepo = lanzar(vacio, '41');
  assert.equal(sinRepo.status, SALIDA_CIEGO);
  assert.match(sinRepo.stdout.split('\n')[0], /NO HE PODIDO MIRAR/);
  // ④ sin número.
  const sinNumero = spawnSync(process.execPath, [GUION], { encoding: 'utf8' });
  assert.equal(sinNumero.status, SALIDA_CIEGO);
  assert.match(sinNumero.stdout, /NO HE PODIDO MIRAR: falta el número/);
});
