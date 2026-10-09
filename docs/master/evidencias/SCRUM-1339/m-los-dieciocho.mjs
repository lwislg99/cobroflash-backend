#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1339/m-los-dieciocho.mjs — SCRUM-1339m
//
// El obligatorio de #2303 (job 113113442033) salió verde y su señal de nombres dijo «18 ausentes
// en 2 ficheros». La pregunta: ¿la señal no ve nombres que SÍ están, o esos ficheros declaran 55
// y 26 casos y montan menos? Tres caminos que no comparten método:
//
//   A · EJECUTAR cada fichero con `node --test` de verdad y contar lo que registra el TAP.
//   B · FABRICAR la pérdida: quitarle al TAP local los casos que CI dijo ausentes y ver si la
//       señal de la casa dicta la misma frase que dictó en CI.
//   C · COTEJAR con el log del job: su salida `spec` es otro reporter sobre la misma tanda.
//
// SÓLO LEE: no toca la señal, ni tests, ni `scripts/`. Corre los ficheros en un hijo con el
// entorno hecho a mano (sin NODE_TEST_CONTEXT, NODE_OPTIONS ni FORCE_COLOR: SCRUM-1308).
//
//   node m-los-dieciocho.mjs <raiz del árbol, con dist/> <log del job 113113442033> [pasadas]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const [raiz, rutaLog, pasadasArg] = process.argv.slice(2);
const PASADAS = Number(pasadasArg ?? 3);
if (!raiz || !rutaLog) { console.log('uso: node m-los-dieciocho.mjs <raiz> <log> [pasadas]'); process.exit(2); }

const m = await import(pathToFileURL(path.join(raiz, 'scripts', '_senal-de-nombres.mjs')).href);

// Lo que dictó CI, copiado del log (líneas 14736-14737 del log bajado). El CONTROL no sale en el
// aviso: tiene que cuadrar por los tres caminos, o el que mide mal soy yo.
const SUJETOS = [
  { fichero: 'scrum1456-ids-que-no-caben-en-la-columna.test.mjs', ci: { faltan: 12, de: 55, desde: 44, hasta: 55, lineas: '222–249' } },
  { fichero: 'scrum176-guard-mensaje.test.mjs', ci: { faltan: 6, de: 26, desde: 21, hasta: 26, lineas: '179–247' } },
  { fichero: 'scrum1339d-senal-de-nombres.test.mjs', ci: null },
];

const entorno = { ...process.env };
for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR', 'NO_COLOR']) delete entorno[k];

const NL = String.fromCharCode(10);
const log = fs.readFileSync(rutaLog, 'utf8');
const lineasDelLog = log.split(NL);
console.log(`POBLACIÓN · log ${rutaLog.split(/[\\/]/).pop()}: ${Buffer.byteLength(log)} bytes · ${lineasDelLog.length} líneas`);
const resumenSpec = lineasDelLog.filter((l) => /ℹ tests \d+/.test(l)).map((l) => Number(/ℹ tests (\d+)/.exec(l)[1]));
const marcasSpec = lineasDelLog.filter((l) => /^\S+ [✔✖﹣]/.test(l)).length;
console.log(`POBLACIÓN · «ℹ tests» en el log: ${resumenSpec.join(', ')} · líneas de caso del reporter spec (✔ ✖ ﹣ a nivel 0): ${marcasSpec}`);
console.log(`POBLACIÓN · node ${process.version} · ${process.platform} · ${PASADAS} pasada(s) por fichero`);
console.log('');

// 🔴 Aparecer no es tener resultado. La primera versión contaba cualquier línea con el nombre, y
// dio por «presente» el caso 44 de scrum1456, del que el log sólo trae el INICIO («▶»). Lo cazó el
// cruce con lo que nombró la señal (11 contra 12). Ahora se cuentan aparte resultado e inicio.
const conMarca = (nombre, marcas) => lineasDelLog.filter((l) => marcas.some((x) => l.includes(x + ' ' + nombre))).length;
const enElLog = (nombre) => conMarca(nombre, ['✔', '✖', '﹣']);
const iniciosEnElLog = (nombre) => conMarca(nombre, ['▶']);
const quitar = (tap, nombresEscapados) => {
  // Quita del TAP el bloque entero de cada caso nombrado y baja el resumen en lo quitado.
  const fuera = new Set(nombresEscapados);
  const sal = [];
  let saltando = false;
  let quitados = 0;
  for (const l of tap.split(NL)) {
    const mm = /^(not )?ok \d+ - (.*)$/.exec(l.replace(/\r$/, ''));
    if (mm) { saltando = fuera.has(mm[2]); if (saltando) quitados++; }
    else if (saltando && !/^\s/.test(l)) saltando = false;
    if (!saltando) sal.push(l);
  }
  const bajar = (clave) => (l) => (new RegExp(`^# ${clave} \\d+\\s*$`).test(l) ? `# ${clave} ${Number(/\d+/.exec(l)[0]) - quitados}` : l);
  return { tap: sal.map(bajar('tests')).map(bajar('pass')).join(NL), quitados };
};

