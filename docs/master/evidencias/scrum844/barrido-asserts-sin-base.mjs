// docs/master/evidencias/scrum844/barrido-asserts-sin-base.mjs — SCRUM-844 §13
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA PREGUNTA, LITERAL Y SIN REFORMULAR (§4 de docs/master/SCRUM-844.md):
//
//     «¿hay dentro de un gateado algún assert que no necesite base?»
//
// §4 explica por qué ÉSA y no otra: «para barrer los 57, la pregunta que rinde **no** es "¿este
// fichero necesita base?" —casi todos dirán que sí, y con razón— sino "¿hay dentro algún assert
// que no la necesite?"». Y da el mecanismo:
//
//     🔒 «Un gate puesto al FICHERO apaga también las mitades que no lo necesitaban.»
//
// ⛔ ESTO MIDE. No arregla nada, no escribe tests y no toca `src/`. Los ficheros del camino
//    fiscal se LEEN (regla 38): no se modifica ni uno, ni siquiera para medir.
//
// ── LO QUE DEVUELVE ES UNA LISTA, NO UN PORCENTAJE ───────────────────────────────────────────
// Un porcentaje se celebra; una lista se arregla. Cada línea sale con fichero, línea y el texto
// del assert, para que se pueda ir a él.
//
// ── DOS CATEGORÍAS, Y LA SEGUNDA ES LA DEL §4 ────────────────────────────────────────────────
//  · **A · SIN BASE POR DATOS**: ningún operando del assert desciende de la base. Correría tal
//    cual sin Postgres delante. Es el caso indiscutible.
//  · **B · LA REGLA, NO EL DATO**: el assert comprueba el MENSAJE (o el código) de un error
//    lanzado, contra un literal. Es exactamente la forma de ① y de 173b, que §4 audita a mano y
//    declara «NO, a medias — el rechazo no necesita base»: lo que se afirma es una regla del
//    código, y la guarda que la produce salta antes de consultar nada.
//
// ⚠️ POR QUÉ HACEN FALTA LAS DOS, dicho para que nadie lo tome por barroco: el dataflow puro
//    NO encuentra ① —`err` desciende sintácticamente de una llamada a `prisma`— y §4 dice que ①
//    SÍ tiene mitad pura. Un barrido que sólo mirase datos daría cero sobre el caso que originó
//    la pregunta, y ese cero se leería como «no hay nada». La categoría B existe para eso, y su
//    acierto se comprueba contra la auditoría a mano del propio §4 (ver `--control`).
//
// ⚠️ LO QUE ESTO NO ES: no decide que un assert SOBRE. Dice «esto no parece necesitar base» y
//    pone el dedo; separar la mitad pura de la que sí la necesita es trabajo de otro ticket.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const requiere = createRequire(path.join(RAIZ, 'package.json'));
const ts = requiere('typescript');

/** Los gates que significan «necesita una BASE DE VERDAD» (CLAUDE.md · Comandos). */
export const GATES = new Set([
  'QA_DB_TEST',
  'A55_DB_TEST',
  'BOT_SUITE_TEST',
  'LIBRO_PG_URL',
]);

/** Raíces de las que desciende un dato de la base. `tx` es la de dentro de una transacción. */
const FUENTES_BD = new Set(['prisma', 'tx', 'db', 'cliente', 'conn', 'pool']);

/** Ayudantes de fixture que devuelven filas reales: lo que sale de ellos ES de la base. */
const AYUDANTES_BD = /^(with|crear|sembrar|insertar|seed|make|nueva|nuevo)[A-Z]/;

/**
 * 🔴 LA RED TAMBIÉN ES LA BASE, y esto no es obvio.
 *
 * En estos gateados el servidor que contesta está enchufado a la base gateada: una cookie de
 * sesión obtenida con `fetch(/auth/verify)` no se consigue sin un merchant real. Sin esto, el
 * barrido daba por «sin base» once asserts de `scrum221` y todos los `cookie.startsWith(...)` —
 * y son justo lo contrario: dependen de la base a través de HTTP.
 *
 * Es el falso positivo que el control del §4 NO podía cazar, porque los siete tests que audita
 * no hacen HTTP. Se encontró leyendo la lista, que es para lo que sirve una lista.
 */
