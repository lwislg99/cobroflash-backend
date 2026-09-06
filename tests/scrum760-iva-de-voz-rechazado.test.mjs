// tests/scrum760-iva-de-voz-rechazado.test.mjs — SCRUM-760
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA PUERTA DE VOZ RECORTABA EL IVA EN VEZ DE RECHAZARLO
//
// LA CADENA, MEDIDA EN EL CAMINO REAL ANTES DE TOCAR NADA (6-sep-2026, este árbol):
//
//   el prompt pide un decimal (`0.21`) → el modelo devuelve `21` → `Math.min(1, Math.max(0, iva))`
//   lo dejaba en `1` (`ai.service.ts:233`) → el `×100` del navegador (`jobDetailView.js:2331`)
//   lo pintaba **100 % DE IVA** → y el total orientativo de la hoja pasaba de 170,00 € de base a
//   **340,00 €**. El cliente firma el doble.
//
// Sin ruido, sin error, sin síntoma: un 100 % es PLAUSIBLE PARA LA MÁQUINA E IMPOSIBLE PARA EL
// NEGOCIO. No cae en ningún `catch`, no dispara nada, y se comporta como un tipo válido hasta
// que alguien mira el papel. Ni siquiera el guardado lo para: `validarLineas`
// (`albaran.service.ts:117`) admite `0 ≤ tipoIva ≤ 100`, así que el 100 pasa.
//
// ── LA IRONÍA ESTABA EN EL PROPIO FICHERO ─────────────────────────────────────────────────
// La cabecera de `sanearLineasAlbaran` dice «ES EL MECANISMO, NO EL PROMPT»: la función existe
// porque un prompt es una PETICIÓN y no una garantía. Y no se defendía de que su propia petición
// —«devuélvemelo como decimal»— se malinterpretara.
//
// ── POR QUÉ SE DERIVA Y NO SE ESCRIBE OTRA VEZ ────────────────────────────────────────────
// El rechazo correcto ya existía y ya estaba probado: `invalidTipoIva` (SCRUM-217), que compara
// en PUNTOS BÁSICOS para no tropezar con la coma flotante y que **nombra el valor que recibió**.
// Dos validaciones de la misma regla son la misma regla dos veces, y una se queda atrás el día
// que Canarias (SCRUM-646) o LATAM (F3) muevan la lista. Por eso aquí no hay lista: hay una
// llamada. El apartado 3 lo vigila por AST.
//
// ⛔ LO QUE NO SE HA HECHO, Y ES DELIBERADO:
//   · NO se amplía el recorte a `Math.min(100, …)`. Aplanar sigue siendo aplanar: convertiría un
//     `2100` («21 % en puntos básicos») en un 100 % con la misma cara de inocente.
//   · NO se toca el PROMPT como arreglo. El prompt ya pide el decimal; el defecto es que nadie
//     comprobaba que le hicieran caso.
//   · NO se toca `invalidTipoIva`: está bien, y acomodarla a la voz sería mover la regla fiscal
//     para que le quepa un caso de dictado.
//   · NO se toca la INTERFAZ. Lo que la pantalla debe hacer con un tipo rechazado está MEDIDO
//     abajo y PROPUESTO en el parte, pero lo firma el fundador (regla 30).
//
// ── ✅ CONTROL NEGATIVO, Y ES EL FILO DEL TICKET ──────────────────────────────────────────
// El backend admite SIETE tipos en puntos básicos {0, 200, 400, 500, 750, 1000, 2100}. El 2 %, el
// 5 % y el 7,5 % están ahí A PROPÓSITO: una rectificativa puede tener que rectificar una
// operación de aquellas ventanas. Un arreglo que los tirase rompería una rectificativa, así que
// los siete se prueban UNO A UNO por la puerta de la voz, no por la de `invalidTipoIva`.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { cargarDashboard, todos } from './_banco-vistas.mjs';
import { sanearLineasAlbaran } from '../dist/modules/ai/domain/ai.service.js';
import { invalidTipoIva, TIPOS_IVA_ES_BP } from '../dist/core/validation/fiscalInput.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTA_AI = path.join(RAIZ, 'src', 'modules', 'ai', 'domain', 'ai.service.ts');
const FUENTE_AI = fs.readFileSync(RUTA_AI, 'utf8');

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 1 · EL CAMINO REAL, DE PUNTA A PUNTA
//
// No se mira el código: se MONTA el editor de albarán de verdad, se pulsa «🎤 Dictar el parte»,
// se pulsa «Convertir en líneas» —con el saneador REAL de `dist` detrás del `fetch`— y se pulsa
// «Añadir al parte». Lo que se lee al final es la casilla que ve el profesional.
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * El banco, con un navegador que SÍ soporta dictado.
 *
 * ⚠️ POR QUÉ SE RE-EJECUTA `voiceInput.js`: su gate captura `window.SpeechRecognition` en una
 * variable de módulo AL CARGARSE, y `cargarDashboard` no ofrece forma de poblar el contexto
 * antes de esa carga. Así que se le vuelve a pasar EL MISMO FICHERO con la API ya presente —que
 * es exactamente el navegador que el producto exige— en vez de sustituir `voiceSupportProbe` por
 * un doble. Lo que corre es el gate REAL: si mañana pide una condición más, este test se entera.
 */
