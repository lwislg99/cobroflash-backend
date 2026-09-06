// tests/scrum739-informes-al-sitio-unico.test.mjs — SCRUM-739
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LA PANTALLA DE INFORMES ESCRIBÍA EL DINERO CON UN CRITERIO PROPIO, Y FALLABA EN LA BANDA DEL
// TRABAJO CORRIENTE.
//
// `es-ES` **no agrupa los enteros de cuatro cifras** (CLDR). Un `toLocaleString('es-ES')` a pelo
// escribe `6050,00` donde el resto del producto escribe `6.050,00` — y vuelve a coincidir a partir
// de 10.000, que es justo lo que lo hacía invisible.
//
// ── 🔴 LA TRAMPA DE ESTE TICKET, Y ESTÁ ESCRITA EN EL ENCARGO ────────────────────────────────
//
// **Un test con 117,60 o con 12.345,67 no prueba NADA**: esos dos ya coincidían ANTES del arreglo.
// El rojo tiene que usar un importe de CUATRO CIFRAS ENTERAS. Aquí no se pide de palabra: se
// ejercita la implementación VIEJA al lado de la nueva y se comprueba que en la banda difieren y
// fuera de ella no. Un test que no puede fallar no es cobertura.
//
// ── LO QUE NO SE HIZO, Y ES LA MITAD DEL TICKET ─────────────────────────────────────────────
//
// **No se ha escrito un sexto formateador.** `fmtImporteEs` es la VARIANTE sin símbolo que el
// backend ya tenía (`formatImporteEs`, SCRUM-636) y que al front se le quedó sin traer — ésa es la
// razón medida de que `reportsView.js` se escribiera la suya: necesitaba un número sin `€` y no
// había ninguno. Y no copia las opciones: se las pide a `opcionesDeDinero`, el mismo objeto que
// usa `fmtMoneyEs`, y descompone SU salida con `formatToParts`. No es que estén escritas iguales:
// es que son la misma llamada.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cargarDashboard } from './_banco-vistas.mjs';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

/** Las funciones REALES del front, cargadas del `api.js` de verdad por el banco de vistas. */
const { ctx } = cargarDashboard(RAIZ);
const { fmtMoneyEs, fmtImporteEs } = ctx;

/** El backend, que es quien ya tenía las dos y contra quien se compara. */
const U = await import('../dist/core/utils/utils.js');

/**
 * LA IMPLEMENTACIÓN VIEJA, tal cual estaba en `reportsView.js`. No es decoración: es lo que hace
 * que el test de abajo se haya visto FALLAR. Sin ella, «ahora sale 6.050,00» sería una afirmación
 * sobre el presente sin nada que la contraste.
 */
const COMO_ESTABA = (n) => Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-739 · SUELO: las dos piezas del front responden, y DISTINGUEN', () => {
  assert.equal(typeof fmtMoneyEs, 'function', '🔴 `fmtMoneyEs` no está en el front');
  assert.equal(typeof fmtImporteEs, 'function',
    '🔴 `fmtImporteEs` no está en el front. Sin ella, `reportsView.js` no tiene a dónde delegar y '
    + 'lo de abajo mediría el aire.');
  assert.notEqual(fmtImporteEs(1000), fmtMoneyEs(1000),
    '🔴 la variante sin símbolo no se distingue de la que lo lleva: una de las dos no hace lo suyo.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL ROJO · CUATRO CIFRAS ENTERAS, QUE ES DONDE ESTÁ EL DEFECTO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-739 · 🔴 el defecto EXISTÍA y estaba en la banda 1.000–9.999', () => {
  // Primero se demuestra que la forma vieja fallaba. Si esto pasara, no habría ticket.
  assert.equal(COMO_ESTABA(6050), '6050,00',
    '🔴 la implementación vieja ya no reproduce el defecto: entonces este test no compara nada y '
    + 'su verde de abajo no significaría que se haya arreglado algo.');
  assert.notEqual(COMO_ESTABA(6050), fmtImporteEs(6050),
    '🔴 la vieja y la nueva dan lo MISMO con 6.050. O el arreglo no está, o se está midiendo un '
    + 'valor que ya coincidía — que es la trampa de este ticket.');
});

test('SCRUM-739 · 🔴 EL QUE DECIDE: con cuatro cifras, Informes escribe el punto de millar', () => {
  assert.equal(fmtImporteEs(6050), '6.050,00');
  assert.equal(fmtImporteEs(1000), '1.000,00');
  assert.equal(fmtImporteEs(9999.99), '9.999,99');
  assert.equal(fmtImporteEs(1234.5), '1.234,50');
});

