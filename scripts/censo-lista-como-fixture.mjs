#!/usr/bin/env node
// scripts/censo-lista-como-fixture.mjs — SCRUM-938
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ¿QUÉ TESTS ALIMENTAN SUS CASOS CON LA LISTA REAL QUE SU PROPIO GUARD CONSULTA?
//
// Miden el CONTENIDO de la lista creyendo medir el FUNCIONAMIENTO del guard. Y miente en las dos
// direcciones, que es lo que lo hace peor que un descuido de estilo:
//
//   · FALSO VERDE — el caso pasa porque la lista tiene contenido, no porque el guard sirva.
//   · FALSO ROJO  — el día que alguien VACÍA la lista, que es el objetivo de toda lista de
//                   excepciones, caen de golpe. Castiga a quien hace el trabajo bien.
//
// Medido el 17-sep-2026 en SCRUM-813: al retirar la última excepción de una lista, **seis casos
// cayeron a la vez**. Ninguno estaba roto. Estaban atados al defecto, no al mecanismo.
//
//     🔒 Un caso que se queda sin sujeto cuando el defecto se arregla estaba atado al defecto.
//
// ── EL CRITERIO ES DE FLUJO, NO DE NOMBRE ─────────────────────────────────────────────────────
//
// No basta con que el fichero MENCIONE una lista. La pregunta es si **el valor que alimenta el
// caso sale de la misma constante que el guard consulta para decidir**. Tres formas, y la tercera
// es la que no se ve:
//
//   ① el test importa la constante y la pasa como entrada a la función del guard;
//   ② el test llama a la función OMITIENDO el parámetro de la lista, así que decide con el
//      valor por defecto — que es la lista real;
//   ③ 🔴 el test escribe A MANO un LITERAL que es un elemento de la lista real.
//      Ésta es la que me pasó: el fixture era `'scrum659/'`, copiado del contenido de la lista.
//      No hay import que lo delate. Sólo se ve comparando el literal con los elementos.
//
// ── LAS TRES CLASES, porque la consecuencia no es la misma ────────────────────────────────────
//
//   (a) MIENTE ...... la lista es la ÚNICA fuente de los casos → los dos sentidos.
//   (b) DEGRADA ..... alimenta un caso entre otros fabricados → pierde un caso, no todos.
//   (c) LIMPIO ...... el test DECLARA que mide el contenido a propósito (trinquete de tamaño o
//                     de conjunto). **No es el defecto** y tiene que salir limpio: si el censo
//                     acusa a los trinquetes, marcará media casa y se desactivará solo.
//
// ⛔ ESTE CENSO NO ARREGLA NADA. Reescribir un fixture sin saber su clase convierte un falso
// verde en un verde de verdad sin haber probado nada.
//
//   node scripts/censo-lista-como-fixture.mjs [--json]
//
// Salidas: 0 nada que declarar · 1 hay acusados · 2 CIEGO (el censo no vio listas)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { censarExcepciones } from './_censo-de-censos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));
const ts = require_('typescript');

const SALIDA_OK = 0;
const SALIDA_ACUSA = 1;
const SALIDA_CIEGO = 2;

const leer = (rel) => { try { return fs.readFileSync(path.join(RAIZ, rel), 'utf8'); } catch { return ''; } };
const fuenteDe = (rel, txt) => ts.createSourceFile(rel, txt, ts.ScriptTarget.Latest, true);

/**
 * Los ELEMENTOS literales de una lista declarada, por AST.
 *
 * `censarExcepciones` da el número de elementos, no sus valores — y los valores son justo lo que
 * hace falta para la forma ③. Se leen del array (o de los `Object.freeze({ruta: '…'})` de dentro):
 * cualquier literal de cadena que cuelgue de la declaración cuenta como elemento.
 */