let descuadres = 0;
for (const s of SUJETOS) {
  const ruta = path.join(raiz, 'tests', s.fichero);
  const codigo = fs.readFileSync(ruta, 'utf8');
  const fuentes = [{ fichero: s.fichero, codigo }];
  const llamadas = m.llamadasDeclaradas(codigo, s.fichero);
  const literales = llamadas.filter((x) => x.clase === 'literal');
  console.log(`══ tests/${s.fichero} ${s.ci ? '' : '(CONTROL: tiene que cuadrar)'}`);
  console.log(`   DECLARA (AST, el recorrido de la señal): ${llamadas.length} llamadas test()/it() · ${literales.length} de nombre literal · ${new Set(literales.map((x) => x.nombre)).size} nombres distintos`);

  // ── A · ejecutar ────────────────────────────────────────────────────────────────────────
  let tapLocal = null;
  for (let i = 1; i <= PASADAS; i++) {
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', path.join('tests', s.fichero)],
      { cwd: raiz, env: entorno, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    const t = m.leerTap(r.stdout);
    const senal = m.senalDeNombres({ fuentes, tap: r.stdout });
    const cuadra = r.status === 0 && t.entero && t.tests === llamadas.length && senal.medible && senal.ausentes === 0;
    if (!cuadra) descuadres++;
    console.log(`   A · pasada ${i}: sale ${r.status} · TAP ${t.bytes} caracteres · líneas de test ${t.lineasDeTest} · resumen tests ${t.tests} pass ${t.pass} fail ${t.fail} skipped ${t.skipped}`
      + ` · la señal: medible=${senal.medible} ausentes=${senal.ausentes} → ${cuadra ? 'CUADRA con lo declarado' : 'NO CUADRA'}`);
    if (!senal.medible) console.log(`       motivo: ${senal.motivo}`);
    tapLocal = r.stdout;
  }

  // ── C · el log del job ──────────────────────────────────────────────────────────────────
  const cuenta = literales.map((x) => ({ ...x, veces: enElLog(x.nombre) }));
  const fuera = cuenta.filter((x) => x.veces === 0);
  const inventado = literales.map((x) => x.nombre + ' ·' + crypto.createHash('sha1').update(x.nombre).digest('hex').slice(0, 8));
  const inventadosVistos = inventado.filter((n) => enElLog(n) > 0).length;
  console.log(`   C · en el log del job (reporter spec): ${cuenta.length - fuera.length} de ${cuenta.length} nombres aparecen · ${fuera.length} no aparecen`
    + (fuera.length ? ` → posiciones ${fuera[0].posicion}–${fuera.at(-1).posicion} · líneas ${fuera[0].linea}–${fuera.at(-1).lineaFin}` : ''));
  console.log(`       control de cero (cada nombre real + 8 hex de su sha1): ${inventadosVistos} de ${inventado.length} aparecen`);
  if (s.ci) {
    const esperadas = cuenta.filter((x) => x.posicion >= s.ci.desde && x.posicion <= s.ci.hasta);
    const mismas = fuera.length === esperadas.length && fuera.every((x, i) => x.posicion === esperadas[i].posicion);
    console.log(`       ¿son las mismas ${s.ci.faltan} que nombró la señal (posiciones ${s.ci.desde}–${s.ci.hasta})? ${mismas ? 'SÍ, el mismo conjunto' : 'NO'}`);
    for (const x of fuera) console.log(`         ${String(x.posicion).padStart(2)} · línea ${x.linea} · ${iniciosEnElLog(x.nombre) ? 'INICIO SIN RESULTADO («▶»)' : 'ni inicio ni resultado'} · ${x.nombre.slice(0, 90)}`);
    console.log(`       control del inicio: de los ${cuenta.length - fuera.length} con resultado, ${cuenta.filter((x) => x.veces > 0 && iniciosEnElLog(x.nombre) > 0).length} llevan además «▶»`);

    // ── B · la pérdida, fabricada sobre el TAP local ──────────────────────────────────────
    const nombres = esperadas.map((x) => m.escaparComoTap(x.nombre));
    const { tap: recortado, quitados } = quitar(tapLocal, nombres);
    const r = m.senalDeNombres({ fuentes, tap: recortado });
    const frase = r.medible && r.bloques.length ? m.describirBloque(r.bloques[0]) : `(sin bloque · medible=${r.medible} · ${r.motivo ?? ''})`;
    const igual = r.medible && r.ausentes === s.ci.faltan && r.bloques[0]?.forma === 'cola' && frase.includes(`posiciones ${s.ci.desde}–${s.ci.hasta} · líneas ${s.ci.lineas}`);
    console.log(`   B · quitados ${quitados} bloques del TAP local (veneno ${quitados === s.ci.faltan ? 'ENTRÓ' : 'NO ENTRÓ'}) → la señal dice: ${frase}`);
    console.log(`       ¿la misma frase que en CI («faltan ${s.ci.faltan} de ${s.ci.de} (cola) · posiciones ${s.ci.desde}–${s.ci.hasta} · líneas ${s.ci.lineas}»)? ${igual ? 'SÍ' : 'NO'}`);
  } else if (fuera.length) {
    descuadres++;
    console.log('       🔴 EL CONTROL NO CUADRA EN EL LOG: el que mide mal es este banco.');
  }
  console.log('');
}
console.log(`DESCUADRES entre lo declarado y lo ejecutado en local: ${descuadres} (sobre ${SUJETOS.length} ficheros × ${PASADAS} pasadas)`);
console.log('EXIT=0');