test('SCRUM-739 · toda la banda 1.000–9.999 se agrupa, no sólo el caso elegido', () => {
  let comprobados = 0;
  for (let v = 1000; v <= 9999; v += 37) {
    const s = fmtImporteEs(v);
    assert.match(s, /^\d\.\d{3},\d{2}$/,
      `🔴 con ${v} € sale «${s}», sin el punto de millar. Es la banda del trabajo corriente de un `
      + 'fontanero: el importe que más veces ve en su pantalla de Informes.');
    comprobados++;
  }
  assert.ok(comprobados > 200,
    `🔴 SUELO: sólo ${comprobados} valores barridos; con tan pocos un verde no dice nada.`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONTROL NEGATIVO · lo que ya salía bien sale EXACTAMENTE igual
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-739 · CONTROL NEGATIVO: fuera de la banda no cambia ni un carácter', () => {
  // 🔴 ÉSTOS SON LOS QUE HACEN LA TRAMPA: con cualquiera de ellos, un test «pasaría» aunque el
  // arreglo no existiera. Están aquí para lo contrario de lo que parece — para fijar que NO se han
  // movido, y para dejar escrito por qué no valen como prueba del arreglo.
  for (const v of [0, 0.5, 117.6, 999.99, 12345.67, 100000]) {
    assert.equal(fmtImporteEs(v), COMO_ESTABA(v),
      `🔴 con ${v} el resultado ha CAMBIADO respecto a lo que la pantalla escribía. Este ticket es `
      + 'sobre cómo se escribe un número, no sobre qué número se escribe.');
  }
});

test('SCRUM-739 · el arreglo no toca la CIFRA, sólo cómo se escribe', () => {
  // Se deshace el formato y se compara con el valor de partida: si el redondeo se hubiera movido,
  // esto caería. Es la línea que el encargo pone como límite: «si cambia alguna cifra, PARA».
  for (const v of [1000, 1234.5, 6050, 9999.99, 12345.67, 0.005, -1500]) {
    const deshecho = Number(fmtImporteEs(v).split('.').join('').replace(',', '.'));
    assert.equal(deshecho, Number(v.toFixed(2)),
      `🔴 LA CIFRA CAMBIA con ${v}: sale «${fmtImporteEs(v)}». Eso no es formato, es cálculo.`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL SITIO ÚNICO · las dos mitades del producto dicen lo mismo
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-739 · el front y el backend escriben el MISMO importe', () => {
  let comparados = 0;
  for (const v of [0, 0.5, 117.6, 999.99, 1000, 1234.5, 6050, 9999.99, 10000, 12345.67, -1500, 1000000]) {
    assert.equal(fmtImporteEs(v), U.formatImporteEs(v),
      `🔴 con ${v} la pantalla escribe «${fmtImporteEs(v)}» y el documento «${U.formatImporteEs(v)}». `
      + 'El mismo profesional vería dos formatos para el mismo dinero.');
    assert.equal(fmtMoneyEs(v), U.formatMoneyEs(v),
      `🔴 con ${v} el CON símbolo diverge entre front y backend.`);
    comparados++;
  }
  assert.ok(comparados >= 12, `🔴 SUELO: sólo ${comparados} comparaciones.`);
});

test('SCRUM-739 · 🔴 `fmtMoneyEs` NO se ha movido: lo usan diez vistas más', () => {
  // Sacar `opcionesDeDinero` fuera de `fmtMoneyEs` era el riesgo de este cambio. Se comprueba
  // contra el backend, que no se ha tocado, en toda la banda y fuera de ella.
  for (let v = 900; v <= 11000; v += 173) {
    assert.equal(fmtMoneyEs(v), U.formatMoneyEs(v),
      `🔴 con ${v} € el formateador CON símbolo del front ha cambiado. Diez vistas dependen de él.`);
  }
  assert.equal(fmtMoneyEs('no soy un número'), U.formatMoneyEs(0),
    '🔴 el dato ilegible ha dejado de tratarse como 0,00 €, que es lo que hacía antes.');
});

test('SCRUM-739 · la moneda no cambia los DÍGITOS del importe sin símbolo', () => {
  // Por eso los dos sitios que no tienen `currency` en alcance pueden omitirla sin perder nada.
  for (const v of [6050, 1234.5]) {
    const salidas = new Set(['EUR', 'MXN', 'USD', 'JPY', 'CLP'].map((c) => fmtImporteEs(v, c)));
    assert.equal(salidas.size, 1,
      `🔴 con ${v} el importe sin símbolo depende de la moneda: ${[...salidas].join(' / ')}. Entonces `
      + 'omitirla en `loadVat` y en `renderServices` sí perdería algo.');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA PANTALLA · que de verdad delegue, y que no haya un sexto formateador
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-739 · Informes ya no formatea dinero por su cuenta', () => {
  const codigo = soloCodigo(leer('public/dashboard/js/reportsView.js'));
  assert.ok(codigo.length > 5000,
    `🔴 SUELO: el extractor sólo ve ${codigo.length} caracteres de código; no está mirando la vista.`);

  const usos = [...codigo.matchAll(/\.toLocaleString\s*\(/g)];
  // 🔴 SCRUM-743 · 1 → 0. El que quedaba era el rótulo del eje, DECLARADO como hueco por este
  // mismo ticket: un entero al que las dos formas de dinero le habrían metido dos decimales. Con
  // la TERCERA forma —agrupar SIN forzarlos— ya tiene a dónde ir, y el hueco se cierra. El número
  // baja y el trinquete sólo aprieta: si aparece uno nuevo, cae.
  assert.equal(usos.length, 0,
    `🔴 quedan ${usos.length} \`toLocaleString\` en el código de Informes y no puede quedar ninguno: `
    + 'las tres formas del sitio único cubren ya los tres casos —con símbolo, sin símbolo, y número '
    + 'agrupado sin forzar decimales—. Uno nuevo es una cuarta copia del formato.');

  assert.ok(codigo.includes('fmtImporteEs('),
    '🔴 Informes no llama al sitio único: el arreglo no está cableado donde se dice.');
});

test('SCRUM-739 · 🔴 la variante NO reescribe las opciones: las COMPARTE', () => {
  const codigo = soloCodigo(leer('public/dashboard/js/api.js'));
  assert.ok(codigo.includes('function opcionesDeDinero('),
    '🔴 no existe `opcionesDeDinero`: las dos funciones han vuelto a escribir sus opciones cada '
    + 'una, que es la quinta copia del formato y justo lo que este ticket cierra.');

  // Las dos tienen que PEDIRLAS, no llevarlas dentro.
  const cuerpo = (nombre) => {
    const i = codigo.indexOf('function ' + nombre + '(');
    assert.notEqual(i, -1, `🔴 SUELO: no encuentro \`${nombre}\` en el código de api.js.`);
    return codigo.slice(i, i + 900);
  };
  for (const n of ['fmtMoneyEs', 'fmtImporteEs']) {
    assert.match(cuerpo(n), /opcionesDeDinero\(/,
      `🔴 \`${n}\` no usa \`opcionesDeDinero\`: puede divergir de su hermana sin que nadie lo vea.`);
    assert.doesNotMatch(cuerpo(n), /minimumFractionDigits/,
      `🔴 \`${n}\` vuelve a declarar los decimales por su cuenta. Si las dos las escriben, el `
      + 'símbolo deja de ser lo único que las separa — que es el aviso literal del backend.');
  }
});

test('SCRUM-739 · la pieza se carga ANTES que Informes, y el service worker la cachea', () => {
  const html = leer('public/dashboard/index.html');
  const iApi = html.indexOf('js/api.js');
  const iInf = html.indexOf('js/reportsView.js');
  assert.ok(iApi !== -1 && iInf !== -1, '🔴 SUELO: no encuentro los dos scripts en el índice.');
  assert.ok(iApi < iInf,
    '🔴 `api.js` se carga DESPUÉS de `reportsView.js`: `fmtImporteEs` sería `undefined` al pintar '
    + 'los informes y la pantalla reventaría en vez de escribir mal un número.');
  assert.match(leer('public/sw.js'), /\/dashboard\/js\/api\.js/,
    '🔴 el service worker no cachea `api.js`');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-745 (adopción) · LAS MUTACIONES DE ESTE GUARD
//
// El ticket tiene dos mitades que se rompen por separado: que el SITIO ÚNICO escriba bien el
// número, y que la pantalla de Informes de verdad DELEGUE en él. Se puede tener lo segundo con lo
// primero roto, y se puede tener lo primero con la pantalla volviendo a formatear por su cuenta —
// que es exactamente cómo nació este defecto.
//
// ⛔ NINGUNA MUTACIÓN TOCA `src/core/utils/utils.ts` PARA LO QUE SE MIDE POR VALOR. Los tests que
// comparan cifras leen el BACKEND desde `dist/`, y el meta-guard no compila entre la mutación y la
// pasada: cambiar el `.ts` no movería el `dist/` y saldría MUDO — una acusación falsa contra un
// guard sano, que es el defecto que SCRUM-748 vino a quitar. Se muta lo que el guard lee de
// verdad: el `api.js` que carga el banco de vistas, y el fuente de la vista.
// ═════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // ① El sitio único deja de agrupar: `fmtImporteEs(6050)` vuelve a «6050,00», que es el defecto
    // literal — `es-ES` por CLDR no agrupa los enteros de cuatro cifras, y ésa es toda la banda
    // del trabajo corriente de un fontanero.
    fichero: 'public/dashboard/js/api.js',
    de: '    return sinSimbolo({ ...opts, ...AGRUPA_SIEMPRE });',
    a: '    return sinSimbolo(opts);',
    cae: 'EL QUE DECIDE: con cuatro cifras, Informes escribe el punto de millar',
  },
  {
    // ② Informes vuelve a formatear por su cuenta. El valor sale IGUAL de bien en la mayoría de
    // los casos —por eso se coló—: lo que cambia es que hay una sexta copia del formato, y la
    // siguiente divergencia ya no la ve nadie.
    //
    // ⚠️ El ancla lleva sus CUATRO espacios a propósito: con dos casaría también la otra
    // `const fmt` del fichero —que va indentada con dos— y se mutaría la que no es. El guard de
    // SCRUM-737 me obligó a quitar de aquí el recuento que lo demostraba: era una cifra del árbol
    // sin ancla, y anotarla habría envejecido sola.
    fichero: 'public/dashboard/js/reportsView.js',
    de: '    const fmt = (n) => fmtImporteEs(n);',
    a: "    const fmt = (n) => Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });",
    cae: 'Informes ya no formatea dinero por su cuenta',
  },
];