function bancoConVoz(lineasQueDevuelveElBackend) {
  const banco = cargarDashboard(RAIZ, {
    datos: (url) => (String(url).includes('suggest-albaran-lines')
      ? { lines: lineasQueDevuelveElBackend }
      : {}),
  });
  assert.deepEqual(banco.fallos, [], '🔴 el dashboard no carga limpio: el banco mediría otra cosa');
  const ctx = banco.ctx;
  ctx.SpeechRecognition = class { start() {} stop() {} abort() {} };
  ctx.isSecureContext = true;
  ctx.appVoiceEnabled = true;          // VOICE_QUOTE_ENABLED, servido por /admin/me
  ctx.appVoiceAlbaranEnabled = true;   // VOICE_ALBARAN_ENABLED, el flag PROPIO del albarán
  vm.runInContext(
    fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/voiceInput.js'), 'utf8'),
    ctx, { filename: 'voiceInput.js' },
  );
  assert.equal(ctx.voiceSupportProbe(), true, '🔴 el gate real de voz dice que no: no hay camino que medir');
  return banco;
}

/** Monta el editor VALORADO, dicta, convierte y añade. Devuelve lo que quedó en pantalla. */
async function dictarYAnadir(banco) {
  const ctx = banco.ctx;
  const box = banco.mk('div');
  ctx.document.body.appendChild(box);
  ctx.buildAlbEditor(
    box,
    { id: 7, estado: 'borrador', modoValoracion: 'VALORADO', lineas: [] },
    {},
    { cur: 'EUR' },
  );

  const btn = (raiz, texto) => todos(raiz)
    .find((n) => n.tagName === 'BUTTON' && String(n.textContent).includes(texto));

  const dictar = btn(box, 'Dictar el parte');
  assert.ok(dictar, '🔴 no se pinta el botón de dictado: no hay nada que medir');
  dictar.click();

  const overlay = ctx.document.body.hijos[ctx.document.body.hijos.length - 1];
  overlay.querySelector('#voz-txt').value = 'he cambiado dos grifos monomando';
  await overlay.querySelector('#voz-gen').disparar('click');
  await new Promise((r) => setTimeout(r, 60)); // el handler es async: se le deja volver

  const res = overlay.querySelector('#voz-res');
  const anadir = btn(res, 'Añadir al parte');
  assert.ok(
    anadir,
    '🔴 la propuesta no llegó a pintarse (error en pantalla: '
      + `«${overlay.querySelector('#voz-err').textContent}»). Sin línea añadida, cualquier `
      + 'afirmación sobre el IVA sería un cero sobre población vacía.',
  );
  anadir.click();

  const casillas = (marcador) => todos(box)
    .filter((n) => n.tagName === 'INPUT' && n.placeholder === marcador)
    .map((n) => String(n.value));
  const totales = todos(box)
    .find((n) => n.tagName === 'P' && String(n.textContent).includes('Total orientativo'));
  return {
    conceptos: casillas('Concepto'),
    ivas: casillas('IVA %'),
    total: totales ? String(totales.textContent) : '',
  };
}

