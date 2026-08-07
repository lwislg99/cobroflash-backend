// tests/scrum298-modo-visible.test.mjs — SCRUM-298 (A8)
//
// EL MODO DE EMISIÓN, VISIBLE. Hasta hoy `getEmissionMode` decidía qué documento sale —factura,
// factura con marca de agua o justificante— y **no aparecía ni una vez en `public/`**. Dos
// estados que producen documentos distintos se veían exactamente igual en pantalla.
//
// ── LO QUE ESTE TICKET **NO** CONSTRUYE, Y ESTÁ MEDIDO ──────────────────────────────────────
// El modal de dos caminos («se guarda» / «se envía») queda bloqueado porque **«se envía» no
// existe**: cero clientes SOAP/mTLS contra la AEAT, `VfSubmission` no está en el schema, no hay
// cola de remisión. Una salida visible pero inerte le diría al profesional que elegir remitir es
// algo que él podría hacer. No enseñarlo no cuesta nada; enseñarlo inerte cuesta que crea que
// está remitiendo cuando no lo está.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { modoEmisionVisible, MODOS_VISIBLES } from '../dist/modules/invoicing/domain/modoVisible.js';
import { getEmissionMode } from '../dist/modules/invoicing/domain/emission.service.js';

const RAIZ = path.resolve(import.meta.dirname, '..');
const PENDIENTE = '[PENDIENTE microcopy oficial]';

// ⚠️ Fixtures con `id` REAL. `isDemoMerchant` es `id === 1` o `demo@yaqu.app`: un fixture con
// `id: 1` pone todos los casos en modo demo y las otras dos ramas no se ejercitan en ninguno.
const ES_REAL = { id: 7, email: 'pro@fontaneria.es', country: 'ES', flags: null };
const ES_CON_FLAG = { ...ES_REAL, flags: { INVOICING_ES_ENABLED: true } };
const NO_ES = { id: 8, email: 'pro@plomberie.fr', country: 'FR', flags: null };
const DEMO = { id: 1, email: 'demo@yaqu.app', country: 'ES', flags: null };

// ═══════════════════════════════════════════════════════════════════════════════════════════
// CONTROL POSITIVO · lo que se ENSEÑA es lo que se EMITE
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-298 · CONTROL POSITIVO: el modo que se enseña coincide con el que emite', () => {
  // No se compara contra una tabla escrita a mano: se compara contra `getEmissionMode`, que es
  // quien decide de verdad qué documento sale. Una tabla propia sería la segunda opinión que este
  // ticket existe para no tener.
  for (const m of [ES_REAL, ES_CON_FLAG, NO_ES, DEMO]) {
    assert.equal(modoEmisionVisible(m), getEmissionMode(m),
      `🔴 la pantalla enseñaría «${modoEmisionVisible(m)}» y se emitiría «${getEmissionMode(m)}» para ${m.email}`);
  }
});

test('SCRUM-298 · los tres modos se distinguen de verdad (y no salen todos iguales)', () => {
  // Sin esto, un derivador que devolviera siempre lo mismo pasaría el test de arriba en cuanto
  // `getEmissionMode` también lo hiciera. Aquí se exige que los tres estados EXISTAN.
  assert.equal(modoEmisionVisible(ES_REAL), 'receipt', 'el ES real sin flag emite justificante');
  assert.equal(modoEmisionVisible(ES_CON_FLAG), 'fiscal');
  assert.equal(modoEmisionVisible(NO_ES), 'fiscal', 'no-ES emite factura fiscal siempre');
  assert.equal(modoEmisionVisible(DEMO), 'demo');
  assert.equal(new Set(MODOS_VISIBLES).size, 3);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// CONTROL NEGATIVO · nadie cambia de modo por esto
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-298 · CONTROL NEGATIVO: un merchant sigue exactamente en el modo que estaba', () => {
  // Regla 24: esto solo LEE. Si enseñar el modo lo cambiara —o si el módulo escribiera algo—,
  // el ES real dejaría de emitir justificantes y empezaría a emitir facturas sin que nadie lo
  // haya decidido.
  const antes = getEmissionMode(ES_REAL);
  modoEmisionVisible(ES_REAL);
  modoEmisionVisible(ES_REAL);
  assert.equal(getEmissionMode(ES_REAL), antes, '🔴 leer el modo lo ha cambiado');
  assert.equal(antes, 'receipt', 'y sigue siendo el justificante: A8 no enciende nada');
});

