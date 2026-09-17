// scripts/censo-alcance-vs-sujeto.mjs — SCRUM-732
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// GUARDS CUYO ALCANCE ES MÁS ANCHO QUE SU SUJETO
//
// Una aserción que toma LA FUENTE ENTERA de un fichero para defender una propiedad de cuatro
// rótulos gobierna mucho más de lo que dice proteger. Mientras el resto del fichero esté limpio,
// las dos cosas coinciden; el día que otro ticket escribe algo legítimo en otra parte, el guard se
// pone rojo acusando al sitio equivocado — y un rojo que nombra el sitio equivocado se arregla
// apagándolo. Ahí sí se pierde la propiedad entera.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// 🔴 SON DOS DEFECTOS CON UN NOMBRE COMÚN, Y SE ACUSAN POR EJES OPUESTOS
//
// Los dos casos conocidos (los dos arreglados por SCRUM-587) NO son el mismo defecto:
//
//   · SCRUM-286 — **GOBIERNA DE MÁS**. `assert.ok(!FUENTE.includes('[PENDIENTE…'))` sobre todo
//     `quotesView.js`, y su mensaje nombra «los TÍTULOS del formulario»: cuatro, ya derivados dos
//     líneas más arriba en `bloques`.
//   · SCRUM-591 — **PERMITE DE MENOS**. `assert.ok(!lit.some(l => l.includes('[PENDIENTE')))`
//     prohíbe CUALQUIER marcador, mientras su mensaje promete que lo declarado en el censo de
//     SCRUM-402 es legítimo. La vía que ofrecía no existía: el único modo de pasar era borrar el
//     marcador o apagar el test.
//
// Que el censo no los confunda en una sola cifra.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// QUÉ MIDE ESTE CENSO, Y QUÉ NO — EL NÚCLEO DECIDIBLE
//
// ✅ MIDE el eje de SCRUM-286, que es **posicional y decidible**: por dónde fluye el valor que la
//    aserción gobierna. Dos conjuntos, comparados como conjuntos:
//
//      ALCANCE  = las unidades que la aserción gobierna de hecho.
//      SUJETO   = las unidades sobre las que el fichero ya sabe hablar por separado.
//
//    Se acusa cuando ALCANCE ⊋ SUJETO: la aserción opera sobre la CADENA CRUDA del fichero
//    (raíz `readFileSync`) por una operación de texto, existiendo en el mismo ámbito una
//    COLECCIÓN DERIVADA de esa misma fuente. O sea: el fichero ya sabe mirar el subconjunto, y la
//    aserción no lo mira.
//
// ⛔ NO MIDE el eje de SCRUM-591. Comparar el conjunto que una aserción gobierna contra el que
//    NOMBRA SU MENSAJE es leer castellano, no medir. Un censo que afirmara cubrirlo cometería
//    dentro del instrumento el defecto que este ticket denuncia: gobernar más de lo que puede.
//    Va a NO CLASIFICADO, con su motivo, y se cuenta SIEMPRE junto al número de cazados.
//
// 🔴 LAS DOS CIFRAS VAN JUNTAS Y EN LA MISMA LÍNEA. Un «caza N» sin su no-clasificado al lado es
//    el mismo cero sin población de siempre.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// EL BANCO ES FABRICADO Y VIVE AQUÍ (decisión del orquestador, 17-sep-2026)
//
// No se ata el positivo a `ac282d55^`: un censo que mide el árbol de hoy no puede llevar dentro un
// control que vive en la historia — en CI el clon puede venir superficial y el instrumento se
// rompería por donde no mide nada.
//
// ⚠️ Y un positivo que uno mismo escribe pasa por construcción. Por eso el banco se validó UNA VEZ
// contra los dos ficheros REALES de antes de SCRUM-587, a mano y fuera del test. La salida literal
// de esa pasada está pegada en `docs/master/SCRUM-732.md`.
// ═════════════════════════════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');
const YO = 'scripts/censo-alcance-vs-sujeto.mjs';

