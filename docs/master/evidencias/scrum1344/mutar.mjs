// docs/master/evidencias/scrum1344/mutar.mjs — SCRUM-1344
//
// EL GUARD, VISTO EN ROJO. Cada mutación rompe UNA cosa de las que el guard dice vigilar, lo corre
// de verdad y exige que caiga el caso que le toca, por su NOMBRE.
//
//     node docs/master/evidencias/scrum1344/mutar.mjs
//
// Antes de la primera mutación corre la BASE sin mutar (A3: sin ella, un test inestable que cae se
// lee como un mutante que muere). Después de cada una restaura el fichero y comprueba, por sha256,
// que ha vuelto a ser el de antes. Exige el árbol LIMPIO al empezar (todo comiteado) y lo comprueba
// al acabar: si el proceso muere a medias, `git status` dice qué quedó tocado.
//
// Solo muta ficheros de `tests/`: no hace falta recompilar entre una y otra.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..', '..', '..');
const GUARD = 'tests/scrum1344-arnes-de-prueba-con-rol.test.mjs';
const CENSO = 'tests/_censo-arneses-de-router.mjs';
const ARNES = 'tests/_arnes-de-router.mjs';
const git = (...a) => execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8' });
const sha = (f) => (fs.existsSync(path.join(RAIZ, f)) ? crypto.createHash('sha256').update(fs.readFileSync(path.join(RAIZ, f))).digest('hex') : 'NO-EXISTE');

