// censo-exentas.mjs — SCRUM-1340 ①
//
// CUÁNTOS registros posteriores al corte tocan la interfaz y el guard de la skill los exime.
//
// La pregunta «¿este registro toca la interfaz?» NO se le hace al registro (que es lo que hace
// el guard, y por eso exime a quien no escribe la ruta): se le hace al MERGE que lo trajo. Un PR
// de `main` es un commit de primer padre; lo que ese commit cambió respecto a su primer padre es
// lo que el PR hizo, lo escribiera como lo escribiera.
//
// Uso:  node censo-exentas.mjs <raíz del repo> <fichero de salida .json>
// Sólo LEE: git log, git diff, git show y el árbol. No escribe en el repo.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [, , RAIZ, SALIDA] = process.argv;
if (!RAIZ || !SALIDA) { console.error('uso: node censo-exentas.mjs <raiz> <salida.json>'); process.exit(2); }

const git = (args) => execFileSync('git', args, {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
});

const m267 = await import(pathToFileURL(path.join(RAIZ, 'tests/scrum267-ancla-de-medicion.test.mjs')).href);
const m811 = await import(pathToFileURL(path.join(RAIZ, 'tests/scrum811c-skill-ui-declarada.test.mjs')).href);
const { entradasTroceadas, RE_ANCLA } = m267;
const { fechaDeEntrada, tocaPublic, declaraSkillUi, entradasSinDeclarar } = m811;

const CORTE = '2026-09-22';
const RE_UI = /^public\/.+\.(js|css|html)$/;
const RE_REG = /^docs\/master\/(SCRUM-\d+\.md)$/;

// El día en Madrid (CEST, +02:00 hasta el 25-oct-2026) de un instante ISO.
const diaMadrid = (iso) => new Date(new Date(iso).getTime() + 2 * 3600 * 1000).toISOString().slice(0, 10);

// ── 1 · los merges de primer padre posteriores al corte, con lo que cambió cada uno ───────────
const SEP = String.fromCharCode(1);
const crudo = git(['log', '--first-parent', '--diff-merges=first-parent', '--name-only',
  '--since=2026-09-21T00:00:00Z', '--format=%x01%H%x09%cI%x09%P%x09%s', 'HEAD']);
const merges = crudo.split(SEP).filter(Boolean).map((bloque) => {
  const [cab, ...resto] = bloque.split('\n');
  const [sha, fecha, padres, asunto] = cab.split('\t');
  const ficheros = resto.map((l) => l.trim()).filter(Boolean);
  return { sha, fecha, dia: diaMadrid(fecha), padres: padres.split(' ').length, asunto, ficheros };
}).filter((m) => m.dia > CORTE);

const conUi = merges.filter((m) => m.ficheros.some((f) => RE_UI.test(f)));
const conUiYRegistro = conUi.filter((m) => m.ficheros.some((f) => RE_REG.test(f)));
const conUiSinRegistro = conUi.filter((m) => !m.ficheros.some((f) => RE_REG.test(f)));

// ── 2 · las entradas del árbol de HOY ─────────────────────────────────────────────────────────
const entradas = entradasTroceadas();
const porFichero = new Map();
for (const e of entradas) {
  if (!porFichero.has(e.fichero)) porFichero.set(e.fichero, []);
  porFichero.get(e.fichero).push(e);
}

// ── 3 · para cada (merge con UI, registro que tocó): qué entradas de HOY trajo ────────────────
// Una entrada «nace» en el merge si su línea de título está entre las líneas que el merge añadió.
// Una entrada es «tocada» si alguna de sus líneas largas (≥ 30) está entre las añadidas.
const lineasAnadidas = (sha, ruta) => {
  const d = git(['diff', '-U0', '--no-color', `${sha}^1`, sha, '--', ruta]);
  return new Set(d.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1).replace(/\r$/, '')));
};

