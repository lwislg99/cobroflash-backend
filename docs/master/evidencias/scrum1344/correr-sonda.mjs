// docs/master/evidencias/scrum1344/correr-sonda.mjs — SCRUM-1344
//
// LA SEGUNDA SONDA, INDEPENDIENTE DEL CENSO POR AST: en vez de leer los arneses, los CORRE.
//
//     node docs/master/evidencias/scrum1344/correr-sonda.mjs <etiqueta>      (antes | despues)
//
// Qué hace, de uno en uno (nunca dos procesos a la vez):
//   1. saca los candidatos del censo por AST (`tests/_censo-arneses-de-router.mjs`): todo fichero
//      de `tests/` que carga un router de `dist/`, o `dist/app.js`, o que quedó sin juzgar;
//   2. corre cada uno DOS veces: sin sonda (la base) y con `sonda.mjs` delante;
//   3. exige el TESTIGO de la sonda y que base y sonda den los mismos recuentos (A21): si la sonda
//      cambiara al sujeto, no estaría midiendo al sujeto;
//   4. cruza lo que VIO con lo que el AST LEYÓ y escribe `<etiqueta>.json` y `<etiqueta>.txt` aquí.
//
// Sale ≠ 0 si algún fichero no dejó testigo, si base y sonda difieren, o si las dos sondas se
// contradicen (un arnés que el AST da por declarado y que corriendo llega sin rol, o al revés).
// Los crudos van a un temporal FUERA del árbol.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { temporal } from '../../../../tests/_temporal.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..', '..', '..');
const etiqueta = process.argv[2];
if (!/^[a-z0-9-]+$/.test(etiqueta || '')) {
  console.error('uso: node docs/master/evidencias/scrum1344/correr-sonda.mjs <etiqueta>   (antes | despues)');
  process.exit(2);
}
const { censoDeArneses, CLASES } = await import(pathToFileURL(path.join(RAIZ, 'tests', '_censo-arneses-de-router.mjs')).href);
const SONDA = pathToFileURL(path.join(AQUI, 'sonda.mjs')).href;
const crudos = temporal('scrum1344-sonda-'); // se borra al salir, pase lo que pase (SCRUM-864)

const censo = await censoDeArneses(RAIZ);
const claseAst = new Map();
for (const [clase, filas] of censo.porClase) for (const x of filas) claseAst.set(x.fichero, x);
const candidatos = [...claseAst.keys()].sort();

