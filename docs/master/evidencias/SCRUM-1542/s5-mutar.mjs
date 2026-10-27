#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1542/s5-mutar.mjs — S5, 13-oct-2026
//
// ¿Caen los tests de `tests/scrum1542c-…` cuando se quita lo que dicen proteger?
//
// Aplica UNA mutación cada vez sobre el árbol, corre ese fichero de tests, mira QUÉ test cae y
// restaura los bytes. Dos listas: las DECLARADAS en el propio test (`MUTACIONES_QUE_ME_TUMBAN`,
// las que el meta-guard correrá en CI) y unas EXTRA que sólo viven aquí.
//
//   node docs/master/evidencias/SCRUM-1542/s5-mutar.mjs <carpeta para los TAP, FUERA del árbol>
//
// Antes de mutar corre la BASE sin tocar nada: sin ella, un test inestable que cae se lee como un
// mutante que muere. Cada fila lleva el `git diff --numstat` del momento, para que «mutante
// puesto» no sea una frase. Sale 0 si todas mueren por el test que dicen, 1 si alguna sobrevive
// o cae por otro, 2 si no pudo medir (ancla que no está una sola vez, base en rojo, árbol sucio).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const TEST = 'tests/scrum1542c-el-hueco-se-fecha-por-entrada.test.mjs';
const dirTap = process.argv[2];
if (!dirTap || !path.isAbsolute(dirTap)) { console.error('uso: s5-mutar.mjs <carpeta ABSOLUTA para los TAP, fuera del árbol>'); process.exit(2); }
fs.mkdirSync(dirTap, { recursive: true });

