// SCRUM-198 · TODA RUTA QUE EMITA XML DE REGISTROS PASA POR `buildVerifactuRegistrosXml`.
//
// ── QUÉ AFIRMA ESTE FICHERO Y QUÉ NO ─────────────────────────────────────────────────────
//
// NO afirma que el XML sea conforme. Eso ya lo demuestra `scrum209-desglose-conforme.test.mjs`,
// y mejor: valida la salida real del servicio contra los XSD oficiales con `xmllint-wasm`, con
// el XML de ANTES del arreglo commiteado como caso rojo permanente. Repetir aquí esa validación
// sería un segundo arnés en paralelo del mismo hecho — que es exactamente el defecto que este
// ticket persigue, cometido en el ticket que lo persigue.
//
// Lo que 209 demuestra es que HOY el camino está bien. Lo que falta —y es esto— es que SIGA
// estándolo: nada impide que mañana una tercera ruta arme el sobre por su cuenta y se salte la
// función validada. Ese es el enunciado literal de SCRUM-198, y hasta hoy no lo vigilaba nadie.
//
// ── LA REGLA, DERIVADA DE LA ESTRUCTURA Y NO DE UNA LISTA DE NOMBRES ─────────────────────
//
// La pertenencia al conjunto vigilado NO se enumera: se deriva de dónde vive el fichero. Todo
// `src/modules/*/app/routes/*.ts` es una ruta, hoy y cuando alguien añada la número 43. Un guard
// con allowlist de nombres se satisface dejando de enumerar —basta llamar al fichero de otra
// forma— y eso no es una vigilancia, es un trámite (criterio de SCRUM-227).
//
// Dos formas de saltarse el emisor, y las dos se vigilan:
//   · A — armar el sobre A MANO en la ruta (una plantilla con la raíz del documento dentro).
//   · B — importar el constructor fiscal DIRECTAMENTE y ensamblar desde la ruta. No deja
//     ningún literal en el fichero, así que A no lo vería.
//
// ⚠️ AST y no `grep`. Este fichero está lleno de las palabras que vigila, porque son las que hay
// que escribir para explicar la prohibición; un guard de texto se cazaría a sí mismo (SCRUM-176/
// 168/3/193). Se miran NODOS: un literal de cadena es un nodo, una mención en un comentario no.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DIR_MODULOS = path.join(AQUI, '..', 'src', 'modules');

/** La única puerta legítima: el servicio que 209 valida contra el XSD. */
const EMISOR = 'buildVerifactuRegistrosXml';
/** La raíz del documento de registros. Si aparece en un literal, ahí se está armando un sobre. */
const RAIZ_SOBRE = 'RegFactuSistemaFacturacion';
/** El constructor fiscal de bajo nivel. Una ruta no tiene por qué conocerlo. */
const MODULO_BUILDER = 'fiscal/verifactu/registro.builder';

/** Todas las rutas del proyecto, por estructura de directorios y no por lista. */
function ficherosDeRutas() {
  const out = [];
  for (const modulo of fs.readdirSync(DIR_MODULOS)) {
    const dir = path.join(DIR_MODULOS, modulo, 'app', 'routes');
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.ts')) out.push(path.join(dir, f));
    }
  }
  return out;
}

const parsear = (nombre, codigo) =>
  ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const leerRuta = (ruta) => parsear(ruta, fs.readFileSync(ruta, 'utf8'));

