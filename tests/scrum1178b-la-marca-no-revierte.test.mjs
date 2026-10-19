// tests/scrum1178b-la-marca-no-revierte.test.mjs — SCRUM-1178 (de paso)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL REMEDIO QUE BORRA TRABAJO: «no falla, obedece».
//
// `restaurarDesdeMarca` escribía la copia guardada SIEMPRE que los bytes difirieran. Con una marca
// huérfana VIEJA, el remedio que propone `guards:entrada` (`meta-guard-mutaciones --solo-censo`)
// devolvía el fichero a su versión de entonces. Medido en `wt-s3-1293`: una marca del 1-oct sobre
// `public/dashboard/js/homeView.js` (75.033 B) frente al de `main` (85.825 B) — ~10 KB de trabajo
// ajeno revertidos sin un solo error en pantalla. No se lanzó; está en `docs/master/SCRUM-1178.md`.
//
// La marca guarda el ORIGINAL; lo que no guardaba es QUÉ escribió la pasada. Sin eso, «el fichero
// difiere de la copia» no distingue «sigue mi mutación puesta» de «alguien trabajó encima después».
//
// ── LO QUE ESTE FICHERO SUJETA ──────────────────────────────────────────────────────────────
//   ① 🔴 marca huérfana vieja + fichero más nuevo → NO se escribe, se dice, y la marca se queda;
//   ② lo mismo con una marca del formato de antes (sin huellas): fail-closed, no se adivina;
//   ③ ✅ CONTROL: la mutación APUNTADA se sigue reparando (SCRUM-808 intacto);
//   ④ un fichero que ya no existe no se resucita;
//   ⑤ `marcasHuerfanas` separa lo reparable de lo AJENO, para que el aviso no mande a pisarlo;
//   ⑥ los dos instrumentos reales apuntan cada mutación ANTES de escribirla.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as marca from '../scripts/_marca-de-arbol.mjs';
import { temporal } from './_temporal.mjs'; // SCRUM-864 · el temporal se borra pase lo que pase

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Un pid que existió y ya NO vive: el de un hijo que ha terminado. Una marca huérfana de verdad. */
function pidMuerto() {
  const pid = Number(execFileSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))']).toString());
  assert.ok(Number.isInteger(pid) && pid > 0, '🔴 el banco no ha conseguido un pid.');
  assert.equal(marca.procesoVivo(pid), false, '🔴 el banco está mal: el pid «muerto» sigue vivo.');
  return pid;
}

/** El banco del 1-oct: el fichero tal como era cuando se marcó, y la marca de una pasada MUERTA. */
function bancoHuerfano({ formatoViejo = false } = {}) {
  const raiz = temporal('scrum1178b-');
  const abs = path.join(raiz, 'homeView.js');
  const VIEJO = Buffer.from('export const vista = 1; // así era el 1-oct\r\n', 'utf8');
  fs.writeFileSync(abs, VIEJO);
  const dir = path.join(raiz, '.marca');
  marca.marcarEnVuelo([{ ruta: 'homeView.js', abs, ORIGINAL: VIEJO }], dir);
  const man = path.join(dir, 'en-vuelo.json');
  const datos = JSON.parse(fs.readFileSync(man, 'utf8'));
  datos.pid = pidMuerto();
  if (formatoViejo) for (const p of datos.piezas) delete p.mutaciones;
  fs.writeFileSync(man, JSON.stringify(datos, null, 2));
  return { raiz, abs, dir, man, VIEJO };
}

// ═══ ① 🔴 EL ROJO SEMBRADO · marca huérfana vieja, fichero más nuevo ═════════════════════════

test('SCRUM-1178 · 🔴 una marca VIEJA no revierte el trabajo que vino después', () => {
  const b = bancoHuerfano();
  // Lo que hizo el árbol después de la marca: un merge de `main`, no una mutación de nadie.
  const NUEVO = Buffer.from('export const vista = 2; // main de hoy, con 10 KB más\r\n', 'utf8');
  fs.writeFileSync(b.abs, NUEVO);
  assert.notEqual(Buffer.compare(fs.readFileSync(b.abs), b.VIEJO), 0,
    '🔴 el banco no ha llegado a sembrar el fichero nuevo: lo de abajo mediría el vacío.');

  const r = marca.restaurarDesdeMarca(b.dir);
  assert.equal(Buffer.compare(fs.readFileSync(b.abs), NUEVO), 0,
    '🔴🔴 HA REVERTIDO EL FICHERO A LA COPIA DE LA MARCA. Lo que había no era una mutación suya: '
    + 'era trabajo posterior, y el remedio que propone `guards:entrada` acaba de borrarlo sin '
    + 'un solo error en pantalla.');
  assert.deepEqual(r.reparadas, [], '🔴 dice que ha «reparado» algo que no era suyo.');
  assert.equal(r.sucios.length, 1, '🔴 se ha negado EN SILENCIO: quien lo lanzó cree que el árbol está limpio.');
  assert.match(r.sucios[0], /homeView\.js/, `🔴 se niega sin nombrar el fichero: «${r.sucios[0]}».`);
  assert.match(r.sucios[0], /NO lo piso/, `🔴 no dice POR QUÉ no lo ha devuelto: «${r.sucios[0]}».`);
  assert.deepEqual(r.ajenos, ['homeView.js'], '🔴 no separa lo ajeno de lo que no pudo escribir.');
  assert.equal(fs.existsSync(b.man), true, '🔴 ha borrado la marca: se pierde la evidencia y el aviso.');
});

