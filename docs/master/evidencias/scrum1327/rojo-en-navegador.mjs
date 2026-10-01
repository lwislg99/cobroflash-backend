// rojo-en-navegador.mjs — SCRUM-1327 · EL DEFECTO, VISTO OCURRIR EN LOS GUARDS DE VERDAD.
//
//   node rojo-en-navegador.mjs <raiz ABSOLUTA del arbol> <etiqueta: antes|despues> <dir de salida> [solo esta pasada]
//
// Rompe a mano el producto (o `dist/`) para que cada guard se encuentre el caso del ticket, lo
// corre con su navegador real, apunta su codigo de salida y lo que dijo, y deshace la rotura con
// la EDICION INVERSA (no `git restore`: lo bloquea `guard-dangerous`). Cada sustitucion cuenta
// sus apariciones y, si no son las esperadas, la pasada se declara CIEGA en vez de correr un guard
// sobre un arbol sin romper. Al final comprueba por sha256 que cada fichero volvio a su sitio.
//
//   GRUPO 1 (caja-datos, caja-documento, portal): un caso CIEGO y, DESPUES, un caso con hallazgo.
//   GRUPO 2 (aviso-bizum, vias-de-cobro, firma-con-tramos): 0 hallazgos y todos los casos ciegos.
//   CONTROL POSITIVO: un hallazgo sin ningun ciego tiene que seguir saliendo 1.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const [RAIZ, ETIQUETA, SALIDA] = process.argv.slice(2);
if (!RAIZ || !path.isAbsolute(RAIZ) || !ETIQUETA || !SALIDA) {
  console.error('uso: node rojo-en-navegador.mjs <raiz ABSOLUTA> <antes|despues> <dir de salida>');
  process.exit(2);
}
fs.mkdirSync(SALIDA, { recursive: true });

const CSS = 'public/dashboard/css/styles.css';
const FICHA = 'public/dashboard/js/customerDetailView.js';
const AJUSTES = 'public/dashboard/js/settingsView.js';
const FIRMA = 'dist/modules/system/app/routes/quoteDecisionLanding.routes.js';
const FIN_CSS = '.plantillas-cabecera > .btn-sm { min-height: 44px; }\n';

// Ancho >= 600: el sidebar computa 0 px -> el caso de 929 px es CIEGO (va PRIMERO en ANCHOS).
// Ancho  < 600: un texto que no cabe      -> el caso de 390 px es un HALLAZGO (va DESPUES).
const CSS_CIEGO_ANCHO = '@media (min-width: 600px) { .sidebar { width: 0 !important; } }\n';
const CSS_HALLAZGO_ESTRECHO = '@media (max-width: 599px) { .pay-methods-note { white-space: nowrap !important; }'
  + ' #titulo-pagina { white-space: nowrap !important; width: 40px !important; overflow: hidden !important; display: block !important; } }\n';

const PORTAL_CIEGO_SIN_TOKEN = [
  { f: FICHA, de: 'id="btn-edit-360" title=', a: 'id="${customer.portalUrl ? \'btn-edit-360\' : \'btn-edit-ciego\'}" title=', veces: 1 },
  { f: FICHA, de: "header.querySelector('#btn-edit-360').onclick", a: "header.querySelector('[id^=\"btn-edit-\"]').onclick", veces: 1 },
];
const PORTAL_HALLAZGO_CON_TOKEN = [
  { f: FICHA, de: 'id="btn-copy-portal-360" title=', a: 'id="${customer.portalUrl ? \'btn-portal-roto\' : \'btn-copy-portal-360\'}" title=', veces: 1 },
  { f: FICHA, de: "header.querySelector('#btn-copy-portal-360')", a: "header.querySelector('[id*=\"portal\"]')", veces: 2 },
];

const PASADAS = [
  // ── GRUPO 1 · el ciego ANTES del hallazgo ──
  { id: 'g1-caja-datos-del-cliente', guard: 'guard-caja-datos-del-cliente.mjs', que: 'ciego a 929 px y, despues, hallazgo a 390 px',
    cambios: [{ f: CSS, de: FIN_CSS, a: FIN_CSS + CSS_CIEGO_ANCHO + CSS_HALLAZGO_ESTRECHO, veces: 1 }] },
  { id: 'g1-caja-documento-suelto', guard: 'guard-caja-documento-suelto.mjs', que: 'ciego a 929 px y, despues, hallazgo a 390 px',
    cambios: [{ f: CSS, de: FIN_CSS, a: FIN_CSS + CSS_CIEGO_ANCHO + CSS_HALLAZGO_ESTRECHO, veces: 1 }] },
  { id: 'g1-portal-en-la-ficha', guard: 'guard-portal-en-la-ficha.mjs', que: 'ciego en «SIN token» y, despues, hallazgo en «CON token»',
    cambios: [...PORTAL_CIEGO_SIN_TOKEN, ...PORTAL_HALLAZGO_CON_TOKEN] },
  // ── GRUPO 2 · solo ciegos ──
  { id: 'g2-aviso-bizum', guard: 'guard-aviso-bizum.mjs', que: 'la ranura del aviso no existe en ningun caso: 0 hallazgos, todo ciego',
    cambios: [{ f: AJUSTES, de: '"Móvil de Bizum (para cobros por Bizum)", "bizumPhone", "text"', a: '"Móvil de Bizum (para cobros por Bizum)", "bizumPhoneRoto", "text"', veces: 1 }] },
  { id: 'g2-vias-de-cobro', guard: 'guard-vias-de-cobro.mjs', que: 'la ranura del aviso no existe en ningun caso: 0 hallazgos, todo ciego',
    cambios: [{ f: AJUSTES, de: '"Móvil de Bizum (para cobros por Bizum)", "bizumPhone", "text"', a: '"Móvil de Bizum (para cobros por Bizum)", "bizumPhoneRoto", "text"', veces: 1 }] },
  { id: 'g2-firma-con-tramos', guard: 'guard-firma-con-tramos.mjs', que: 'pulsar «aceptar» no envia nada en ningun modo: 0 hallazgos, todo ciego',
    cambios: [{ f: FIRMA, de: "fetch('/quote/${token}/decision', {", a: "fetch('/quote/${token}/decision-rota', {", veces: 1 }] },
  // ── CONTROL POSITIVO · un hallazgo SIN ciegos sigue saliendo 1 ──
  { id: 'positivo-caja-datos-del-cliente', guard: 'guard-caja-datos-del-cliente.mjs', que: 'hallazgo a 390 px y ningun ciego',
    cambios: [{ f: CSS, de: FIN_CSS, a: FIN_CSS + CSS_HALLAZGO_ESTRECHO, veces: 1 }] },
  { id: 'positivo-portal-en-la-ficha', guard: 'guard-portal-en-la-ficha.mjs', que: 'hallazgo en «CON token» y ningun ciego',
    cambios: PORTAL_HALLAZGO_CON_TOKEN },
];

