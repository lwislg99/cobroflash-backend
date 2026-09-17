// SCRUM-812 · LAS DOS POBLACIONES: los guards que EXISTEN y los que DECLARAN.
//
// ── LA PREGUNTA ─────────────────────────────────────────────────────────────────────────────
// `meta:mutaciones` imprime «vivas N · mudas 0 · ciegas 0», y esa línea se lee como «todos los
// guards están cubiertos». No lo dice: su censo sale de `censoDeDeclaraciones`, que **sólo recoge
// los ficheros que DECLARAN** (`if (buenas.length || incompletas.length)`). Un guard que no
// declara no aparece en el denominador — ni para bien ni para mal.
//
// ── EL LECTOR ES EL DE LA CASA ─────────────────────────────────────────────────────────────
// `censoDeDeclaraciones` y `lecturaDeDeclaraciones` se IMPORTAN. Un censo con su propia idea de
// qué es una declaración daría un número distinto del que decide si CI pasa.
//
// ── 🔴 LO QUE DECIDE, Y POR ESO SE SEPARA ───────────────────────────────────────────────────
// Un guard sin mutación declarada puede ser DOS cosas con arreglos opuestos:
//   · un HUECO ......... podría declararla y no lo hace
//   · una IMPOSIBILIDAD  el defecto que vigila no se puede imitar con una sustitución de texto
// Meterlos en el mismo cubo inventa deuda. El precedente ya existe en el árbol:
// `scrum708-el-fichero-que-no-corre.test.mjs` declara EN PROSA por qué no declara — «el defecto
// que vigila es renombrar o mover un fichero, y una mutación de SCRUM-745 es una sustitución de
// texto: no puede imitarlo».
//
// ⚠️ Lo que no se pueda clasificar va a NO CLASIFICADO y cuenta **del lado malo**.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const RAIZ = 'C:/Users/Javier Pereira/cobroflash-b2';
process.chdir(RAIZ);
const DIR = path.join(RAIZ, 'tests');
const SCRUM745 = new Date('2026-09-04T22:52:36+01:00'); // f2b71ca4 · el commit que creó el mecanismo

const m = await import('file:///C:/Users/Javier%20Pereira/cobroflash-b2/scripts/meta-guard-mutaciones.mjs');

const ficheros = fs.readdirSync(DIR).filter((f) => f.endsWith('.test.mjs')).sort();
if (!ficheros.length) { console.log('🔴 CIEGO: cero ficheros de test.'); process.exit(2); }