// El dictado de obra, tal cual: dos grifos a 85 €. Base = 170,00 €.
const DICTADO = { concepto: 'Sustitución de grifo monomando', cantidad: 2, unidad: 'ud', precioUnitario: 85 };

test('SCRUM-760 · 🔴 EL CONTROL QUE DECIDE: el modelo contesta 21 y la pantalla NO pinta 100 %', async () => {
  // El modelo devuelve el tipo como PORCENTAJE aunque se le pidió decimal. Es el caso real.
  const delBackend = sanearLineasAlbaran([{ ...DICTADO, tipoIva: 21 }], 'VALORADO');

  const pantalla = await dictarYAnadir(bancoConVoz(delBackend));

  assert.ok(
    pantalla.conceptos.includes(DICTADO.concepto),
    '🔴 la línea no llegó a la hoja: sin ella, el «no hay 100 %» de abajo no mide nada',
  );
  assert.ok(
    !pantalla.ivas.includes('100'),
    '🔴 UN 100 % DE IVA EN LA HOJA DEL PARTE. El modelo contestó 21 —queriendo decir 21 %—, el '
      + `recorte lo dejó en 1 y el ×100 del navegador lo pintó entero. Casillas: [${pantalla.ivas}]. `
      + 'Es plausible para la máquina e imposible para el negocio: no lo para ningún catch, y el '
      + 'albarán lo firma el cliente.',
  );
  assert.ok(
    !pantalla.total.includes('340,00'),
    `🔴 el total orientativo cobra el doble de la base: «${pantalla.total}»`,
  );
});