const FUENTES_RED = /\b(fetch|axios|supertest|got|superagent)\s*[.(]|\bserver\s*\.|\.listen\s*\(/;

const texto = (n, sf) => n.getText(sf).replace(/\s+/g, ' ');

/** ¿La expresión de `skip` depende de alguno de los GATES? Resuelve identificadores locales. */
function gateDelSkip(nodo, sf) {
  const visto = new Set();
  let gate = null;

  const declDe = (nombre) => {
    let hallado = null;
    const mira = (n) => {
      if (hallado) return;
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === nombre) {
        hallado = n.initializer || null;
      }
      ts.forEachChild(n, mira);
    };
    ts.forEachChild(sf, mira);
    return hallado;
  };

  const rec = (n) => {
    if (!n || gate) return;
    if (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) {
      const t = texto(n, sf);
      for (const g of GATES) if (t.includes(`process.env.${g}`) || t.includes(`'${g}'`) || t.includes(`"${g}"`)) { gate = g; return; }
    }
    if (ts.isIdentifier(n) && !visto.has(n.text)) {
      visto.add(n.text);
      const init = declDe(n.text);
      if (init) rec(init);
      if (gate) return;
    }
    ts.forEachChild(n, rec);
  };
  rec(nodo);
  return gate;
}

/** Los `test(...)` del fichero con su gate (o null) y su cuerpo. */
function testsDe(sf) {
  const out = [];
  const rec = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'test') {
      const opts = n.arguments.find((a) => ts.isObjectLiteralExpression(a));
      const cuerpo = n.arguments.find((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a));
      let gate = null;
      if (opts) {
        const skip = opts.properties.find((p) => p.name && ts.isIdentifier(p.name) && p.name.text === 'skip');
        if (skip && ts.isPropertyAssignment(skip)) gate = gateDelSkip(skip.initializer, sf);
      }
      const nombre = n.arguments[0] && ts.isStringLiteralLike(n.arguments[0]) ? n.arguments[0].text : '(sin nombre)';
      if (cuerpo) out.push({ nombre, gate, cuerpo });
    }
    ts.forEachChild(n, rec);
  };
  rec(sf);
  return out;
}

/**
 * Nombres que descienden de la base DENTRO de este cuerpo: lo que se saca de `prisma`/`tx`, lo
 * que devuelve un ayudante de fixture, y lo que se deriva de ellos. Se itera hasta punto fijo,
 * porque `const a = await prisma…; const b = a.id; const c = f(b);` propaga en cadena.
 */
function nombresDeLaBase(cuerpo, sf) {
  const sucios = new Set();
  const decls = [];

  /**
   * 🔴 TODOS los nombres que liga un patrón, no sólo el identificador suelto.
   *
   * La primera versión sólo miraba `ts.isIdentifier(d.name)`, y por ahí se escapaban
   * `const [s1, s2] = await Promise.all([...])` y `for (const inv of ...)`. El SUELO lo cazó: el
   * barrido señalaba el test ③ de `scrum173` —que §4 audita a mano y declara que SÍ necesita
   * base— porque `s1`/`s2` nunca se ensuciaban. Era un defecto del instrumento, no un hallazgo.
   */
  const nombresDe = (name, out = []) => {
    if (ts.isIdentifier(name)) out.push(name.text);
    else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
      for (const el of name.elements) if (ts.isBindingElement(el)) nombresDe(el.name, out);
    }
    return out;
  };

  const rec = (n) => {
    if (ts.isVariableDeclaration(n) && n.initializer) decls.push(n);
    // `for (const x of <algo>)` — si lo iterado viene de la base, `x` también.
    if (ts.isForOfStatement(n) && ts.isVariableDeclarationList(n.initializer)) {
      for (const d of n.initializer.declarations) {
        decls.push({ name: d.name, initializer: n.expression, __forOf: true });
      }
    }
    // 🔴 Y LA ASIGNACIÓN, no sólo la declaración. `let row;` … `row = await prisma…` es el patrón
    // normal cuando la consulta va dentro de un `try`. Sin esto, el barrido daba por «sin base»
    // doce asserts de `scrum115` y tres de `scrum52` que leen filas reales. Lo encontró la
    // LISTA al mirarla una por una, no el suelo — porque los siete tests del §4 no usan `let`.
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && (ts.isIdentifier(n.left) || ts.isObjectBindingPattern(n.left) || ts.isArrayBindingPattern(n.left))) {
      decls.push({ name: n.left, initializer: n.right, __asignacion: true });
    }
    if (ts.isFunctionLike(n) && n !== cuerpo) {
      // los parámetros de un callback de fixture (p. ej. `async (merchant) => …`) son de la base
      for (const p of n.parameters) for (const nm of nombresDe(p.name)) sucios.add(nm);
    }
    ts.forEachChild(n, rec);
  };
  ts.forEachChild(cuerpo, rec);

  const tocaLaBase = (t) => {
    for (const f of FUENTES_BD) if (new RegExp(`\\b${f}\\s*\\.`).test(t)) return true;
    if (FUENTES_RED.test(t)) return true; // el servidor que contesta está enchufado a la base
    return AYUDANTES_BD.test(t.replace(/^await\s+/, ''));
  };

  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const d of decls) {
      const ligados = nombresDe(d.name);
      if (!ligados.length || ligados.every((x) => sucios.has(x))) continue;
      const t = texto(d.initializer, sf);
      const heredado = [...sucios].some((s) => new RegExp(`\\b${s}\\b`).test(t));
      if (tocaLaBase(t) || heredado) {
        for (const x of ligados) sucios.add(x);
        cambio = true;
      }
    }
  }
  return { sucios, tocaLaBase };
}

