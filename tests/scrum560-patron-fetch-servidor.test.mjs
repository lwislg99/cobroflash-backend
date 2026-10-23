// tests/scrum560-patron-fetch-servidor.test.mjs — SCRUM-560 (C) · la convención para los nuevos.
//
// ── QUÉ VIGILA ───────────────────────────────────────────────────────────────────────────────
// Que ningún fichero NUEVO pida con `fetch` a un servidor que él mismo levanta con
// `app.listen(0)`. Es el patrón que revienta una aserción nativa de libuv al cerrar el proceso.
//
// ── POR QUÉ, CON LOS NÚMEROS ─────────────────────────────────────────────────────────────────
// Medido en SCRUM-556 y SCRUM-560: `scrum334-destino-de-los-cta` abortaba **2 de cada 10 tandas**
// con `exitCode 3221226505` (0xC0000409), sin nombrar ningún subtest. Cambiado a `node:http` con
// `agent:false`: **0 de 20**. Si la tasa base era 0,20, la probabilidad de que ese cero fuera
// suerte es 0,8^20 = 1,15%.
//
// El daño no era cobertura perdida —los siete subtests salían `ok` igual— sino un rojo con ruido
// en la tanda de todo el mundo, y de los que no dicen qué ha fallado.
//
// ── POR QUÉ UN TRINQUETE Y NO UNA PROHIBICIÓN ────────────────────────────────────────────────
// 🔴 Hay 21 ficheros vivos con el patrón y NO se arreglan hoy: es un barrido a mano sobre 21
// ficheros sin un solo síntoma, y en SCRUM-559 quedó medido que eso fabrica rojos donde no había
// problema. Prohibir el patrón a secas sería rojo permanente el primer día — y un rojo permanente
// es el que el segundo que lo ve desactiva.
// Así que la lista de abajo se CONGELA y este guard sólo cae si CRECE. La opción de arreglarlos
// se reabre en cuanto un segundo fichero aborte; para saberlo hace falta que esto exista.
//
// ── EL CRITERIO NO ES CONTAR LLAMADAS, y está medido por qué ─────────────────────────────────
// `scrum334` tenía UN `fetch` en el código, dentro de un bucle sobre 6 rutas: seis peticiones.
// Un censo por número de llamadas lo habría clasificado «riesgo bajo» — al único fichero que
// estaba abortando. Cuenta como peligroso un `fetch` DENTRO DE UN BUCLE, o 3 o más sueltos.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(RAIZ, 'tests');

/**
 * LOS QUE YA ESTABAN, congelados el 20-ago-2026. NO es una lista de excepciones concedidas: es
 * una FECHA. Ninguno se puede añadir después — añadirse es editar este fichero, y eso se ve en
 * el diff.
 *
 * ⚠️ NO SE ARREGLAN HOY, y el motivo es del asesor con la tabla delante (SCRUM-560): coste cierto
 * —21 ficheros editados a mano, cada uno con su forma de pedir— contra beneficio hipotético:
 * ninguno de los 21 tiene hoy un síntoma. Se reabre en cuanto un segundo aborte.
 *
 * SI ARREGLAS UNO, quítalo de aquí en el mismo commit. El test de abajo lo exige.
 */