/** Operaciones de TEXTO: las que tratan la fuente como una cadena, no como una estructura. */
const OPS_DE_TEXTO = new Set(['includes', 'match', 'test', 'indexOf', 'search', 'split', 'startsWith', 'endsWith']);

/** La raíz de una cadena de accesos: `a.b.c()` → `a`. */
function raizDe(nodo) {
  let n = nodo;
  for (;;) {
    if (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) { n = n.expression; continue; }
    if (ts.isCallExpression(n)) { n = n.expression; continue; }
    if (ts.isNonNullExpression(n) || ts.isParenthesizedExpression(n)) { n = n.expression; continue; }
    return n;
  }
}

/**
 * Analiza un fuente y devuelve su veredicto. Exportado para que el banco fabricado —y la pasada
 * histórica a mano— usen EXACTAMENTE el mismo criterio que el barrido del árbol.
 */
export function analizar(fuente, nombre = 'anon.mjs') {
  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

  const CRUDAS = new Set();    // variables cuya raíz es la fuente cruda de un fichero
  const DERIVADAS = new Set(); // variables que son una ESTRUCTURA sacada de una cruda

  // ① Las crudas: `const F = fs.readFileSync(...)` y un salto de alias (`const G = F`).
  const visitarCrudas = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      // 🔴 UNA FUNCIÓN QUE ENVUELVE `readFileSync` NO ES UNA CADENA. Lo destapó la pasada
      // histórica: en `scrum591` este barrido daba `crudas: leer` por `const leer = (p) =>
      // fs.readFileSync(p, 'utf8')`, que es el LECTOR, no la fuente. Contarlo como cruda haría
      // «medible» a un fichero del que no se ha leído nada — un no-clasificado disfrazado de
      // clasificado, que es el cero sin población otra vez.
      const esFuncion = ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer);
      const texto = n.initializer.getText(sf);
      if (!esFuncion && /readFileSync\s*\(/.test(texto) && !/JSON\.parse/.test(texto)) CRUDAS.add(n.name.text);
    }
    ts.forEachChild(n, visitarCrudas);
  };
  visitarCrudas(sf);

  // ② Las derivadas: una llamada que RECIBE una cruda y devuelve algo que no es la cruda.
  //    `const R = revisarAsignacionDeBloques(FUENTE, 'x')` → R es una estructura sobre FUENTE.
  //    Es UN salto, y el límite se declara: más saltos y esto dejaría de ser decidible.
  const visitarDerivadas = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer
        && ts.isCallExpression(n.initializer)) {
      const usaCruda = n.initializer.arguments.some(
        (a) => ts.isIdentifier(a) && CRUDAS.has(a.text),
      );
      if (usaCruda) DERIVADAS.add(n.name.text);
    }
    ts.forEachChild(n, visitarDerivadas);
  };
  visitarDerivadas(sf);

  // ③ Las aserciones que gobiernan la CRUDA por una operación de texto.
  const anchas = [];
  const estrechas = [];
  const visitarAserciones = (n) => {
    if (ts.isCallExpression(n) && /^assert\b/.test(n.expression.getText(sf))) {
      let tocaCruda = null;
      let tocaDerivada = false;
      const mirar = (x, negado) => {
        if (ts.isCallExpression(x) && ts.isPropertyAccessExpression(x.expression)
            && OPS_DE_TEXTO.has(x.expression.name.text)) {
          const r = raizDe(x.expression.expression);
          // 🔴 SÓLO LA BÚSQUEDA NEGADA. Lo destapó la pasada histórica, y era un falso positivo
          // mío: en `scrum286` este barrido acusaba también la `l.38`,
          // `assert.ok(FUENTE.includes(buscar))` dentro del helper `mutar()`. Ahí el sujeto SÍ es
          // la fuente entera —«el patrón a mutar existe en alguna parte»— y gobernarla es
          // exactamente lo que dice hacer.
          //
          // La distinción es decidible y es de forma, no de significado: `!F.includes(x)` es una
          // PROHIBICIÓN sobre todo el fichero («esto no está en ninguna parte»); `F.includes(x)`
          // es una PRECONDICIÓN («esto está en alguna parte»). El defecto de este ticket vive en
          // las prohibiciones: son las que se ponen rojas acusando al sitio equivocado.
          if (negado && ts.isIdentifier(r) && CRUDAS.has(r.text)) tocaCruda = r.text;
        }
        const r2 = ts.isIdentifier(x) ? x : null;
        if (r2 && DERIVADAS.has(r2.text)) tocaDerivada = true;
        if (ts.isPropertyAccessExpression(x)) {
          const r3 = raizDe(x);
          if (ts.isIdentifier(r3) && DERIVADAS.has(r3.text)) tocaDerivada = true;
        }
        ts.forEachChild(x, (h) => mirar(h, negado || (ts.isPrefixUnaryExpression(x) && x.operator === ts.SyntaxKind.ExclamationToken)));
      };
      for (const a of n.arguments) mirar(a, false);
      const linea = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
      if (tocaCruda && !tocaDerivada) anchas.push({ linea, cruda: tocaCruda });
      else if (tocaDerivada) estrechas.push({ linea });
    }
    ts.forEachChild(n, visitarAserciones);
  };
  visitarAserciones(sf);

  return {
    crudas: [...CRUDAS], derivadas: [...DERIVADAS], anchas, estrechas,
    // ALCANCE ⊋ SUJETO: gobierna la fuente entera Y el fichero ya sabe mirar el subconjunto.
    acusado: anchas.length > 0 && DERIVADAS.size > 0,
    // Sin fuente cruda no hay nada que decir de este fichero: no es limpio, es no medible.
    medible: CRUDAS.size > 0,
  };
}

