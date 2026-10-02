#!/usr/bin/env node
// scripts/senal-de-nombres.mjs — SCRUM-1339d
//
// ¿Están en el TAP todos los tests que el árbol declara? Dice cuáles faltan, con fichero y líneas.
//
//   node scripts/senal-de-nombres.mjs <ruta-del-tap> [--raiz <carpeta>]
//   node scripts/senal-de-nombres.mjs --tasa <registros.json>
//
// El veredicto vive en `_senal-de-nombres.mjs`, que es PURO. Aquí sólo se leen ficheros y se
// imprime — el mismo reparto que `suelo-de-la-tanda.mjs` / `_suelo-de-la-tanda.mjs`.
//
// 🔴 ESTE GUION SALE SIEMPRE 0, Y NO POR INTENCIÓN: POR CONSTRUCCIÓN (SCRUM-1339 c.17954).
// La señal AVISA; no bloquea (c.17935). «Termina con `exit 0`» es una promesa: un guion que
// revienta ANTES de llegar ahí —un `import` que no resuelve, un fichero que no está, un JSON que
// no parsea— sale 1 igual. Por eso:
//   · NO hay ni un `import` estático de nada que pueda faltar: el módulo puro y el censo se
//     cargan con `import()` DENTRO del `try`;
//   · todo el trabajo va dentro de un `try` de nivel superior;
//   · y lo que no caiga ahí lo recogen `uncaughtException` y `unhandledRejection`.
// ⛔ Y el `catch` NO SE CALLA: imprime qué pasó, con el mismo rótulo «NO PUDE MEDIR» que usa el
// módulo cuando el TAP no está entero. Un catch mudo sería un CIEGO silencioso, que es el
// defecto que este ticket persigue, construido dentro de su arreglo.
import fs from 'node:fs';
import path from 'node:path';

const ROTULO = 'señal de nombres';
const RAIZ_POR_DEFECTO = path.resolve(import.meta.dirname, '..');
// Las líneas `::notice` / `::warning` se imprimen SIEMPRE, también fuera del CI, donde son sólo
// texto. A propósito: un guion que hace una cosa en el CI y otra en local no se comprueba en
// ninguno de los dos (SCRUM-702), y así el test corre exactamente lo que corre el paso.

const unaLinea = (e) => String(e && e.message ? e.message : e).split('\n')[0];
const escaparDato = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

/** Lo que se dice cuando NO se pudo medir. Nunca se lee como «no falta nada», y sale 0. */
function noPudeMedir(que) {
  const linea = `[${ROTULO}] ⚠️ NO PUDE MEDIR: ${que}`;
  console.log('\n' + linea);
  console.log('   Esto NO es «no falta nada»: es que no se ha podido comprobar. El paso sale 0 a propósito.\n');
  console.log(`::warning title=${ROTULO} · NO PUDE MEDIR::` + escaparDato(que));
  alResumen(linea);
  process.exitCode = 0;
}

/** Al resumen del job, si lo hay. Que no se pueda escribir no es motivo para caer. */
function alResumen(texto) {
  const destino = process.env.GITHUB_STEP_SUMMARY;
  if (!destino) return;
  try {
    fs.appendFileSync(destino, '\n```\n' + texto + '\n```\n');
  } catch (e) {
    console.log(`[${ROTULO}] (no pude escribir en el resumen del job: ${unaLinea(e)})`);
  }
}

process.on('uncaughtException', (e) => { noPudeMedir(`error sin recoger: ${unaLinea(e)}`); process.exit(0); });
process.on('unhandledRejection', (e) => { noPudeMedir(`promesa rechazada sin recoger: ${unaLinea(e)}`); process.exit(0); });

function argumentos(argv) {
  const a = { tap: null, raiz: RAIZ_POR_DEFECTO, tasa: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--raiz') a.raiz = path.resolve(argv[++i] ?? '');
    else if (argv[i] === '--tasa') a.tasa = argv[++i] ?? '';
    else if (a.tap === null) a.tap = argv[i];
  }
  return a;
}

async function medir({ tap, raiz }) {
  const m = await import('./_senal-de-nombres.mjs');
  const censo = await import('../tests/_poblacion-de-tests.mjs');
  if (!tap) return noPudeMedir('falta la ruta del TAP. uso: node scripts/senal-de-nombres.mjs <ruta-del-tap> [--raiz <carpeta>]');

  let texto;
  try {
    texto = fs.readFileSync(tap, 'utf8');
  } catch (e) {
    return noPudeMedir(`no pude leer el TAP «${tap}»: ${unaLinea(e)}`);
  }

  const dir = path.join(raiz, 'tests');
  const fuentes = fs.readdirSync(dir).filter((n) => n.endsWith('.test.mjs'))
    .map((n) => ({ fichero: n, codigo: fs.readFileSync(path.join(dir, n), 'utf8') }));

  const r = m.senalDeNombres({ fuentes, tap: texto, censoDelArbol: censo.testsDeclaradosEn(raiz) });
  const texto2 = m.informe(r);
  console.log('\n' + texto2 + '\n');
  for (const c of m.comandosDeAnotacion(r)) console.log(c);
  alResumen(texto2);
}

async function tasa(ruta) {
  const m = await import('./_senal-de-nombres.mjs');
  let datos;
  try {
    datos = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  } catch (e) {
    return noPudeMedir(`no pude leer los registros «${ruta}»: ${unaLinea(e)}`);
  }
  if (!Array.isArray(datos)) return noPudeMedir(`los registros de «${ruta}» no son una lista`);
  // Cada elemento es un registro, o la LÍNEA de registro tal como salió en la anotación del run.
  const registros = datos.map((d) => (typeof d === 'string' ? m.registroDesdeLinea(d) : d));
  console.log('\n' + m.lineaDeTasa(m.tasaDeRegistros(registros)) + '\n');
}

try {
  const a = argumentos(process.argv.slice(2));
  if (a.tasa !== null) await tasa(a.tasa); else await medir(a);
} catch (e) {
  noPudeMedir(`el guion reventó: ${unaLinea(e)}`);
}
process.exitCode = 0;
