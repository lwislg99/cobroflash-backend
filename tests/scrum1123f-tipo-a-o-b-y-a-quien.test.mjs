// tests/scrum1123f-tipo-a-o-b-y-a-quien.test.mjs — SCRUM-1123f
//
// EL AVISO DEL VIGÍA DICE QUÉ AVERÍA ES, Y LLAMA A ALGUIEN.
//
// Del 21 al 22-oct Railway no vio 55 commits de `main` (cero estados suyos) y el aviso mandó 8
// veces a mirar «los logs de arranque… falta un ALTER», que es la avería del 24/25-sep. Y no
// mencionaba a nadie: 9 comentarios del bot en el #2455, 0 menciones (SCRUM-1123e, S0).
//
// 🔴 LOS DATOS DE AQUÍ SON REALES: los estados que devolvió `GET /repos/…/commits/:sha/status` el
// 23-oct-2026 para commits de `main`, con la forma que compone el paso de aviso del YAML
// (`docs/master/evidencias/SCRUM-1123f/capturar-estados.mjs`). Van copiados DENTRO del test y no
// se leen de `docs/`: un test que ejecuta o lee `docs/` cambia con un PR «de sólo docs» (SCRUM-935e).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  tipoDeAveria, componerCuerpo, decidirAviso, diagnosticoDelEntorno, mencionValida, servicioDeRailway,
  TIPO_A, TIPO_B, EN_CURSO, NO_SE_SABE, SERVICIO_DE_PRODUCCION,
} from '../scripts/vigia-despliegue-aviso.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARCA = '<!-- vigia-despliegue:produccion-congelada -->';
const P = 'comfortable-nourishment - ';
const e = (servicio, state, description) => ({ context: P + servicio, state, description });

// ── los casos reales ─────────────────────────────────────────────────────────────────────────
// TIPO A · los 5 más nuevos de los 55 que Railway no vio (prod=fe65a8b7 · main=82f3ea41): justo
// los que habría mirado el YAML. Los cinco, `leido:true` y CERO estados.
const TIPO_A_21OCT = [
  '82f3ea4115723db78ca56c4b2e1c426a810a0433', '6d8399f547fb49da3c0aec45e93879498f46d6c7',
  '7badbcea208ec561b4d85b139fabdd1e2c5b0573', 'a1e89c27cdedc3abd3a3e37208ae7f306bd649e4',
  '2c75e89351a350d9658cc0d902edc293419f958e',
].map((sha) => ({ sha, leido: true, estados: [] }));
// TIPO B · el congelado del 24/25-sep (SCRUM-1122).
const TIPO_B_24SEP = [{ sha: 'db771431612fb709939401c958e7c8fa51b295f5', leido: true, estados: [
  e('guard-acreditacion', 'success', 'Success'), e('yaqu-staging', 'failure', 'Deployment failed'),
  e('cobroflash-backend', 'failure', 'Deployment failed'),
] }];
// TIPO B · uno de los dos del 23-oct por la mañana (se curó con el merge siguiente).
const TIPO_B_23OCT = [{ sha: '3c255d98a331baeb49c97646e040cc2e27719e08', leido: true, estados: [
  e('guard-acreditacion', 'success', 'Success'), e('cobroflash-backend', 'failure', 'Deployment failed'),
  e('yaqu-staging', 'success', 'Success - yaqu-staging-production.up.railway.app'),
] }];
// SANO · en producción y sirviendo, con `guard-acreditacion` en failure: el combinado dice failure.
const SANO_CON_OTRO_SERVICIO_EN_ROJO = [{ sha: '655f1252e4b0d095da15ae2857b37a5d9b3f7ecd', leido: true, estados: [
  e('cobroflash-backend', 'success', 'Success - yaqu.app'),
  e('yaqu-staging', 'success', 'Success - yaqu-staging-production.up.railway.app'),
  e('guard-acreditacion', 'failure', 'Deployment failed'),
] }];