const filas = [];            // una por (entrada de interfaz por efecto)
const sinCasar = [];         // (merge, registro) donde no supe atribuir a ninguna entrada de hoy
const vistas = new Map();    // clave → fila
for (const m of conUiYRegistro) {
  const ui = m.ficheros.filter((f) => RE_UI.test(f));
  for (const ruta of m.ficheros.filter((f) => RE_REG.test(f))) {
    const nombre = RE_REG.exec(ruta)[1];
    const deHoy = porFichero.get(nombre) || [];
    if (!deHoy.length) { sinCasar.push({ sha: m.sha, nombre, por: 'el registro ya no existe o no tiene entradas' }); continue; }
    const mas = lineasAnadidas(m.sha, ruta);
    const nacidas = deHoy.filter((e) => mas.has(e.tituloCompleto.replace(/\r$/, '')));
    const tocadas = deHoy.filter((e) => e.cuerpo.split('\n').some((l) => l.replace(/\r$/, '').length >= 30 && mas.has(l.replace(/\r$/, ''))));
    const atribuidas = nacidas.length ? nacidas : tocadas;
    if (!atribuidas.length) { sinCasar.push({ sha: m.sha, nombre, por: 'ninguna línea añadida sigue en una entrada de hoy' }); continue; }
    for (const e of atribuidas) {
      if (!vistas.has(e.clave)) {
        const f = fechaDeEntrada(e.cuerpo);
        const ancla = RE_ANCLA.exec(e.cuerpo);
        const fila = {
          clave: e.clave,
          fichero: e.fichero,
          nacida: nacidas.includes(e),
          merges: [],
          uiDelMerge: new Set(),
          nombraRutaPublic: tocaPublic(e.cuerpo),
          fechaCampo: f,
          fechaAncla: ancla ? ancla[2].slice(0, 10) : null,
          declara: declaraSkillUi(e.cuerpo),
        };
        // lo que hace HOY el guard con ella, tal cual: ¿la mira?
        fila.elGuardLaMira = fila.nombraRutaPublic && !!f && f > CORTE;
        fila.motivoExenta = fila.elGuardLaMira ? null
          : !fila.nombraRutaPublic && !f ? 'sin ruta public/ y sin Fecha'
            : !fila.nombraRutaPublic ? 'sin ruta public/'
              : !f ? 'sin Fecha'
                : 'Fecha escrita en o antes del corte';
        vistas.set(e.clave, fila);
        filas.push(fila);
      }
      const fila = vistas.get(e.clave);
      fila.merges.push({ sha: m.sha, dia: m.dia, asunto: m.asunto });
      ui.forEach((u) => fila.uiDelMerge.add(u));
      if (nacidas.includes(e)) fila.nacida = true;
    }
  }
}
for (const f of filas) f.uiDelMerge = [...f.uiDelMerge].sort();

// ── 4 · la sonda independiente, SIN git: lo que hace hoy el guard, sobre todo el árbol ────────
const todas = entradas.map((e) => ({ clave: e.clave, toca: tocaPublic(e.cuerpo), fecha: fechaDeEntrada(e.cuerpo), declara: declaraSkillUi(e.cuerpo) }));
const mideHoy = todas.filter((t) => t.toca && t.fecha && t.fecha > CORTE);
const tocaSinFecha = todas.filter((t) => t.toca && !t.fecha);
const tocaPreCorte = todas.filter((t) => t.toca && t.fecha && t.fecha <= CORTE);

// ── 5 · la misma cuenta por UNIDAD (el PR), que es quien toca la interfaz ─────────────────────
// Un PR que toca interfaz «declara» si AL MENOS UNA de las entradas que escribió declara.
// «Lo mira el guard» si al menos una de ellas es de las que el guard exige hoy.
const unidades = conUiYRegistro.map((m) => {
  const suyas = filas.filter((f) => f.merges.some((x) => x.sha === m.sha));
  return {
    sha: m.sha, dia: m.dia, asunto: m.asunto,
    entradas: suyas.map((f) => f.clave),
    declara: suyas.some((f) => f.declara),
    laMiraElGuard: suyas.some((f) => f.elGuardLaMira),
  };
});
const unidadesExentas = unidades.filter((u) => !u.laMiraElGuard);