export function elementosDeLaLista(fuente, nombre) {
  const sf = fuenteDe('x.mjs', fuente);
  const out = new Set();
  let encontrada = false;
  // 🔴 LOS MOTIVOS NO SON ELEMENTOS, y colarlos genera falsos positivos.
  //
  // Una entrada de lista suele ser `{ruta, quien, expresion, porque}`, y `porque` es PROSA — en
  // `ESCRITURAS_DE_LA_TANDA` ocupa cuatro líneas. Si esa prosa entra como «elemento», cualquier
  // test que cite la misma frase en un comentario o en un mensaje de error saldría acusado por la
  // forma ③, que es acusar por el TEXTO y no por el flujo: el error que este censo persigue.
  //
  // El corte es por longitud, y está elegido con su dato: el elemento legítimo más largo que se
  // ha medido es `'Pendiente de precio'` (19) y el motivo más corto de los censados pasa de 70.
  // Los literales de 60 o más se declaran PROSA y no cuentan.
  //
  //     🔒 Un motivo no es un elemento, y confundirlos convierte el censo en un buscador de frases.
  // ⚠️ Y EL MÍNIMO, con su límite declarado: la primera versión exigía 3 caracteres y por eso no
  // veía un elemento como `'a/'` — su propio test lo cazó. Baja a 2. **Los elementos de UN solo
  // carácter siguen siendo invisibles**, y es a propósito: un literal `'x'` suelto en un test
  // aparece por mil motivos que no son este defecto, así que contarlo daría más ruido que señal.
  // Si alguna vez hace falta, la forma correcta es exigir además que el argumento llegue a la
  // función del guard, no bajar el umbral a ciegas.
  const TOPE_ELEMENTO = 60;
  const MINIMO_ELEMENTO = 2;
  const recogerLiterales = (n) => {
    const t = ts.isStringLiteralLike(n) ? n.text.trim() : '';
    if (t.length >= MINIMO_ELEMENTO && t.length < TOPE_ELEMENTO) out.add(n.text);
    ts.forEachChild(n, recogerLiterales);
  };
  const buscar = (n) => {
    if (ts.isVariableDeclaration(n) && n.name.getText() === nombre && n.initializer) {
      encontrada = true;
      recogerLiterales(n.initializer);
    }
    ts.forEachChild(n, buscar);
  };
  buscar(sf);
  return { encontrada, elementos: [...out] };
}

/**
 * ¿Este test usa la lista como FIXTURE? Devuelve las formas detectadas y las pruebas.
 *
 * 🔴 Se distingue el USO COMO ENTRADA del ASSERT SOBRE LA LISTA, que es lo que separa el defecto
 * de la clase (c). Un `assert.deepEqual(LISTA.map(…), […])` **mide el contenido a propósito**: es
 * un trinquete, no un fixture.
 */
export function usoDeLaLista(fuenteTest, nombre, elementos) {
  const sf = fuenteDe('t.mjs', fuenteTest);
  const formas = new Set();
  const pruebas = [];
  let assertsSobreLaLista = 0;
  let pasadaComoArgumento = 0;

  const dentroDeAssert = (n) => {
    for (let p = n.parent; p; p = p.parent) {
      if (ts.isCallExpression(p) && /^assert\b/.test(p.expression.getText())) return true;
    }
    return false;
  };

  const recorrer = (n) => {
    // ① / (c): la constante aparece. Si está bajo un `assert`, es un trinquete de contenido.
    if (ts.isIdentifier(n) && n.text === nombre) {
      if (dentroDeAssert(n)) assertsSobreLaLista++;
      else if (n.parent && ts.isCallExpression(n.parent) && n.parent.arguments.includes(n)) {
        pasadaComoArgumento++;
        formas.add('① pasada como entrada a una llamada');
        pruebas.push(`\`${nombre}\` pasada como argumento (línea ${posicion(sf, n)})`);
      }
    }
    // ③ un literal que ES un elemento de la lista real, usado como ARGUMENTO.
    if (ts.isStringLiteralLike(n) && elementos.includes(n.text) && !dentroDeAssert(n)) {
      const enLlamada = (() => {
        for (let p = n.parent; p; p = p.parent) {
          if (ts.isCallExpression(p)) return !/^assert\b/.test(p.expression.getText());
        }
        return false;
      })();
      if (enLlamada) {
        formas.add('③ literal copiado del contenido de la lista');
        pruebas.push(`literal ${JSON.stringify(n.text)} es un elemento de \`${nombre}\` (línea ${posicion(sf, n)})`);
      }
    }
    ts.forEachChild(n, recorrer);
  };
  recorrer(sf);

  return { formas: [...formas], pruebas, assertsSobreLaLista, pasadaComoArgumento };
}

function posicion(sf, n) {
  return sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
}

/**
 * ¿Este fichero IMPORTA `nombre` desde un módulo cuyo basename es `modulo`?
 *
 * Por AST y no por texto: un comentario que cite la palabra no es un import, y una cadena
 * tampoco. Cubre el import estático y el dinámico con desestructuración, que es como los tests
 * de esta casa cargan `dist/`.
 */