test('SCRUM-298 · REGLA 24: el módulo no puede escribir nada', () => {
  // Se comprueba por importaciones, no por lectura a ojo: si mañana alguien mete Prisma o el
  // servicio de flags aquí, este módulo pasaría de leer a poder cambiar el estado fiscal.
  const codigo = fs.readFileSync(path.join(RAIZ, 'src/modules/invoicing/domain/modoVisible.ts'), 'utf8');
  const sf = ts.createSourceFile('modoVisible.ts', codigo, ts.ScriptTarget.Latest, true);
  const imports = [];
  sf.forEachChild((n) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) imports.push(n.moduleSpecifier.text);
  });
  assert.deepEqual(imports, ['./emission.service'],
    `🔴 el módulo de VISIBILIDAD importa cosas que no son el lector del modo: ${JSON.stringify(imports)}. Con Prisma o el servicio de flags dentro dejaría de ser solo lectura (regla 24)`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL SUELO · sin dato NO se cae a un modo por defecto
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-298 · SUELO: sin merchant devuelve `null`, NUNCA un modo', () => {
  // Enseñar el modo equivocado es peor que no enseñar ninguno: quien lo lee toma decisiones
  // fiscales sobre una pantalla que le miente y no tiene forma de sospecharlo.
  for (const vacio of [null, undefined]) {
    const r = modoEmisionVisible(vacio);
    assert.equal(r, null, `🔴 sin merchant ha salido «${r}»: eso es inventarse el estado fiscal de alguien`);
    assert.ok(!MODOS_VISIBLES.includes(r), '🔴 se ha caído a un modo por defecto');
  }
});

test('SCRUM-298 · SUELO: la pantalla NO pinta nada cuando no hay modo', () => {
  const vista = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/settingsView.js'), 'utf8');
  assert.match(vista, /if\s*\(\s*window\.appModoEmision\s*\)/,
    '🔴 la fila del modo se pinta sin comprobar que haya modo: con `null` enseñaría un hueco o, peor, un valor por defecto');
});

test('SCRUM-298 · SUELO: el navegador tampoco normaliza un valor desconocido', () => {
  const appJs = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/app.js'), 'utf8');
  const linea = appJs.split(String.fromCharCode(10)).find((l) => l.includes('window.appModoEmision'));
  assert.ok(linea, '🔴 el front ya no recibe el modo');
  const bloque = appJs.slice(appJs.indexOf('window.appModoEmision'), appJs.indexOf('window.appModoEmision') + 220);
  assert.match(bloque, /:\s*null/,
    '🔴 un valor fuera del contrato tiene que caer a `null`, no a un modo: normalizarlo sería inventarse el estado fiscal');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ROJO POR EL MECANISMO · fuente única
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-298 · el modo NO se recalcula en ningún sitio: fuente única', () => {
  // Si el navegador —o este módulo— reconstruyera el criterio (país, flag, id del demo), habría
  // dos opiniones sobre el modo y la pantalla podría decir una cosa mientras el documento sale de
  // otra. Es la lección de A0.5 con `facturaSueltaDisponible`.
  const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const f of ['public/dashboard/js/app.js', 'public/dashboard/js/settingsView.js']) {
    const codigo = sinComentarios(fs.readFileSync(path.join(RAIZ, f), 'utf8'));
    assert.doesNotMatch(codigo, /INVOICING_ES_ENABLED|getEmissionMode|isDemoMerchant/,
      `🔴 ${f} está reconstruyendo el modo de emisión en vez de recibirlo`);
  }
  // Hermanos positivos (SCRUM-237), uno por token de la alternancia: sin ellos una regex rota
  // sería verde para siempre.
  assert.match('isFlagEnabled("INVOICING_ES_ENABLED")', /INVOICING_ES_ENABLED|getEmissionMode|isDemoMerchant/);
  assert.match('const m = getEmissionMode(x);', /INVOICING_ES_ENABLED|getEmissionMode|isDemoMerchant/);
  assert.match('if (isDemoMerchant(m)) return;', /INVOICING_ES_ENABLED|getEmissionMode|isDemoMerchant/);
});

