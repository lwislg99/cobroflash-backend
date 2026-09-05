// tests/scrum743-tercera-forma.test.mjs — SCRUM-743
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LA TERCERA FORMA: AGRUPAR **SIN FORZAR DECIMALES**.
//
// El producto tenía dos: el importe CON símbolo y el importe SIN símbolo. Las dos fijan
// `minimumFractionDigits: 2`. Faltaba la de lo que NO es dinero —una cantidad, el rótulo de un
// eje—, y por eso esos sitios se escribían su propio `toLocaleString('es-ES')`, que por CLDR **no
// agrupa los enteros de cuatro cifras**: `1500` donde el producto escribe `1.500`.
//
// ── 🔴 EL FILO, Y ES EL ARGUMENTO CON EL QUE SE PIDIÓ ESTE TICKET ────────────────────────────
//
//     `1,5` sigue siendo `1,5` y NO `1,50`.
//
// Pasar una cantidad por una forma de dinero **añadiría un decimal que hoy no está**. En un albarán
// FIRMADO eso es cambiar lo impreso, que es peor que el defecto que se viene a arreglar. Hay un
// test abajo que cae si alguien «unifica» por ahí.
//
// ── LA TRAMPA, LA MISMA QUE EN SCRUM-739 ────────────────────────────────────────────────────
//
// Un rojo con 117 o con 12.345 no prueba nada: `es-ES` YA agrupa a partir de cinco cifras, y con
// tres no hay nada que agrupar. **El rojo tiene que usar cuatro cifras enteras.** Aquí no se
// promete: se ejercita la forma vieja al lado de la nueva.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { cargarDashboard } from './_banco-vistas.mjs';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

const U = await import('../dist/core/utils/utils.js');
const { ctx } = cargarDashboard(RAIZ);
const { fmtNumeroEs, fmtImporteEs, fmtMoneyEs } = ctx;

/** La forma VIEJA, la que estaba escrita en los dos sitios. Sin ella, «ahora agrupa» no se contrasta. */
const COMO_ESTABA = (v) => Number(v).toLocaleString('es-ES', { maximumFractionDigits: 2 });

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-743 · SUELO: la tercera forma existe en las DOS mitades, y DISTINGUE', () => {
  assert.equal(typeof U.formatNumeroEs, 'function', '🔴 el backend no exporta `formatNumeroEs`');
  assert.equal(typeof fmtNumeroEs, 'function', '🔴 el front no expone `fmtNumeroEs`');
  // Si diera lo mismo que las de dinero, no sería una forma nueva: sería una copia.
  assert.notEqual(U.formatNumeroEs(1.5), U.formatImporteEs(1.5),
    '🔴 la tercera forma da lo mismo que el importe sin símbolo: entonces no aporta nada y lo de '
    + 'abajo mide una función que no distingue.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL FILO · `1,5` NO PUEDE VOLVERSE `1,50`
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-743 · 🔴 EL FILO: los decimales que traiga, y ni uno más', () => {
  assert.equal(U.formatNumeroEs(1.5), '1,5',
    '🔴 `1,5` se ha convertido en otra cosa. Si alguien «unifica» esto con una forma de dinero, una '
    + 'cantidad de 1,5 h pasa a imprimirse 1,50 h — y en un albarán FIRMADO eso es cambiar lo '
    + 'impreso, que es peor que el defecto que este ticket viene a arreglar.');
  assert.equal(U.formatNumeroEs(3), '3', '🔴 un entero ha ganado decimales');
  assert.equal(U.formatNumeroEs(1500), '1.500', '🔴 un entero de cuatro cifras ha ganado decimales');
  assert.equal(U.formatNumeroEs(2500.5), '2.500,5', '🔴 se ha rellenado el segundo decimal');

  // Y el contraste que lo hace demostrativo: las DOS formas de dinero sí los fuerzan.
  //
  // ⚠️ `formatMoneyEs` se comprueba por el PRINCIPIO y no con la cadena entera, y no es pereza:
  // `style: 'currency'` mete un espacio DURO (U+00A0) antes del símbolo, así que `'1,50 €'` escrito
  // a mano NO es igual y las dos se ven idénticas en pantalla. Es la misma trampa que
  // `albaranPublicVista.ts` documenta —«se ven igual y son dos cadenas distintas»— y aquí cayó al
  // escribir este test. Lo que importa es que fuerza los dos decimales, no cuál es el separador.
  assert.equal(U.formatImporteEs(1.5), '1,50');
  assert.ok(U.formatMoneyEs(1.5).startsWith('1,50'),
    `🔴 la forma CON símbolo ya no fuerza dos decimales: «${U.formatMoneyEs(1.5)}»`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL ROJO · CUATRO CIFRAS ENTERAS
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-743 · 🔴 el defecto EXISTÍA, y sólo se ve con cuatro cifras', () => {
  assert.equal(COMO_ESTABA(1500), '1500',
    '🔴 la forma vieja ya no reproduce el defecto: entonces el verde de al lado no significa que se '
    + 'haya arreglado nada.');
  assert.notEqual(COMO_ESTABA(1500), U.formatNumeroEs(1500),
    '🔴 la vieja y la nueva dan lo MISMO con 1.500.');

  // 🔴 LA TRAMPA, ESCRITA: con tres o con cinco cifras las dos coinciden, así que un test con
  // 117 o con 12.345 habría pasado igual SIN el arreglo.
  for (const v of [117, 12345, 999, 2.5]) {
    assert.equal(COMO_ESTABA(v), U.formatNumeroEs(v),
      `🔴 con ${v} la vieja y la nueva difieren, y no deberían: este ticket sólo cambia la banda de `
      + 'cuatro cifras. Si difieren aquí, se ha movido algo que no tocaba.');
  }
});