// ── Fecha de NACIMIENTO de cada fichero, en UNA pasada de git ───────────────────────────────
// 879 llamadas a `git log` costarían minutos; una sola pasada con `--name-only` las da todas.
const nacimiento = new Map();
{
  const salida = execFileSync('git', ['log', '--diff-filter=A', '--format=%cI', '--name-only',
    '--', 'tests/'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  let fecha = null;
  for (const linea of salida.split('\n')) {
    if (/^\d{4}-\d{2}-\d{2}T/.test(linea)) { fecha = linea.trim(); continue; }
    const f = linea.trim();
    if (!f || !f.startsWith('tests/')) continue;
    const base = f.slice('tests/'.length);
    // `git log` va de lo nuevo a lo viejo: la ÚLTIMA vez que se ve un fichero es su alta original.
    if (fecha) nacimiento.set(base, fecha);
  }
}

// ── Lo que el meta-guard VE ─────────────────────────────────────────────────────────────────
const censo = m.censoDeDeclaraciones(DIR);
const vistos = new Map(censo.map((g) => [g.guard, g]));
const declaraciones = censo.reduce((a, g) => a + g.mutaciones.length, 0);

// ── Lo que el TEXTO dice ────────────────────────────────────────────────────────────────────
const nombranElSimbolo = ficheros.filter((f) =>
  fs.readFileSync(path.join(DIR, f), 'utf8').includes('MUTACIONES_QUE_ME_TUMBAN'));

console.log('══ LAS TRES CIFRAS ═════════════════════════════════════════════════════');
console.log('   ① ficheros de test que EXISTEN en `tests/`        : ' + ficheros.length);
console.log('   ② nombran `MUTACIONES_QUE_ME_TUMBAN` en su texto  : ' + nombranElSimbolo.length);
console.log('   ③ los que el META-GUARD VE (y por tanto mide)     : ' + vistos.size
  + '   (' + declaraciones + ' declaraciones)');
console.log('');
const huerfanos = nombranElSimbolo.filter((f) => !vistos.has(f));
console.log('   ②−③ = ' + huerfanos.length + ' que nombran el símbolo y el lector NO ve:');
for (const f of huerfanos) console.log('      · ' + f);
console.log('   (se revisan uno a uno en el expediente: ninguno es una declaración invisible)');
console.log('');

// ── Clasificación de los que NO declaran ────────────────────────────────────────────────────
const GATES = ['QA_DB_TEST', 'A55_DB_TEST', 'BOT_SUITE_TEST', 'LIBRO_PG_URL', 'STAGING_DB_TEST'];
const clases = { imposibilidadDeclarada: [], gateado: [], sinCodigoDelRepo: [], sinVigilar: [], noClasificado: [] };

for (const f of ficheros) {
  if (vistos.has(f)) continue;
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');

  // ① La imposibilidad DECLARADA en prosa. El precedente es `scrum708`.
  if (/NO DECLARA\s+`?MUTACIONES_QUE_ME_TUMBAN|POR QUÉ NO DECLARA/i.test(src)) {
    clases.imposibilidadDeclarada.push(f); continue;
  }
  // ② Gateado: el job del meta-guard corre SIN BASE por diseño, así que estos saldrían CIEGOS.
  //    No es un hueco de cobertura: es que este instrumento no los alcanza (SCRUM-754c).
  if (GATES.some((g) => src.includes(g))) { clases.gateado.push(f); continue; }
  // ③ ¿Ejercita código del repositorio? Si no importa nada de `src/`, `dist/`, `scripts/` o
  //    `public/` y no lee un fichero del árbol, NO HAY NADA QUE MUTAR que le afecte.
  const ejercita = /from '\.\.\/(src|dist|scripts|public)\//.test(src)
    || /import\('\.\.\/(src|dist|scripts|public)\//.test(src)
    || /readFileSync\(/.test(src)
    || /from '\.\/_/.test(src);
  if (!ejercita) { clases.sinCodigoDelRepo.push(f); continue; }
  // ④ Ejercita código del repo, no está gateado y no declara: HUECO.
  clases.sinVigilar.push(f);
}

const noDeclaran = ficheros.length - vistos.size;
console.log('══ LOS QUE NO DECLARAN (' + noDeclaran + ') ═══════════════════════════════════════');
console.log('   ⛔ imposibilidad DECLARADA en prosa              : ' + clases.imposibilidadDeclarada.length);
console.log('   ⚠️ GATEADOS (el meta-guard corre sin base: CIEGO): ' + clases.gateado.length);
console.log('   ⚪ no ejercitan código del repo (nada que mutar)  : ' + clases.sinCodigoDelRepo.length);
console.log('   🔴 SIN VIGILAR (podrían declarar y no lo hacen)   : ' + clases.sinVigilar.length);
console.log('   ❔ NO CLASIFICADO (del lado malo)                 : ' + clases.noClasificado.length);
const suma = Object.values(clases).reduce((a, x) => a + x.length, 0);
console.log('   suma: ' + suma + (suma === noDeclaran ? ' ✅ cuadra' : ' 🔴 NO CUADRA'));
console.log('');

// ── ¿Anteriores o posteriores a SCRUM-745? ──────────────────────────────────────────────────
const sinFecha = [];
const reparto = { antes: 0, despues: 0 };
for (const f of ficheros) {
  if (vistos.has(f)) continue;
  const n = nacimiento.get(f);
  if (!n) { sinFecha.push(f); continue; }
  if (new Date(n) < SCRUM745) reparto.antes += 1; else reparto.despues += 1;
}
console.log('══ ¿ANTERIORES A SCRUM-745 (4-sep-2026) O NACIDOS DESPUÉS? ═════════════');
console.log('   anteriores al mecanismo  : ' + reparto.antes);
console.log('   nacidos DESPUÉS y aun así sin declarar : ' + reparto.despues);
console.log('   sin fecha de alta legible (NO CLASIFICADO): ' + sinFecha.length);
console.log('   suma: ' + (reparto.antes + reparto.despues + sinFecha.length)
  + (reparto.antes + reparto.despues + sinFecha.length === noDeclaran ? ' ✅ cuadra' : ' 🔴 NO CUADRA'));
console.log('');
console.log('   ⚠️ Las dos causas tienen arreglos distintos: el que nació ANTES nunca tuvo el');
console.log('      mecanismo delante; el que nació DESPUÉS lo tenía y no lo usó.');

// ── Los que declaran, ¿nacieron antes o después? (control del reparto) ───────────────────────
let decAntes = 0; let decDespues = 0;
for (const f of vistos.keys()) {
  const n = nacimiento.get(f);
  if (!n) continue;
  if (new Date(n) < SCRUM745) decAntes += 1; else decDespues += 1;
}
console.log('');
console.log('   CONTROL · de los ' + vistos.size + ' que SÍ declaran: ' + decAntes + ' nacieron antes de 745 y '
  + decDespues + ' después.');
console.log('   (si ninguno de los anteriores declarara, «anterior a 745» sería una excusa perfecta;');
console.log('    con ' + decAntes + ' que sí lo hicieron, no lo es.)');

// ── El detalle de los huecos, para que sean accionables ─────────────────────────────────────
// ── 🔴 Y AQUÍ EL LÍMITE DE TODO ESTO, QUE HAY QUE DECIR ANTES QUE EL NÚMERO ─────────────────
// «Cuántos guards EXISTEN» presupone una definición de GUARD, y **el árbol no la tiene**: no hay
// ni una línea en `docs/` ni en el máster que diga qué distingue un guard de un test cualquiera.
// Mirando la lista salen `billingPlan`, `flags`, `locales`, `invoiceNumber`: tests unitarios de
// funciones puras. Llamarlos «guards sin vigilar» inventaría deuda.
//
// Así que el cubo de arriba se parte por la ÚNICA señal auto-declarada que hay en el árbol: que
// el propio test se llame GUARD en su título. Es estrecha y se queda corta a propósito — prefiero
// un suelo firme y pequeño que un número grande que no se sostiene.
const seLlamaGuard = (src) => /test\(\s*[`'"][^`'"]*GUARD/i.test(src);
const sinVigilarAutodeclarados = clases.sinVigilar.filter((f) =>
  seLlamaGuard(fs.readFileSync(path.join(DIR, f), 'utf8')));

console.log('');
console.log('══ 🔴 EL LÍMITE: «GUARD» NO ESTÁ DEFINIDO EN EL ÁRBOL ══════════════════');
console.log('   de los ' + clases.sinVigilar.length + ' que no declaran y SÍ se pueden mutar,');
console.log('   los que se AUTODECLARAN guard en el título de un test: ' + sinVigilarAutodeclarados.length);
console.log('   el resto (' + (clases.sinVigilar.length - sinVigilarAutodeclarados.length)
  + ') NO se puede afirmar que sean guards: van a NO CLASIFICADO.');
console.log('');
if (sinVigilarAutodeclarados.length) {
  console.log('🔴 SE LLAMAN GUARD, SE PUEDEN MUTAR Y NO DECLARAN — uno a uno:');
  for (const f of sinVigilarAutodeclarados) {
    const n = nacimiento.get(f);
    const cuando = n ? (new Date(n) < SCRUM745 ? 'pre-745 ' : 'post-745') : '   ?    ';
    console.log('   · ' + cuando + '  ' + f);
  }
}