test('SCRUM-298 · ROJO POR EL MECANISMO: si un modo deja de reflejarse, se NOMBRA', () => {
  // El fallo que se quiere cazar es silencioso: alguien aplana dos modos en uno —por ejemplo
  // 'demo' devolviendo 'fiscal'— y la pantalla sigue enseñando algo, solo que mal. Aquí cada modo
  // se comprueba por separado y el fallo dice CUÁL dejó de reflejarse.
  const casos = [
    ['receipt', ES_REAL], ['fiscal', ES_CON_FLAG], ['fiscal', NO_ES], ['demo', DEMO],
  ];
  const rotos = casos
    .filter(([esperado, m]) => modoEmisionVisible(m) !== esperado)
    .map(([esperado, m]) => `${m.email}: esperaba «${esperado}» y sale «${modoEmisionVisible(m)}»`);
  assert.deepEqual(rotos, [], '🔴 hay modos que dejaron de reflejarse:\n    ' + rotos.join('\n    '));
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// MICROCOPY · TODAS las ramas, con suelo (regla 30 + regla 26)
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * Los textos visibles de un fuente, recorriendo **objetos y ternarios**.
 *
 * Es mi propio hallazgo de SCRUM-346 aplicado a mi propio código: un guard que inspecciona
 * LITERALES se queda ciego en cuanto el valor pasa a ser una expresión. Allí fue un ternario;
 * aquí el rótulo sale de un OBJETO indexado (`ROTULO_MODO_EMISION[modo]`), que es otra forma de
 * lo mismo. Si este guard solo mirase el literal de la asignación, no vería ninguna de las tres
 * ramas — y la que existe para que nadie escriba microcopy sin el fundador quedaría abierta.
 */
function textosVisibles(codigo, ruta) {
  const sf = ts.createSourceFile(ruta, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const constantes = new Map();
  (function recoger(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && ts.isStringLiteral(n.initializer)) {
      constantes.set(n.name.text, n.initializer.text);
    }
    ts.forEachChild(n, recoger);
  })(sf);

  const textosDe = (n) => {
    if (!n) return [];
    if (ts.isStringLiteral(n)) return [n.text];
    if (ts.isIdentifier(n) && constantes.has(n.text)) return [constantes.get(n.text)];
    if (ts.isConditionalExpression(n)) return [...textosDe(n.whenTrue), ...textosDe(n.whenFalse)];
    // `a || b`, `a ?? b` — las dos ramas se pintan según el caso
    if (ts.isBinaryExpression(n)
      && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(n.operatorToken.kind)) {
      return [...textosDe(n.left), ...textosDe(n.right)];
    }
    // `ROTULO[x]` — se devuelven TODOS los valores del objeto: cualquiera puede acabar en pantalla
    if (ts.isElementAccessExpression(n) && ts.isIdentifier(n.expression)) {
      const obj = objetos.get(n.expression.text);
      if (obj) return obj;
    }
    return [];
  };

  const objetos = new Map();
  (function recogerObjetos(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer
      && ts.isObjectLiteralExpression(n.initializer)) {
      const vals = [];
      for (const p of n.initializer.properties) {
        if (ts.isPropertyAssignment(p)) vals.push(...textosDe(p.initializer));
      }
      if (vals.length) objetos.set(n.name.text, vals);
    }
    ts.forEachChild(n, recogerObjetos);
  })(sf);

  const out = [];
  (function visitar(n) {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isPropertyAccessExpression(n.left) && n.left.name.text === 'textContent') {
      for (const t of textosDe(n.right)) out.push(t);
    }
    ts.forEachChild(n, visitar);
  })(sf);
  return out;
}

test('SCRUM-298 · SUELO del guard: VE las tres formas (ternario, `||` y objeto indexado)', () => {
  // Sin este suelo, el guard de abajo podría no ver nada y dar verde sobre una pantalla con
  // microcopy inventada. Es exactamente lo que pasó en SCRUM-346 con el ternario.
  const ternario = textosVisibles("b.textContent = x ? 'uno' : 'dos';", 'p.js').sort();
  assert.deepEqual(ternario, ['dos', 'uno'], '🔴 el guard no ve las dos ramas de un ternario');
  const alterna = textosVisibles("b.textContent = m['k'] || 'fallback';", 'p.js');
  assert.ok(alterna.includes('fallback'), '🔴 el guard no ve la rama del `||`');
  const objeto = textosVisibles("const R = { a: 'uno', b: 'dos' };\nb.textContent = R[k];", 'p.js').sort();
  assert.deepEqual(objeto, ['dos', 'uno'], '🔴 el guard no ve los valores de un objeto indexado');
});

/**
 * LOS TEXTOS APROBADOS, CON SU PROCEDENCIA Y CON LO QUE SE MIDIÓ PARA CADA UNO.
 *
 * La clave es el texto EXACTO que se pinta; el valor, dónde consta la aprobación y contra qué
 * mecanismo se verificó. Las dos cosas, y la segunda no es adorno: el fundador aprobó estos textos
 * **con la condición de comprobar cada afirmación contra el código antes de escribirla**, y de las
 * tres ramas propuestas una se cayó en esa comprobación (ver `receipt`, que sigue con marcador).
 *
 * ⚠️ Un texto aprobado NO es un texto libre: si cambia una coma, deja de estar en esta lista y el
 * guard vuelve a rojo. Es deliberado — obliga a que la redacción nueva pase por el fundador otra
 * vez, que es justo lo que la regla 30 pide.
 */
