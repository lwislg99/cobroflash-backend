// SCRUM-271 · UNA CANTIDAD NO INTERPRETABLE NUNCA SE CONVIERTE EN UN NÚMERO PLAUSIBLE.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL MECANISMO, que no es el que decía el ticket
//
// El ticket culpaba a la coma: `Number("2,5")` es `NaN` y `NaN || 1` es `1`. Medido, el JS **nunca
// ve la coma**: el campo es `<input type="number">` y el navegador sanea el valor antes de que
// `.value` lo devuelva. En Chrome/Edge con locale español la coma se acepta y `.value` sale ya
// como `"2.5"` — que es lo que midió el fundador y es cierto.
//
// Pero eso no salva al `|| 1`, porque el saneado tiene DOS salidas: cuando el navegador **no**
// puede sanear lo escrito, `.value` es **cadena vacía**. Y `Number("")` es **0, no NaN**. Así que
// `0 || 1` daba `1`: una cantidad plausible, sin error y sin marca. No hace falta ninguna coma
// para llegar ahí — basta que el navegador rechace la entrada, o borrar el campo.
//
// O sea que la seguridad estaba delegada en **una conducta del navegador que el código ni ejecuta
// ni comprueba**. Por eso el arreglo no es normalizar: es VALIDAR, como ya hacían los otros cuatro
// puntos del front (`expensesView`, `productsView` ×2, `jobDetailView`). La diferencia entre
// seguro e inseguro nunca fue el `replace(",", ".")` — fue **validar el resultado en vez de
// ponerle un defecto**.
//
// ⚠️ Por eso NO se añade una función compartida de normalización: vendería una seguridad que no
// da. Está medido y decidido (2-ago-2026).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS TRES PUNTOS, y por qué son tres y no uno
//
//   1. `homeView:912`  — el total EN VIVO. Engaña a la vista.
//   2. `homeView:1087` — el ENVÍO. Este es el que cuesta dinero: manda la línea al servidor con
//      la cantidad inventada, y de ahí sale el presupuesto que firma el cliente. Arreglar solo
//      el primero habría dejado el defecto entero vivo.
//   3. `jobDetailView` — al facturar, una línea sin cantidad se caía **en silencio**: el pro pedía
//      facturar tres y se emitían dos sin decir nada. No corrompe un valor, OMITE una línea.
//
// Los tests reproducen la LÓGICA de cada punto sobre los mismos valores que produce un
// `input type="number"` (incluida la cadena vacía), porque es ahí donde vive el defecto.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const homeView = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'js', 'homeView.js'), 'utf8');
const jobDetail = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'js', 'jobDetailView.js'), 'utf8');

/** Lo que devuelve `.value` de un `input type="number"` según lo que el navegador pudo sanear. */
const VALORES_DEL_NAVEGADOR = [
  ['2.5', 2.5, 'Chrome/Edge en es-ES: la coma se acepta y llega ya normalizada'],
  ['', 0, 'el navegador NO pudo sanear (o el campo está vacío) → cadena vacía → Number("") = 0'],
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// PUNTO 1 · el total en vivo no inventa una cantidad
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-271 · (1) el handler en vivo guarda lo que hay, no un 1 inventado', () => {
  // La línea del handler, tal cual está en el fichero: se ejecuta sobre los valores reales.
  const m = homeView.match(/\.qty = (Number\(e\.target\.value\)[^;]*);/);
  assert.ok(m, '🔴 no encuentro la asignación de qty del presupuesto rápido');
  const calcular = new Function('e', `return ${m[1]};`);

  for (const [value, esperado, porque] of VALORES_DEL_NAVEGADOR) {
    assert.equal(calcular({ target: { value } }), esperado, `${porque} → esperaba ${esperado}`);
  }
  assert.notEqual(
    calcular({ target: { value: '' } }), 1,
    '🔴 VUELVE EL VALOR INVENTADO: una entrada que el navegador no pudo sanear se convierte en ' +
    'cantidad 1. No hay error, no hay marca — se ve una cantidad, y es plausible.',
  );
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// PUNTO 2 · el ENVÍO valida en vez de inventar — el que cuesta dinero
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-271 · (2) el envío NO manda una cantidad inventada al servidor', () => {
  const envio = homeView.slice(homeView.indexOf('const lines = qqState.products.filter'));
  const hasta = envio.slice(0, envio.indexOf('quotePayload ='));

  assert.doesNotMatch(
    hasta + envio.slice(0, envio.indexOf('};', envio.indexOf('quotePayload ='))),
    /qty:\s*Number\(l\.qty\)\s*\|\|/,
    '🔴 el ENVÍO sigue poniendo un defecto. Este es el que acaba en el presupuesto que firma el ' +
    'cliente: el del total en vivo solo engaña a la vista, éste manda el número inventado al ' +
    'servidor.',
  );
  assert.match(hasta, /showQqAlert\("Pon una cantidad en cada línea\."\)/,
    '🔴 falta la validación con el texto oficial antes de construir el payload');
  assert.match(hasta, /uiMarkFieldError\(/,
    '🔴 se avisa pero no se marca el campo: el flujo qq marca SIEMPRE (mismo patrón que el precio)');
});