// ── la decisión ──────────────────────────────────────────────────────────────────────────────

test('SCRUM-1123f · los 55 del 21-oct (cero estados de Railway) son TIPO A: Railway no los vio', () => {
  const d = tipoDeAveria(TIPO_A_21OCT);
  assert.equal(d.tipo, TIPO_A);
  assert.equal(d.filas.length, 5);
});

test('SCRUM-1123f · el 24/25-sep y el del 23-oct (cobroflash-backend en failure) son TIPO B, con su commit', () => {
  const sep = tipoDeAveria(TIPO_B_24SEP);
  assert.equal(sep.tipo, TIPO_B);
  assert.equal(sep.sha, TIPO_B_24SEP[0].sha);
  assert.equal(sep.descripcion, 'Deployment failed');
  assert.equal(tipoDeAveria(TIPO_B_23OCT).tipo, TIPO_B);
});

test('SCRUM-1123f · 🔴 un commit SANO con OTRO servicio en failure NO es tipo B: manda el servicio de producción', () => {
  const d = tipoDeAveria(SANO_CON_OTRO_SERVICIO_EN_ROJO);
  assert.notEqual(d.tipo, TIPO_B, `🔴 \`guard-acreditacion\` en rojo se ha leído como despliegue de \`${SERVICIO_DE_PRODUCCION}\` fallido`);
  assert.notEqual(d.tipo, TIPO_A);
  assert.equal(d.tipo, NO_SE_SABE);
});

test('SCRUM-1123f · 🔴 «no pude leer» NO es «cero estados»: un commit sin leer deja la avería en NO SE SABE', () => {
  const unoSinLeer = [...TIPO_A_21OCT.slice(0, 4), { sha: TIPO_A_21OCT[4].sha, leido: false }];
  const d = tipoDeAveria(unoSinLeer);
  assert.equal(d.tipo, NO_SE_SABE, '🔴 un fallo de lectura se ha convertido en «Railway no lo vio»');
  assert.match(d.motivo, /no se pudieron leer/);
  assert.equal(tipoDeAveria([]).tipo, NO_SE_SABE);
  assert.equal(tipoDeAveria(null).tipo, NO_SE_SABE);
  assert.equal(diagnosticoDelEntorno('').tipo, NO_SE_SABE);
  assert.equal(diagnosticoDelEntorno('{esto no es JSON').tipo, NO_SE_SABE);
});

test('SCRUM-1123f · el más nuevo recién entrado (aún sin estados) no tapa un fallo de debajo: sigue siendo B', () => {
  const recien = { sha: 'f'.repeat(40), leido: true, estados: [] };
  assert.equal(tipoDeAveria([recien, ...TIPO_B_23OCT]).tipo, TIPO_B);
  const enCurso = [{ sha: 'e'.repeat(40), leido: true, estados: [e('cobroflash-backend', 'pending', 'Deploying')] }];
  assert.equal(tipoDeAveria(enCurso).tipo, EN_CURSO);
});

test('SCRUM-1123f · sólo cuentan como de Railway los estados de sus servicios', () => {
  assert.equal(servicioDeRailway(P + 'cobroflash-backend'), 'cobroflash-backend');
  assert.equal(servicioDeRailway('ci/otra-cosa'), null);
  const ajeno = [{ sha: 'a'.repeat(40), leido: true, estados: [{ context: 'ci/otra-cosa', state: 'success' }] }];
  assert.equal(tipoDeAveria(ajeno).tipo, TIPO_A, 'un estado que no es de Railway no dice que Railway lo viera');
});

// ── el texto: cada avería manda a SU sitio ────────────────────────────────────────────────────

const cuerpoDe = (commits, extra = {}) => componerCuerpo({
  renglon: 'vigía · x', runUrl: 'https://x/run/1', marca: MARCA, diagnostico: tipoDeAveria(commits), mencion: '@lwislg99', ...extra,
});