const APROBADOS = {
  'Se emiten facturas':
    'fundador 7-ago-2026 · numera con la serie fiscal (`formatInvoiceNumber`, lock `SERIE_LOCK_NS`)',
  'Cada cobro genera una factura con su numeración. Una vez emitida no se puede editar ni borrar.':
    'fundador 7-ago-2026 · «no se edita ni borra» verificado en `invoicesAdmin.routes.ts:68` (SOLO ALTA, regla 29)',
  'Cuenta de demostración':
    'fundador 7-ago-2026 · solo el merchant demo (`isDemoMerchant`)',
  'Se generan facturas completas con una marca de agua DEMO. No tienen validez: esta cuenta es para probar.':
    'fundador 7-ago-2026 · `DEMO_WATERMARK = "DEMO — no válida fiscalmente"` (`emission.service.ts:12`), aplicada en `lib/invoicing.ts:122` y `:257`',
};

test('SCRUM-298 · MICROCOPY: sin aprobar va el marcador; aprobado va con su procedencia (reglas 30 y 26)', () => {
  const vista = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/settingsView.js'), 'utf8');
  // Se acota a MI bloque. La primera versión cortaba desde la primera aparición de «SCRUM-298»
  // —que es la declaración de constantes, arriba del fichero— y se tragaba la cabecera de Ajustes:
  // «Datos de la empresa» es copy YA APROBADO de otro carril y exigirle el marcador es un rojo en
  // falso. Un guard que grita sin motivo se acaba silenciando (regla 9).
  const ini = vista.indexOf('SCRUM-298 (A8) · EL MODO');
  assert.ok(ini > 0, '🔴 no se encuentra el bloque del modo: el guard no está mirando nada');
  const bloque = vista.slice(ini, vista.indexOf('const alertBox'));
  const textos = textosVisibles(
    vista.slice(0, vista.indexOf('function renderSettingsView')) + bloque, 'settingsView.js');
  assert.ok(textos.length >= 3, `🔴 el guard solo ve ${textos.length} textos del modo: tiene que ver las TRES ramas`);

  const malos = textos.filter((t) => t !== PENDIENTE && !(t in APROBADOS));
  assert.deepEqual(malos, [], '🔴 HAY MICROCOPY ESCRITA SIN APROBAR en la fila del modo de emisión:\n    '
    + JSON.stringify(malos) + '\n\n  Regla 30 y, encima, regla 26: este texto dice qué documento fiscal emite un\n'
    + '  profesional. La pregunta de VeriFactu se responde SOLO con el guion H2.\n'
    + '  Si el fundador lo ha aprobado, va a `APROBADOS` CON SU PROCEDENCIA — no basta con borrar\n'
    + '  el marcador: una aprobación sin dónde-consta es lo que vigila SCRUM-387.');

  // CADUCIDAD, y es la otra mitad. Sin esto, `APROBADOS` sería una lista que solo crece: un texto
  // retirado de la pantalla seguiría amparado ahí para siempre, y el siguiente que escribiera esa
  // misma frase en cualquier rama la tendría pre-aprobada sin que nadie lo decidiera.
  // «Una excepción que sobrevive a su causa deja de ser una nota y pasa a ser un permiso.»
  const fantasmas = Object.keys(APROBADOS).filter((t) => !textos.includes(t));
  assert.deepEqual(fantasmas, [],
    '🔴 hay textos APROBADOS que ya no se pintan:\n    ' + JSON.stringify(fantasmas)
    + '\n\n  O han cambiado de redacción —y entonces el nuevo necesita su propia aprobación— o se\n'
    + '  han retirado. En los dos casos, la entrada se borra de `APROBADOS`.');
});

test('SCRUM-298 · REGLA 26: ni una palabra sobre VeriFactu, la AEAT o el calendario', () => {
  // No es un guard de estilo: es que un texto que explica mal una obligación fiscal fabrica una
  // creencia falsa en alguien que responde ante Hacienda.
  const vista = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/settingsView.js'), 'utf8');
  const bloque = vista.slice(vista.indexOf('SCRUM-298 (A8) · EL MODO'), vista.indexOf('const alertBox'));
  const sinComentarios = bloque.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(sinComentarios, /VeriFactu|AEAT|Hacienda|remit|plazo|calendario/i,
    '🔴 hay texto que explica la obligación fiscal. Eso se responde SOLO con el guion H2 (regla 26)');
  // Hermano positivo: la regex casa cuando el patrón está de verdad.
  assert.match('se remite a la AEAT según el calendario', /VeriFactu|AEAT|Hacienda|remit|plazo|calendario/i);
});