// ═══ ② fail-closed · una marca del formato de ANTES no sabe qué escribió ════════════════════

test('SCRUM-1178 · 🔴 una marca sin huellas (formato de antes) tampoco escribe: no se adivina', () => {
  const b = bancoHuerfano({ formatoViejo: true });
  const QUE_HAY = Buffer.from('export const vista = 1; // MUTADO… o no: la marca no lo sabe\n', 'utf8');
  fs.writeFileSync(b.abs, QUE_HAY);
  const r = marca.restaurarDesdeMarca(b.dir);
  assert.equal(Buffer.compare(fs.readFileSync(b.abs), QUE_HAY), 0,
    '🔴 una marca que no sabe qué escribió ha escrito igual. Si no puede saber cuál es más nueva, '
    + 'NO escribe.');
  assert.deepEqual(r.ajenos, ['homeView.js']);
  assert.equal(fs.existsSync(b.man), true);
});

// ═══ ③ ✅ CONTROL POSITIVO · la mutación apuntada SÍ se repara ═════════════════════════════

test('SCRUM-1178 · ✅ la mutación APUNTADA se sigue reparando (SCRUM-808 intacto)', () => {
  const b = bancoHuerfano();
  const MUTADO = Buffer.from('export const vista = 999; // MUTADO\n', 'utf8');
  marca.apuntarMutacion(b.dir, b.abs, MUTADO);
  fs.writeFileSync(b.abs, MUTADO);
  const r = marca.restaurarDesdeMarca(b.dir);
  assert.deepEqual(r.reparadas, ['homeView.js'],
    '🔴 la mutación que la propia pasada apuntó ya no se repara: eso es el árbol sucio de SCRUM-808.');
  assert.deepEqual(r.sucios, []);
  assert.equal(Buffer.compare(fs.readFileSync(b.abs), b.VIEJO), 0, '🔴 dice que reparó y no volvió a sus bytes.');
  assert.equal(fs.existsSync(b.man), false, '🔴 reparado y la marca sigue: gritaría en cada arranque.');

  // Varias mutaciones bajo la MISMA marca (así trabaja `censo-mudez`): vale cualquiera de ellas.
  const c = bancoHuerfano();
  marca.apuntarMutacion(c.dir, c.abs, Buffer.from('uno\n'));
  marca.apuntarMutacion(c.dir, c.abs, Buffer.from('dos\n'));
  fs.writeFileSync(c.abs, 'uno\n');
  assert.deepEqual(marca.restaurarDesdeMarca(c.dir).reparadas, ['homeView.js'],
    '🔴 sólo reconoce la ÚLTIMA mutación apuntada: una pasada que muere en la primera no se repara.');
});

test('SCRUM-1178 · apuntar sobre un fichero que la marca no conoce revienta, no se traga', () => {
  const b = bancoHuerfano();
  assert.throws(() => marca.apuntarMutacion(b.dir, path.join(b.raiz, 'otro.js'), Buffer.from('x')),
    /no está en la marca/,
    '🔴 apuntar una mutación sobre una pieza que no se marcó no puede salir bien en silencio: la '
    + 'escritura de después no tendría con qué devolverse.');
});

// ═══ ④ un fichero que ya no existe no se resucita ══════════════════════════════════════════

test('SCRUM-1178 · un fichero BORRADO después de la marca no se resucita', () => {
  const b = bancoHuerfano();
  fs.rmSync(b.abs);
  const r = marca.restaurarDesdeMarca(b.dir);
  assert.equal(fs.existsSync(b.abs), false,
    '🔴 ha recreado un fichero que alguien borró después: tampoco era una mutación suya.');
  assert.deepEqual(r.ajenos, ['homeView.js']);
});

// ═══ ⑤ el aviso no puede mandar a pisar lo ajeno ═══════════════════════════════════════════

