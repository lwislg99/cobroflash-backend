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
  duenoDelAsunto, repartirCommits,
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
const lanzar = (clon, ...args) => {
  // El hijo no hereda el reporter, el color ni el contexto de test de quien lo lanza (SCRUM-1349).
  const entornoHijo = { ...process.env };
  delete entornoHijo.FORCE_COLOR;
  delete entornoHijo.NODE_OPTIONS;
  delete entornoHijo.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, [GUION, ...args, '--raiz', clon], { encoding: 'utf8', timeout: 60000, env: entornoHijo });
};

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
  const entornoSinNumero = { ...process.env };
  delete entornoSinNumero.FORCE_COLOR;
  delete entornoSinNumero.NODE_OPTIONS;
  delete entornoSinNumero.NODE_TEST_CONTEXT;
  const sinNumero = spawnSync(process.execPath, [GUION], { encoding: 'utf8', env: entornoSinNumero });
  assert.equal(sinNumero.status, SALIDA_CIEGO);
  assert.match(sinNumero.stdout, /NO HE PODIDO MIRAR: falta el número/);
});

// ══ SCRUM-1454 · el commit de OTRO ticket que lo nombra, y preguntar por varios a la vez ══════════
//
// Medido el 6-oct-2026: `ya-esta 1434` decía YA ESTÁ y 1434 estaba «Por hacer». Lo único «suyo» era
// `da3798df SCRUM-1123c: … y el ticket abierto (SCRUM-1434)`: un commit de 1123 que lo ABRE. Y el mismo
// día el orquestador preguntó por 40 tickets con un bucle propio y `2>/dev/null`, y leyó 40 vacíos como
// «no hay nada». Los asuntos de abajo son los de verdad, recortados.
const ASUNTO_AJENO = 'SCRUM-1123c: el censo rescatado y su desmentido viajan juntos; linea A9 y el ticket abierto (SCRUM-1434)';

test('SCRUM-1454 · de quién es un commit lo dice el PRIMER ticket de su asunto, no cualquiera que nombre', () => {
  assert.equal(duenoDelAsunto(ASUNTO_AJENO), 1123);
  assert.equal(duenoDelAsunto('SCRUM-1434: el paso no puede morir antes del exit 0'), 1434);
  assert.equal(duenoDelAsunto('SCRUM-684b: la fase B'), 684);
  assert.equal(duenoDelAsunto('feat(quotes): el recordatorio (SCRUM-7)'), 7);
  assert.equal(duenoDelAsunto('Merge pull request #2148 from lwislg99/scrum-1419-canceladas-de-pr'), 1419);
  assert.equal(duenoDelAsunto("Merge remote-tracking branch 'origin/main' into scrum-1424-ya-esta"), 1424);
  assert.equal(duenoDelAsunto('arreglo sin ticket'), null);

  const c = (asunto) => ({ sha: 'abc1234', fecha: '2026-10-02', asunto });
  const r = repartirCommits(1434, [c(ASUNTO_AJENO), c('SCRUM-1434: lo suyo')]);
  assert.deepEqual(r.propios.map((x) => x.asunto), ['SCRUM-1434: lo suyo']);
  assert.deepEqual(r.ajenos.map((x) => [x.asunto, x.dueno]), [[ASUNTO_AJENO, 1123]]);
  // El mismo commit, preguntado por su dueño, SÍ es suyo: no se pierde, cambia de lado.
  assert.equal(repartirCommits(1123, [c(ASUNTO_AJENO)]).propios.length, 1);
  // 🔴 El caso exacto: con sólo ese commit, 1434 NO ESTÁ.
  const solo = repartirCommits(1434, [c(ASUNTO_AJENO)]);
  const h = nada({ commits: solo.propios, commitsAjenos: solo.ajenos });
  assert.equal(veredictoDe(h).respuesta, NO_ESTA);
  const texto = informe(1434, h, veredictoDe(h), { main: SHA }).join('\n');
  assert.match(texto, /1 commit\(s\) de OTRO ticket lo citan en su asunto/);
  assert.match(texto, /abc1234 2026-10-02 \(es de SCRUM-1123\)/);
});

