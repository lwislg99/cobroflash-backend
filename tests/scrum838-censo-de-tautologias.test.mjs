// tests/scrum838-censo-de-tautologias.test.mjs — SCRUM-838
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// UN ASERTO QUE NO PUEDE FALLAR ES UNA MENTIRA DENTRO DE LA SUITE, Y NINGÚN GUARD LO CAZA.
//
// Los trinquetes vigilan que el número no baje. Los suelos vigilan que el instrumento vea. Los
// meta-guards vigilan que los guards caigan cuando deben. Los tres dan por bueno **un aserto que
// pasa** — y uno que pasa SIEMPRE se lee exactamente igual que uno que pasa porque el código está
// bien. Es el único defecto que el resto de la maquinaria no puede encontrar.
//
// ── LOS TRES CASOS QUE LO ABREN, Y LOS TRES SON REALES ───────────────────────────────────────
//
//   ① SCRUM-833 · `dentro ∩ fuera === []`, donde `dentro` era `alcanzable === true` y `fuera`
//      era `alcanzable === false` SOBRE LA MISMA COLECCIÓN. Complementarios por construcción:
//      la intersección es vacía pase lo que pase con el código. Vivió meses.
//   ② SCRUM-814 · `new Set([]).size === [].length` daba verde con CERO facturas: `0 === 0`.
//      Su fichero lo arregló poniendo delante `assert.equal(facturas.length, 2)` — o sea, un
//      SUELO que fija la población. La forma rota es la MISMA comparación sin ese suelo.
//   ③ El extractor de PDF · comparaba `''` con `''` y daba por bueno el viaje del texto.
//
// ── EL SUELO DE ESTE CENSO ───────────────────────────────────────────────────────────────────
// 🔴 Un cero aquí NO vale por sí solo. Los tres casos de arriba se siembran y el detector tiene
// que cazarlos. Si no caza los tres, el censo está CIEGO y eso es lo que se reporta — no el cero.
//
// ── ALCANCE (regla 37) ───────────────────────────────────────────────────────────────────────
// ⛔ NO se abre un ticket por cada tautología. La lista vive aquí, declarada, y sólo se convierte
// en ticket la que tenga VÍCTIMA HOY. Una lista de hallazgos sin víctima es deuda anotada; una
// lista convertida en veinte tickets es ruido que nadie mira.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(RAIZ, 'tests');

const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
/** Un nombre de variable metido en una expresión regular sin que sus símbolos la rompan. */
const escapar = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** ¿Este argumento es una comparación de tamaño? `x.length`, `x.size`, `new Set(x).size`… */
const esMagnitud = (t) => /\.(length|size)\s*$/.test(norm(t));

/**
 * EL DETECTOR. Devuelve los asertos que son verdaderos POR CONSTRUCCIÓN.
 *
 * Se mira con AST y no con `grep` porque hacen falta dos cosas que el texto plano no da: saber
 * qué asertos viven DENTRO del mismo `test(...)` —para buscarles suelo— y comparar el TEXTO
 * NORMALIZADO de los dos lados de un aserto sin que un salto de línea los haga distintos.
 *
 * @returns {{linea:number, forma:string, texto:string}[]}
 */