test('SCRUM-760 · ✅ CONTROL POSITIVO: un 0.21 legítimo sigue dando 21 %, exactamente como hoy', async () => {
  const delBackend = sanearLineasAlbaran([{ ...DICTADO, tipoIva: 0.21 }], 'VALORADO');
  assert.equal(delBackend[0].tipoIva, 0.21, 'la puerta no puede tocar el caso bueno');

  const pantalla = await dictarYAnadir(bancoConVoz(delBackend));
  assert.ok(pantalla.conceptos.includes(DICTADO.concepto), 'la línea se añade');
  assert.ok(
    pantalla.ivas.includes('21'),
    `🔴 el 21 % legítimo ya no llega a la casilla. Casillas: [${pantalla.ivas}]`,
  );
  assert.ok(
    pantalla.total.includes('205,70'),
    `🔴 el total del caso bueno ha cambiado: «${pantalla.total}» (170,00 € + 21 % = 205,70 €)`,
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 2 · LA PUERTA, PURA — rechaza NOMBRANDO el valor, y no se lleva por delante ningún tipo real
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-760 · el 21 se RECHAZA, no se recorta, y el rechazo NOMBRA el valor recibido', () => {
  const [linea] = sanearLineasAlbaran([{ ...DICTADO, tipoIva: 21 }], 'VALORADO');

  assert.equal(
    linea.tipoIva, undefined,
    '🔴 sigue saliendo un tipo de la puerta con un 21 dentro: recortar es inventarse una respuesta',
  );
  assert.equal(linea.precioUnitario, 85, 'el precio de la línea NO es rehén del IVA: sigue pasando');
  assert.ok(
    linea.tipoIvaRechazado,
    '🔴 se rechaza en silencio. Un rechazo que no deja motivo es indistinguible de que el modelo '
      + 'no dijera nada, y son dos cosas muy distintas.',
  );
  assert.match(
    String(linea.tipoIvaRechazado), /\b21\b/,
    `🔴 el motivo no nombra el valor recibido: «${linea.tipoIvaRechazado}»`,
  );
  assert.equal(
    linea.tipoIvaRechazado, invalidTipoIva(21),
    '🔴 el motivo NO sale de `invalidTipoIva`: es un segundo texto que dirá otra cosa el día que '
      + 'aquél cambie',
  );
});

test('SCRUM-760 · ✅ CONTROL NEGATIVO: los SIETE tipos españoles pasan por la puerta de la VOZ', () => {
  // Por la puerta de la voz, uno a uno: probarlos en `invalidTipoIva` mediría el otro lado.
  // 0,075 es el que rompe una comparación ingenua de flotantes; el 2 %, el 5 % y el 7,5 % son los
  // de las ventanas temporales, y tirarlos rompería una rectificativa de aquel periodo.
  const fracciones = [0, 0.02, 0.04, 0.05, 0.075, 0.10, 0.21];
  assert.equal(fracciones.length, TIPOS_IVA_ES_BP.size, 'se prueban los SIETE, no una selección');

  for (const f of fracciones) {
    const [l] = sanearLineasAlbaran([{ ...DICTADO, tipoIva: f }], 'VALORADO');
    assert.equal(l.tipoIva, f, `🔴 el tipo del ${f * 100} % ya no pasa por la voz`);
    assert.equal(l.tipoIvaRechazado, undefined, `🔴 el ${f * 100} % se marca como rechazado`);
  }
});

test('SCRUM-760 · el 15 % inventado también cae, y SIN_VALORAR sigue sin IVA de ninguna clase', () => {
  const [malo] = sanearLineasAlbaran([{ ...DICTADO, tipoIva: 0.15 }], 'VALORADO');
  assert.equal(malo.tipoIva, undefined, '🔴 un 15 % no es un tipo español y estaba pasando entero');
  assert.match(String(malo.tipoIvaRechazado), /15 %/);

  // La regla de SCRUM-71 no se toca: en SIN_VALORAR no sale precio NI IVA, ni siquiera el motivo
  // de un rechazo — ahí no hay nada que rechazar porque no se mira.
  const [sin] = sanearLineasAlbaran([{ ...DICTADO, tipoIva: 21 }], 'SIN_VALORAR');
  assert.equal('tipoIva' in sin, false);
  assert.equal('precioUnitario' in sin, false);
  assert.equal('tipoIvaRechazado' in sin, false);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 3 · EL TRINQUETE: LA REGLA NO SE ESCRIBE DOS VECES
//
// Un test de comportamiento aprueba la bifurcación el día que nace: si mañana alguien copia la
// lista de tipos dentro de `ai.service.ts`, todo lo de arriba sigue verde y las dos copias
// empiezan a separarse. Esto se mide por AST sobre el fuente, que es lo único que distingue
// «llama a la regla» de «trae la regla dentro».
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** El nodo de `sanearLineasAlbaran`, o `null` si no se encuentra (escáner ciego). */
function nodoDelSaneador() {
  const sf = ts.createSourceFile('ai.service.ts', FUENTE_AI, ts.ScriptTarget.Latest, true);
  let fn = null;
  const visita = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.getText(sf) === 'sanearLineasAlbaran') fn = n;
    ts.forEachChild(n, visita);
  };
  ts.forEachChild(sf, visita);
  return { sf, fn };
}

test('SCRUM-760 · la puerta de voz LLAMA a `invalidTipoIva`, no reimplementa la regla', () => {
  const { sf, fn } = nodoDelSaneador();
  assert.ok(fn, '🔴 ESCÁNER CIEGO: no encuentro `sanearLineasAlbaran` en el fuente');

  const llamadas = [];
  const visita = (n) => {
    if (ts.isCallExpression(n)) llamadas.push(n.expression.getText(sf));
    ts.forEachChild(n, visita);
  };
  ts.forEachChild(fn, visita);

  assert.ok(
    llamadas.includes('invalidTipoIva'),
    `🔴 la puerta de voz no consulta la regla fiscal. Llama a: [${[...new Set(llamadas)].join(', ')}]`,
  );
  assert.ok(
    !llamadas.includes('Math.min'),
    '🔴 sigue habiendo un RECORTE dentro del saneador. Aplanar no es validar: convierte un valor '
      + 'imposible en uno plausible, que es el defecto entero de este ticket.',
  );
});

test('SCRUM-760 · la lista de tipos españoles vive en UN solo fichero de `src/`', () => {
  // Censo con CONTROL POSITIVO: si el escáner no encontrara NINGUNA declaración, «una» y «cero»
  // se leerían igual de bien y el guard sería una decoración.
  const ficheros = [];
  const recorrer = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) recorrer(p);
      else if (e.name.endsWith('.ts')) ficheros.push(p);
    }
  };
  recorrer(path.join(RAIZ, 'src'));
  assert.ok(ficheros.length > 100, `🔴 CENSO CIEGO: sólo ${ficheros.length} ficheros .ts en src/`);

  // Se busca la DECLARACIÓN por AST, no la mención: importarla es justo lo que se quiere.
  const declaran = ficheros.filter((p) => {
    const sf = ts.createSourceFile(path.basename(p), fs.readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true);
    let hay = false;
    const visita = (n) => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'TIPOS_IVA_ES_BP') hay = true;
      ts.forEachChild(n, visita);
    };
    ts.forEachChild(sf, visita);
    return hay;
  }).map((p) => path.relative(RAIZ, p).replace(/\\/g, '/'));

  assert.deepEqual(
    declaran, ['src/core/validation/fiscalInput.ts'],
    '🔴 la lista de tipos de IVA españoles está declarada en más de un sitio (o en ninguno, y '
      + 'entonces este censo está ciego). Dos listas de la misma regla derivan en silencio, y la '
      + 'que se queda atrás acaba admitiendo un tipo que no existe o tirando uno que sí.',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 4 · LAS MUTACIONES — Y EL LÍMITE DEL CORREDOR, DECLARADO EN VEZ DE DISIMULADO
//
// 🔴 `scripts/meta-guard-mutaciones.mjs` muta el FUENTE y corre el guard **SIN RECOMPILAR**. Los
// tests 1-5 de este fichero importan de `dist/`, así que una mutación en el `.ts` NO LES LLEGA:
// saldrían «vivos» sin que nadie los haya visto caer, o «mudos» sin estarlo. Declarar una
// mutación que el corredor no puede juzgar es peor que no declararla — pinta de vivo un guard
// que nadie ha visto fallar, que es justo lo que este mecanismo existe para impedir.
//
// Por eso aquí SÓLO se declara lo que el corredor puede juzgar de verdad:
//   · sobre el `.ts`, las que caen en los tests que leen el FUENTE por AST (6 y 7);
//   · sobre el FRONT, que no se compila, las que caen en los tests de pantalla (1 y 2).
//
// Las del BACKEND (tests 3, 4 y 5) se corrieron A MANO recompilando entre pasos, y su resultado
// va en el parte. No se declaran aquí para no falsear el recuento del meta-guard.
// ═══════════════════════════════════════════════════════════════════════════════════════════

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // ① La puerta deja de consultar la regla fiscal. Es el defecto de este ticket vuelto a nacer.
    fichero: 'src/modules/ai/domain/ai.service.ts',
    de: '        const motivo = invalidTipoIva(bruto);',
    a: '        const motivo = null;',
    cae: 'SCRUM-760 · la puerta de voz LLAMA a `invalidTipoIva`, no reimplementa la regla',
  },
  {
    // ② Vuelve el RECORTE. El guard mira llamadas por AST, no el texto del fichero: el `import` y
    // los comentarios mantienen la palabra `invalidTipoIva` viva, así que un guard que comparase
    // por texto seguiría verde aquí (la lección de SCRUM-745).
    fichero: 'src/modules/ai/domain/ai.service.ts',
    de: '        if (motivo === null) linea.tipoIva = Number(bruto);',
    a: '        if (motivo === null) linea.tipoIva = Math.min(1, Math.max(0, Number(bruto)));',
    cae: 'SCRUM-760 · la puerta de voz LLAMA a `invalidTipoIva`, no reimplementa la regla',
  },
  {
    // ③ Nace una SEGUNDA copia de la lista de tipos. Es la forma exacta en que dos validaciones
    // de la misma regla empiezan a separarse, y el censo tiene que verla.
    fichero: 'src/modules/ai/domain/ai.service.ts',
    de: "export type ModoValoracion = 'SIN_VALORAR' | 'VALORADO';",
    a: "const TIPOS_IVA_ES_BP = new Set([0, 200, 400, 500, 750, 1000, 2100]);\nexport type ModoValoracion = 'SIN_VALORAR' | 'VALORADO';",
    cae: 'SCRUM-760 · la lista de tipos españoles vive en UN solo fichero de `src/`',
  },
  {
    // ④ NO SE AÑADE NINGUNA LÍNEA. Sin esta mutación, «no hay ningún 100 %» podría estar
    // midiendo una hoja VACÍA — un cero sobre población vacía, que no es un cero.
    fichero: 'public/dashboard/js/jobDetailView.js',
    de: '          marcas.filter((m) => m.chk.checked).forEach((m) => {',
    a: '          marcas.filter(() => false).forEach((m) => {',
    cae: 'SCRUM-760 · 🔴 EL CONTROL QUE DECIDE: el modelo contesta 21 y la pantalla NO pinta 100 %',
  },
  {
    // ⑤ Desaparece el ×100 del navegador — la mitad de la cadena que vive en el front. El control
    // POSITIVO tiene que caer con esto, o no estaría vigilando la conversión.
    fichero: 'public/dashboard/js/jobDetailView.js',
    de: '                ? { precioUnitario: l.precioUnitario, tipoIva: l.tipoIva != null ? l.tipoIva * 100 : undefined }',
    a: '                ? { precioUnitario: l.precioUnitario, tipoIva: l.tipoIva != null ? l.tipoIva * 1 : undefined }',
    cae: 'SCRUM-760 · ✅ CONTROL POSITIVO: un 0.21 legítimo sigue dando 21 %, exactamente como hoy',
  },
];