const CON_EL_PATRON_YA = [
  'albaran.test.mjs',
  'pdfs.test.mjs',
  'scrum127-paywall-bloquea.test.mjs',
  'scrum170-facturacion-parcial.test.mjs',
  'scrum171a-consolidar-cliente.test.mjs',
  'scrum178-emision-manual.test.mjs',
  'scrum221-export-fiscal-cero-bytes.test.mjs',
  // 🔴 `scrum329-legal-pagina-publica.test.mjs` SALE DE AQUÍ (SCRUM-822, 8-sep-2026). Era el
  // «segundo que aborta» que esta lista se dejó anotado como condición para reabrirse: 24 de 24
  // instancias en paralelo caían con `fetch failed`, y su rojo tenía forma de 404, así que acusó
  // a la landing y se abrió un Highest contra un sistema sano. Arreglado con este mismo patrón.
  'scrum49-firma-remota.test.mjs',
  'scrum51-job-sin-quote.test.mjs',
  'scrum57-operario-propagacion.test.mjs',
  'scrum58-jobs-n1.test.mjs',
  'scrum68-evidencias-firma.test.mjs',
  'scrum72-pdfs-privados.test.mjs',
  'scrum73-verifactu-gate.test.mjs',
  'scrum74-recibo-token.test.mjs',
  'scrum82-zip-verifactu.test.mjs',
  'scrum85-pay-routes-token.test.mjs',
  'scrum90-pay-bank-mp-token.test.mjs',
  'scrum92-login-operario.test.mjs',
  'tenancy-permisos.test.mjs',
  // ── SCRUM-1218b (21-oct-2026): NO son ficheros nuevos con el patrón: son los que el censo NO VEÍA.
  // 22 salieron al arreglar sus dos ciegos (el `listen(0, host, cb)` y el `fetch` a través de una
  // llamada); `scrum893` y `scrum910` se migraron a `node:http` en el mismo commit y no están. La lista
  // se RECALCULA con el censo, no se elige (regla 41). Quedan, y el motivo de cada grupo está en
  // `docs/master/SCRUM-1218.md` (tramo 1218b):
  //   · del equipo de Luis (se le avisa, no se tocan): scrum1188d, scrum1489, scrum912;
  //   · el resto, gateados por `QA_DB_TEST` o `BOT_SUITE_TEST`: sus veredictos sólo se miden en staging.
  // Los tres de J2 que sólo corren con `LIBRO_PG_URL` (scrum1346, scrum1397, scrum1403) se migraron en
  // SCRUM-1218c (23-oct-2026), medidos con un Postgres desechable: la lista baja de 40 a 37.
  'bot-suite.test.mjs',
  'scrum1188d-tiers-tambien-se-vacia.test.mjs',
  'scrum120-patch-job-roles.test.mjs',
  'scrum148-filtro-por-miembro.test.mjs',
  'scrum1489-la-busqueda-recorta-al-tecnico.test.mjs',
  'scrum17-recapitulativa.test.mjs',
  'scrum22-operario-readpath.test.mjs',
  'scrum24-operarios-metrics.test.mjs',
  'scrum25-export-zip.test.mjs',
  'scrum25-exports.test.mjs',
  'scrum47-enviar-albaran-wa.test.mjs',
  'scrum50-bot-albaranes.test.mjs',
  'scrum66-tipo-operacion.test.mjs',
  'scrum814-carrera-del-tramo.gated.test.mjs',
  'scrum912-leer-ticket-gasto.test.mjs',
  'scrum94-register-teammember.test.mjs',
  'scrum992-partes-recortan-por-rol.test.mjs',
];

/** La salida, que va en todos los mensajes: un guard que no la dice acaba en una lista de excepciones. */
const LA_SALIDA =
  '\n\n  QUÉ HACER EN SU LUGAR — `node:http` con `agent: false` (sin pool de conexiones):\n'
  + '    const req = http.request({ host: \'127.0.0.1\', port, path, method: \'GET\', agent: false },\n'
  + '      (res) => { let d = \'\'; res.setEncoding(\'utf8\');\n'
  + '                 res.on(\'data\', (t) => { d += t; });\n'
  + '                 res.on(\'end\', () => resolve({ status: res.statusCode, cuerpo: d })); });\n'
  + '    req.on(\'error\', (e) => resolve({ status: 0, cuerpo: \'\' }));\n'
  + '    req.end();\n'
  + '  EL EJEMPLO PROBADO, con su motivo escrito: `tests/scrum100-webhooks-fail-closed.test.mjs`\n'
  + '  (líneas 50-57), donde vive desde SCRUM-100. Y el antes/después medido, en\n'
  + '  `docs/master/SCRUM-560.md`.';

/**
 * ¿Este fuente cae en el patrón peligroso?
 *
 * Se mira con AST y no con `grep` porque hay que saber si el `fetch` está DENTRO de un bucle, y
 * eso el texto plano no lo distingue.
 */