test('SCRUM-1123f · TIPO A manda a la conexión con GitHub, NO a los logs de arranque, y dice TRES veces', () => {
  const c = cuerpoDe(TIPO_A_21OCT);
  assert.match(c, /Railway NO HA VISTO estos 5 commits/);
  assert.match(c, /conexión del servicio con GitHub/);
  assert.doesNotMatch(c, /Primer sitio donde mirar: los logs de arranque/, '🔴 el tipo A vuelve a mandar a los logs de arranque (la causa de septiembre)');
  assert.doesNotMatch(c, /ALTER/, '🔴 con un commit que Railway no ha visto no hay ALTER que buscar');
  assert.match(c, /ha pasado tres veces/);
  assert.doesNotMatch(c, /cuatro veces/);
});

test('SCRUM-1123f · TIPO B manda a los logs de arranque y al ALTER, y nombra el commit que falló', () => {
  const c = cuerpoDe(TIPO_B_24SEP);
  assert.match(c, /Railway vio `db7714316` y el despliegue FALLÓ/);
  assert.match(c, /logs de arranque/);
  assert.match(c, /ALTER/);
  assert.doesNotMatch(c, /conexión del servicio con GitHub/);
});

test('SCRUM-1123f · sin diagnóstico, el aviso SALE IGUAL y nombra las dos averías', () => {
  const c = componerCuerpo({ renglon: 'r', runUrl: 'u', marca: MARCA, mencion: '@lwislg99' });
  assert.match(c, /No he podido saber qué avería es/);
  assert.match(c, /\*\*A\*\*/);
  assert.match(c, /\*\*B\*\*/);
  assert.ok(c.trim().endsWith(MARCA));
});

// ── a quién llama ────────────────────────────────────────────────────────────────────────────

test('SCRUM-1123f · 🔴 el aviso MENCIONA a alguien, lo primero (sale en la notificación)', () => {
  const c = cuerpoDe(TIPO_A_21OCT);
  assert.ok(c.startsWith('@lwislg99 '), '🔴 el aviso no empieza mencionando a nadie: no le llega a nadie');
  const sim = cuerpoDe(TIPO_A_21OCT, { simulacro: true });
  assert.match(sim, /^🧪 \*\*SIMULACRO/, 'el simulacro sigue diciéndolo lo primero');
  assert.match(sim, /\n@lwislg99 /, 'y menciona igual: el simulacro prueba el canal entero');
});

test('SCRUM-1123f · una mención mal formada NO se pinta como mención: se dice que no menciona a nadie', () => {
  for (const malo of ['', '@', 'lwislg99', '@ alguien', '@a/b', '@@x', undefined]) {
    assert.equal(mencionValida(malo), null, `«${malo}» no es un @usuario`);
  }
  assert.equal(mencionValida('@lwislg99'), '@lwislg99');
  const c = componerCuerpo({ renglon: 'r', runUrl: 'u', marca: MARCA });
  assert.match(c, /^⚠️ Este aviso no menciona a nadie/);
});

// ── el CLI de verdad, con el entorno que le da el YAML ────────────────────────────────────────

function correrCli(extra) {
  const env = { ...process.env, VIGIA_ISSUES_JSON: '[]', VIGIA_MARCA: MARCA, VIGIA_RENGLON: 'r', VIGIA_RUN_URL: 'u', ...extra };
  delete env.FORCE_COLOR; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [path.join(RAIZ, 'scripts', 'vigia-despliegue-aviso.mjs')], { encoding: 'utf8', env });
  return { status: r.status, salida: JSON.parse(r.stdout) };
}