// ═══ EL BANCO FABRICADO · tres casos de respuesta conocida ═══════════════════════════════════
//
// Fabricado a propósito y no copiado del árbol: un banco copiado envejece con su original y deja
// de probar lo que decía. Los tres son la misma forma con una sola diferencia cada vez.

export const BANCO = [
  {
    nombre: 'ANCHO · gobierna la fuente entera teniendo el subconjunto al lado',
    acusado: true,
    fuente: `
      const FUENTE = fs.readFileSync(ruta, 'utf8');
      const R = revisarBloques(FUENTE, 'x.js');
      const bloques = R.orden.filter((n) => ESPERADOS.includes(n.nombre));
      assert.ok(!FUENTE.includes('[PENDIENTE microcopy oficial]'), 'los TITULOS');
    `,
  },
  {
    nombre: 'ESTRECHO · la misma propiedad, mirada sobre el subconjunto',
    acusado: false,
    fuente: `
      const FUENTE = fs.readFileSync(ruta, 'utf8');
      const R = revisarBloques(FUENTE, 'x.js');
      const bloques = R.orden.filter((n) => ESPERADOS.includes(n.nombre));
      const conMarcador = bloques.filter((b) => String(b.titulo).includes('[PENDIENTE'));
      assert.deepEqual(conMarcador.map((b) => b.nombre), [], 'los TITULOS');
    `,
  },
  {
    // 🔴 EL CONTROL NEGATIVO QUE DECIDE: alcance y sujeto COINCIDEN. No hay subconjunto derivado,
    // así que gobernar el fichero entero es exactamente lo que dice hacer. Si esto saliera
    // acusado, el criterio acusaría a todo el que lea un fichero y su lista no significaría nada.
    nombre: 'NEGATIVO · gobierna la fuente entera y su sujeto ES la fuente entera',
    acusado: false,
    fuente: `
      const FUENTE = fs.readFileSync(ruta, 'utf8');
      assert.ok(!FUENTE.includes('eval('), 'este fichero no usa eval');
    `,
  },
];

function correrBanco() {
  const fallos = [];
  for (const c of BANCO) {
    const r = analizar(c.fuente, 'banco.mjs');
    if (r.acusado !== c.acusado) {
      fallos.push(`${c.nombre} → esperado acusado=${c.acusado}, obtenido ${r.acusado}`);
    }
  }
  return fallos;
}