const abs = (f) => path.join(RAIZ, f);
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(abs(f))).digest('hex');
const veces = (texto, trozo) => texto.split(trozo).length - 1;

/** Sustituye contando. Devuelve `null` si salio bien, o el motivo por el que NO se aplico. */
function sustituir(f, de, a, esperadas) {
  const antes = fs.readFileSync(abs(f), 'utf8');
  const n = veces(antes, de);
  if (n !== esperadas) return `${f}: «${de.slice(0, 50)}» aparece ${n} veces y esperaba ${esperadas}`;
  fs.writeFileSync(abs(f), antes.split(de).join(a));
  return null;
}

// El entorno del sujeto se construye a mano (A21): sin el color ni las opciones de quien lo lanza.
const entorno = { ...process.env };
for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];

const SOLO = process.argv[5];
if (SOLO) { const quedan = PASADAS.filter((p) => p.id === SOLO); PASADAS.length = 0; PASADAS.push(...quedan); }
const filas = [];
console.log(`POBLACION=${PASADAS.length} pasadas · etiqueta=${ETIQUETA} · arbol=${RAIZ}`);
for (const p of PASADAS) {
  const ficheros = [...new Set(p.cambios.map((c) => c.f))];
  const original = Object.fromEntries(ficheros.map((f) => [f, sha(f)]));
  const hechos = [];
  let ciego = null;
  for (const c of p.cambios) {
    const motivo = sustituir(c.f, c.de, c.a, c.veces);
    if (motivo) { ciego = motivo; break; }
    hechos.push(c);
  }
  let r = null;
  if (!ciego) {
    r = spawnSync(process.execPath, [path.join('scripts', p.guard)], { cwd: RAIZ, env: entorno, encoding: 'utf8', timeout: 240000 });
  }
  // LA EDICION INVERSA, en orden contrario, y solo de lo que llego a aplicarse.
  for (const c of hechos.reverse()) {
    const motivo = sustituir(c.f, c.a, c.de, c.veces);
    if (motivo) { console.error('🔴 NO PUDE DESHACER: ' + motivo); process.exit(3); }
  }
  for (const f of ficheros) {
    if (sha(f) !== original[f]) { console.error(`🔴 ${f} NO ha vuelto a su sitio tras la pasada ${p.id}`); process.exit(3); }
  }
  const salida = r ? String(r.stdout || '') + String(r.stderr || '') : '';
  fs.writeFileSync(path.join(SALIDA, `${ETIQUETA}-${p.id}.txt`),
    `# ${p.id} · ${p.guard} · ${p.que}\n# ${ciego ? 'CIEGO: la rotura no se aplico — ' + ciego : 'EXIT=' + r.status}\n\n${salida}`);
  const veredicto = (salida.split('\n').filter((l) => l.includes('⟦veredicto⟧')).pop() || '').trim();
  filas.push({ id: p.id, exit: ciego ? 'CIEGO' : r.status, veredicto });
  console.log(`${String(ciego ? 'CIEGO' : 'EXIT=' + r.status).padEnd(8)} ${p.id.padEnd(34)} ${veredicto || '(sin línea de veredicto)'}${ciego ? '  ← ' + ciego : ''}`);
}
const st = spawnSync('git', ['status', '--porcelain'], { cwd: RAIZ, encoding: 'utf8' });
console.log(`porcelain tras deshacer: ${st.stdout.trim() ? '\n' + st.stdout : '(vacío)'}`);
if (!SOLO) fs.writeFileSync(path.join(SALIDA, `${ETIQUETA}-resumen.json`), JSON.stringify(filas, null, 2) + '\n');
// Este banco no juzga: apunta. Sale 2 solo si alguna rotura no llego a aplicarse.
const noAplicadas = filas.filter((f) => f.exit === 'CIEGO').length;
console.log(`EXIT=${noAplicadas ? 2 : 0}`);
process.exit(noAplicadas ? 2 : 0);