test('SCRUM-1123f · CLI: los estados y la mención llegan por entorno; tipo A y B salen distintos', () => {
  const a = correrCli({ VIGIA_ESTADOS_JSON: JSON.stringify(TIPO_A_21OCT), VIGIA_MENCION: '@lwislg99' });
  const b = correrCli({ VIGIA_ESTADOS_JSON: JSON.stringify(TIPO_B_24SEP), VIGIA_MENCION: '@lwislg99' });
  assert.equal(a.status, 0);
  assert.equal(a.salida.tipo, TIPO_A);
  assert.equal(b.salida.tipo, TIPO_B);
  assert.notEqual(a.salida.cuerpo, b.salida.cuerpo, '🔴 el aviso dice lo mismo para las dos averías');
  assert.ok(a.salida.cuerpo.startsWith('@lwislg99 '));
});

test('SCRUM-1123f · 🔴 CLI: estados ilegibles NO callan el aviso — sale, exit 0, diciendo que no sabe qué avería es', () => {
  const r = correrCli({ VIGIA_ESTADOS_JSON: 'gh: Not Found (HTTP 404)' });
  assert.equal(r.status, 0, '🔴 no poder diagnosticar ha tumbado el aviso entero');
  assert.equal(r.salida.accion, 'crear');
  assert.equal(r.salida.tipo, NO_SE_SABE);
});

// ── y el YAML los pasa ───────────────────────────────────────────────────────────────────────

test('SCRUM-1123f · el paso de aviso del YAML lee los estados y pasa VIGIA_ESTADOS_JSON y VIGIA_MENCION', () => {
  const yml = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'vigia-despliegue.yml'), 'utf8');
  const paso = yml.slice(yml.indexOf('- name: Avisar de verdad si el vigía cantó'), yml.indexOf('- name: SIMULACRO · ¿sonó?'));
  assert.ok(paso.length > 0, 'no encuentro el paso de aviso');
  assert.match(paso, /VIGIA_MENCION: "@\$\{\{ github\.repository_owner \}\}"/);
  assert.match(paso, /gh api "repos\/\$REPO\/commits\/\$SHA\/status"/);
  assert.match(paso, /git rev-list --first-parent --max-count=5 "\$PROD\.\.\$MAIN"/);
  assert.match(paso, /VIGIA_ESTADOS_JSON="\$VIGIA_ESTADOS_JSON" \\\n\s+node scripts\/vigia-despliegue-aviso\.mjs/);
  assert.match(paso, /\\"leido\\":false/, '🔴 una lectura fallida tiene que llegar como leido:false, no desaparecer');
});

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // ① «no pude leer» vuelve a contar como «cero estados».
    fichero: 'scripts/vigia-despliegue-aviso.mjs',
    de: '    if (!c || c.leido !== true || !Array.isArray(c.estados)) {',
    a: '    if (!c) {',
    cae: 'SCRUM-1123f · 🔴 «no pude leer» NO es «cero estados»: un commit sin leer deja la avería en NO SE SABE',
  },
  {
    // ② Vuelve a mandar el estado de cualquier servicio, no el de producción.
    fichero: 'scripts/vigia-despliegue-aviso.mjs',
    de: '    const prod = deRailway.find((e) => servicioDeRailway(e.context) === SERVICIO_DE_PRODUCCION);',
    a: "    const prod = deRailway.find((e) => e.state === 'failure') || deRailway[0];",
    cae: 'SCRUM-1123f · 🔴 un commit SANO con OTRO servicio en failure NO es tipo B: manda el servicio de producción',
  },
  {
    // ③ El aviso deja de mencionar a nadie.
    fichero: 'scripts/vigia-despliegue-aviso.mjs',
    de: '  const quien = mencionValida(mencion);',
    a: '  const quien = null;',
    cae: 'SCRUM-1123f · 🔴 el aviso MENCIONA a alguien, lo primero (sale en la notificación)',
  },
  {
    // ④ El tipo A vuelve a mandar a los logs de arranque.
    fichero: 'scripts/vigia-despliegue-aviso.mjs',
    de: '  if (d.tipo === TIPO_A) {',
    a: '  if (false) {',
    cae: 'SCRUM-1123f · TIPO A manda a la conexión con GitHub, NO a los logs de arranque, y dice TRES veces',
  },
];