//
// SCRUM-1218b (21-oct-2026) · DOS CIEGOS que dejaban fuera el caso de SCRUM-1456c, que murió al salir
// con `0xC0000409` y sus 10 casos en verde:
//   ① el servidor se buscaba por el TEXTO `app.listen(0)`, y 1456c escribía `app.listen(0, '127.0.0.1', …)`;
//   ② el `fetch` se buscaba DENTRO del bucle, y en 1456c estaba en `const emitir = async () => {…}`,
//      a la que el bucle `for (const estado of […]) await emitir()` llama.
// Ahora el servidor es cualquier llamada `<x>.listen(0, …)` del código, y cada llamada a una función
// con nombre DEL PROPIO FICHERO cuenta los `fetch` de esa función en el sitio desde el que se llama.
// ⚠️ Sigue CIEGO a: funciones importadas de otro fichero, métodos (`obj.pedir()`), `fetch` por otro
// nombre (`globalThis.fetch`, `const f = fetch`) y procesos hijos.
export function enPatronPeligroso(fuente, nombre = 'anonimo.mjs') {
  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

  const esFuncion = (n) => n && (ts.isArrowFunction(n) || ts.isFunctionExpression(n));
  const funciones = new Map();
  let servidor = false;
  const registra = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.body) funciones.set(n.name.text, n);
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && esFuncion(n.initializer)) {
      funciones.set(n.name.text, n.initializer);
    }
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && n.expression.name.text === 'listen' && n.arguments.length > 0
      && ts.isNumericLiteral(n.arguments[0]) && n.arguments[0].text === '0') servidor = true;
    ts.forEachChild(n, registra);
  };
  registra(sf);
  if (!servidor) return { peligroso: false, motivo: 'no levanta servidor propio' };

  const esBucle = (p) => ts.isForStatement(p) || ts.isForOfStatement(p) || ts.isForInStatement(p)
    || ts.isWhileStatement(p) || ts.isDoStatement(p)
    || (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression)
      && /^(map|forEach|flatMap|filter|reduce)$/.test(p.expression.name.text));
  const definiciones = new Set(funciones.values());
  const alcanzadas = new Set();
  let sueltos = 0, enBucle = 0;

  // Recorre de arriba abajo. Una función con nombre NO se recorre donde se define, sino en cada
  // sitio que la llama, con el «en bucle» de ese sitio. `pila` corta la recursión.
  const recorre = (n, bucle, pila) => {
    if (definiciones.has(n) && !pila.includes(n)) return;
    const b = bucle || esBucle(n);
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      if (n.expression.text === 'fetch') b ? enBucle++ : sueltos++;
      const f = funciones.get(n.expression.text);
      if (f && !pila.includes(f)) { alcanzadas.add(f); recorre(f, b, [...pila, f]); }
    }
    ts.forEachChild(n, (h) => recorre(h, b, pila));
  };
  recorre(sf, false, []);
  // Una función con nombre que nadie del fichero llama (exportada, o pasada como valor) cuenta una vez.
  for (const f of definiciones) if (!alcanzadas.has(f)) recorre(f, false, [f]);

  if (enBucle > 0) return { peligroso: true, motivo: `${enBucle} \`fetch\` DENTRO DE UN BUCLE (cuenta por muchas peticiones, no por una)` };
  if (sueltos >= 3) return { peligroso: true, motivo: `${sueltos} \`fetch\` sobre su propio servidor (el umbral de SCRUM-100 son 3)` };
  return { peligroso: false, motivo: `${sueltos} \`fetch\`: por debajo del patrón` };
}

/**
 * LA SIEMBRA (SCRUM-1218b): la forma de SCRUM-1456c, fabricada aquí y escrita a un temporal FUERA del
 * árbol en cada pasada, que el censo lee por el mismo camino que los de `tests/`. Si no sale, el censo
 * está CIEGO y lo dice. No se toma prestado un fichero real: el día que alguien lo arreglara, el control
 * se quedaría mudo y seguiría en verde.
 */
const SIEMBRA = 'siembra-scrum1218b-forma-1456c.mjs';
const FUENTE_SIEMBRA = [
  "const srv = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)); });",
  'const emitir = async () => {',
  "  const r = await fetch(`http://127.0.0.1:${srv.address().port}/webhooks/stripe`, { method: 'POST' });",
  '  return { status: r.status };',
  '};',
  'for (const estado of [400, 500, 200]) { await emitir(); }',
].join('\n');