const enLinea = (sf, n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

/** ¿Es un nodo que APORTA TEXTO al programa? Cubre las cuatro piezas de una plantilla. */
const esTexto = (n) =>
  ts.isStringLiteral(n) ||
  ts.isNoSubstitutionTemplateLiteral(n) ||
  ts.isTemplateHead(n) ||
  ts.isTemplateMiddle(n) ||
  ts.isTemplateTail(n);

/** A · sobres armados a mano: un literal del programa que contiene la raíz del documento. */
function sobresArmadosAMano(sf) {
  const out = [];
  const visitar = (n) => {
    if (esTexto(n) && n.text.includes(RAIZ_SOBRE)) out.push(enLinea(sf, n));
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(sf, visitar);
  return out;
}

/** B · imports directos del constructor fiscal. */
function importaElBuilder(sf) {
  const out = [];
  const visitar = (n) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)
        && n.moduleSpecifier.text.includes(MODULO_BUILDER)) {
      out.push(enLinea(sf, n));
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(sf, visitar);
  return out;
}

/** Llamadas al emisor legítimo. Es lo que el suelo cuenta para saber que el análisis MIRÓ. */
function llamadasAlEmisor(sf) {
  const out = [];
  const visitar = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === EMISOR) {
      out.push(enLinea(sf, n));
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(sf, visitar);
  return out;
}

// ── SUELO, EN DOS MITADES ────────────────────────────────────────────────────────────────
//
// Los guards de abajo son NEGATIVOS: afirman «no hay ningún sitio que…». Un cero es la
// respuesta buena y también la que da un analizador que no miró nada — un parser roto, un
// directorio renombrado, un `readdirSync` sobre la carpeta equivocada. Las dos mitades separan
// esos casos: ① el analizador reconoce lo que persigue, y ② de verdad recorrió el árbol real.

test('SCRUM-198 · ① el analizador ve las dos evasiones y NO marca lo legítimo', () => {
  // Positivos: las dos formas de saltarse el emisor, en sus dos sabores de literal.
  const conPlantilla = parsear('x.ts', 'const a = `<sum:' + RAIZ_SOBRE + ' xmlns="y">${cuerpo}</sum:' + RAIZ_SOBRE + '>`;');
  assert.ok(sobresArmadosAMano(conPlantilla).length > 0,
    '🔴 no reconoce un sobre armado con plantilla: el guard está ciego');

  const conComillas = parsear('x.ts', `const a = '<sum:${RAIZ_SOBRE}>';`);
  assert.ok(sobresArmadosAMano(conComillas).length > 0,
    '🔴 no reconoce un sobre armado con comillas');

  const conImport = parsear('x.ts', `import { buildRegistroAlta } from '../../../${MODULO_BUILDER}';`);
  assert.equal(importaElBuilder(conImport).length, 1,
    '🔴 no reconoce el import directo del constructor fiscal');

  assert.equal(llamadasAlEmisor(parsear('x.ts', `const r = await ${EMISOR}({ merchantId: 7 });`)).length, 1,
    '🔴 no reconoce ni la llamada legítima: no está mirando nodos de llamada');

  // Negativo 1: el nombre en un COMENTARIO no es un nodo. Sin esto, este mismo fichero —que
  // escribe la palabra prohibida para explicarla— sería imposible de mantener.
  assert.deepEqual(sobresArmadosAMano(parsear('x.ts', `// nunca armes ${RAIZ_SOBRE} aquí\nconst y = 1;`)), [],
    '🔴 el guard mira TEXTO y no nodos: se cazaría a sí mismo');

  // Negativo 2: importar el SERVICIO es la vía correcta y no puede dar rojo. Un guard que
  // molesta en el código bueno acaba desactivado, que es la forma silenciosa de perderlo.
  assert.deepEqual(importaElBuilder(parsear('x.ts', `import { ${EMISOR} } from '../../../invoicing/domain/verifactu.service';`)), [],
    '🔴 marca la vía CORRECTA como si fuera una evasión');
});

test('SCRUM-198 · ② el análisis recorrió las rutas REALES y encontró los dos consumidores', () => {
  const rutas = ficherosDeRutas();
  assert.ok(rutas.length > 0,
    '🔴 no se ha analizado NINGÚN fichero de rutas. El cero de los guards de abajo no ' +
    'significaría «no hay evasiones», sino «no se miró». Revisa src/modules/*/app/routes/.');

  const consumidores = [];
  for (const ruta of rutas) {
    for (const linea of llamadasAlEmisor(leerRuta(ruta))) {
      consumidores.push(`${path.basename(ruta)}:${linea}`);
    }
  }

  // Los dos consumidores medidos: el XML dentro de `datos.zip` y el endpoint `/verifactu.xml`.
  // Se exige encontrar AL MENOS los dos: un tercero legítimo puede aparecer y no es un fallo —
  // lo que no puede pasar es encontrar cero y llamarlo tranquilidad.
  assert.ok(consumidores.length >= 2,
    '🔴 el analizador encuentra ' + consumidores.length + ' llamadas a ' + EMISOR + ' y tiene que ' +
    'ver al menos las DOS conocidas (datos.zip y /verifactu.xml). Si ve cero, no está mirando ' +
    'donde cree: los guards de abajo estarían dando verde sobre un árbol vacío.\n  ' +
    consumidores.join('\n  '));

  assert.ok(consumidores.every((c) => c.startsWith('exports.routes.ts:')),
    '🔴 hay un consumidor fuera de exports.routes.ts:\n  ' + consumidores.join('\n  ') +
    '\n  No es necesariamente un error, pero SCRUM-198 se midió sobre dos y solo dos: ' +
    'confirma que el nuevo también valida su XML antes de actualizar este suelo.');
});

// ── EL GUARD ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-198 · A · ninguna ruta arma el sobre de registros a mano', () => {
  const culpables = [];
  for (const ruta of ficherosDeRutas()) {
    for (const linea of sobresArmadosAMano(leerRuta(ruta))) {
      culpables.push(`${path.relative(path.join(AQUI, '..'), ruta).replace(/\\/g, '/')}:${linea}`);
    }
  }
  assert.deepEqual(culpables, [],
    '🔴 UNA RUTA ESTÁ ARMANDO EL XML DE REGISTROS POR SU CUENTA:\n    ' + culpables.join('\n    ') +
    '\n\n  Ese XML NO pasa por `' + EMISOR + '`, así que no lo cubre la validación contra los\n' +
    '  XSD oficiales de `scrum209-desglose-conforme.test.mjs`. Es un segundo emisor, y de los\n' +
    '  dos solo uno está demostrado conforme — que es literalmente el defecto de SCRUM-209 (dos\n' +
    '  constructores, uno validado y otro no) repetido.\n\n' +
    '  Un XML de registros que no valida no es un fallo de formato: es una declaración que la\n' +
    '  AEAT rechaza. La salida correcta es llamar al servicio, no replicarlo.');
});

test('SCRUM-198 · B · ninguna ruta importa el constructor fiscal directamente', () => {
  const culpables = [];
  for (const ruta of ficherosDeRutas()) {
    for (const linea of importaElBuilder(leerRuta(ruta))) {
      culpables.push(`${path.relative(path.join(AQUI, '..'), ruta).replace(/\\/g, '/')}:${linea}`);
    }
  }
  assert.deepEqual(culpables, [],
    '🔴 UNA RUTA IMPORTA EL CONSTRUCTOR FISCAL DE BAJO NIVEL:\n    ' + culpables.join('\n    ') +
    '\n\n  Esta es la evasión que el guard A no vería: ensamblar el documento desde la ruta no\n' +
    '  deja ningún literal en el fichero. El resultado es el mismo — un XML que se entrega sin\n' +
    '  pasar por la función que está demostrada conforme.\n\n' +
    '  Una ruta habla con `' + EMISOR + '`; el constructor de registros es asunto del servicio.');
});