/** Los `assert…` de un cuerpo, clasificados. */
function assertsDe(cuerpo, sf) {
  const { sucios, tocaLaBase } = nombresDeLaBase(cuerpo, sf);
  const out = [];
  const rec = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && ts.isIdentifier(n.expression.expression) && n.expression.expression.text === 'assert') {
      const metodo = n.expression.name.text;
      // Sólo los argumentos que son el SUJETO, no el mensaje de fallo (el último string literal).
      const args = n.arguments.filter((a) => !ts.isStringLiteralLike(a));
      const t = args.map((a) => texto(a, sf)).join(' , ');
      const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));

      const usaSucio = [...sucios].some((s) => new RegExp(`\\b${s}\\b`).test(t));
      const usaBD = tocaLaBase(t);

      // B · LA REGLA, NO EL DATO: se comprueba el mensaje/código de un error contra un literal.
      const esMensajeDeError = /\b(err|error|e)\s*\.\s*(message|code|name)\b/.test(t)
        && args.some((a) => ts.isRegularExpressionLiteral(a) || ts.isStringLiteralLike(a));

      let clase = null;
      if (!usaSucio && !usaBD) clase = 'A';
      else if (esMensajeDeError) clase = 'B';

      if (clase) out.push({ linea: line + 1, metodo, clase, texto: t.slice(0, 120) });
    }
    ts.forEachChild(n, rec);
  };
  ts.forEachChild(cuerpo, rec);
  return out;
}

