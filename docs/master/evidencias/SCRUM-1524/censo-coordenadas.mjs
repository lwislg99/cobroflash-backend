// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1524 · ¿CUÁNTAS COORDENADAS DE `docs/legal/` APUNTAN A ALGO QUE YA NO ESTÁ DONDE DICEN?
//
// ES UNA MEDICIÓN. No arregla ninguna cita, no toca `scrum525d` y no escribe en `docs/legal/`.
//
// DOS FALLOS QUE NO SE MEZCLAN:
//   F1 · el FICHERO citado no existe hoy                         ← evidente
//   F2 · el fichero existe y la LÍNEA ya no dice lo que decía    ← silencioso
//
// CÓMO SE MIDE F2 SIN ADIVINAR QUÉ AFIRMA LA FRASE. Una coordenada sin testigo no dice qué símbolo
// espera, y deducirlo de la prosa es lo que SCRUM-525b pagó con un verde falso. Aquí no se deduce:
// se busca en el historial del DOCUMENTO el commit en que esa coordenada (`ruta:NN`) entró en él,
// se lee qué había en esa línea del fichero citado EN ESE COMMIT, y se compara con lo que hay hoy.
//
//   INTACTA     · la línea dice hoy lo mismo que el día que se citó
//   DESPLAZADA  · dice otra cosa, y lo que decía está hoy en otra línea    (F2)
//   CAMBIADA    · dice otra cosa, y lo que decía ya no está en el fichero  (F2: hay que leerla)
//   FUERA       · la línea ya no existe (el fichero es más corto)          (F2)
//
// ⚠️ LO QUE ESTO **NO** MIDE: si la cita ya apuntaba MAL el día que nació. «INTACTA» quiere decir
// «no se ha movido desde que se escribió», no «apunta a lo que la frase afirma». Eso sólo lo da
// un testigo escrito, y es lo que `scrum525d` comprueba en las que lo llevan.
//
// EL EXTRACTOR ES EL DE LA CASA (`scripts/_anclas-con-testigo.mjs`): la población es la suya.
//
// 🔴 EL CONTROL, Y SIN ÉL NO SE IMPRIME NI UNA CIFRA. Antes de mirar el árbol real, este fichero
// fabrica un repositorio desechable con citas SEMBRADAS —buenas y rotas de cada clase— y exige
// que cada una salga con su veredicto. Si falta una rota sembrada dice CIEGO y sale 2: no verde.
//   node censo-coordenadas.mjs                 censo real (con el control delante)
//   node censo-coordenadas.mjs --sin-rotas     control SIN las rotas: tiene que decir CIEGO
//   node censo-coordenadas.mjs --tsv <fichero> además, una fila por coordenada
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { coordenadasDe, veredictoDe, identidad, POBLACION } from '../../../../scripts/_anclas-con-testigo.mjs';

const RAIZ_REAL = path.resolve(import.meta.dirname, '..', '..', '..', '..');