test('SCRUM-1178 · `marcasHuerfanas` dice qué es AJENO, y el aviso de `guards:entrada` no lo manda pisar', async () => {
  const b = bancoHuerfano();
  fs.writeFileSync(b.abs, 'trabajo de después\n');
  const cache = path.dirname(b.dir); // el barrido mira las carpetas de dentro
  const h = marca.marcasHuerfanas(cache);
  assert.equal(h.length, 1, '🔴 el banco está mal: la marca no se ve como huérfana.');
  assert.deepEqual(h[0].sucias, ['homeView.js'], '🔴 lo ajeno ha dejado de bloquear el empuje.');
  assert.deepEqual(h[0].ajenas, ['homeView.js'], '🔴 no distingue lo ajeno de una mutación puesta.');

  const { avisoDeMutacionPuesta } = await import('../scripts/guards-entrada.mjs');
  const aviso = avisoDeMutacionPuesta(h);
  assert.match(aviso, /NO es una mutación/,
    `🔴 el aviso no dice que lo que hay no es una mutación — y propone el remedio igual:\n${aviso}`);
  assert.match(aviso, /borra la marca/, `🔴 no dice cómo salir si lo de hoy es lo bueno:\n${aviso}`);
  assert.doesNotMatch(aviso, /dejó mutado|--solo-censo/,
    `🔴 llama «mutado» a lo ajeno y propone el remedio que lo pisaría (o que se negará):\n${aviso}`);

  // CONTROL: una mutación apuntada sale sucia pero NO ajena, y el aviso de siempre se mantiene.
  const c = bancoHuerfano();
  marca.apuntarMutacion(c.dir, c.abs, Buffer.from('MUTADO\n'));
  fs.writeFileSync(c.abs, 'MUTADO\n');
  const hc = marca.marcasHuerfanas(path.dirname(c.dir));
  assert.deepEqual([hc[0].sucias, hc[0].ajenas], [['homeView.js'], []]);
  assert.doesNotMatch(avisoDeMutacionPuesta(hc), /NO es una mutación/,
    '🔴 el aviso trata como ajena una mutación de verdad: mandaría a borrar la marca que la repara.');
  assert.match(avisoDeMutacionPuesta(hc), /dejó mutado: homeView\.js[\s\S]*--solo-censo/,
    '🔴 una mutación de verdad ya no recibe el remedio que la devuelve.');
});

// ═══ ⑥ los instrumentos reales apuntan ANTES de escribir ═══════════════════════════════════

/** El código sin comentarios de línea (A23 nº 2 y 3: por líneas, nada de `.*$`). */
function sinComentarios(texto) {
  return texto.split(/\r?\n/).map((l) => (l.trimStart().startsWith('//') ? '' : l));
}

/**
 * Cada `fs.writeFileSync(<objetivo>, …)` que escribe una mutación tiene que llevar, en la línea de
 * código ANTERIOR, `apuntarMutacion(DIR_MARCA, <objetivo>, …)`. Las escrituras que DEVUELVEN el
 * original se reconocen por su segundo argumento y no cuentan.
 */
function sinApuntar(texto, objetivos, devoluciones) {
  const lineas = sinComentarios(texto);
  const faltan = [];
  let escrituras = 0;
  lineas.forEach((l, i) => {
    for (const obj of objetivos) {
      const m = l.match(new RegExp(`fs\\.writeFileSync\\(${obj},\\s*([^,)]+)`));
      if (!m || devoluciones.includes(m[1].trim())) continue;
      escrituras += 1;
      let j = i - 1;
      while (j >= 0 && !lineas[j].trim()) j -= 1;
      if (!new RegExp(`apuntarMutacion\\(DIR_MARCA,\\s*${obj},`).test(lineas[j] || '')) faltan.push(`${obj} (línea ${i + 1})`);
    }
  });
  return { escrituras, faltan };
}

const META_GUARD = { rel: 'scripts/meta-guard-mutaciones.mjs', objetivos: ['abs', 'absDist'], devoluciones: [], minimo: 2 };
const CENSO_MUDEZ = { rel: 'scripts/censo-mudez.mjs', objetivos: ['HELPER'], devoluciones: ['ORIGINAL'], minimo: 2 };

// Nombres LITERALES a propósito: SCRUM-1415 no deja declarar test() con nombre construido.
test('SCRUM-1178 · `meta-guard-mutaciones` apunta cada mutación antes de escribirla', () => apuntaAntes(META_GUARD));
test('SCRUM-1178 · `censo-mudez` apunta cada mutación antes de escribirla', () => apuntaAntes(CENSO_MUDEZ));

function apuntaAntes(ins) {
  {
    const texto = fs.readFileSync(path.join(RAIZ, ins.rel), 'utf8');
    const r = sinApuntar(texto, ins.objetivos, ins.devoluciones);
    assert.ok(r.escrituras >= ins.minimo,
      `🔴 CIEGO: veo ${r.escrituras} escrituras de mutación en \`${ins.rel}\` y sé que hay al menos `
      + `${ins.minimo}. No compruebo nada sobre una población que no veo.`);
    assert.deepEqual(r.faltan, [],
      `🔴 \`${ins.rel}\` escribe una mutación SIN apuntarla: si muere ahí, la marca no la reconoce, `
      + 'el remedio se niega y el árbol se queda mutado.');

    // EL ROJO, en memoria: sin la línea que apunta, el detector tiene que caer.
    const sinLinea = texto.split(/\r?\n/).filter((l) => !/^\s*apuntarMutacion\(DIR_MARCA,/.test(l)).join('\n');
    assert.notEqual(sinLinea, texto, '🔴 CIEGO: no encuentro ninguna línea que apunte.');
    assert.ok(sinApuntar(sinLinea, ins.objetivos, ins.devoluciones).faltan.length >= ins.minimo,
      '🔴 el detector no cae al quitar las líneas que apuntan: este test no vigila nada.');
  }
}
