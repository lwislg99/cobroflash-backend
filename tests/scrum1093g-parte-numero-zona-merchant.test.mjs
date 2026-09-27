// tests/scrum1093g-parte-numero-zona-merchant.test.mjs — SCRUM-1093 (el tercero: el parte)
//
// EL AÑO DEL NÚMERO DEL PARTE SALÍA DEL RELOJ DEL PROCESO, NO DE LA ZONA DEL MERCHANT.
//
// `POST /admin/partes` numeraba con `siguienteNumeroParte(…, fecha.getFullYear())`, con
// `fecha = new Date()`: el año del PROCESO (Railway va en UTC). Un merchant en Europe/Madrid que abre
// un parte a las 00:30 del 1 de enero SU hora recibía el número de la serie del año anterior, y el
// número de un documento no se corrige después. Es la misma familia que SCRUM-735 (facturas),
// SCRUM-1093 (presupuestos) y SCRUM-1093f (albaranes).
//
// La ruta necesita Postgres para correr entera; el comportamiento de `diaNaturalEn` ya lo prueban sus
// propios tests. Esto es la RED ESTRUCTURAL, por AST sobre el fichero real: el año que recibe
// `siguienteNumeroParte` tiene que salir de `diaNaturalEn(…)` con la zona del merchant, y en todo el
// fichero no puede quedar un `getFullYear()`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTAS = path.join(RAIZ, 'src', 'modules', 'jobs', 'app', 'routes', 'partes.routes.ts');

/** Lo que el censo ve en un fuente: las llamadas a `siguienteNumeroParte` y los `getFullYear()`. */
export function censa(fuente) {
  const sf = ts.createSourceFile('partes.routes.ts', fuente, ts.ScriptTarget.Latest, true);
  const numeraciones = [];
  const getFullYear = [];
  // Las variables inicializadas con una llamada: para seguir `const anio = …` hasta su origen.
  const inicializadas = new Map();
  (function anda(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      inicializadas.set(n.name.text, n.initializer);
    }
    if (ts.isCallExpression(n)) {
      if (ts.isIdentifier(n.expression) && n.expression.text === 'siguienteNumeroParte') numeraciones.push(n);
      if (ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'getFullYear') {
        getFullYear.push(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1);
      }
    }
    n.forEachChild(anda);
  })(sf);

  const llamaA = (nodo, nombre) => {
    let si = false;
    const vistas = new Set(); // los nombres se repiten en el fichero: sin esto, un ciclo no acaba
    (function anda(x) {
      if (ts.isCallExpression(x) && ts.isIdentifier(x.expression) && x.expression.text === nombre) si = true;
      if (ts.isIdentifier(x) && inicializadas.has(x.text) && !vistas.has(x.text)
          && x.parent && !ts.isVariableDeclaration(x.parent)) {
        vistas.add(x.text);
        anda(inicializadas.get(x.text));
      }
      x.forEachChild(anda);
    })(nodo);
    return si;
  };

  return {
    numeraciones: numeraciones.length,
    anioDeLaZona: numeraciones.filter((c) => c.arguments[1]
      && llamaA(c.arguments[1], 'diaNaturalEn') && llamaA(c.arguments[1], 'zonaDelMerchant')).length,
    getFullYear,
  };
}

test('🔴 SCRUM-1093g · el año del número del parte sale de la ZONA del merchant, no del reloj del proceso', () => {
  const c = censa(fs.readFileSync(RUTAS, 'utf8'));
  // SUELO: si no ve ninguna numeración, no ha mirado — un «0 getFullYear» sobre nada no vale.
  assert.ok(c.numeraciones >= 1, `CIEGO: no encuentro ninguna llamada a siguienteNumeroParte en ${RUTAS}`);
  assert.equal(c.anioDeLaZona, c.numeraciones,
    '🔴 una numeración del parte no deriva el año con diaNaturalEn(…, zonaDelMerchant(…))');
  assert.deepEqual(c.getFullYear, [],
    `🔴 partes.routes.ts sigue leyendo el año del proceso (getFullYear) en la(s) línea(s) ${c.getFullYear.join(', ')}`);
});

test('CONTROL · el censo CAZA la forma del defecto y ABSUELVE la del arreglo', () => {
  const defecto = censa(`const fecha = new Date();
    const numero = siguienteNumeroParte(yaHay, fecha.getFullYear());`);
  assert.equal(defecto.numeraciones, 1);
  assert.equal(defecto.anioDeLaZona, 0);
  assert.deepEqual(defecto.getFullYear, [2]);

  const arreglo = censa(`const zona = zonaDelMerchant(m);
    const anio = Number(diaNaturalEn(fecha, zona).slice(0, 4));
    const numero = siguienteNumeroParte(yaHay, anio);`);
  assert.equal(arreglo.numeraciones, 1);
  assert.equal(arreglo.anioDeLaZona, 1);
  assert.deepEqual(arreglo.getFullYear, []);
});
