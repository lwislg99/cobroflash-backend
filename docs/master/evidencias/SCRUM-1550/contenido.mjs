#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1550/contenido.mjs · J3 (equipo de Javier), 14-oct-2026
//
// «NADA EN MAIN» NO ES «SIN HACER». `tabla-ya-esta.mjs` (SCRUM-1496) mira tres columnas que se apoyan en el
// NÚMERO del ticket. Un trabajo que entró bajo otro número sale igual que uno que nunca se hizo. Esta
// capa mira el CONTENIDO de los que ese censo da por vacíos.
//
//   node docs/master/evidencias/SCRUM-1550/contenido.mjs --sondas docs/master/evidencias/SCRUM-1550/sondas.json --ref <sha>
//
// ES UNA CAPA, NO UN MOTOR. Busqué por CONCEPTO antes de escribirla. `censarTicket` (SCRUM-388),
// `ya-esta` (SCRUM-1424/1454) y SCRUM-1259 declaran ese mismo límite y no lo resuelven:
// «SIN RASTRO no es sin hacer: para eso, el PASO 0 por CONTENIDO». `censo-regla-42` mira contenido, pero
// solo el que nombra el registro del propio ticket, y aquí no hay registro. De SCRUM-1259 se reusa
// `reMencion`. Sin red, sin Jira y sin base de datos: solo `git grep` y `git log` sobre UN commit.
//
// QUÉ BUSCAR NO LO DECIDE ESTE FICHERO: lo decide `sondas.json`, una entrada por ticket con lo que su
// enunciado pide y la sonda que lo mira. Cada sonda declara qué significa encontrar algo:
//   · "presente": el trabajo está si el patrón aparece (un literal, una función, una ruta, una fila de máster);
//   · "ausente":  el trabajo está si el DEFECTO citado ya no aparece. Un cero solo vale si sus rutas
//                 EXISTEN en el commit: si no, la sonda no miró nada y queda «no he podido mirar».
// No cuentan las líneas cuyo TEXTO nombra SCRUM-<ese ticket>, porque citarlo no es hacerlo, ni las de su
// registro y sus evidencias, ni los ficheros de SCRUM-1550 y SCRUM-1496*, que son de este censo. Que la
// RUTA lleve el número no descarta nada (`lineaCuenta`, SCRUM-1550b). Un ticket sin sonda posible lleva `sinSonda`
// con el motivo.
//
// TRES VEREDICTOS, y el tercero no se mezcla con el primero:
//   ESTÁ, BAJO OTRA COSA  alguna sonda dice que sí. Se cita QUÉ lo cubre (fichero:línea) y POR DÓNDE
//                         entró: el primer commit de la primera línea de `main` que trae el patrón
//   SIGUE SIN HACER       todas las sondas miraron y ninguna dice que sí
//   NO HE PODIDO MIRAR    no hay sonda posible, o alguna no contestó y ninguna dice que sí
// «ESTÁ» no es «hecho» ni «entero»: con «parte» quiere decir que solo algunas sondas casan. Y en un
// ticket que espera la firma del fundador no autoriza nada.
//
// Controles DENTRO de la misma pasada, o la tabla no vale (salida 2):
//   · NEGATIVO (9999): un literal que no existe tiene que dar SIGUE SIN HACER;
//   · POSITIVO SEMBRADO (9998): un literal que solo existe en `semilla.txt` tiene que dar ESTÁ. Es una
//     semilla y no un defecto del árbol, así que nadie lo «arregla» mañana dejando el censo mudo. Se busca
//     en el árbol de trabajo, porque el commit medido es anterior a ella: prueba el grep, el filtro y el
//     veredicto, no la referencia. El positivo contra la referencia lo da SCRUM-1101 (ver el registro);
//   · RUTA SEMBRADA (9997, SCRUM-1550b): `semilla-ruta-SCRUM-9997.txt` lleva la semilla en dos líneas y solo
//     una nombra el ticket. Tiene que contar 1: 0 es volver a filtrar por la ruta, 2 es no filtrar el texto.
// Salidas: 0 los controles salieron bien · 2 un control falló o no se pudo resolver la referencia.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reMencion } from '../../../../scripts/abierto-con-trabajo-en-main.mjs';

export const ESTA = 'ESTÁ, BAJO OTRA COSA';
export const SIGUE = 'SIGUE SIN HACER';
export const NO_PUDE = 'NO HE PODIDO MIRAR';

const AQUI = 'docs/master/evidencias/SCRUM-1550';
export const SEMILLA = 'semilla-del-control-positivo-scrum1550';
export const SEMILLA_RUTA = 'semilla-del-control-de-ruta-scrum1550b';
export const FICHERO_RUTA = 'semilla-ruta-SCRUM-9997.txt';
const EXCLUIR = [`:(exclude)${AQUI}/**`, ':(exclude)docs/master/evidencias/SCRUM-1496/**', ':(exclude)docs/master/evidencias/SCRUM-1496b/**'];