test('SCRUM-760 · EL LECTOR OFICIAL me ve: las cinco declaraciones, con sus cuatro campos', async () => {
  // 🔴 El meta-guard está bajo sospecha, y uno de los defectos medidos es que IGNORA EN SILENCIO
  // una declaración con forma propia. Una declaración que el corredor no lee es una promesa que
  // nadie comprueba, así que no basta con escribirla bien: hay que PREGUNTARLE A ÉL si la ve.
  const { mutacionesDeclaradas } = await import('../scripts/meta-guard-mutaciones.mjs');
  const yo = fileURLToPath(import.meta.url);
  const vistas = mutacionesDeclaradas(fs.readFileSync(yo, 'utf8'), path.basename(yo));

  assert.equal(
    vistas.length, MUTACIONES_QUE_ME_TUMBAN.length,
    `🔴 declaro ${MUTACIONES_QUE_ME_TUMBAN.length} mutaciones y el lector oficial ve ${vistas.length}. `
      + 'Las que no ve son promesas que no comprueba nadie.',
  );
  // Campo a campo: que las CUENTE no significa que las lea enteras.
  assert.deepEqual(
    vistas.map((m) => ({ fichero: m.fichero, de: m.de, a: m.a, cae: m.cae })),
    MUTACIONES_QUE_ME_TUMBAN.map((m) => ({ fichero: m.fichero, de: m.de, a: m.a, cae: m.cae })),
    '🔴 el lector oficial lee algo distinto de lo que está escrito aquí',
  );

  // Y el ANCLA tiene que existir HOY: una declaración cuyo `de` caducó sale «ciega» en el
  // corredor, que es un rótulo que se lee igual de bien que «no lo he mirado».
  for (const m of MUTACIONES_QUE_ME_TUMBAN) {
    const abs = path.join(RAIZ, m.fichero);
    assert.ok(fs.existsSync(abs), `🔴 el fichero de la mutación no existe: ${m.fichero}`);
    assert.ok(
      fs.readFileSync(abs, 'utf8').includes(m.de),
      `🔴 el ancla de la mutación ya no está en ${m.fichero}: «${m.de.trim().slice(0, 60)}…»`,
    );
  }
});