const git = (raiz, args, { crudo = false } = {}) => {
  try {
    const s = execFileSync('git', ['-C', raiz, ...args], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
    return crudo ? s : s.trimEnd();
  } catch { return null; }
};

const lineas = (txt) => txt.split(/\r?\n/);
const clave = (c) => `${c.ruta}|${c.a}|${c.b}`;
/** Una línea que no dice nada no sirve de referencia: está en todas partes. */
const esTrivial = (ls) => ls.every((l) => /^[\s{}()[\];,]*$/.test(l) || /^(return;?|else \{?|\} else \{|break;|continue;|\/\/|\*\/|\/\*\*?)$/.test(l.trim()));

/** `ruta` contra una lista de ficheros: exacta, o por el final de la ruta (cita abreviada). */
function resolver(ruta, lista) {
  if (lista.conjunto.has(ruta)) return { forma: 'COMPLETA', rutas: [ruta] };
  const cola = '/' + ruta;
  const rutas = lista.todas.filter((f) => f.endsWith(cola));
  return { forma: ruta.includes('/') ? 'PARCIAL' : 'SOLO_NOMBRE', rutas };
}

export function censar(raiz) {
  const cacheArbol = new Map();
  const arbolEn = (sha) => {
    if (!cacheArbol.has(sha)) {
      const todas = (git(raiz, ['ls-tree', '-r', '--name-only', sha]) || '').split('\n').filter(Boolean);
      cacheArbol.set(sha, { todas, conjunto: new Set(todas) });
    }
    return cacheArbol.get(sha);
  };
  const cacheTexto = new Map();
  const textoEn = (sha, ruta) => {
    const k = `${sha}:${ruta}`;
    if (!cacheTexto.has(k)) cacheTexto.set(k, git(raiz, ['show', k], { crudo: true }));
    return cacheTexto.get(k);
  };

  const cabeza = git(raiz, ['rev-parse', 'HEAD']);
  const hoy = arbolEn(cabeza);
  const docs = hoy.todas.filter((f) => f.startsWith(POBLACION + '/') && f.endsWith('.md') && !f.slice(POBLACION.length + 1).includes('/')).sort();

  const filas = [];
  let bytes = 0;
  for (const doc of docs) {
    const txt = fs.readFileSync(path.join(raiz, doc), 'utf8');
    bytes += Buffer.byteLength(txt);
    // Historial del documento, de hoy hacia atrás, siguiendo renombrados.
    const crudo = git(raiz, ['log', '--follow', '--format=%x01%H %cs', '--name-only', '--', doc]) || '';
    const versiones = crudo.split('\x01').filter(Boolean).map((b) => {
      const [cab, ...resto] = b.split('\n').filter(Boolean);
      const [sha, fecha] = cab.split(' ');
      return { sha, fecha, ruta: resto[0] || doc };
    });
    const claves = versiones.map((v) => {
      const t = textoEn(v.sha, v.ruta);
      return t == null ? new Set() : new Set(coordenadasDe(t).map(clave));
    });

    for (const c of coordenadasDe(txt)) {
      const k = clave(c);
      // Nacimiento: la versión más vieja de la racha continua en la que la coordenada está.
      let n = -1;
      for (let i = 0; i < versiones.length && claves[i].has(k); i += 1) n = i;
      const nac = n >= 0 ? versiones[n] : null;
      const casa = c.tachada ? 'TACHADA' : veredictoDe({ ...c }, raiz).estado;
      const f = { doc, linea: c.linea, id: identidad(c), ruta: c.ruta, a: c.a, b: c.b, tachada: c.tachada, testigo: c.testigo, casa, nacio: nac ? `${nac.sha.slice(0, 9)} ${nac.fecha}` : '?' };

      const rHoy = resolver(c.ruta, hoy);
      f.forma = rHoy.forma;
      const rNac = nac ? resolver(c.ruta, arbolEn(nac.sha)) : { rutas: [] };
      let rutaHoy = rHoy.rutas.length === 1 ? rHoy.rutas[0] : null;
      let rutaNac = rNac.rutas.length === 1 ? rNac.rutas[0] : null;
      // Un nombre repetido se desempata con el otro lado, si ese lado es único.
      if (!rutaHoy && rHoy.rutas.length > 1 && rutaNac && rHoy.rutas.includes(rutaNac)) rutaHoy = rutaNac;
      if (!rutaNac && rNac.rutas.length > 1 && rutaHoy && rNac.rutas.includes(rutaHoy)) rutaNac = rutaHoy;

      if (rHoy.rutas.length === 0) {
        f.veredicto = 'F1_AUSENTE';
        f.nota = rNac.rutas.length ? `existía al nacer la cita (${rNac.rutas[0]})` : 'tampoco existía al nacer la cita';
      } else if (!rutaHoy) {
        f.veredicto = 'AMBIGUA';
        f.nota = `${rHoy.rutas.length} ficheros se llaman así hoy: ${rHoy.rutas.slice(0, 3).join(', ')}`;
      } else {
        f.rutaHoy = rutaHoy;
        const L1 = lineas(fs.readFileSync(path.join(raiz, rutaHoy), 'utf8'));
        const t0 = rutaNac ? textoEn(nac.sha, rutaNac) : null;
        const L0 = t0 == null ? null : lineas(t0);
        if (c.b > L1.length) {
          f.veredicto = 'F2_FUERA';
          f.nota = `el fichero tiene hoy ${L1.length} líneas`;
        } else if (!L0 || c.b > L0.length) {
          f.veredicto = 'SIN_REFERENCIA';
          f.nota = !rutaNac ? `al nacer la cita no había UN fichero con ese nombre (${rNac.rutas.length})` : 'al nacer, la línea ya caía fuera';
        } else {
          const T0 = L0.slice(c.a - 1, c.b).map((l) => l.trim());
          const T1 = L1.slice(c.a - 1, c.b).map((l) => l.trim());
          f.decia = T0.join(' ⏎ ').slice(0, 110);
          f.dice = T1.join(' ⏎ ').slice(0, 110);
          f.trivial = esTrivial(T0);
          if (T0.join('\n') === T1.join('\n')) f.veredicto = 'INTACTA';
          else {
            const N1 = L1.map((l) => l.trim());
            const donde = [];
            for (let i = 0; i + T0.length <= N1.length; i += 1) {
              if (T0.every((l, j) => N1[i + j] === l)) donde.push(i + 1);
            }
            f.veredicto = donde.length ? 'F2_DESPLAZADA' : 'F2_CAMBIADA';
            if (donde.length) {
              f.nota = `lo que decía está hoy en ${donde.slice(0, 4).join(', ')}${donde.length > 4 ? '…' : ''}`;
              f.sub = donde.length === 1 ? 'un solo sitio' : 'varios sitios';
              f.salto = Math.min(...donde.map((d) => Math.abs(d - c.a)));
            } else {
              // CAMBIADA se parte en tres con criterios DISCRETOS (ninguna «similitud» con umbral):
              const dice0 = (l) => !esTrivial([l]);
              const enSitio = T0.some((l, j) => dice0(l) && T1[j] === l);
              const fuera = T0.filter(dice0).map((l) => N1.indexOf(l) + 1).filter((n) => n > 0);
              f.sub = enSitio ? 'editada en su sitio' : (fuera.length ? 'movida y además editada' : 'ese texto ya no está en el fichero');
              if (!enSitio && fuera.length) f.nota = `parte de lo que decía está hoy en ${fuera.slice(0, 4).join(', ')}`;
            }
          }
          if (rutaNac !== rutaHoy) f.nota = `${f.nota ? f.nota + ' · ' : ''}el fichero se movió: ${rutaNac} → ${rutaHoy}`;
        }
      }
      filas.push(f);
    }
  }
  return { cabeza, docs, bytes, filas };
}

// ═══ EL CONTROL SEMBRADO ═════════════════════════════════════════════════════════════════════
const SIEMBRA = [
  // [cita, veredicto esperado, es rota]
  ['src/bueno.ts:4', 'INTACTA', false],
  ['solo-nombre.mjs:2', 'INTACTA', false],
  ['src/borrado.ts:3', 'F1_AUSENTE', true],
  ['nombre-borrado.mjs:3', 'F1_AUSENTE', true],
  ['src/nunca-existio.ts:1', 'F1_AUSENTE', true],
  ['src/desplazado.ts:5', 'F2_DESPLAZADA', true],
  ['src/cambiado.ts:5', 'F2_CAMBIADA', true],
  ['src/corto.ts:9', 'F2_FUERA', true],
];

function control({ sinRotas }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1524-siembra-'));
  const g = (...a) => execFileSync('git', ['-C', dir, '-c', 'user.name=siembra', '-c', 'user.email=siembra@invalid', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...a], { stdio: 'ignore' });
  const escribe = (rel, txt) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), txt); };
  const diez = (n) => Array.from({ length: 10 }, (_, i) => `const ${n}_${i + 1} = '${n} línea ${i + 1}';`).join('\n') + '\n';
  try {
    g('init', '-q');
    for (const n of ['bueno', 'borrado', 'desplazado', 'cambiado', 'corto']) escribe(`src/${n}.ts`, diez(n));
    escribe('scripts/solo-nombre.mjs', diez('solo'));
    escribe('scripts/nombre-borrado.mjs', diez('nb'));
    const citas = SIEMBRA.filter(([, , rota]) => !(sinRotas && rota));
    escribe(`${POBLACION}/SIEMBRA.md`, '# Siembra\n\n' + citas.map(([c]) => `- una afirmación — \`${c}\`\n`).join(''));
    g('add', '-A'); g('commit', '-q', '-m', 'siembra: las citas nacen');
    fs.rmSync(path.join(dir, 'src/borrado.ts'));
    fs.rmSync(path.join(dir, 'scripts/nombre-borrado.mjs'));
    escribe('src/desplazado.ts', '// una línea nueva\n// y otra\n' + diez('desplazado'));
    escribe('src/cambiado.ts', diez('cambiado').replace("'cambiado línea 5'", "'otra cosa'"));
    escribe('src/corto.ts', diez('corto').split('\n').slice(0, 3).join('\n') + '\n');
    g('add', '-A'); g('commit', '-q', '-m', 'siembra: el árbol se mueve y las citas no');

    const r = censar(dir);
    const visto = new Map(r.filas.map((f) => [f.id, f.veredicto]));
    const fallos = [];
    for (const [c, esperado, rota] of SIEMBRA) {
      const v = visto.get(c);
      if (sinRotas && rota) { if (v) fallos.push(`${c}: no se sembró y aparece`); continue; }
      if (v !== esperado) fallos.push(`${c}: esperaba ${esperado}, sale ${v ?? 'NO VISTA'}`);
    }
    const rotasVistas = r.filas.filter((f) => /^F[12]_/.test(f.veredicto)).length;
    const rotasSembradas = SIEMBRA.filter(([, , rota]) => rota).length;
    const buenasMarcadas = r.filas.filter((f) => SIEMBRA.some(([c, , rota]) => c === f.id && !rota) && f.veredicto !== 'INTACTA').length;
    return { fallos, rotasVistas, rotasSembradas, buenasMarcadas, sembradas: r.filas.length };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ═══ PRINCIPAL ═══════════════════════════════════════════════════════════════════════════════
const args = process.argv.slice(2);
const sinRotas = args.includes('--sin-rotas');
const tsv = args.includes('--tsv') ? args[args.indexOf('--tsv') + 1] : null;

const k = control({ sinRotas });
console.log(`CONTROL SEMBRADO · ${k.sembradas} citas fabricadas · rotas vistas ${k.rotasVistas} de ${k.rotasSembradas} sembradas · buenas marcadas como rotas ${k.buenasMarcadas}`);
if (k.fallos.length || k.rotasVistas !== k.rotasSembradas || k.buenasMarcadas !== 0) {
  console.log('🔴 CIEGO: el instrumento no ha visto las rotas sembradas (o ha marcado una buena). NO SE IMPRIME NINGUNA CIFRA.');
  for (const f of k.fallos) console.log(`   · ${f}`);
  process.exit(2);
}
console.log('✅ el control ve cada rota sembrada con su clase y no marca ninguna buena\n');

const r = censar(RAIZ_REAL);
const vivas = r.filas.filter((f) => !f.tachada);
const cuenta = (xs, fn) => xs.reduce((m, x) => { const key = fn(x); m[key] = (m[key] || 0) + 1; return m; }, {});
const pinta = (o) => Object.entries(o).sort().map(([a, b]) => `${a} ${b}`).join(' · ');

console.log(`POBLACIÓN · HEAD ${r.cabeza.slice(0, 9)} · ${r.docs.length} documentos de ${POBLACION}/ · ${r.bytes} bytes leídos`);
console.log(`           ${r.filas.length} coordenadas · ${vivas.length} vivas · ${r.filas.length - vivas.length} tachadas`);
console.log(`           únicas (por fichero:línea citado) entre las vivas: ${new Set(vivas.map((f) => f.id)).size}`);
console.log(`\nCÓMO LAS VE LA CASA (veredictoDe)  · ${pinta(cuenta(vivas, (f) => f.casa))}`);
console.log(`CÓMO ESTÁN ESCRITAS                · ${pinta(cuenta(vivas, (f) => f.forma))}`);
console.log(`\nVEREDICTO DE ESTE CENSO, vivas     · ${pinta(cuenta(vivas, (f) => f.veredicto))}`);
console.log('\nCRUCE casa × censo (vivas):');
const cruce = cuenta(vivas, (f) => `${f.casa.padEnd(9)} → ${f.veredicto}`);
for (const [a, b] of Object.entries(cruce).sort()) console.log(`   ${String(b).padStart(4)}  ${a}`);
console.log(`\nINTACTAS cuya línea de nacimiento no dice nada (llave, return…): ${vivas.filter((f) => f.veredicto === 'INTACTA' && f.trivial).length}`);
console.log(`DESPLAZADAS cuya línea de nacimiento no dice nada:               ${vivas.filter((f) => f.veredicto === 'F2_DESPLAZADA' && f.trivial).length}`);
console.log(`\nF2 POR DENTRO (vivas)              · ${pinta(cuenta(vivas.filter((f) => f.sub), (f) => `[${f.veredicto.slice(3)}: ${f.sub}]`))}`);
const saltos = vivas.filter((f) => f.salto != null).map((f) => f.salto).sort((x, y) => x - y);
if (saltos.length) console.log(`SALTO de las desplazadas, en líneas · mínimo ${saltos[0]} · mediana ${saltos[saltos.length >> 1]} · máximo ${saltos[saltos.length - 1]} (sobre ${saltos.length})`);
const rotas = vivas.filter((f) => /^F[12]_/.test(f.veredicto));
console.log(`FICHEROS citados (vivas): ${new Set(vivas.map((f) => f.rutaHoy || f.ruta)).size} distintos · con alguna cita F1/F2: ${new Set(rotas.map((f) => f.rutaHoy || f.ruta)).size}`);
console.log(`\nPOR DOCUMENTO (vivas): total · F1 · F2 (desplazada/cambiada/fuera) · ambigua · sin referencia · intacta`);
for (const d of r.docs) {
  const x = vivas.filter((f) => f.doc === d); if (!x.length) continue;
  const n = (v) => x.filter((f) => f.veredicto === v).length;
  console.log(`   ${d.slice(POBLACION.length + 1).padEnd(46)} ${String(x.length).padStart(3)} · ${n('F1_AUSENTE')} · ${n('F2_DESPLAZADA')}/${n('F2_CAMBIADA')}/${n('F2_FUERA')} · ${n('AMBIGUA')} · ${n('SIN_REFERENCIA')} · ${n('INTACTA')}`);
}
console.log('\nTACHADAS (exentas para la casa):');
for (const f of r.filas.filter((x) => x.tachada)) console.log(`   ${f.doc}:${f.linea} · ${f.id} → ${f.veredicto}`);

if (tsv) {
  const col = ['doc', 'linea', 'id', 'tachada', 'forma', 'casa', 'veredicto', 'sub', 'salto', 'nacio', 'rutaHoy', 'trivial', 'nota', 'decia', 'dice'];
  const limpia = (v) => String(v ?? '').replace(/[\t\r\n]/g, ' ');
  fs.writeFileSync(tsv, col.join('\t') + '\n' + r.filas.map((f) => col.map((c) => limpia(c === 'testigo' ? (f.testigo || []).join(',') : f[c])).join('\t')).join('\n') + '\n');
  console.log(`\nTSV: ${r.filas.length} filas en ${tsv}`);
}