export function tautologiasDe(fuente, nombre = 'x.test.mjs') {
  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const out = [];
  const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const txt = (n) => norm(n.getText(sf));

  // ── Los `const X = COLL.filter(PRED)` del fichero, para la forma ① ──────────────────────────
  const derivadas = [];
  // …y TODOS los `const X = <lo que sea>`, para poder seguir el rastro hacia arriba.
  // 🔴 Sin esto la forma ① no se caza, y lo aprendí midiendo: en SCRUM-833 el enlace entre las
  // dos mitades complementarias pasaba por `const nombresFuera = new Set(fuera.map(…))`, que NO
  // es un `.filter()`. Mirando sólo las derivadas por filtro, el rastro se cortaba ahí.
  const ligaduras = [];
  const visitaDecl = (n) => {
    if (ts.isVariableDeclaration(n) && n.name && n.initializer) {
      ligaduras.push({ nombre: txt(n.name), cuerpo: txt(n.initializer) });
      if (ts.isCallExpression(n.initializer)
        && ts.isPropertyAccessExpression(n.initializer.expression)
        && n.initializer.expression.name.text === 'filter') {
        derivadas.push({
          nombre: txt(n.name),
          coleccion: txt(n.initializer.expression.expression),
          predicado: n.initializer.arguments.map((a) => txt(a)).join(','),
        });
      }
    }
    ts.forEachChild(n, visitaDecl);
  };
  visitaDecl(sf);

  /**
   * Dos derivadas de la MISMA colección cuyos predicados son el uno la negación del otro.
   *
   * Se compara el predicado DESNUDO —sin el `=== true`/`=== false` y sin los filtros añadidos con
   * `&&`, que no cambian la complementariedad—. Un `!INTOCABLES.has(r.nombre) && p === false`
   * sigue siendo el complemento de `p === true` en lo que importa: ninguna rama puede estar en
   * los dos lados.
   */
  const sonComplementarios = (a, b) => {
    if (a.coleccion !== b.coleccion) return false;
    const nucleo = (p) => p
      .split('&&').map((s) => s.trim()).filter((s) => /===\s*(true|false)/.test(s) || /^!/.test(s))
      .join('&&').replace(/\s*===\s*(true|false)\s*/g, '').replace(/^!+/, '').replace(/^\(*/, '');
    const valor = (p) => (/===\s*false/.test(p) ? false : /===\s*true/.test(p) ? true
      : /=>\s*!/.test(p) ? false : null);
    const va = valor(a.predicado), vb = valor(b.predicado);
    if (va === null || vb === null || va === vb) return false;
    const na = nucleo(a.predicado), nb = nucleo(b.predicado);
    return na.length > 0 && na === nb;
  };

  /**
   * Los nombres de los que depende una expresión, siguiendo las derivadas HACIA ARRIBA.
   *
   * Hace falta porque la tautología de SCRUM-833 no cruzaba `dentro` con `fuera` directamente:
   * cruzaba `coladas` —derivado de `dentro`— contra un `Set` construido sobre `fuera`. El par
   * complementario estaba un nivel más arriba, y mirando sólo el aserto no se ve.
   */
  const raices = (texto) => {
    const vistos = new Set();
    const pendientes = [texto];
    while (pendientes.length) {
      const t = pendientes.pop();
      for (const l of ligaduras) {
        if (vistos.has(l.nombre)) continue;
        if (!new RegExp(`\\b${l.nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(t)) continue;
        vistos.add(l.nombre);
        pendientes.push(l.cuerpo);
      }
    }
    return vistos;
  };

  // ── El cuerpo del `test(...)` que envuelve a un nodo, para buscarle SUELO ───────────────────
  const cuerpoDelTest = (n) => {
    for (let p = n.parent; p; p = p.parent) {
      if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && p.expression.text === 'test') {
        return txt(p);
      }
    }
    return null;
  };

  /**
   * ¿Hay SUELO en este test? Algo que fije la población a un número concreto o exija que no esté
   * vacía. Es lo que separa la forma rota de SCRUM-814 de la arreglada: la arreglada tiene
   * delante `assert.equal(facturas.length, 2)`.
   */
  /**
   * ¿Este lado se apoya en una CONSTANTE LITERAL del propio fichero? Entonces no puede ser 0, y
   * comparar contra ella no es `0 === 0`: la lista es su propio suelo.
   * 🔴 Sin esto el censo daba 20 hallazgos y casi todos eran `bloques.length` contra
   * `BLOQUES_EN_ORDEN.length`, que es exactamente lo que un test DEBE hacer.
   */
  const esConstanteLiteral = (texto) => ligaduras.some((l) =>
    new RegExp(`\\b${escapar(l.nombre)}\\b`).test(texto)
    && /^(Object\.freeze\()?\[[^\]]/.test(l.cuerpo));

  const tieneSuelo = (cuerpo) => cuerpo !== null && (
    /assert\.\w+\(\s*[^,)]*\.(length|size)\s*,\s*[1-9]\d*/.test(cuerpo)
    || /assert\.ok\(\s*[^,)]*\.(length|size)\s*[><]=?\s*\d+/.test(cuerpo)
    || /assert\.ok\(\s*[^,)]*\.(length|size)\s*&&/.test(cuerpo)
    // 🔴 UN SUELO NO SIEMPRE ES UN ASERTO, y esto lo aprendí con dos falsos positivos medidos:
    // `scrum481` escribe `if (cubo.casa.length < 2) continue;` — se salta el caso vacío en vez de
    // asertarlo, y el efecto es el mismo: cuando llega a la comparación, la población ya no puede
    // ser 0. Un censo que sólo reconoce suelos con forma de `assert` acusa al que se protegió de
    // otra manera.
    || /if\s*\([^)]*\.(length|size)\s*[<>]=?\s*\d+\s*\)\s*(continue|return)/.test(cuerpo)
    || /\.filter\(\s*\(?\w+\)?\s*=>\s*\w+\.(length|size)\s*[><]=?\s*[1-9]/.test(cuerpo));

  const visita = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && ts.isIdentifier(n.expression.expression) && n.expression.expression.text === 'assert'
      && n.arguments.length >= 2) {
      const a = txt(n.arguments[0]);
      const b = txt(n.arguments[1]);
      // 🔴 PARA COMPARAR LOS DOS LADOS **NO** SE NORMALIZAN LOS ESPACIOS, y lo aprendí con un
      // falso positivo: `scrum252` compara `normalizarSchema('id      Int')` con
      // `normalizarSchema('id Int')`, y su diferencia ES el espaciado. Colapsarlo hacía que mi
      // detector viera dos lados idénticos donde había justo lo que el test mide. Un instrumento
      // que normaliza la diferencia que busca no encuentra nada.
      const crudoA = n.arguments[0].getText(sf).trim();
      const crudoB = n.arguments[1].getText(sf).trim();

      // ── FORMA ④ · LOS DOS LADOS SON EL MISMO TEXTO. Comparar algo consigo mismo.
      if (crudoA === crudoB) {
        out.push({ linea: linea(n), forma: 'lados-identicos', texto: a.slice(0, 90) });
      } else {
        // ── FORMA ① · dos derivadas COMPLEMENTARIAS por construcción, cruzadas y esperando vacío.
        const dependencias = raices(a);
        let complementaria = false;
        for (const x of derivadas) {
          for (const y of derivadas) {
            if (x !== y && dependencias.has(x.nombre) && dependencias.has(y.nombre)
              && sonComplementarios(x, y)) complementaria = true;
          }
        }
        if (complementaria && /^\[\s*\]$/.test(b)) {
          out.push({ linea: linea(n), forma: 'complementarios-por-construccion', texto: a.slice(0, 90) });
        } else if (esMagnitud(a) && esMagnitud(b) && !tieneSuelo(cuerpoDelTest(n))
          && !esConstanteLiteral(a) && !esConstanteLiteral(b)) {
          // ── FORMA ② · dos magnitudes comparadas entre sí, y las dos pueden ser 0.
          out.push({ linea: linea(n), forma: 'magnitudes-sin-suelo', texto: `${a} vs ${b}`.slice(0, 90) });
        }
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return out;
}

// ═══ ① EL SUELO · los TRES casos conocidos, y si no caza los tres el cero de abajo no vale ════

/**
 * ⚠️ PROCEDENCIA DE CADA SEMILLA, declarada:
 *   · ① es la fuente REAL, copiada de `scrum637-la-rama-que-nadie-mira.test.mjs` antes de
 *     SCRUM-833. No es una reconstrucción.
 *   · ② es la forma REAL de `scrum814-carrera-del-tramo.gated.test.mjs` con su suelo retirado —
 *     que es exactamente como estaba cuando dio el falso verde.
 *   · ③ es una RECONSTRUCCIÓN de la forma descrita en SCRUM-814 («el extractor de PDF que
 *     comparaba «» con «»»). Su fuente original no está en el árbol y NO se finge que lo esté.
 */
const SEMILLAS = [
  {
    id: '① SCRUM-833 · complementarios por construcción (fuente real)',
    forma: 'complementarios-por-construccion',
    src: `test('x', () => {
      const dentro = inst.ramas.filter((r) => alcanzable(r.nombre) === true);
      const fuera = inst.ramas.filter((r) => alcanzable(r.nombre) === false);
      const nombresFuera = new Set(fuera.map((r) => r.nombre));
      const coladas = dentro.filter((r) => nombresFuera.has(r.nombre));
      assert.deepEqual(coladas.map((r) => r.nombre), [], 'una rama YA MERGEADA...');
    });`,
  },
  {
    id: '② SCRUM-814 · magnitudes que pueden ser 0 = 0 (forma real, sin su suelo)',
    forma: 'magnitudes-sin-suelo',
    src: `test('x', async () => {
      const numeros = facturas.map((f) => f.stageLabel);
      assert.equal(new Set(numeros).size, numeros.length, 'dos facturas del mismo tramo');
    });`,
  },
  {
    id: '③ el extractor de PDF · comparar algo consigo mismo (RECONSTRUCCIÓN declarada)',
    forma: 'lados-identicos',
    src: `test('x', () => {
      assert.equal(textoDelPdf(buf).trim(), textoDelPdf(buf).trim(), 'el viaje del texto');
    });`,
  },
];

test('SCRUM-838 · 🔴 SUELO: el detector caza los TRES casos conocidos', () => {
  const ciego = [];
  for (const s of SEMILLAS) {
    const h = tautologiasDe(s.src, 'semilla.test.mjs');
    if (!h.some((x) => x.forma === s.forma)) ciego.push(`${s.id} → esperaba «${s.forma}», encontró [${h.map((x) => x.forma).join(', ') || 'nada'}]`);
  }
  assert.deepEqual(ciego, [],
    '🔴 EL CENSO ESTÁ CIEGO y su cero de abajo no significa nada:\n    ' + ciego.join('\n    '));
});

test('SCRUM-838 · ✅ CONTROL NEGATIVO: un aserto normal NO se marca', () => {
  // Sin esta mitad, un detector que dijera «tautología» a todo pasaría el suelo de arriba y
  // dejaría la suite llena de rojos falsos — que es como se desactiva un guard en una semana.
  const sanos = [
    `test('x', () => { assert.equal(sumar(2, 2), 4, 'la suma'); });`,
    `test('x', () => { assert.deepEqual(lista.map((r) => r.nombre), ['a', 'b']); });`,
    // La forma de SCRUM-814 CON su suelo delante: es la versión ARREGLADA y no puede salir.
    `test('x', () => {
       assert.equal(facturas.length, 2, 'se esperaban 2 facturas');
       assert.equal(new Set(numeros).size, numeros.length, 'un tramo por factura');
     });`,
    // Dos derivadas de la misma colección que NO son complementarias.
    `test('x', () => {
       const viejas = ramas.filter((r) => r.dias > 30);
       const conPr = ramas.filter((r) => r.pr !== null);
       assert.deepEqual(viejas.filter((r) => conPr.includes(r)), []);
     });`,
  ];
  const falsos = [];
  for (const s of sanos) {
    const h = tautologiasDe(s, 'sano.test.mjs');
    if (h.length) falsos.push(`${h.map((x) => x.forma).join(', ')} ← ${norm(s).slice(0, 70)}`);
  }
  assert.deepEqual(falsos, [],
    '🔴 FALSOS POSITIVOS: el detector marca asertos sanos. Un censo así se apaga en una semana:\n'
    + '    ' + falsos.join('\n    '));
});

// ═══ ② EL CENSO SOBRE EL ÁRBOL DE HOY ════════════════════════════════════════════════════════

/**
 * LO ENCONTRADO, declarado con su motivo. Regla 37: esto NO son tickets.
 *
 * Una entrada sale de aquí de dos maneras: se arregla el aserto, o se demuestra que no es una
 * tautología y se retira con el porqué. Lo que no puede es crecer en silencio — de eso se encarga
 * el test de abajo.
 */
const DECLARADAS = [
  // 🔴 UNA DE VERDAD, y es lo que este censo vino a encontrar. El comentario de al lado dice qué
  // quería probar —«nadie ha llamado a `aplicarA`, y el total es el de siempre»— y el aserto no
  // lo prueba: compara `centimos(LINEAS)` consigo mismo, así que pasa aunque `aplicarA` mutara
  // `LINEAS` en el sitio, que es EXACTAMENTE el defecto que vigila. Lo correcto sería capturar el
  // total ANTES y comparar contra esa captura.
  // ⚠️ SIN VÍCTIMA HOY, medido: `aplicarA` devuelve `lista.slice()` o un `.map()`, nunca muta
  // (`public/dashboard/js/descuentoPorDefecto.js:89-100`). Por eso se declara y NO se abre ticket
  // (regla 37): el día que alguien haga que mute, este aserto seguirá en verde y ahí sí hay
  // víctima. Sale de aquí cuando se capture el antes.
  'scrum587-descuento-por-defecto.test.mjs [lados-identicos] centimos(LINEAS)',
  // ✅ INTENCIONADO, y no es una tautología aunque lo parezca: el test se llama «la clave es
  // DETERMINISTA» y comparar dos llamadas es justo lo que prueba. Una función que devolviera un
  // valor distinto cada vez lo tumbaría. Se declara para que la lista describa el árbol entero y
  // no sólo lo malo.
  'scrum358-encolar-firma.test.mjs [lados-identicos] b.ctx.claveDeFirma(42)',
];

/**
 * 🔴 QUÉ FORMAS BLOQUEAN Y CUÁL NO, con el motivo medido.
 *
 * `magnitudes-sin-suelo` NO entra en el trinquete. Medido sobre el árbol de hoy: 35 hallazgos, y
 * de los CINCO que revisé a mano los cinco eran falsos positivos con suelo propio —una lista
 * constante que no puede ser 0, un `if (x.length < 2) continue`, una población construida a
 * partir de las versiones soportadas—. Comparar un recuento derivado contra el esperado es lo que
 * un test DEBE hacer, y la forma no distingue eso de `0 === 0`.
 *
 *     🔒 Una lista de excepciones sin la causa al lado convierte un fallo en una característica.
 *        Y un guard que nace con 35 falsos positivos es uno que alguien silencia la primera semana.
 *
 * Se queda como MODO DE INFORME (`node --test` lo imprime abajo) hasta que alguien encuentre un
 * discriminador. Lo que sí bloquea son las dos formas con precisión medida: `lados-identicos`
 * —2 hallazgos, 1 real— y `complementarios-por-construccion` —0 hoy, pero es la forma exacta de
 * SCRUM-833 y está probada con su semilla—.
 */
const FORMAS_QUE_BLOQUEAN = new Set(['lados-identicos', 'complementarios-por-construccion']);

test('SCRUM-838 · 🔴 el censo del árbol: ninguna tautología NUEVA sin declarar', () => {
  const ficheros = fs.readdirSync(DIR).filter((f) => f.endsWith('.test.mjs'));
  assert.ok(ficheros.length > 100,
    `🔴 CIEGO: sólo ${ficheros.length} ficheros de test barridos.`);

  const halladas = [];
  const informativas = [];
  for (const f of ficheros) {
    if (f === path.basename(fileURLToPath(import.meta.url))) continue; // este fichero lleva las semillas dentro
    for (const h of tautologiasDe(fs.readFileSync(path.join(DIR, f), 'utf8'), f)) {
      // 🔴 LA IDENTIDAD NO LLEVA LA LÍNEA DENTRO (SCRUM-710): si la llevara, corregir un
      // fichero por encima movería la declaración y este trinquete gritaría sin que nada haya
      // cambiado. La línea se imprime para quien lo lea, pero NO forma parte de la clave.
      const fila = `${f} [${h.forma}] ${h.texto}`;
      if (!FORMAS_QUE_BLOQUEAN.has(h.forma)) { informativas.push(`${f}:${h.linea} ${h.texto}`); continue; }
      halladas.push(fila);
    }
  }
  console.log(`    · ${informativas.length} candidatos de \`magnitudes-sin-suelo\` (informe, no trinquete: `
    + '5 de 5 revisados a mano eran falsos positivos con suelo propio)');

  assert.deepEqual(halladas.sort(), [...DECLARADAS].sort(),
    '🔴 HA CAMBIADO LA LISTA DE ASERTOS QUE NO PUEDEN FALLAR.\n'
    + '     ahora:     ' + (halladas.join('\n                ') || '(ninguna)') + '\n'
    + '     declarado: ' + (DECLARADAS.join('\n                ') || '(ninguna)') + '\n'
    + '  Uno nuevo no es necesariamente un fallo, pero SÍ es una decisión: o el aserto se arregla\n'
    + '  para que pueda fallar, o se declara aquí con el motivo por el que no es una tautología.\n'
    + '  Lo que no puede es entrar en silencio: un control que no puede fallar se lee igual que\n'
    + '  uno que pasa porque el código está bien, y ningún otro guard lo va a cazar.');
});