/** El juguete, más un commit de SCRUM-50 que abre SCRUM-51 nombrándolo en su asunto. */
function jugueteConAjeno() {
  const j = juguete();
  const g = (...a) => execFileSync('git', ['-C', j.clon, '-c', 'user.name=prueba', '-c', 'user.email=prueba@example.invalid', '-c', 'commit.gpgsign=false', ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  // Commit VACÍO: lo que se prueba es el asunto, y así el test no crea ningún fichero (SCRUM-824).
  g('commit', '--quiet', '--allow-empty', '-m', 'SCRUM-50c: el censo y su desmentido; y el ticket abierto (SCRUM-51)');
  g('push', '--quiet', 'origin', 'main'); g('fetch', '--quiet', 'origin');
  return j;
}

test('SCRUM-1454 · el COMANDO: un ticket que sólo NOMBRA un commit ajeno sale NO ESTÁ, y el commit se enseña con su dueño', (t) => {
  const j = jugueteConAjeno(); t.after(() => fs.rmSync(j.base, { recursive: true, force: true }));
  const abierto = lanzar(j.clon, '51');
  assert.equal(abierto.status, SALIDA_MIRADO, abierto.stdout + abierto.stderr);
  assert.match(abierto.stdout.split('\n')[0], /SCRUM-51 · NO ESTÁ en origin\/main con ese número/);
  assert.match(abierto.stdout, /commits {4}· ninguno de main es suyo/);
  assert.match(abierto.stdout, /1 commit\(s\) de OTRO ticket lo citan en su asunto/);
  assert.match(abierto.stdout, /\(es de SCRUM-50\) SCRUM-50c: el censo/);
  // Control: su dueño SÍ está, por ese mismo commit.
  const dueno = lanzar(j.clon, '50');
  assert.match(dueno.stdout.split('\n')[0], /SCRUM-50 · YA ESTÁ/);
  assert.match(dueno.stdout, /commits {4}· 1 en main/);
});

test('SCRUM-1454 · el COMANDO con VARIOS: una respuesta por ticket, un recuento que dice cuántos se preguntaron, y sale 2 si UNO no se pudo mirar', (t) => {
  const j = jugueteConAjeno(); t.after(() => fs.rmSync(j.base, { recursive: true, force: true }));
  const cabezas = (r) => r.stdout.split('\n').filter((l) => /^(🟢|⚪|🔴) SCRUM-/u.test(l));
  const tres = lanzar(j.clon, '41', '99', '51');
  assert.equal(tres.status, SALIDA_MIRADO, tres.stdout + tres.stderr);
  assert.deepEqual(cabezas(tres).map((l) => l.match(/SCRUM-\S+ · (YA ESTÁ|NO ESTÁ|NO HE PODIDO MIRAR)/)[1]), [YA_ESTA, NO_ESTA, NO_ESTA]);
  assert.match(tres.stdout, /RECUENTO · 3 preguntado\(s\) · 1 YA ESTÁ · 2 NO ESTÁ · 0 NO HE PODIDO MIRAR/);

  // Uno que no es un número no se salta ni se calla: es un «no he podido mirar» más, y manda en la salida.
  const conBasura = lanzar(j.clon, '41', 'x41', '99');
  assert.equal(conBasura.status, SALIDA_CIEGO, conBasura.stdout + conBasura.stderr);
  assert.equal(cabezas(conBasura).length, 3, 'tantas respuestas como preguntas');
  assert.match(conBasura.stdout, /RECUENTO · 3 preguntado\(s\) · 1 YA ESTÁ · 1 NO ESTÁ · 1 NO HE PODIDO MIRAR/);
  assert.match(conBasura.stdout.trimEnd().split('\n').pop(), /la salida es 2/);

  // Sin remoto: los tres ciegos, ninguno «no está».
  fs.rmSync(j.origen, { recursive: true, force: true });
  const ciegos = lanzar(j.clon, '41', '99', '51');
  assert.equal(ciegos.status, SALIDA_CIEGO);
  assert.match(ciegos.stdout, /RECUENTO · 3 preguntado\(s\) · 0 YA ESTÁ · 0 NO ESTÁ · 3 NO HE PODIDO MIRAR/);
  assert.doesNotMatch(ciegos.stdout, /NO ESTÁ en origin/);
});

test('SCRUM-1454 · el COMANDO sin sus motores: lo dice por su SALIDA y sale 2 — con el stderr tirado sigue habiendo respuesta', (t) => {
  // Lo más cerca que se puede fabricar del 6-oct: el guion, solo, en un árbol donde no está lo que importa.
  const j = juguete(); t.after(() => fs.rmSync(j.base, { recursive: true, force: true }));
  // Fuera del árbol y donde se vea de qué cuelga (SCRUM-824): un temporal propio, no una subcarpeta del juguete.
  const arbolSuelto = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-ya-esta-suelto-'));
  t.after(() => fs.rmSync(arbolSuelto, { recursive: true, force: true }));
  const suelto = path.join(arbolSuelto, 'scripts', 'equipo');
  fs.mkdirSync(suelto, { recursive: true });
  fs.copyFileSync(GUION, path.join(suelto, 'ya-esta.mjs'));
  // El hijo no hereda el reporter, el color ni el contexto de test de quien lo lanza (SCRUM-1349).
  const entornoHijo = { ...process.env };
  delete entornoHijo.FORCE_COLOR;
  delete entornoHijo.NODE_OPTIONS;
  delete entornoHijo.NODE_TEST_CONTEXT;
  // `stdio` con el stderr a `ignore` es el `2>/dev/null` de quien lo lanzó aquel día.
  const r = spawnSync(process.execPath, [path.join(suelto, 'ya-esta.mjs'), '41', '99', '--raiz', j.clon], { encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'ignore'], env: entornoHijo });
  assert.equal(r.status, SALIDA_CIEGO, r.stdout);
  assert.equal(r.stdout.split('\n').filter((l) => /NO HE PODIDO MIRAR/.test(l) && /^🔴 SCRUM-/u.test(l)).length, 2, r.stdout);
  assert.match(r.stdout, /el comando reventó/);
  assert.match(r.stdout, /RECUENTO · 2 preguntado\(s\) · 0 YA ESTÁ · 0 NO ESTÁ · 2 NO HE PODIDO MIRAR/);
});
