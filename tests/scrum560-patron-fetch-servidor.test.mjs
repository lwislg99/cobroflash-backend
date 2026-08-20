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
  'scrum329-legal-pagina-publica.test.mjs',
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
export function enPatronPeligroso(fuente, nombre = 'anonimo.mjs') {
  if (!/app\.listen\(0\)/.test(fuente)) return { peligroso: false, motivo: 'no levanta servidor propio' };

  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let sueltos = 0, enBucle = 0;

  const dentroDeBucle = (n) => {
    for (let p = n.parent; p; p = p.parent) {
      if (ts.isForStatement(p) || ts.isForOfStatement(p) || ts.isForInStatement(p)
        || ts.isWhileStatement(p) || ts.isDoStatement(p)) return true;
      if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression)
        && /^(map|forEach|flatMap|filter|reduce)$/.test(p.expression.name.text)) return true;
    }
    return false;
  };

  const visita = (n) => {
    if (ts.isCallExpression(n) && n.expression.getText(sf) === 'fetch') {
      dentroDeBucle(n) ? enBucle++ : sueltos++;
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);

  if (enBucle > 0) return { peligroso: true, motivo: `${enBucle} \`fetch\` DENTRO DE UN BUCLE (cuenta por muchas peticiones, no por una)` };
  if (sueltos >= 3) return { peligroso: true, motivo: `${sueltos} \`fetch\` sobre su propio servidor (el umbral de SCRUM-100 son 3)` };
  return { peligroso: false, motivo: `${sueltos} \`fetch\`: por debajo del patrón` };
}

/** Los ficheros de `tests/` que hoy caen en el patrón. */
function censar() {
  const out = [];
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.test.mjs'))) {
    const r = enPatronPeligroso(fs.readFileSync(path.join(DIR, f), 'utf8'), f);
    if (r.peligroso) out.push({ f, motivo: r.motivo });
  }
  return out;
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