export function importaDe(fuente, modulo, nombre) {
  const sf = fuenteDe('c.mjs', fuente);
  let hay = false;
  const citaElModulo = (spec) => spec.includes(modulo);
  const recorrer = (n) => {
    if (hay) return;
    // import { X } from '…/modulo.mjs'
    if (ts.isImportDeclaration(n) && ts.isStringLiteralLike(n.moduleSpecifier)
        && citaElModulo(n.moduleSpecifier.text)) {
      const c = n.importClause;
      if (c && c.namedBindings && ts.isNamedImports(c.namedBindings)
          && c.namedBindings.elements.some((e) => e.name.text === nombre)) hay = true;
      // `import * as m` deja el nombre accesible como `m.X`: cuenta.
      if (c && c.namedBindings && ts.isNamespaceImport(c.namedBindings)) hay = true;
    }
    // const { X } = await import('…/modulo.js')  ·  = require('…/modulo.js')
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isObjectBindingPattern(n.name)) {
      const txt = n.initializer.getText();
      if (citaElModulo(txt) && n.name.elements.some((e) => e.name.getText() === nombre)) hay = true;
    }
    ts.forEachChild(n, recorrer);
  };
  recorrer(sf);
  return hay;
}

/** Clasifica por CONSECUENCIA, que no es igual en todos. */
export function clasificar(uso) {
  if (!uso.formas.length) return 'LIMPIO';
  // (c): mide el contenido a propósito y NO lo usa como entrada.
  if (uso.assertsSobreLaLista > 0 && !uso.pasadaComoArgumento
      && !uso.formas.some((f) => f.startsWith('③'))) return 'LIMPIO (c · trinquete de contenido)';
  // (a) la lista es la única fuente · (b) convive con fixtures propios.
  return uso.formas.length >= 2 ? '(a) MIENTE' : '(b) DEGRADA';
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL CENSO
// ═══════════════════════════════════════════════════════════════════════════════════════════════
export function censar(raiz = RAIZ) {
  const excepciones = censarExcepciones(raiz);
  const listas = excepciones.listas || [];

  const acusados = [];
  const examinados = [];

  for (const l of listas) {
    const fuente = leer(l.fichero);
    if (!fuente) continue;
    const { encontrada, elementos } = elementosDeLaLista(fuente, l.nombre);
    if (!encontrada) continue;

    // ═══════════════════════════════════════════════════════════════════════════════════════
    // 🔴 QUIÉN CONSUME LA LISTA SE RESUELVE POR EL IMPORT, NO POR MENCIONAR SU NOMBRE.
    //
    // La primera versión de este censo añadía como consumidor cualquier test cuyo texto
    // contuviera el nombre de la lista o el del fichero. Resultado medido: **118 acusados de
    // 833**, y el primero de la lista era `scrum405` acusado por una lista declarada en
    // `scrum226` — dos ficheros que no se importan. `EXCEPCIONES`, `EXENTAS` y `CONOCIDOS` son
    // nombres GENÉRICOS que se repiten por toda la casa, así que emparejar por nombre cruza
    // listas de un guard con tests de otro.
    //
    // Es el error que este mismo ticket persigue, cometido por su censo: acusar por la FORMA
    // (aparece la palabra) en vez de por el FLUJO (el valor llega al caso). Y un censo que
    // acusa al 14 % de la casa se desactiva la primera semana.
    //
    //     🔒 Un prefijo no es un nombre, y un nombre repetido no es una referencia.
    // ═══════════════════════════════════════════════════════════════════════════════════════
    const consumidores = new Set([l.fichero]); // donde vive: siempre es consumidor potencial
    const modulo = path.basename(l.fichero).replace(/\.(mjs|ts|js)$/, '');
    for (const t of ficherosDe(path.join(raiz, 'tests'))) {
      if (t === l.fichero) continue;
      const txt = leer(t);
      if (!txt) continue;
      // Sólo cuenta si IMPORTA ese nombre DESDE ese módulo. Se lee por AST: un comentario que
      // cite la palabra no es un import, y una cadena tampoco.
      if (importaDe(txt, modulo, l.nombre)) consumidores.add(t);
    }

    for (const c of consumidores) {
      const txt = leer(c);
      if (!txt) continue;
      const uso = usoDeLaLista(txt, l.nombre, elementos);
      examinados.push({ lista: l.nombre, en: l.fichero, test: c });
      const clase = clasificar(uso);
      if (clase.startsWith('LIMPIO')) continue;
      acusados.push({ lista: l.nombre, declaradaEn: l.fichero, test: c, clase, ...uso });
    }
  }

  return { listas: listas.length, examinados: examinados.length, acusados };
}

/**
 * 🔴 LA PRUEBA QUE DECIDE — vaciar la lista y ver si el test cae.
 *
 * El AST da CANDIDATOS, no acusados. «Pasada como argumento» no distingue un fixture de un caso
 * que mide precisamente cómo el guard trata su lista, y por eso la primera pasada acusaba al 39 %
 * de los pares examinados. Lo único que separa las dos cosas es el comportamiento: **si al vaciar
 * la lista el test sigue verde, no es este defecto y sale.**
 *
 * ⛔ NO SE TOCA NINGUNA LISTA REAL DEL ÁRBOL. Se copia el fichero que la declara a un hermano
 * temporal —hermano para que sus rutas relativas sigan resolviendo— con la lista vaciada, y se
 * corre ESA copia. El nombre no acaba en `.test.mjs` a propósito: así `npm test` no la recoge
 * nunca, ni aunque quedara suelta. Y se borra en un `finally` con verificación de que se fue.
 *
 * ⚠️ LÍMITE DECLARADO: sólo puede decidir cuando la lista vive **en el propio fichero de test**.
 * Si vive en un módulo aparte, vaciarla exigiría copiar también ese módulo y reescribir el import
 * de la copia; eso queda como **NO DECIDIBLE**, y cuenta del lado malo (candidato, no absuelto).
 */
export function decidirVaciando(candidato, raiz = RAIZ) {
  if (candidato.declaradaEn !== candidato.test) {
    return { decidido: false, motivo: 'la lista vive en otro fichero: haría falta copiar el módulo' };
  }
  const abs = path.join(raiz, candidato.test);
  const original = fs.readFileSync(abs, 'utf8');
  const sf = fuenteDe(candidato.test, original);

  // Se sustituye el INICIALIZADOR de la declaración por un array vacío, por posición de AST.
  let rango = null;
  const buscar = (n) => {
    if (ts.isVariableDeclaration(n) && n.name.getText() === candidato.lista && n.initializer) {
      rango = { ini: n.initializer.getStart(), fin: n.initializer.getEnd() };
    }
    ts.forEachChild(n, buscar);
  };
  buscar(sf);
  if (!rango) return { decidido: false, motivo: 'no se localizó el inicializador de la lista' };

  const vaciado = original.slice(0, rango.ini) + '[]' + original.slice(rango.fin);
  if (vaciado === original) return { decidido: false, motivo: 'la sustitución no cambió el fichero' };

  const copia = path.join(raiz, 'tests', `_938-sonda-${process.pid}-${Math.random().toString(36).slice(2, 8)}.mjs`);
  try {
    fs.writeFileSync(copia, vaciado);
    const r = require_('node:child_process').spawnSync(
      process.execPath, ['--test', '--test-force-exit', path.relative(raiz, copia).replace(/\\/g, '/')],
      { cwd: raiz, encoding: 'utf8' },
    );
    const fail = Number((r.stdout.match(/^ℹ fail (\d+)/m) || [])[1] || 0);
    const total = Number((r.stdout.match(/^ℹ tests (\d+)/m) || [])[1] || 0);
    if (!total) return { decidido: false, motivo: 'la copia no ejecutó ni un caso (import roto)' };
    return { decidido: true, cae: fail > 0, fail, total };
  } finally {
    try { fs.unlinkSync(copia); } catch { /* ya no está */ }
    if (fs.existsSync(copia)) console.error('🔴 NO SE PUDO BORRAR LA SONDA: ' + copia);
  }
}

function ficherosDe(dir) {
  const out = [];
  let entradas = [];
  try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entradas) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...ficherosDe(p));
    else if (/\.(mjs|test\.mjs)$/.test(e.name)) out.push(path.relative(RAIZ, p).replace(/\\/g, '/'));
  }
  return out;
}