const git = (...a) => String(execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8' })).trim();
const sucio = () => git('status', '--porcelain', '--untracked-files=no');

/** Las declaradas: el literal del array, leído del fichero (importarlo ejecutaría sus tests). */
const fuente = fs.readFileSync(path.join(RAIZ, TEST), 'utf8');
const desde = fuente.indexOf('export const MUTACIONES_QUE_ME_TUMBAN = ');
if (desde === -1) { console.error('🔴 CIEGO: el test no declara MUTACIONES_QUE_ME_TUMBAN'); process.exit(2); }
const declaradas = new Function('return ' + fuente.slice(desde).replace('export const MUTACIONES_QUE_ME_TUMBAN = ', '').replace(/;\s*$/, ''))();

const EXTRA = [
  { fichero: 'scripts/_vigilante-de-despliegue.mjs', de: ".filter((l) => /^\\d+$/.test(l)).map(Number);", a: '.map(Number);', cae: 'una salida de `git log` vacía o ilegible NO es el año 1970' },
  { fichero: 'scripts/_vigilante-de-despliegue.mjs', de: "    ? ' (en ' + entradasPorDelante + ' entrada(s) a `main`)' : '';", a: "    ? '' : '';", cae: 'Y SIGUE CANTANDO' },
  { fichero: 'scripts/vigilante-de-despliegue.mjs', de: 'if (url !== URL_POR_DEFECTO) {', a: 'if (false) {', cae: 'EL CASO DEL 13-oct' },
  { fichero: 'scripts/_ritmo-de-despliegue.mjs', de: '    shaDeMain: main ? main[1] : null,', a: '    shaDeMain: null,', cae: 'la lectura anterior trae TAMBIÉN su hora y su `main`' },
  { fichero: 'scripts/_ritmo-de-despliegue.mjs', de: '    epoch: Number.isFinite(ms) ? Math.trunc(ms / 1000) : null,', a: '    epoch: null,', cae: 'la lectura anterior trae TAMBIÉN su hora y su `main`' },
  { fichero: 'scripts/_ritmo-de-despliegue.mjs', de: '(e > t0 || laAnteriorNoVioHueco)', a: '(e > t0)', cae: 'la holgura: un merge que cae entre el `fetch`' },
  { fichero: 'scripts/_ritmo-de-despliegue.mjs', de: '  if (hayHuecoFechado && !hayHoraAnterior) {', a: '  if (false) {', cae: 'una lectura anterior SIN hora no sirve' },
  { fichero: 'scripts/_ritmo-de-despliegue.mjs', de: 'export const HOLGURA_DE_LECTURA_S = 600;', a: 'export const HOLGURA_DE_LECTURA_S = 0;', cae: 'la holgura: un merge que cae entre el `fetch`' },
  { fichero: 'scripts/vigia-despliegue-aviso.mjs', de: "simulacro: process.env.VIGIA_SIMULACRO === 'true',", a: "simulacro: Boolean(process.env.VIGIA_SIMULACRO),", cae: 'el CLI del aviso sólo hace simulacro con `VIGIA_SIMULACRO=true`' },
  { fichero: 'scripts/vigia-despliegue-aviso.mjs', de: '  const titulo = simulacro ? TITULO_DEL_SIMULACRO : TITULO_DEL_AVISO;', a: '  const titulo = TITULO_DEL_AVISO;', cae: 'el aviso de un simulacro lo dice LO PRIMERO' },
  { fichero: 'scripts/equipo/simulacro-del-vigia.mjs', de: "  const abiertoPorElSimulacro = accion === 'crear' && issue.title === TITULO_DEL_SIMULACRO;", a: '  const abiertoPorElSimulacro = true;', cae: '«¿sonó?» se decide sobre el Issue LEÍDO DE VUELTA' },
  { fichero: 'scripts/equipo/simulacro-del-vigia.mjs', de: "  if (!marca || !String(issue.body || '').includes(marca)) {", a: '  if (false) {', cae: '«¿sonó?» se decide sobre el Issue LEÍDO DE VUELTA' },
  { fichero: 'scripts/equipo/simulacro-del-vigia.mjs', de: '  if (fs.existsSync(estado)) muere(', a: '  if (false) muere(', cae: 'DE PUNTA A PUNTA: el simulacro siembra' },
  { fichero: 'scripts/equipo/simulacro-del-vigia.mjs', de: '    return { produccion: x.padre, primeraPendiente: x.sha,', a: '    return { produccion: x.sha, primeraPendiente: x.sha,', cae: 'la producción fabricada deja un hueco' },
  { fichero: '.github/workflows/vigia-despliegue.yml', de: '        if: always() && !inputs.simulacro\n', a: '        if: always()\n', cae: 'el simulacro pasa por los MISMOS pasos' },
  { fichero: '.github/workflows/vigia-despliegue.yml', de: '        if: ${{ !inputs.simulacro }}\n', a: '', cae: 'el simulacro pasa por los MISMOS pasos' },
  { fichero: '.github/workflows/vigia-despliegue.yml', de: '          VIGIA_URL: ${{ steps.simulacro.outputs.url }}\n', a: '', cae: 'el simulacro pasa por los MISMOS pasos' },
  { fichero: '.github/workflows/vigia-despliegue.yml', de: '              && gh issue close "$SIMULACRO_NUMERO" --repo "$REPO" \\\n', a: '              && true \\\n', cae: 'el simulacro pasa por los MISMOS pasos' },
  { fichero: '.github/workflows/vigia-despliegue.yml', de: "run-name: ${{ inputs.simulacro && 'SIMULACRO del aviso del vigía", a: "run-name: ${{ inputs.simulacro && 'Ensayo del aviso del vigía", cae: 'el latido aparta las corridas de simulacro' },
];

function corre(etiqueta) {
  const tap = path.join(dirTap, etiqueta + '.tap');
  const entorno = { ...process.env };
  delete entorno.FORCE_COLOR; delete entorno.NODE_OPTIONS;
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', '--test-reporter-destination=' + tap, TEST], { cwd: RAIZ, encoding: 'utf8', env: entorno });
  const texto = fs.existsSync(tap) ? fs.readFileSync(tap, 'utf8') : '';
  const lineas = texto.split('\n');
  const ok = lineas.filter((l) => /^ok \d+ /.test(l)).length;
  const caidos = lineas.filter((l) => /^not ok \d+ /.test(l)).map((l) => l.replace(/^not ok \d+ - /, ''));
  return { codigo: r.status, ok, caidos, total: ok + caidos.length };
}

if (sucio()) { console.error('🔴 CIEGO: el árbol tiene cambios sin commit en ficheros seguidos. Se muta sobre un commit, no sobre trabajo a medias:\n' + sucio()); process.exit(2); }
console.log('POBLACION · ' + declaradas.length + ' mutaciones declaradas + ' + EXTRA.length + ' extra · HEAD ' + git('rev-parse', 'HEAD'));

const base = corre('base');
console.log(`BASE sin mutar · ${base.ok} de ${base.total} pasan · código ${base.codigo}`);
if (base.codigo !== 0 || base.caidos.length || base.total === 0) { console.error('🔴 CIEGO: la base no está en verde, o no corrió ningún test. Sin base no se lee ninguna mutación.'); process.exit(2); }

let mal = 0; let ciegas = 0; let n = 0;
for (const [lista, muts] of [['declarada', declaradas], ['extra', EXTRA]]) {
  for (const m of muts) {
    n += 1;
    const abs = path.join(RAIZ, m.fichero);
    const original = fs.readFileSync(abs);
    const texto = original.toString('utf8');
    const veces = texto.split(m.de).length - 1;
    if (veces !== 1) { ciegas += 1; console.log(`🔴 CIEGA  ${n} (${lista}) · el ancla está ${veces} veces en ${m.fichero}, y tiene que estar UNA: ${JSON.stringify(m.de.slice(0, 70))}`); continue; }
    let fila;
    try {
      fs.writeFileSync(abs, texto.replace(m.de, m.a));
      const numstat = git('diff', '--numstat', '--', m.fichero);
      const r = corre('mut-' + String(n).padStart(2, '0'));
      const porElSuyo = r.caidos.some((c) => c.includes(m.cae));
      const veredicto = r.total === 0 ? 'CIEGA (no corrió ningún test)' : porElSuyo ? 'MUERE' : r.caidos.length ? 'MUERE POR OTRO' : 'SOBREVIVE';
      if (r.total === 0) ciegas += 1; else if (!porElSuyo) mal += 1;
      fila = `${porElSuyo ? '✅' : '🔴'} ${veredicto.padEnd(9)} ${n} (${lista}) · ${m.fichero} · numstat «${numstat}» · caen ${r.caidos.length} de ${r.total}${porElSuyo ? '' : ' · esperaba: ' + m.cae + (r.caidos.length ? ' · cayeron: ' + r.caidos.join(' | ') : '')}`;
    } finally {
      fs.writeFileSync(abs, original);
    }
    if (!fs.readFileSync(abs).equals(original)) { console.error('🔴 NO SE PUDO RESTAURAR ' + m.fichero + ': mira el árbol a mano.'); process.exit(3); }
    console.log(fila);
  }
}
const resto = sucio();
console.log(`RESUMEN · ${n} mutaciones · ${n - mal - ciegas} mueren por su test · ${mal} no · ${ciegas} ciegas · árbol tras restaurar: ${resto ? 'SUCIO\n' + resto : 'limpio'}`);
const salida = resto ? 3 : ciegas ? 2 : mal ? 1 : 0;
console.log('EXIT=' + salida);
process.exit(salida);
