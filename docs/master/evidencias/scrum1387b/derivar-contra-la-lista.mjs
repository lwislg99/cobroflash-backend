// docs/master/evidencias/scrum1387b/derivar-contra-la-lista.mjs — SCRUM-1387b
//
// LA PREGUNTA: ¿se puede DERIVAR de la historia de git la lista que el PR #2286 llevaba escrita a mano?
// Se contesta comparando CONJUNTOS: con el corte puesto en el `main` contra el que se escribió aquella
// lista, lo que la historia llama «heredado» tiene que ser, nombre a nombre, lo que la lista decía.
//
//   node docs/master/evidencias/scrum1387b/derivar-contra-la-lista.mjs
//
// Lee: el disco (bancos), la historia de `HEAD` (primer padre) y la lista vieja tal como está en el
// commit `888e7ffe2` (rama `j4h-1387-banco-nuevo-va-al-catalogo`, que NO se borra). No escribe nada.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  leerFicherosDeMutacion, clasificar, leerHistoria, juicio, fichaDelHeredado, corteDe,
} from '../../../../tests/_catalogo-obligatorio.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const git = (...a) => execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();

const RAMA_VIEJA = '888e7ffe2a210c0dfad72e61e765f549773afc04';
// El `main` contra el que la sesión J4h escribió la lista (su registro: «Medido contra»).
const MAIN_DE_LA_LISTA = '6536e63e038ef36be9d61fc8057a649ff2af3149';

console.log(`HEAD ............ ${git('rev-parse', 'HEAD')}`);
const h = leerHistoria(RAIZ);
if (h.ciego) { console.log(`CIEGO: ${h.ciego}`); process.exit(2); }
const ficheros = leerFicherosDeMutacion(RAIZ);
const { bancos, fuera } = clasificar(ficheros);
const altaDe = (r) => h.altas.get(r);
console.log(`historia ........ ${h.commits} commits en la línea principal · ${h.altas.size} rutas con alta leída`);
console.log(`disco ........... ${ficheros.length} ficheros con «mut» en el nombre · ${bancos.length} bancos · ${fuera.length} fuera`);
const guionesFuera = fuera.flatMap((b) => b.guiones);
const sinAlta = guionesFuera.filter((g) => !altaDe(g));
console.log(`guiones fuera ... ${guionesFuera.length} · sin alta en la historia: ${sinAlta.length}${sinAlta.length ? ' → ' + sinAlta.join(', ') : ''}`);

// ── ① HOY: el corte es la entrada del guard (o nada, si aún no está en ningún commit) ──────────
const nace = corteDe(h);
const hoy = juicio({ fuera, altaDe, corte: nace ? nace.pos : null });
console.log(`\n① HOY · corte = ${nace ? `${nace.sha} (${nace.fecha})` : 'el guard aún no está en ningún commit'}`);
console.log(`   heredados ${hoy.heredados.length} · nuevos ${hoy.nuevos.length} · suma ${hoy.heredados.length + hoy.nuevos.length} de ${fuera.length} fuera`);
for (const n of hoy.nuevos) console.log(`   NUEVO  ${n.carpeta} → ${n.guiones.join(', ')}`);
const fichas = hoy.heredados.map((b) => fichaDelHeredado(b, altaDe));
const porMotivo = {};
for (const f of fichas) porMotivo[f.motivo] = (porMotivo[f.motivo] || 0) + 1;
console.log(`   por motivo: ${Object.entries(porMotivo).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`   quién la retira: leído en Jira el 7-oct ${fichas.filter((f) => f.retira !== 'sin leer en Jira').length} · sin leer ${fichas.filter((f) => f.retira === 'sin leer en Jira').length}`);
for (const f of fichas.sort((a, b) => (a.desde < b.desde ? -1 : 1))) {
  console.log(`   ${f.desde}  ${f.carpeta.padEnd(42)} ${f.motivo.padEnd(44)} retira: ${f.retira}`);
}

// ── ② EL CONTROL QUE DECIDE: con el corte del 7-oct, ¿sale la lista escrita a mano? ────────────
const viejo = git('show', `${RAMA_VIEJA}:tests/_catalogo-obligatorio.mjs`);
const lista = [...viejo.matchAll(/\{ carpeta: '([^']+)', motivo:/g)].map((m) => m[1]);
const corteViejo = h.posDe(MAIN_DE_LA_LISTA);
console.log(`\n② CONTROL · corte = ${MAIN_DE_LA_LISTA} (pos ${corteViejo} de ${h.commits})`);
console.log(`   lista escrita a mano en ${RAMA_VIEJA.slice(0, 9)}: ${lista.length} carpetas`);
if (lista.length === 0 || corteViejo === undefined) { console.log('   CIEGO: no he podido leer la lista o situar el corte'); process.exit(2); }
const c = juicio({ fuera, altaDe, corte: corteViejo });
const derivados = new Set(c.heredados.map((b) => b.carpeta));
const escritos = new Set(lista);
const soloLista = lista.filter((x) => !derivados.has(x));
const soloHistoria = [...derivados].filter((x) => !escritos.has(x));
console.log(`   derivados de la historia: ${derivados.size} · en los dos: ${lista.filter((x) => derivados.has(x)).length}`);
console.log(`   sólo en la lista: ${soloLista.length}${soloLista.length ? ' → ' + soloLista.join(', ') : ''}`);
console.log(`   sólo en la historia: ${soloHistoria.length}${soloHistoria.length ? ' → ' + soloHistoria.join(', ') : ''}`);
console.log(`   y con ese corte, NUEVOS (lo que entró después del 7-oct): ${c.nuevos.length}`);
for (const n of c.nuevos) {
  const a = n.guiones.map(altaDe).filter(Boolean).sort((x, y) => x.pos - y.pos)[0];
  console.log(`   NUEVO  ${a ? a.fecha : 'sin alta'}  ${n.carpeta} → ${n.guiones.map((g) => g.split('/').pop()).join(', ')}`);
}

// ── ③ CONTROLES DEL PROPIO INSTRUMENTO ────────────────────────────────────────────────────────
// Positivo: con el corte en el primer commit de la historia, TODO lo que está fuera es nuevo.
const todo = juicio({ fuera, altaDe, corte: 1 });
// Cero derivado: con el corte en HEAD, nada es nuevo (salvo lo que no esté en ningún commit).
const nada = juicio({ fuera, altaDe, corte: h.commits });
console.log(`\n③ corte en el commit más viejo → nuevos ${todo.nuevos.length} de ${fuera.length} (tiene que ser todos)`);
console.log(`   corte en HEAD → nuevos ${nada.nuevos.length} (tiene que ser ${sinAlta.length ? 'los sin alta: ' + new Set(sinAlta.map((g) => g.slice(0, g.lastIndexOf('/')))).size : 0})`);
const ok = soloLista.length === 0 && soloHistoria.length === 0 && todo.nuevos.length === fuera.length;
console.log(`\nVEREDICTO: la historia ${ok ? 'REPRODUCE' : 'NO reproduce'} la lista escrita a mano (${lista.length} de ${lista.length} en los dos sentidos${ok ? '' : ': mira arriba'}).`);
console.log(`EXIT=${ok ? 0 : 1}`);
process.exit(ok ? 0 : 1);