const exentas = filas.filter((f) => !f.elGuardLaMira);
const cuenta = (xs, k) => xs.reduce((a, x) => { a[x[k]] = (a[x[k]] || 0) + 1; return a; }, {});

const resumen = {
  medidoSobre: { head: git(['rev-parse', 'HEAD']).trim(), corte: CORTE },
  poblacion: {
    registros: porFichero.size,
    entradas: entradas.length,
    mergesDePrimerPadreTrasElCorte: merges.length,
    deEllosConUnPadre: merges.filter((m) => m.padres === 1).length,
    mergesQueTocanInterfaz: conUi.length,
    deEllosConRegistro: conUiYRegistro.length,
    deEllosSinNingunRegistro: conUiSinRegistro.length,
  },
  entradasDeInterfazPorEfecto: {
    total: filas.length,
    lasMiraElGuard: filas.length - exentas.length,
    exentas: exentas.length,
    exentasPorMotivo: cuenta(exentas, 'motivoExenta'),
    exentasQueAunAsiDeclaran: exentas.filter((f) => f.declara).length,
    exentasQueNoDeclaran: exentas.filter((f) => !f.declara).length,
    miradasQueDeclaran: filas.filter((f) => f.elGuardLaMira && f.declara).length,
    nacidasEnElMerge: filas.filter((f) => f.nacida).length,
    soloTocadas: filas.filter((f) => !f.nacida).length,
    exentasNacidas: exentas.filter((f) => f.nacida).length,
    exentasSoloTocadas: exentas.filter((f) => !f.nacida).length,
    exentasConFechaDeAncla: exentas.filter((f) => f.fechaAncla).length,
  },
  porUnidad: {
    prQueTocanInterfaz: unidades.length,
    losMiraElGuard: unidades.length - unidadesExentas.length,
    exentos: unidadesExentas.length,
    exentosQueDeclaran: unidadesExentas.filter((u) => u.declara).length,
    exentosQueNoDeclaran: unidadesExentas.filter((u) => !u.declara).length,
    sinNingunaEntradaAtribuida: unidades.filter((u) => u.entradas.length === 0).length,
    noDeclaranPorDia: cuenta(unidades.filter((u) => !u.declara), 'dia'),
    declaranPorDia: cuenta(unidades.filter((u) => u.declara), 'dia'),
  },
  sinCasar: sinCasar.length,
  sondaSinGit: {
    entradasQueNombranRutaPublic: todas.filter((t) => t.toca).length,
    lasMiraHoyElGuard: mideHoy.length,
    deEllasDeclaran: mideHoy.filter((t) => t.declara).length,
    nombranRutaPeroSinFecha: tocaSinFecha.length,
    nombranRutaConFechaPreCorte: tocaPreCorte.length,
    loQueDiceElGuard_sinDeclarar: entradasSinDeclarar(entradas).length,
  },
  // comparación de CONJUNTOS entre las dos sondas
  cruce: {
    miradasPorElGuardQueElEfectoNoVe: mideHoy.filter((t) => !vistas.has(t.clave)).map((t) => t.clave),
  },
};

fs.writeFileSync(SALIDA, JSON.stringify({ resumen, unidades, exentas, filas, sinCasar,
  mergesConUiSinRegistro: conUiSinRegistro.map((m) => ({ sha: m.sha, dia: m.dia, asunto: m.asunto, ui: m.ficheros.filter((f) => RE_UI.test(f)) })),
}, null, 1));
console.log('CENSO-1340 ' + JSON.stringify(resumen, null, 1));
console.log('CENSO-1340 EXIT=0');