// ═══ BARRIDO DEL ÁRBOL ═══════════════════════════════════════════════════════════════════════

function ficheros(dir) {
  const out = [];
  const rec = (d) => {
    let e;
    try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const x of e) {
      const p = path.join(d, x.name);
      if (x.isDirectory()) { if (x.name !== 'node_modules' && x.name !== 'dist') rec(p); continue; }
      if (x.name.endsWith('.mjs')) out.push(p);
    }
  };
  rec(path.join(RAIZ, dir));
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const fallosBanco = correrBanco();

  const examinados = [];
  const acusados = [];
  const noClasificados = [];
  for (const dir of ['tests', 'scripts']) {
    for (const abs of ficheros(dir)) {
      const rel = path.relative(RAIZ, abs).split(path.sep).join('/');
      if (rel === YO) continue;
      let fuente;
      try { fuente = fs.readFileSync(abs, 'utf8'); } catch { continue; }
      if (!/\bassert\b/.test(fuente)) continue; // sin aserciones no es un guard
      examinados.push(rel);
      const r = analizar(fuente, rel);
      if (!r.medible) { noClasificados.push({ rel, motivo: 'no lee ninguna fuente cruda: nada que comparar' }); continue; }
      if (r.acusado) acusados.push({ rel, anchas: r.anchas, derivadas: r.derivadas });
    }
  }

  // ── SUELO ──────────────────────────────────────────────────────────────────────────────────
  if (examinados.length === 0) {
    console.error(`🔴 CIEGO: 0 guards examinados. Un cero sobre población vacía no es un cero.`);
    process.exit(2);
  }

  console.log('SCRUM-732 · ALCANCE MÁS ANCHO QUE EL SUJETO\n');
  console.log('── CONTROLES DEL BANCO FABRICADO ──');
  if (fallosBanco.length) {
    console.log('🔴 EL BANCO NO RESPONDE COMO DEBE:');
    for (const f of fallosBanco) console.log(`   ${f}`);
  } else {
    console.log(`✅ los ${BANCO.length} casos fabricados responden como deben:`);
    for (const c of BANCO) console.log(`     ${c.acusado ? 'ACUSA ' : 'limpio'} · ${c.nombre}`);
  }
  console.log('');

  console.log('── POBLACIÓN ──');
  console.log(`guards EXAMINADOS (ficheros .mjs con aserciones) ... ${examinados.length}`);
  console.log(`  · medibles (leen una fuente cruda) ............... ${examinados.length - noClasificados.length}`);
  console.log(`  · NO CLASIFICADOS ............................... ${noClasificados.length}`);
  console.log('');
  console.log('── HALLAZGO · LAS DOS CIFRAS JUNTAS ──');
  console.log(`CAZADOS ${acusados.length}  ·  NO CLASIFICADOS ${noClasificados.length}   (sobre ${examinados.length} examinados)`);
  console.log('');
  console.log('⛔ EL EJE DE SCRUM-591 NO ENTRA EN LA CIFRA DE CAZADOS, y es un defecto distinto:');
  console.log('   «permite de menos» —prohibir más de lo que el mensaje declara legítimo— exige');
  console.log('   comparar el conjunto gobernado contra el que NOMBRA el mensaje. Eso es leer');
  console.log('   castellano. Medirlo aquí sería cometer dentro del instrumento el defecto que');
  console.log('   este ticket denuncia.');
  console.log('');
  console.log('── CAZADOS · ALCANCE ⊋ SUJETO ──');
  for (const a of acusados.sort((x, y) => y.anchas.length - x.anchas.length || x.rel.localeCompare(y.rel))) {
    console.log(`  ${a.rel}`);
    for (const w of a.anchas) console.log(`     l.${w.linea} gobierna \`${w.cruda}\` entera · subconjunto disponible: ${a.derivadas.join(', ')}`);
  }

  if (fallosBanco.length) process.exit(2);
  process.exit(acusados.length ? 1 : 0);
}