// Entorno del sujeto construido A MANO (A21): fuera el color y lo que `node --test` deja puesto.
const entorno = { ...process.env };
for (const k of ['FORCE_COLOR', 'NO_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];

const recuento = (txt) => {
  const n = (k) => { const m = txt.match(new RegExp(`^(?:#|ℹ) ${k} (\\d+)`, 'm')); return m ? Number(m[1]) : null; };
  return { tests: n('tests'), pass: n('pass'), fail: n('fail'), skipped: n('skipped') };
};
function una(fichero, conSonda) {
  const salida = path.join(crudos, fichero + '.json');
  const args = conSonda ? ['--import', SONDA, path.join('tests', fichero)] : [path.join('tests', fichero)];
  const r = spawnSync(process.execPath, args, {
    cwd: RAIZ, env: { ...entorno, SONDA_RAIZ: RAIZ, SONDA_SALIDA: salida }, encoding: 'utf8', timeout: 180000, maxBuffer: 64 * 1024 * 1024,
  });
  return { codigo: r.status, ...recuento((r.stdout || '') + (r.stderr || '')) };
}

const gateDe = (evento) => {
  const r = evento.router ? censo.mapa.porFichero.get(evento.router) : null;
  if (r && r.rolMontaje) return { rol: r.rolMontaje, donde: 'montaje' };
  if (r && r.rolUse) return { rol: r.rolUse, donde: 'router.use' };
  if (evento.rolDeLaRuta) return { rol: evento.rolDeLaRuta, donde: 'ruta' };
  return null;
};
const prefijoDe = (evento) => {
  const r = evento.router ? censo.mapa.porFichero.get(evento.router) : null;
  if (!r) return '(router sin montar)';
  return r.admin ? r.prefijos[0] : '(público)';
};

const filas = [];
console.log(`POBLACION=${candidatos.length} ficheros (de ${censo.filas.length} leídos en tests/)`);
for (const fichero of candidatos) {
  const base = una(fichero, false);
  const con = una(fichero, true);
  const salida = path.join(crudos, fichero + '.json');
  const fila = { fichero, ast: claseAst.get(fichero).clase, base, testigo: false, igual: false, llamadas: 0, deSesion: 0, sinRol: 0, sinRolConGate: 0, conRol: 0, roles: [], sinRolPorRuta: {}, rolQueElGateRechaza: {} };
  if (fs.existsSync(salida)) {
    const j = JSON.parse(fs.readFileSync(salida, 'utf8'));
    fila.testigo = j.testigo === 'sonda-cargada';
    const roles = new Set();
    for (const e of j.eventos) {
      fila.llamadas++;
      const r = e.router ? censo.mapa.porFichero.get(e.router) : null;
      if (!e.tieneMerchant || !r || !r.admin) continue; // solo cuenta la sesión contra un router de /admin
      fila.deSesion++;
      if (e.rol !== null) {
        fila.conRol++;
        roles.add(e.rol);
        // Lo que este ticket NO cierra, medido: un llamante CON rol, pero uno que el gate de esa
        // ruta rechazaría, y que llega al handler porque el arnés lo saca de `route.stack`.
        const g = gateDe(e);
        if (g && e.rol !== g.rol && e.via === 'directo') {
          const clave = `${e.metodo} ${prefijoDe(e)}${e.ruta === '/' ? '' : e.ruta} · llega con rol ${e.rol} · GATE ${g.rol} en ${g.donde}`;
          fila.rolQueElGateRechaza[clave] = (fila.rolQueElGateRechaza[clave] || 0) + 1;
        }
        continue;
      }
      fila.sinRol++;
      const gate = gateDe(e);
      if (gate) fila.sinRolConGate++;
      const clave = `${e.metodo} ${prefijoDe(e)}${e.ruta === '/' ? '' : e.ruta} · ${e.via === 'directo' ? 'handler sacado de route.stack' : 'por el router'} · ${gate ? `GATE ${gate.rol} en ${gate.donde}` : 'sin gate hoy'}`;
      fila.sinRolPorRuta[clave] = (fila.sinRolPorRuta[clave] || 0) + 1;
    }
    fila.roles = [...roles].sort();
  }
  fila.igual = ['codigo', 'tests', 'pass', 'fail', 'skipped'].every((k) => base[k] === con[k]);
  fila.sonda = !fila.testigo ? 'SIN-TESTIGO'
    : fila.llamadas === 0 ? 'no-observado'
      : fila.deSesion === 0 ? 'sin-sesion'
        : fila.sinRolConGate ? 'sin-rol-CON-GATE'
          : fila.sinRol ? 'sin-rol-sin-gate' : 'con-rol';
  filas.push(fila);
  console.log(`${fichero} · AST ${fila.ast} · sonda ${fila.sonda} · ${base.pass}/${base.tests} caen ${base.fail} saltan ${base.skipped}${fila.igual ? '' : ' · 🔴 BASE≠SONDA'}`);
}

// ── el cruce: lo que el AST leyó contra lo que la sonda vio ──────────────────────────────
const SONDAS = ['sin-rol-CON-GATE', 'sin-rol-sin-gate', 'con-rol', 'sin-sesion', 'no-observado', 'SIN-TESTIGO'];
const ASTS = Object.values(CLASES);
const celda = (a, s) => filas.filter((f) => f.ast === a && f.sonda === s);
// «no-observado» no contradice a nadie: el test se saltó o no llama a ninguna ruta. No se juzga.
const coherente = (a, s) => s === 'no-observado'
  || (a === CLASES.K && s.startsWith('sin-rol'))
  || ((a === CLASES.A_MANO || a === CLASES.ARNES) && s === 'con-rol')
  || ([CLASES.SIN_SESION, CLASES.PUBLICO, CLASES.APP, CLASES.SIN_JUZGAR, CLASES.SIN_RESOLVER].includes(a) && s === 'sin-sesion');
const contradicciones = filas.filter((f) => !coherente(f.ast, f.sonda));

const out = [];
out.push(`SCRUM-1344 · sonda de ejecución · etiqueta «${etiqueta}»`);
out.push(censo.linea);
out.push('');
out.push(`POBLACION corrida: ${filas.length} ficheros · sin testigo: ${filas.filter((f) => !f.testigo).length} · base≠sonda: ${filas.filter((f) => !f.igual).length} · base en rojo: ${filas.filter((f) => f.base.codigo !== 0).length}`);
out.push('');
out.push('CRUCE (filas = lo que LEE el AST · columnas = lo que VE la sonda)');
out.push(''.padEnd(22) + SONDAS.map((s) => s.padStart(18)).join(''));
for (const a of ASTS) out.push(a.padEnd(22) + SONDAS.map((s) => String(celda(a, s).length).padStart(18)).join(''));
out.push('');
out.push(`CONTRADICCIONES entre las dos sondas: ${contradicciones.length}`);
for (const f of contradicciones) out.push(`  🔴 ${f.fichero} · AST ${f.ast} · sonda ${f.sonda}`);
for (const s of ['sin-rol-CON-GATE', 'sin-rol-sin-gate']) {
  const l = filas.filter((f) => f.sonda === s);
  out.push('');
  out.push(`${s === 'sin-rol-CON-GATE' ? 'UN REQ SIN ROL LLEGA A UNA RUTA QUE HOY EXIGE ROL, Y EL TEST SALE VERDE' : 'UN REQ SIN ROL LLEGA A UNA RUTA QUE HOY NO EXIGE ROL'}: ${l.length} ficheros`);
  for (const f of l) {
    out.push(`  ${f.fichero} · ${f.base.pass}/${f.base.tests} en verde, caen ${f.base.fail}, saltan ${f.base.skipped} · ${f.sinRol} llamadas sin rol${f.conRol ? ` (y ${f.conRol} con rol)` : ''}`);
    for (const [k, v] of Object.entries(f.sinRolPorRuta)) out.push(`      ${String(v).padStart(3)} × ${k}`);
  }
}
const rechazados = filas.filter((f) => Object.keys(f.rolQueElGateRechaza).length);
out.push('');
out.push(`FUERA DE ESTE TICKET, MEDIDO: un llamante CON rol que el gate de la ruta rechazaría, y que llega al handler porque el arnés lo saca de route.stack: ${rechazados.length} ficheros`);
for (const f of rechazados) {
  out.push(`  ${f.fichero}`);
  for (const [k, v] of Object.entries(f.rolQueElGateRechaza)) out.push(`      ${String(v).padStart(3)} × ${k}`);
}
const noVistos = filas.filter((f) => f.sonda === 'no-observado');
out.push('');
out.push(`NO OBSERVADOS (la sonda no vio ninguna llamada: NO se juzgan por ejecución): ${noVistos.length}`);
out.push(`  de ellos con todos sus tests saltados: ${noVistos.filter((f) => f.base.tests !== null && f.base.skipped === f.base.tests).length} · con alguno saltado: ${noVistos.filter((f) => f.base.skipped > 0 && f.base.skipped !== f.base.tests).length} · sin ninguno saltado (no llaman a ninguna ruta): ${noVistos.filter((f) => f.base.skipped === 0).length} · sin recuento (ayudantes, no son tests): ${noVistos.filter((f) => f.base.tests === null).length}`);
for (const a of ASTS) { const l = noVistos.filter((f) => f.ast === a); if (l.length) out.push(`  ${a}: ${l.map((f) => f.fichero).join(' ')}`); }

const fallo = filas.some((f) => !f.testigo) || filas.some((f) => !f.igual) || contradicciones.length > 0;
out.push('');
out.push(`EXIT=${fallo ? 1 : 0}`);
fs.writeFileSync(path.join(AQUI, etiqueta + '.txt'), out.join('\n') + '\n');
fs.writeFileSync(path.join(AQUI, etiqueta + '.json'), JSON.stringify({ etiqueta, linea: censo.linea, filas }, null, 1) + '\n');
console.log('\n' + out.join('\n'));
process.exit(fallo ? 1 : 0);