// ── Ejecución ────────────────────────────────────────────────────────────────────────────────
// 🔴 LA PUERTA, CON EL PATRÓN QUE ESTA CASA YA MIDIÓ (SCRUM-765).
//
// La primera versión hacía `new URL('file://' + process.argv[1].replace(…))`, y reventó con
// `Cannot read properties of undefined` en cuanto alguien importó este módulo desde otro proceso
// (que es justo lo que hace su propio test). Además es la comparación que SCRUM-765 dejó medida
// como INSERVIBLE en Windows: tres barras contra dos, invertidas contra normales, `%20` contra
// espacio. `pathToFileURL` casa en las cuatro formas de invocación — y el `argv[1] &&` delante
// es lo que permite importarlo sin ejecutarlo.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = censar();

  if (!r.listas) {
    console.log('🔴 CIEGO · el censo no ha visto NI UNA lista de excepciones.');
    console.log('   SCRUM-927 midió 132. Un cero aquí es un lector roto, no un árbol limpio.');
    process.exit(SALIDA_CIEGO);
  }

  console.log('POBLACIÓN · ' + r.listas + ' listas de excepciones declaradas (censo de SCRUM-927, reutilizado)');
  console.log('            ' + r.examinados + ' pares (lista × fichero que la consume) examinados');
  console.log('            ' + r.acusados.length + ' acusados\n');

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.acusados.length ? SALIDA_ACUSA : SALIDA_OK);
  }

  const porClase = {};
  for (const a of r.acusados) porClase[a.clase] = (porClase[a.clase] || 0) + 1;
  console.log('CANDIDATOS por clase (análisis estático — todavía no son acusados):');
  for (const [c, n] of Object.entries(porClase)) console.log('  ' + c + ': ' + n);

  if (!process.argv.includes('--decidir')) {
    console.log('\n⚠️ Éstos son CANDIDATOS. «Pasada como argumento» no distingue un fixture de un');
    console.log('   caso que mide cómo el guard trata su lista. Para decidir: `--decidir`, que');
    console.log('   vacía la lista en una COPIA y comprueba si el test cae.\n');
    for (const a of r.acusados) {
      console.log(`${a.clase}  ${a.test}`);
      console.log(`    lista \`${a.lista}\` declarada en ${a.declaradaEn}`);
      for (const p of a.pruebas.slice(0, 3)) console.log('      · ' + p);
    }
    process.exit(r.acusados.length ? SALIDA_ACUSA : SALIDA_OK);
  }

  // ── LA PRUEBA QUE DECIDE ────────────────────────────────────────────────────────────────────
  console.log('\n🔴 LA PRUEBA QUE DECIDE · se vacía la lista en una COPIA y se mira si el test cae.\n');
  const confirmados = [];
  const absueltos = [];
  const noDecidibles = [];
  for (const a of r.acusados) {
    const d = decidirVaciando(a, RAIZ);
    if (!d.decidido) { noDecidibles.push({ ...a, motivo: d.motivo }); continue; }
    if (d.cae) confirmados.push({ ...a, fail: d.fail, total: d.total });
    else absueltos.push({ ...a, total: d.total });
  }

  console.log('VEREDICTO');
  console.log('  candidatos ................. ' + r.acusados.length);
  console.log('  CONFIRMADOS (la lista vacía los tumba) ... ' + confirmados.length);
  console.log('  absueltos (siguen verdes) ................ ' + absueltos.length);
  console.log('  NO DECIDIBLES (cuentan del lado malo) .... ' + noDecidibles.length + '\n');

  for (const c of confirmados) {
    console.log(`🔴 ${c.clase}  ${c.test}`);
    console.log(`    \`${c.lista}\` · al vaciarla caen ${c.fail} de ${c.total} casos`);
    for (const p of c.pruebas.slice(0, 2)) console.log('      · ' + p);
  }
  if (noDecidibles.length) {
    console.log('\nNO DECIDIBLES (la lista vive en otro fichero, o la copia no arrancó):');
    for (const n of noDecidibles.slice(0, 12)) console.log(`   ${n.test} · \`${n.lista}\` — ${n.motivo}`);
    if (noDecidibles.length > 12) console.log(`   … y ${noDecidibles.length - 12} más`);
  }
  process.exit(confirmados.length ? SALIDA_ACUSA : SALIDA_OK);

  console.log('\n⛔ Este censo NO arregla nada: la clase decide el remedio, y reescribir un fixture');
  console.log('   sin saber su clase convierte un falso verde en un verde de verdad sin probar nada.');
  process.exit(r.acusados.length ? SALIDA_ACUSA : SALIDA_OK);
}