/**
 * Pura. ¿Esta línea de `git grep` (`ruta:nº:texto`) cuenta como prueba del ticket `n`? No cuenta si su
 * TEXTO nombra el ticket (citarlo no es hacerlo) ni si vive en su registro o sus evidencias, que hablan de
 * él. La RUTA no descarta por sí sola: `docs/sql/scrum-1310c-….sql` ES el trabajo de 1310 (SCRUM-1550b;
 * hasta entonces el filtro miraba la línea entera, ruta incluida, y esa sonda no podía salir nunca).
 */
export function lineaCuenta(linea, n) {
  const m = /^(.*?):(\d+):(.*)$/s.exec(linea);
  if (!m) return false;
  const [, ruta, , texto] = m;
  if (reMencion(n).test(texto)) return false;
  return !new RegExp(`^docs/master/(?:SCRUM-${n}\\.md$|evidencias/SCRUM-${n}(?![0-9])[^/]*/)`, 'i').test(ruta);
}

/** Pura. ¿Esta sonda dice que el trabajo está? `null` = no miró. */
export function hechoDeSonda(s) {
  if (s.aciertos === null) return null;
  return s.espera === 'ausente' ? s.aciertos === 0 : s.aciertos > 0;
}

/** Pura. El veredicto de un ticket a partir de sus sondas ya corridas. */
export function veredicto(t) {
  if (t.sinSonda) return { v: NO_PUDE, alcance: '' };
  const h = t.sondas.map(hechoDeSonda);
  const si = h.filter((x) => x === true).length;
  if (si > 0) return { v: ESTA, alcance: si === h.length ? 'todas las sondas' : `parte: ${si} de ${h.length} sondas` };
  if (h.some((x) => x === null)) return { v: NO_PUDE, alcance: '' };
  return { v: SIGUE, alcance: '' };
}