test('SCRUM-743 · toda la banda 1.000–9.999 se agrupa, sin decimales de más', () => {
  let comprobados = 0;
  for (let v = 1000; v <= 9999; v += 41) {
    assert.equal(U.formatNumeroEs(v), String(v).slice(0, 1) + '.' + String(v).slice(1),
      `🔴 con ${v} sale «${U.formatNumeroEs(v)}»: o no agrupa, o le ha puesto decimales.`);
    comprobados++;
  }
  assert.ok(comprobados > 200, `🔴 SUELO: sólo ${comprobados} valores barridos.`);
});

test('SCRUM-743 · la CIFRA no se mueve: sólo cómo se escribe', () => {
  for (const v of [1, 1.5, 1000, 1500, 2500.5, 9999.99, 12345, 0]) {
    const deshecho = Number(U.formatNumeroEs(v).split('.').join('').replace(',', '.'));
    assert.equal(deshecho, Number(Number(v).toFixed(2)),
      `🔴 LA CIFRA CAMBIA con ${v}: sale «${U.formatNumeroEs(v)}». Eso no es formato, es cálculo.`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL SITIO ÚNICO · las tres formas comparten LA AGRUPACIÓN, y nada más
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-743 · el front y el backend escriben el MISMO número', () => {
  let comparados = 0;
  for (const v of [0, 1, 1.5, 3, 999, 1000, 1500, 2500.5, 9999.99, 12345, -1500]) {
    assert.equal(fmtNumeroEs(v), U.formatNumeroEs(v),
      `🔴 con ${v} la pantalla escribe «${fmtNumeroEs(v)}» y el servidor «${U.formatNumeroEs(v)}».`);
    comparados++;
  }
  assert.ok(comparados >= 11, `🔴 SUELO: sólo ${comparados} comparaciones.`);
});

test('SCRUM-743 · 🔴 la agrupación está escrita UNA vez en cada mitad', () => {
  const back = soloCodigo(leer('src/core/utils/utils.ts'));
  const front = soloCodigo(leer('public/dashboard/js/api.js'));
  assert.ok(back.length > 3000 && front.length > 3000,
    '🔴 SUELO: el extractor no está leyendo los ficheros; su cuenta de abajo no vale.');

  for (const [nombre, codigo] of [['utils.ts', back], ['api.js', front]]) {
    const veces = (codigo.match(/useGrouping/g) || []).length;
    assert.equal(veces, 1,
      `🔴 «useGrouping» aparece ${veces} veces en el CÓDIGO de ${nombre} y tiene que aparecer UNA: `
      + 'en la constante que las tres formas comparten. Escrita N veces es exactamente lo que lleva '
      + 'cuatro tickets rompiéndose — cada copia del formato reintrodujo el mismo defecto.');
  }
});

test('SCRUM-743 · 🔴 las formas siguen siendo TRES, no cuatro', () => {
  // Derivado del árbol, no una lista a mano: se cuentan las funciones EXPORTADAS de cada mitad que
  // construyen un `Intl.NumberFormat`. Una cuarta hace caer esto — y si el detector no ve ninguna,
  // también, porque cero sería «no supe mirar».
  const delBackend = (() => {
    const fuente = leer('src/core/utils/utils.ts');
    const sf = ts.createSourceFile('utils.ts', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const out = [];
    const visitar = (n) => {
      if (ts.isFunctionDeclaration(n) && n.name
          && (n.modifiers || []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
          && /Intl\.NumberFormat|toLocaleString/.test(n.getText(sf))) out.push(n.name.text);
      n.forEachChild(visitar);
    };
    visitar(sf);
    return out.sort();
  })();

  assert.deepEqual(delBackend, ['formatImporteEs', 'formatMoneyEs', 'formatNumeroEs'],
    `🔴 las formas del backend han dejado de ser tres: ${delBackend.join(', ')}. Una cuarta es una `
    + 'cuarta manera de escribir un número en el mismo producto, y este ticket existe justamente '
    + 'porque la tercera faltaba y alguien se la escribió por su cuenta.');

  // El front expone las mismas TRES por `window`, más `fmtMoneyEsOAusente`, que NO es una forma:
  // es la decisión sobre el ausente y DELEGA en `fmtMoneyEs` (SCRUM-436).
  const codigoFront = soloCodigo(leer('public/dashboard/js/api.js'));
  for (const n of ['fmtMoneyEs', 'fmtImporteEs', 'fmtNumeroEs']) {
    assert.ok(codigoFront.includes('window.' + n + ' = ' + n + ';'),
      `🔴 el front no expone \`${n}\`: la mitad de la pantalla no tiene esa forma.`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CABLEADO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-743 · el rótulo del eje ya pasa por la tercera forma', () => {
  const codigo = soloCodigo(leer('public/dashboard/js/reportsView.js'));
  assert.ok(codigo.includes('fmtNumeroEs(Math.round(maxVal * f))'),
    '🔴 el rótulo del eje no llama a `fmtNumeroEs`: seguiría escribiendo `6050` donde el resto del '
    + 'producto escribe `6.050`.');
  assert.equal((codigo.match(/\.toLocaleString\s*\(/g) || []).length, 0,
    '🔴 queda algún `toLocaleString` en Informes: con las tres formas ya no hace falta ninguno.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-745 (adopción) · LAS MUTACIONES DE ESTE GUARD
//
// El FILO y el CABLEADO, que es donde este ticket se puede romper por separado: la tercera forma
// puede volver a forzar decimales mientras el rótulo del eje sigue llamándola, o puede quedar
// perfecta mientras la pantalla vuelve a escribir el número por su cuenta.
//
// ⛔ EL FILO SE MUTA EN EL FRONT, NO EN `src/core/utils/utils.ts`. Los asserts que comparan `1,5`
// contra `1,50` leen el backend desde `dist/`, y entre la mutación y la pasada no se compila: el
// `.ts` mutado no llegaría a `dist/` y el guard saldría MUDO sin estar mudo. El front sí lo carga
// el banco de vistas en vivo, y el test que compara las dos mitades cae igual.
// ═════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // ① EL FILO, reconstruido: la tercera forma vuelve a forzar dos decimales. `1,5` pasa a
    // escribirse `1,50` — en un albarán ya firmado eso es cambiar lo impreso, que es peor que el
    // defecto que el ticket vino a arreglar. Cae por la mitad que se puede medir sin compilar: el
    // front deja de decir lo mismo que el backend.
    fichero: 'public/dashboard/js/api.js',
    de: "  return { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 2 };",
    a: "  return { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 };",
    cae: 'el front y el backend escriben el MISMO número',
  },
  {
    // ② EL CABLEADO: el rótulo del eje se escribe otra vez a mano. Vuelve a salir `6050` donde el
    // resto del producto escribe `6.050`, y reaparece el `toLocaleString` que las tres formas
    // existen para no necesitar — la cuarta copia del formato.
    fichero: 'public/dashboard/js/reportsView.js',
    de: '    label.textContent = fmtNumeroEs(Math.round(maxVal * f));',
    a: "    label.textContent = Math.round(maxVal * f).toLocaleString('es-ES');",
    cae: 'el rótulo del eje ya pasa por la tercera forma',
  },
];