/** Los ficheros de `tests/` que hoy caen en el patrón, con la siembra leída al lado. */
function censar() {
  const dirSiembra = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1218b-'));
  fs.writeFileSync(path.join(dirSiembra, SIEMBRA), FUENTE_SIEMBRA);
  try {
    const out = [];
    let vioLaSiembra = false;
    const leer = (dir, filtro) => fs.readdirSync(dir).filter(filtro).map((f) => [dir, f]);
    for (const [dir, f] of [...leer(DIR, (x) => x.endsWith('.test.mjs')), ...leer(dirSiembra, () => true)]) {
      const r = enPatronPeligroso(fs.readFileSync(path.join(dir, f), 'utf8'), f);
      if (!r.peligroso) continue;
      if (dir === dirSiembra && f === SIEMBRA) vioLaSiembra = true;
      else out.push({ f, motivo: r.motivo });
    }
    assert.ok(vioLaSiembra,
      `🔴 CIEGO: la siembra \`${SIEMBRA}\` (la forma de SCRUM-1456c: \`fetch\` en una función con nombre `
      + 'a la que llama un bucle, y `listen(0, host, cb)`) no sale en el censo. Sin ella, «ningún fichero '
      + 'nuevo» no significa que no los haya: significa que el censo no los ve.');
    return out;
  } finally {
    fs.rmSync(dirSiembra, { recursive: true, force: true });
  }
}

// ── ① SUELO ─────────────────────────────────────────────────────────────────────────────────
test('SCRUM-560 · SUELO: el censo VE los ficheros que levantan servidor propio', () => {
  const conServidor = fs.readdirSync(DIR)
    .filter((x) => x.endsWith('.test.mjs'))
    .filter((x) => /app\.listen\(0\)/.test(fs.readFileSync(path.join(DIR, x), 'utf8')));

  assert.ok(conServidor.length >= 20,
    `🔴 CIEGO: sólo se ven ${conServidor.length} ficheros con \`app.listen(0)\` y el 20-ago-2026 `
    + 'había 34. Si el detector dejó de reconocerlos, «ningún fichero nuevo con el patrón» no '
    + 'significaría nada: significaría que no se miró.');
});