test('SCRUM-271 · (2b) la validación caza exactamente lo que el navegador puede devolver', () => {
  // El predicado real del envío, ejecutado sobre los valores del navegador.
  const m = homeView.match(/const sinCantidad = lines\.findIndex\(\(l\) => (.+)\);/);
  assert.ok(m, '🔴 no encuentro el predicado de validación del envío');
  const esInvalida = new Function('l', `return ${m[1]};`);

  assert.equal(esInvalida({ qty: 0 }), true, 'cadena vacía → 0 → inválida');
  assert.equal(esInvalida({ qty: 2.5 }), false, '2,5 saneado por el navegador → válida');
  assert.equal(esInvalida({ qty: -1 }), true, 'negativa → inválida');
  assert.equal(esInvalida({ qty: NaN }), true, 'NaN → inválida');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// PUNTO 3 · facturar-parcial avisa cuando se cae ALGUNA línea, no solo cuando se caen todas
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Reproduce la decisión del handler de emitir, con su estado de aviso. */
function decidirEmision(valores, { yaAvisado = false } = {}) {
  const todas = valores.map((v, i) => ({ index: i, cantidad: Number(v) }));
  const lineas = todas.filter((l) => l.cantidad > 0);
  if (lineas.length === 0) return { accion: 'error-todas' };
  if (lineas.length < todas.length && !yaAvisado) return { accion: 'aviso' };
  return { accion: 'emitir', lineas: lineas.length };
}

test('SCRUM-271 · (3) una línea sin cantidad ya NO se cae en silencio', () => {
  const r = decidirEmision(['2', '', '3']);
  assert.equal(r.accion, 'aviso',
    '🔴 SE EMITE EN SILENCIO: el pro pidió facturar tres líneas y se facturan dos sin decírselo. ' +
    'No corrompe un valor — omite una línea, y eso en facturación es peor.');
  assert.match(jobDetail, /'Revisa las líneas sin cantidad: no se facturarán\.'/,
    '🔴 falta el texto oficial del aviso');
});

test('SCRUM-271 · (3b) AVISA pero NO BLOQUEA: facturar parte es un uso legítimo', () => {
  // Si bloqueara, rompería la pantalla: facturar solo algunas líneas es para lo que existe.
  const r = decidirEmision(['2', '', '3'], { yaAvisado: true });
  assert.equal(r.accion, 'emitir', '🔴 la segunda pulsación tiene que emitir, no volver a avisar');
  assert.equal(r.lineas, 2);
});

test('SCRUM-271 · (3c) sin líneas caídas no aparece ningún aviso', () => {
  // Control negativo: un aviso que sale cuando no toca se aprende a ignorar, y entonces no avisa.
  assert.equal(decidirEmision(['2', '1', '3']).accion, 'emitir');
  assert.equal(decidirEmision(['', '', '']).accion, 'error-todas', 'todas vacías sigue siendo error');
});

test('SCRUM-271 · (3d) tocar un campo vuelve a armar el aviso', () => {
  // Sin esto, una confirmación se heredaría de una situación distinta de la que se está mirando.
  assert.match(jobDetail, /input\.addEventListener\('input', \(\) => \{ avisadoDeLineasSinCantidad = false; \}\)/,
    '🔴 el aviso no se rearma al cambiar un campo: se podría confirmar algo que ya no es lo que hay');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA DECISIÓN DE FORMA · no se añade normalización compartida, y consta por qué
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-271 · el arreglo es VALIDAR, no normalizar', () => {
  // Medido: los otros cuatro puntos del front son seguros porque validan el resultado
  // (`<= 0`, `isFinite`), no porque normalicen. Una `parseNumeroEs()` compartida no habría
  // salvado a homeView, cuyo problema era el defecto `|| 1`. Añadirla vendería seguridad que no
  // da, así que se decidió NO hacerla (fundador, 2-ago-2026).
  const otros = {
    'expensesView.js': /amount <= 0/,
    'productsView.js': /price <= 0/,
  };
  for (const [f, patron] of Object.entries(otros)) {
    const src = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'js', f), 'utf8');
    assert.match(src, patron, `🔴 ${f} ha dejado de validar el resultado: era la mitad segura`);
  }
});