function principal(argv) {
  const val = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
  const fSondas = val('--sondas') || path.join(raiz, AQUI, 'sondas.json');
  const ref = val('--ref') || 'origin/main';
  const git = (args) => {
    try { return { ok: true, out: execFileSync('git', ['-C', raiz, ...args], { encoding: 'utf8', maxBuffer: 1 << 28, timeout: 180000, stdio: ['ignore', 'pipe', 'pipe'] }) }; }
    catch (e) { return { ok: e.status === 1 && !String(e.stderr || '').trim(), out: '' }; } // grep: 1 sin errores = cero aciertos
  };
  const sha = git(['rev-parse', '--verify', `${ref}^{commit}`]).out.trim();
  if (!sha) { console.log(`🔴 ${NO_PUDE}: \`${ref}\` no se resuelve`); return 2; }
  return Promise.resolve().then(() => {
    const entrada = JSON.parse(fs.readFileSync(fSondas, 'utf8'));
    const tickets = [
      ...entrada.tickets,
      { n: 9999, control: 'negativo', pide: 'número inventado', sondas: [{ que: 'literal que no existe', patron: 'zq-1550-esto-no-existe-' + 'en-ningun-sitio', fijo: true, rutas: ['.'], espera: 'presente' }] },
      { n: 9998, control: 'positivo sembrado', pide: 'semilla', sondas: [{ que: 'la semilla', patron: SEMILLA, fijo: true, rutas: [`${AQUI}/semilla.txt`], espera: 'presente', semilla: true }] },
      // SCRUM-1550b: la RUTA del fichero nombra el ticket y sus dos líneas llevan la semilla; solo una nombra
      // el ticket en su TEXTO. Tiene que contar exactamente 1: 0 es el filtro por ruta, 2 es no filtrar nada.
      { n: 9997, control: 'ruta sembrada', pide: 'semilla en un fichero cuya ruta nombra el ticket', sondas: [{ que: 'la semilla por ruta', patron: SEMILLA_RUTA, fijo: true, rutas: [`${AQUI}/${FICHERO_RUTA}`], espera: 'presente', semilla: true }] },
    ];
    const filas = [];
    for (const t of tickets) {
      for (const s of t.sondas || []) {
        const excl = s.semilla ? [] : EXCLUIR;
        // `.` es la raíz y no se comprueba: se quita ANTES, en vez de darla por buena dentro de un `||`.
        const existen = s.rutas.filter((r) => r !== '.').every((r) => git(['cat-file', '-e', `${sha}:${r.replace(/\/$/, '')}`]).ok);
        if (s.espera === 'ausente' && !existen) { s.aciertos = null; s.nota = 'sus rutas no existen en el commit'; continue; }
        // La semilla se busca en el ÁRBOL DE TRABAJO (`--untracked`), no en `sha`: el commit medido es anterior a ella.
        const g = git(['grep', '-n', '-I', ...(s.semilla ? ['--untracked'] : []), s.fijo ? '-F' : '-E', ...(s.i ? ['-i'] : []), '-e', s.patron, ...(s.semilla ? [] : [sha]), '--', ...s.rutas, ...excl]);
        if (!g.ok) { s.aciertos = null; s.nota = 'git grep no contestó'; continue; }
        const lineas = g.out.split('\n').filter(Boolean).map((l) => (s.semilla ? l : l.slice(sha.length + 1))).filter((l) => lineaCuenta(l, t.n));
        s.aciertos = lineas.length;
        s.primera = lineas[0] ? lineas[0].replace(/^([^:]+:\d+):.*$/, '$1') : '';
        // El TEXTO del acierto va en la tabla, porque un número de aciertos no dice QUÉ casó. Medido en la
        // primera pasada: 3 de 7 «ESTÁ» eran otra cosa («sepa» dentro de «sepan», las notas de la cotización).
        s.texto = lineas[0] ? lineas[0].replace(/^[^:]+:\d+:/, '').trim().slice(0, 140) : '';
        if (lineas.length && s.espera === 'presente' && !s.semilla) {
          const [fichero] = s.primera.split(':');
          const lg = git(['log', sha, '--first-parent', '--reverse', '--format=%h %cs %s', '-S', s.patron, ...(s.fijo ? [] : ['--pickaxe-regex']), ...(s.i ? ['-i'] : []), '--', fichero]);
          s.entro = lg.ok ? (lg.out.split('\n')[0] || '').trim() : '🔴 git log no contestó';
        }
        // Un defecto que ya no está: por dónde se FUE, que es el último commit que cambió su recuento.
        if (s.espera === 'ausente' && lineas.length === 0) {
          const lg = git(['log', sha, '--first-parent', '-1', '--format=%h %cs %s', '-S', s.patron, ...(s.fijo ? [] : ['--pickaxe-regex']), '--', ...s.rutas]);
          s.entro = lg.ok ? (lg.out.trim() || '🔴 git log no lo encuentra') : '🔴 git log no contestó';
        }
      }
      filas.push({ ...t, ...veredicto(t) });
    }
    const neg = filas.find((f) => f.n === 9999); const pos = filas.find((f) => f.n === 9998);
    const ruta = filas.find((f) => f.n === 9997); const nRuta = ruta.sondas[0].aciertos;
    const bien = neg.v === SIGUE && pos.v === ESTA && nRuta === 1;
    const reales = filas.filter((f) => !f.control);
    const c = (v) => reales.filter((f) => f.v === v).length;
    console.log(`medido contra ${sha}`);
    console.log(`población: ${reales.length} ticket(s) de ${path.basename(fSondas)} · ${reales.filter((f) => !f.sinSonda).length} con sonda, ${reales.filter((f) => f.sinSonda).length} sin sonda posible`);
    console.log(`control NEGATIVO SCRUM-9999 → ${neg.v} ${neg.v === SIGUE ? '✅' : '🔴'} · control POSITIVO sembrado SCRUM-9998 → ${pos.v} ${pos.v === ESTA ? '✅' : '🔴'} · control RUTA sembrada SCRUM-9997 → ${nRuta === null ? 'no miró' : nRuta} de 1 ${nRuta === 1 ? '✅' : '🔴'}${bien ? '' : ' · 🔴 EL INSTRUMENTO NO MIDE: la tabla no vale'}`);
    console.log(`veredictos: ${c(ESTA)} ${ESTA} · ${c(SIGUE)} ${SIGUE} · ${c(NO_PUDE)} ${NO_PUDE}\n`);
    console.log('| ticket | VEREDICTO | alcance | lo que pide | sondas: qué · aciertos · primera · por dónde entró | notas |');
    console.log('|---|---|---|---|---|---|');
    for (const f of filas) {
      const ss = f.sinSonda ? `sin sonda: ${f.sinSonda}` : f.sondas.map((s) => `${s.que} [${s.espera}] · ${s.aciertos === null ? `🔴 ${s.nota}` : s.aciertos}${s.primera ? ` · ${s.primera} «${s.texto}»` : ''}${s.entro ? ` · entró: ${s.entro}` : ''}`).join(' ‖ ');
      console.log(`| SCRUM-${f.n}${f.control ? ` (control ${f.control})` : ''} | **${f.v}** | ${f.alcance} | ${f.pide} | ${ss.replace(/\|/g, '\\|')} | ${(f.nota || '').replace(/\|/g, '\\|')} |`);
    }
    console.log(`\n«${ESTA}» no es «hecho» ni «entero», y en un ticket de «Acción del fundador» no autoriza nada. Cerrar es leer el enunciado (A13).`);
    return bien ? 0 : 2;
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  Promise.resolve(principal(process.argv.slice(2))).then((c) => process.exit(c), (e) => {
    console.log(`🔴 ${NO_PUDE}: el comando reventó: ${String((e && e.message) || e).split('\n')[0]}`);
    process.exit(2);
  });
}