/** Clasifica una FUENTE (no un fichero): lo que necesita la siembra de abajo. */
export function barrerFuente(nombre, src) {
  const sf = ts.createSourceFile(nombre, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const out = [];
  for (const t of testsDe(sf).filter((x) => x.gate)) {
    for (const a of assertsDe(t.cuerpo, sf)) out.push({ test: t.nombre, gate: t.gate, ...a });
  }
  return out;
}

/**
 * 🔴 SIEMBRA — un defecto que SÉ que no está cubierto, para que «no hay nada» no pueda
 * confundirse con «no sé mirar».
 *
 * El control del §4 comprueba que el instrumento reproduce una auditoría a mano. Éste comprueba
 * lo otro: que sobre un fichero fabricado a propósito **separa** las dos mitades del mismo test —
 * la que necesita base y la que no—, que es literalmente el fenómeno que describe el §4:
 *
 *     🔒 «Un gate puesto al FICHERO apaga también las mitades que no lo necesitaban.»
 *
 * No escribe nada en el árbol: la fuente se clasifica en memoria.
 */
export function siembra() {
  const fuente = [
    "import test from 'node:test';",
    "import assert from 'node:assert/strict';",
    "const ENABLED = process.env.QA_DB_TEST === '1';",
    "test('sembrado: las dos mitades', { skip: !ENABLED && 'sin QA_DB_TEST=1' }, async () => {",
    "  const { prisma } = await import('../dist/core/db/prisma.js');",
    // ① LA MITAD QUE SÍ NECESITA BASE
    "  const fila = await prisma.invoice.findFirst({ where: { id: 1 } });",
    "  assert.equal(fila.number, 'F-2026-001');",
    // ② LA MITAD QUE NO — pura, apagada por el gate del fichero
    "  const normalizado = '/var/app/storage/facturas'.replace(/\\\\/g, '/');",
    "  assert.ok(normalizado.includes('/storage/'));",
    "});",
  ].join('\n');

  const hallados = barrerFuente('tests/sembrado.test.mjs', fuente);
  const lineas = hallados.map((h) => h.linea);
  return {
    veLaMitadPura: lineas.includes(9),      // el assert sobre `normalizado`
    noVeLaDeLaBase: !lineas.includes(7),    // el assert sobre `fila`, que sí necesita base
    hallados,
  };
}

export function barrer(raiz = RAIZ) {
  const dir = path.join(raiz, 'tests');
  const ficheros = fs.readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort();
  const resultado = { ficherosMirados: ficheros.length, gateados: [], hallazgos: [], testsGateados: 0 };

  for (const f of ficheros) {
    const p = path.join(dir, f);
    const sf = ts.createSourceFile(p, fs.readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const tests = testsDe(sf);
    const conGate = tests.filter((t) => t.gate);
    if (!conGate.length) continue;
    resultado.gateados.push({ fichero: `tests/${f}`, tests: conGate.length, gates: [...new Set(conGate.map((t) => t.gate))] });
    resultado.testsGateados += conGate.length;
    for (const t of conGate) {
      for (const a of assertsDe(t.cuerpo, sf)) {
        resultado.hallazgos.push({ fichero: `tests/${f}`, test: t.nombre, gate: t.gate, ...a });
      }
    }
  }
  return resultado;
}

/**
 * 🔴 SUELO — la respuesta CONOCIDA, de la auditoría a mano del §4.
 *
 * §4 auditó siete tests de `scrum173` uno a uno. Dos salen «NO, a medias»: el ① y el 173b. Los
 * otros necesitan base de verdad. Si el instrumento no distingue ESO, no distingue nada — y su
 * silencio sobre los otros 65 ficheros no significaría «no hay», significaría «no sé mirar».
 */
export function control(raiz = RAIZ) {
  const r = barrer(raiz);
  const delFichero = r.hallazgos.filter((h) => h.fichero === 'tests/scrum173-cadena-verifactu-serializada.test.mjs');
  const nombra = (frag) => delFichero.some((h) => h.test.includes(frag));
  return {
    ve173_1: nombra('SCRUM-173 ①'),
    ve173b: nombra('SCRUM-173b'),
    noSeñalaEl2: !nombra('SCRUM-173 ②'),
    noSeñalaEl3: !nombra('SCRUM-173 ③'),
    noSeñalaEl177: !nombra('SCRUM-177'),
    detalle: delFichero.map((h) => `${h.fichero}:${h.linea} [${h.clase}] ${h.test}`),
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const r = barrer();
  const c = control();

  console.log('BARRIDO SCRUM-844 §13 · «¿hay dentro de un gateado algún assert que no necesite base?»');
  console.log('─'.repeat(95));
  console.log(`ficheros .test.mjs mirados : ${r.ficherosMirados}`);
  console.log(`ficheros CON tests gateados: ${r.gateados.length}`);
  console.log(`tests gateados             : ${r.testsGateados}`);
  console.log('');

  if (!r.gateados.length) {
    console.log('🔴 CIEGO: cero ficheros gateados. El §13 habla de 65: un cero aquí no es «no hay»,');
    console.log('   es que el detector de gates dejó de reconocerlos.');
    process.exit(3);
  }

  console.log('🔴 SUELO · la respuesta CONOCIDA del §4 (auditada a mano allí):');
  for (const [k, v] of Object.entries(c)) {
    if (k === 'detalle') continue;
    console.log(`   ${v ? '✅' : '🔴'} ${k}`);
  }
  for (const d of c.detalle) console.log(`      · ${d}`);
  const sueloOk = c.ve173_1 && c.ve173b && c.noSeñalaEl2 && c.noSeñalaEl3 && c.noSeñalaEl177;
  console.log(`   → ${sueloOk ? '✅ el instrumento distingue' : '🔴 NO distingue: la lista de abajo no vale'}`);
  console.log('');

  const s = siembra();
  console.log('🔴 SIEMBRA · un defecto que SÉ que no está cubierto, en un test fabricado:');
  console.log(`   ${s.veLaMitadPura ? '✅' : '🔴'} ve la mitad PURA (el assert que no necesita base)`);
  console.log(`   ${s.noVeLaDeLaBase ? '✅' : '🔴'} y NO señala la mitad que sí la necesita`);
  for (const h of s.hallados) console.log(`      · :${h.linea} [${h.clase}] ${h.metodo}(${h.texto})`);
  const siembraOk = s.veLaMitadPura && s.noVeLaDeLaBase;
  console.log(`   → ${siembraOk ? '✅ separa las dos mitades del mismo test' : '🔴 NO separa: el barrido no vale'}`);
  console.log('');

  const porFichero = new Map();
  for (const h of r.hallazgos) {
    if (!porFichero.has(h.fichero)) porFichero.set(h.fichero, []);
    porFichero.get(h.fichero).push(h);
  }
  console.log(`LA LISTA · ${r.hallazgos.length} asserts en ${porFichero.size} ficheros`);
  console.log('─'.repeat(95));
  for (const [f, hs] of [...porFichero.entries()].sort()) {
    console.log(`\n${f}   (${hs.length})`);
    for (const h of hs.sort((a, b) => a.linea - b.linea)) {
      console.log(`  :${String(h.linea).padStart(4)} [${h.clase}] ${h.metodo}(${h.texto})`);
    }
  }
  console.log('');
  console.log('A = ningún operando desciende de la base · B = comprueba el mensaje de un error contra un literal');
  if (!sueloOk || !siembraOk) process.exit(3);
}