// ── ② AUTOPRUEBA: el detector distingue, y se prueba sobre fuente sintética ──────────────────
// Sin esto, un detector que devolviera siempre `false` pasaría el trinquete de abajo y parecería
// que la convención se cumple sola.
test('SCRUM-560 · AUTOPRUEBA: el detector caza el patrón y NO acusa a `node:http`', () => {
  const conBucle = 'const server = app.listen(0);\nfor (const r of rutas) { await fetch(BASE + r); }';
  assert.equal(enPatronPeligroso(conBucle).peligroso, true,
    '🔴 no caza un `fetch` dentro de un bucle — que es EXACTAMENTE el caso de scrum334, el único '
    + 'que ha abortado de verdad.');

  const tresSueltos = 'const server = app.listen(0);\nawait fetch(a); await fetch(b); await fetch(c);';
  assert.equal(enPatronPeligroso(tresSueltos).peligroso, true, '🔴 no caza 3 `fetch` sueltos');

  const dosSueltos = 'const server = app.listen(0);\nawait fetch(a); await fetch(b);';
  assert.equal(enPatronPeligroso(dosSueltos).peligroso, false,
    '🔴 acusa con 2 peticiones: el umbral medido de SCRUM-100 son 3, y un guard que acusa de más '
    + 'se acaba desactivando igual que uno que no acusa.');

  const conNodeHttp = 'const server = app.listen(0);\nfor (const r of rutas) { http.request({ agent: false }); }';
  assert.equal(enPatronPeligroso(conNodeHttp).peligroso, false,
    '🔴 acusa a `node:http`, que es LA SALIDA que este guard recomienda. Si el remedio dispara el '
    + 'guard, nadie lo aplica.');

  const sinServidor = 'for (const r of rutas) { await fetch(URL_EXTERNA + r); }';
  assert.equal(enPatronPeligroso(sinServidor).peligroso, false,
    '🔴 acusa a un `fetch` que no va contra un servidor propio: el patrón necesita las DOS piezas.');

  // SCRUM-1218b · los dos ciegos de SCRUM-1456c, cada uno por separado.
  const conHost = "const s = app.listen(0, '127.0.0.1', listo);\nfor (const r of rutas) { await fetch(BASE + r); }";
  assert.equal(enPatronPeligroso(conHost).peligroso, true,
    '🔴 no ve el servidor de `app.listen(0, host, cb)`: era el ciego ① de SCRUM-1456c.');
  const servidorEnComentario = '// app.listen(0)\nfor (const r of rutas) { await fetch(BASE + r); }';
  assert.equal(enPatronPeligroso(servidorEnComentario).peligroso, false,
    '🔴 un `app.listen(0)` en un COMENTARIO cuenta como servidor: el servidor se busca en el código, no en el texto.');

  const porLaLlamada = 'const s = app.listen(0);\nconst emitir = async () => { await fetch(BASE); };\n'
    + 'for (const e of [1, 2, 3]) { await emitir(); }';
  assert.equal(enPatronPeligroso(porLaLlamada).peligroso, true,
    '🔴 no ve el `fetch` a través de la llamada: era el ciego ② de SCRUM-1456c.');
  const porLaDeclaracion = 'const s = app.listen(0);\nasync function emitir() { await fetch(BASE); }\n'
    + 'for (const e of [1, 2, 3]) { await emitir(); }';
  assert.equal(enPatronPeligroso(porLaDeclaracion).peligroso, true,
    '🔴 ve la función de flecha y no la `function` declarada: es la misma forma.');
  const unaLlamadaSuelta = 'const s = app.listen(0);\nconst emitir = async () => { await fetch(BASE); };\nawait emitir();';
  assert.equal(enPatronPeligroso(unaLlamadaSuelta).peligroso, false,
    '🔴 acusa a una función con UN `fetch` llamada UNA vez fuera de un bucle: es una petición.');
  const tresLlamadasSueltas = 'const s = app.listen(0);\nconst emitir = async () => { await fetch(BASE); };\n'
    + 'await emitir(); await emitir(); await emitir();';
  assert.equal(enPatronPeligroso(tresLlamadasSueltas).peligroso, true,
    '🔴 no cuenta las llamadas: tres llamadas a una función con un `fetch` son tres peticiones.');
  const recursiva = 'const s = app.listen(0);\nfunction otra(n) { if (n) otra(n - 1); }\nawait fetch(a);';
  assert.equal(enPatronPeligroso(recursiva).peligroso, false,
    '🔴 una función recursiva sin `fetch` dispara el detector: la recursión tiene que cortarse sin contar.');
});

// ── ③ EL TRINQUETE ──────────────────────────────────────────────────────────────────────────
test('SCRUM-560 · ningún fichero NUEVO pide con `fetch` a su propio `app.listen(0)`', () => {
  const nuevos = censar().filter((x) => !CON_EL_PATRON_YA.includes(x.f));
  assert.deepEqual(nuevos.map((x) => `${x.f} — ${x.motivo}`), [],
    '🔴 UN FICHERO NUEVO USA `fetch` SOBRE SU PROPIO SERVIDOR:\n    '
    + nuevos.map((x) => `${x.f} — ${x.motivo}`).join('\n    ')
    + '\n\n  Ese patrón revienta una aserción de libuv al cerrar el proceso: el fichero se marca '
    + 'fallido\n  sin nombrar ningún subtest, y sale en la tanda de todo el mundo de forma '
    + 'intermitente\n  (medido: 2 de cada 10 tandas).' + LA_SALIDA);
});

// ── ④ EL TRINQUETE TAMBIÉN BAJA ─────────────────────────────────────────────────────────────
// Si alguien arregla uno y no lo quita de la lista, la lista se queda diciendo que hay un
// problema donde ya no lo hay — y la próxima persona no sabe cuáles faltan de verdad.
test('SCRUM-560 · la lista de los que ya estaban no puede quedarse vieja', () => {
  const hoy = censar().map((x) => x.f);
  const arreglados = CON_EL_PATRON_YA.filter((f) => !hoy.includes(f));
  assert.deepEqual(arreglados, [],
    '✅ ESTOS YA NO USAN `fetch` SOBRE SU SERVIDOR: ' + arreglados.join(', ')
    + '\n\n  Es una buena noticia y hay que ANOTARLA: quítalos de `CON_EL_PATRON_YA` en este mismo '
    + 'commit.\n  Una lista que sobrevive a su causa deja de ser una fecha y pasa a ser un permiso.');
});