const entorno = { ...process.env };
for (const k of ['FORCE_COLOR', 'NO_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];

function correr() {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', GUARD], { cwd: RAIZ, env: entorno, encoding: 'utf8', timeout: 180000, maxBuffer: 64 * 1024 * 1024 });
  const txt = (r.stdout || '') + (r.stderr || '');
  // Solo los casos de primer nivel (sin sangría): el fichero entero también sale como un «not ok».
  const caidos = [...txt.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]).filter((n) => n.startsWith('SCRUM-1344'));
  const pasan = [...txt.matchAll(/^ok \d+ - (.*)$/gm)].map((m) => m[1]).filter((n) => n.startsWith('SCRUM-1344')).length;
  return { codigo: r.status, caidos, pasan, corrio: /^# tests \d+/m.test(txt) };
}

/** `de` tiene que aparecer EXACTAMENTE una vez: un literal repetido mutaría a ciegas. */
function reemplazo(fichero, de, a) {
  return () => {
    const ruta = path.join(RAIZ, fichero);
    const antes = fs.readFileSync(ruta, 'utf8');
    const veces = antes.split(de).length - 1;
    if (veces !== 1) throw new Error(`${fichero}: «${de.slice(0, 50)}» aparece ${veces} veces, no 1`);
    fs.writeFileSync(ruta, antes.replace(de, () => a));
    return () => fs.writeFileSync(ruta, antes);
  };
}
function ficheroNuevo(fichero, contenido) {
  return () => {
    const ruta = path.join(RAIZ, fichero);
    if (fs.existsSync(ruta)) throw new Error(`${fichero} ya existe`);
    fs.writeFileSync(ruta, contenido);
    return () => fs.rmSync(ruta);
  };
}
function desdeLaBase(ficheros, ref) {
  return () => {
    const antes = ficheros.map((f) => [f, fs.readFileSync(path.join(RAIZ, f))]);
    for (const f of ficheros) fs.writeFileSync(path.join(RAIZ, f), execFileSync('git', ['show', `${ref}:${f}`], { cwd: RAIZ, maxBuffer: 64 * 1024 * 1024 }));
    return () => { for (const [f, b] of antes) fs.writeFileSync(path.join(RAIZ, f), b); };
  };
}

const IMPORTA_PROVEEDORES = "const mod = await import('../dist/modules/providers/app/routes/providers.routes.js');\nconst router = mod.default?.default ?? mod.default;\n";
const BASE_REF = process.argv[2] || 'origin/main';
const migrados = git('diff', '--name-only', '--diff-filter=M', BASE_REF, '--', 'tests').split('\n').filter((f) => f.endsWith('.test.mjs'));

const MUTACIONES = [
  { nombre: 'M1 · el árbol de ANTES: los arneses migrados vuelven a como están en la base', toca: migrados,
    aplica: desdeLaBase(migrados, BASE_REF), cae: '④ NINGÚN arnés arma un `req` de sesión sin rol' },
  { nombre: 'M2 · nace un arnés nuevo que saca el handler y lo llama sin rol', toca: ['tests/zz-mutante-sin-rol.test.mjs'],
    aplica: ficheroNuevo('tests/zz-mutante-sin-rol.test.mjs', IMPORTA_PROVEEDORES + "await router.stack[0].route.stack[1].handle({ merchantId: 7, params: {} }, {});\n"),
    cae: '④ NINGÚN arnés arma un `req` de sesión sin rol' },
  { nombre: 'M3 · nace un arnés nuevo que escribe `userRole` a mano (el parche de scrum960, la vez 21)', toca: ['tests/zz-mutante-a-mano.test.mjs'],
    aplica: ficheroNuevo('tests/zz-mutante-a-mano.test.mjs', IMPORTA_PROVEEDORES + "await router({ method: 'POST', url: '/', body: {}, merchantId: 7, userRole: 'admin', headers: {} }, {}, () => {});\n"),
    cae: '⑤ un arnés NUEVO no declara el rol a mano' },
  { nombre: 'M4 · se cuela un nombre de más en HEREDADOS_A_MANO', toca: [GUARD],
    aplica: reemplazo(GUARD, "  'scrum1022-importa-xlsx-real.test.mjs',\n", "  'scrum1022-importa-xlsx-real.test.mjs',\n  'zz-ya-no-existe.test.mjs',\n"),
    cae: '⑥ la lista de heredados no se queda con nombres de más' },
  { nombre: 'M5 · nace un fichero que carga un router de /admin sin armarle un req', toca: ['tests/zz-mutante-sin-sesion.test.mjs'],
    aplica: ficheroNuevo('tests/zz-mutante-sin-sesion.test.mjs', IMPORTA_PROVEEDORES + "console.log(router.stack.length);\n"),
    cae: '⑦ «carga un router de /admin y no le arma ningún req de sesión» es lista cerrada' },
  { nombre: 'M6 · nace un fichero que no se puede parsear', toca: ['tests/zz-mutante-roto.mjs'],
    aplica: ficheroNuevo('tests/zz-mutante-roto.mjs', "export const x = { merchantId: 7 ;\n"),
    cae: '⑧ lo que no se pudo mirar se cuenta APARTE' },
  { nombre: 'M7 · `reqDeSesion` gana un rol por defecto', toca: [ARNES],
    aplica: reemplazo(ARNES, 'const { rol, ...resto } = datos;', "const { rol = 'admin', ...resto } = datos;"),
    cae: '⑨ `reqDeSesion` no tiene rol por defecto' },
  { nombre: 'M8 · `reqDeSesion` inventa un campo', toca: [ARNES],
    aplica: reemplazo(ARNES, 'return { ...resto, userRole: rol };', 'return { headers: {}, ...resto, userRole: rol };'),
    cae: '⑪ `reqDeSesion` devuelve lo que se le da más `userRole`, y NADA más' },
  { nombre: 'M9 · el analizador deja de ver el handler sacado de route.stack', toca: [CENSO],
    aplica: reemplazo(CENSO, "if (ts.isPropertyAccessExpression(quien) && quien.name.text === 'handle') return 'llamada';", "if (ts.isPropertyAccessExpression(quien) && quien.name.text === 'handleX') return 'llamada';"),
    cae: '⑫ el analizador VE el arnés sin rol · saca el handler de route.stack y lo llama' },
  { nombre: 'M9b · el analizador deja de ver la llamada (req, res)', toca: [CENSO],
    aplica: reemplazo(CENSO, 'if (segundo && ts.isIdentifier(segundo) && /^res($|[A-Z_]|p$|ponse$)/.test(segundo.text)) return \'llamada\';', 'if (segundo && ts.isIdentifier(segundo) && /^resX$/.test(segundo.text)) return \'llamada\';'),
    cae: '⑫ el analizador VE el arnés sin rol · llama a una función con (req, res)' },
  { nombre: 'M9c · el analizador deja de ver lo que devuelve un `handlerDe…()`', toca: [CENSO],
    aplica: reemplazo(CENSO, "if (/handler/i.test(quien.getText())) return 'llamada';", "if (/handlerX/i.test(quien.getText())) return 'llamada';"),
    cae: '⑫ el analizador VE el arnés sin rol · llama a lo que devuelve un `handlerDe…()`' },
  // M10 se declaró primero contra el ⑫ «lo carga con un createRequire de otro nombre» y salió MUDA
  // ahí: esa fuente NOMBRA el router en un literal, y nombrarlo ya basta para contarla como arnés.
  // Lo que el alias decide de verdad es otra cosa: si un `requiere.resolve(<variable>)` se ve como
  // un import sin resolver. Eso lo sujetan el ⑰ (fuente de mentira) y el ⑧ (el árbol real).
  { nombre: 'M10 · el analizador deja de reconocer un createRequire con otro nombre', toca: [CENSO],
    aplica: reemplazo(CENSO, "/(^|\\.)createRequire$/.test(ini.expression.getText())) alias.add(k);", "/(^|\\.)createRequireX$/.test(ini.expression.getText())) alias.add(k);"),
    cae: '⑰ lo que no se puede mirar sale SIN JUZGAR, nunca limpio' },
  { nombre: 'M10b · nombrar el router en un literal deja de contar como cargarlo', toca: [CENSO],
    aplica: reemplazo(CENSO, 'const routers = [...new Set([...fila.importa, ...fila.nombra])].filter((d) => R.has(d));', 'const routers = [...new Set([...fila.importa])].filter((d) => R.has(d));'),
    cae: '⑫ el analizador VE el arnés sin rol · carga el router por un ayudante, con la ruta a secas' },
  { nombre: 'M11 · un fichero que no parsea pasa por limpio', toca: [CENSO],
    aplica: reemplazo(CENSO, "if (!fila.parsea) return { clase: CLASES.SIN_JUZGAR, motivo: 'no se pudo parsear', routers: [], deAdmin: [], gate: null };", "if (!fila.parsea) return { clase: null, routers: [], deAdmin: [], gate: null };"),
    cae: '⑰ lo que no se puede mirar sale SIN JUZGAR, nunca limpio' },
  { nombre: 'M12 · el emparejamiento router↔fichero se queda ciego (no encuentra ninguno)', toca: [CENSO],
    aplica: reemplazo(CENSO, 'if (!esRouter(valor) || !montados.has(valor)) continue;', 'if (!esRouter(valor) || montados.has(valor)) continue;'),
    cae: '① la línea sale SIEMPRE, con su población, y el censo no está ciego' },
  { nombre: 'M13 · el gate de una ruta deja de mirar el verbo', toca: [CENSO],
    aplica: reemplazo(CENSO, 'const delVerbo = (x) => fila.verbos.length === 0 || x.verbos.some((v) => fila.verbos.includes(v));', 'const delVerbo = () => false;'),
    cae: '⑱ las DOS cifras: la ruta que el arnés nombra decide si tiene gate hoy' },
];

const sucio = git('status', '--porcelain').trim();
if (sucio) { console.error('🔴 el árbol no está limpio: comitea antes de mutar (A23 nº 9)\n' + sucio); process.exit(2); }
console.log(`HEAD=${git('rev-parse', 'HEAD').trim()} · base de M1=${BASE_REF} (${git('rev-parse', BASE_REF).trim()}) · ${migrados.length} arneses migrados`);
console.log(`POBLACION=${MUTACIONES.length} mutaciones`);

const base = correr();
console.log(`BASE sin mutar: código ${base.codigo} · pasan ${base.pasan} · caen ${base.caidos.length}`);
if (!base.corrio || base.codigo !== 0 || base.caidos.length) { console.error('🔴 la base no está en verde: no se muta sobre un rojo'); process.exit(2); }

let vivas = 0;
const filas = [];
for (const m of MUTACIONES) {
  const antes = m.toca.map(sha);
  const deshacer = m.aplica();
  const cambio = m.toca.some((f, i) => sha(f) !== antes[i]);
  const r = correr();
  deshacer();
  const restaurado = m.toca.every((f, i) => sha(f) === antes[i]);
  const cazada = r.corrio && r.caidos.some((n) => n.includes(m.cae));
  const veredicto = !cambio ? 'CIEGA (la mutación no cambió nada)' : !r.corrio ? 'CIEGA (el guard no llegó a correr)' : cazada ? 'VIVA' : 'MUDA';
  if (veredicto === 'VIVA') vivas++;
  filas.push(veredicto);
  console.log(`${veredicto.padEnd(6)} · ${m.nombre}\n         esperado: «${m.cae}» · caen ${r.caidos.length}: ${r.caidos.map((n) => n.replace('SCRUM-1344 · ', '').slice(0, 60)).join(' | ') || '(ninguno)'}${restaurado ? '' : ' · 🔴 NO RESTAURADO'}`);
  if (!restaurado) { console.error('🔴 no se pudo restaurar: paro'); process.exit(2); }
}
const despues = correr();
const limpio = git('status', '--porcelain').trim() === '';
console.log(`DESPUÉS de restaurar: código ${despues.codigo} · pasan ${despues.pasan} · caen ${despues.caidos.length} · árbol ${limpio ? 'limpio' : '🔴 SUCIO'}`);
console.log(`RESULTADO: ${vivas} vivas de ${MUTACIONES.length} · ${filas.filter((v) => v === 'MUDA').length} mudas · ${filas.filter((v) => v.startsWith('CIEGA')).length} ciegas`);
const fallo = vivas !== MUTACIONES.length || despues.codigo !== 0 || !limpio;
console.log(`EXIT=${fallo ? 1 : 0}`);
process.exit(fallo ? 1 : 0);
