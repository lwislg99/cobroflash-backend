// tests/scrum982-la-nota-del-cliente-en-el-trabajo.test.mjs — SCRUM-982
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA NOTA DEL CLIENTE, A LA VISTA EN LA FICHA DEL TRABAJO (el técnico también la ve)
//
// `Customer.notes` guarda «timbre roto, llamar al móvil, perro suelto» y no salía en ninguna
// pantalla de trabajo: sólo en la ficha del cliente. Quien llega a la puerta la necesita justo donde
// mira al llegar. Medido en el PASO 0 (staging `53d756d7`, 15 Trabajos con cliente): la nota no
// viaja ni en la lista ni en el detalle; sólo la lee la ficha 360.
//
// CUATRO COSAS, y cada una con su mitad:
//   ① EL RÓTULO, carácter a carácter. «Nota del cliente», firmado por el orquestador por delegación
//     del fundador (SCRUM-982, comentario 16065): etiqueta pequeña, sin dos puntos y sin icono.
//   ② EL CONSTRUCTOR: con nota hay línea; sin nota —o sólo espacios— no la hay; y los saltos de línea
//     de DENTRO son del profesional: se recortan los extremos y nada más.
//   ③ EL SERVIDOR: `notes` va en la consulta del DETALLE (`serializeJobDetail`) y NO en
//     `CUSTOMER_SELECT`, que alimenta la lista de hasta 200 filas donde nada la pinta.
//   ④ 🔴 OBLIGATORIO (orquestador): NINGUNA RUTA PÚBLICA LA EXPONE. `Customer.notes` es texto libre
//     interno: no sale en el portal ni en documentos. Se prueba por estructura, con AST, no por
//     texto: el serializador no se exporta, se llama sólo desde handlers del propio router, el
//     router sólo se importa desde `app.ts` y sólo se monta con `mountAdmin(… '/admin/jobs' …)`,
//     DESPUÉS de `app.use('/admin', requireAuth)`.
//
// 🔴 Una fuga «se evita por disciplina» vuelve; una que se evita porque el camino ni siquiera
// existe, no (canon de la Sesión 2, SCRUM-832). Por eso ④ no busca la palabra «notes» en las rutas
// públicas: comprueba que la ÚNICA puerta por la que sale es la de /admin.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs'; // SCRUM-262: el rango imposible

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
const BLOQUES = require_(path.join(RAIZ, 'public/dashboard/js/jobRailBlocks.js'));

const RUTA_JOBS = 'src/modules/jobs/app/routes/jobs.routes.ts';
const RUTA_APP = 'src/app.ts';
const RUTA_CSS = 'public/dashboard/css/styles.css';

// El literal FIRMADO. Se escribe aquí y no se importa de `jobRailBlocks.js`: un test que compara el
// rótulo consigo mismo pasa aunque alguien lo cambie (canon: «un control más débil que el contrato
// que dice proteger es peor que no tener control»).
const ROTULO_FIRMADO = 'Nota del cliente';

// Una nota de verdad: varios párrafos, con saltos dobles, y un tramo largo sin espacios (una URL) que
// es lo que ensancharía el rail si el texto no se partiera.
const NOTA_LARGA = [
  'Timbre roto: llamar al móvil antes de subir.',
  '',
  'Perro suelto en el patio. Entrar por la puerta del garaje y esperar a que salga el dueño.',
  'Llaves de la azotea en la floristería de enfrente, preguntar por Marisol.',
  '',
  'https://maps.example.test/ruta/muy/larga/sin/espacios/que/no/se/puede/partir/por/una/palabra/0123456789',
].join('\n');

const TEL = telefonoDePrueba(982);

// ── UTILIDADES DE AST ────────────────────────────────────────────────────────────────────
const fuenteTS = (rel) => {
  const texto = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  return ts.createSourceFile(rel, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
};
const recorrer = (nodo, visita) => { visita(nodo); nodo.forEachChild((h) => recorrer(h, visita)); };
const sinEnvoltorios = (n) => {
  while (n && (ts.isAsExpression(n) || ts.isParenthesizedExpression(n) || ts.isSatisfiesExpression(n))) n = n.expression;
  return n;
};
/** Nombres de las propiedades de un objeto literal. */
const clavesDe = (obj) => obj.properties.map((p) => (p.name ? p.name.getText() : '…spread'));

/** Las claves de `CUSTOMER_SELECT`, o null si no encuentro la declaración. */
function clavesDeCustomerSelect(sf) {
  let claves = null;
  recorrer(sf, (n) => {
    if (ts.isVariableDeclaration(n) && n.name.getText() === 'CUSTOMER_SELECT' && n.initializer) {
      const obj = sinEnvoltorios(n.initializer);
      if (obj && ts.isObjectLiteralExpression(obj)) claves = clavesDe(obj);
    }
  });
  return claves;
}

/** La declaración de `serializeJobDetail`, o null. */
function funcionDelDetalle(sf) {
  let fn = null;
  recorrer(sf, (n) => { if (ts.isFunctionDeclaration(n) && n.name && n.name.text === 'serializeJobDetail') fn = n; });
  return fn;
}

/** Los `select` de cada `prisma.customer.findUnique(...)` DENTRO de `serializeJobDetail`. */
function selectsDelClienteEnElDetalle(sf) {
  const fn = funcionDelDetalle(sf);
  if (!fn) return null;
  const selects = [];
  recorrer(fn, (n) => {
    if (ts.isCallExpression(n) && /(^|\.)prisma\.customer\.findUnique$/.test(n.expression.getText())) {
      const arg = n.arguments[0];
      const sel = arg && ts.isObjectLiteralExpression(arg)
        && arg.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText() === 'select');
      if (sel && ts.isObjectLiteralExpression(sel.initializer)) selects.push(clavesDe(sel.initializer));
    }
  });
  return selects;
}

/** Lo que el fichero EXPORTA, por nombre (`default` para `export default x`). */
function exportacionesDe(sf) {
  const salida = [];
  for (const s of sf.statements) {
    if (ts.isExportAssignment(s)) { salida.push('default'); continue; }
    if (ts.isExportDeclaration(s)) { salida.push('export {…}'); continue; }
    if (ts.getSyntacticModifierFlags(s) & ts.ModifierFlags.Export) {
      if (ts.isVariableStatement(s)) for (const d of s.declarationList.declarations) salida.push(d.name.getText());
      else salida.push((s.name && s.name.getText()) || 'default');
    }
  }
  return salida;
}

/** Todos los `.ts` de `src/`, con ruta relativa y barras normales. */
function ficherosDeSrc() {
  const salida = [];
  (function andar(dir) {
    for (const e of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) andar(rel);
      else if (/\.ts$/.test(e.name) && !/\.d\.ts$/.test(e.name)) salida.push(rel);
    }
  })('src');
  return salida;
}

const bloqueCliente = (customer) => BLOQUES.bloqueCliente({ customer });
const lineaDeNota = (b) => (b ? b.lineas.find((l) => l.nota) : undefined);

// ═══ ① EL RÓTULO ═════════════════════════════════════════════════════════════════════════

test('SCRUM-982 · el rótulo firmado, carácter a carácter (sin dos puntos, sin icono)', () => {
  assert.equal(BLOQUES.ROTULO_NOTA_DEL_CLIENTE, ROTULO_FIRMADO,
    '🔴 el rótulo de la nota NO es el firmado en SCRUM-982 (comentario 16065). Un texto que ve el ' +
      'usuario sin firma es un texto inventado (regla 30/39).');
  const l = lineaDeNota(bloqueCliente({ name: 'Ana', phone: TEL, notes: 'Timbre roto' }));
  assert.ok(l, '🔴 SUELO: con nota no sale ni la línea, así que el resto de comprobaciones medirían nada.');
  assert.equal(l.etiqueta, ROTULO_FIRMADO, '🔴 la línea de la nota lleva otro rótulo');
  assert.ok(!/:/.test(l.etiqueta), '🔴 el rótulo lleva dos puntos: la firma dice «sin dos puntos»');
  assert.ok(!l.icono, '🔴 la nota lleva icono: la firma dice «sin icono»');
  assert.ok(!l.href, '🔴 la nota es un enlace: es texto para LEER, no una acción');
});

// ═══ ② EL CONSTRUCTOR ════════════════════════════════════════════════════════════════════

test('SCRUM-982 · 🔴 con nota hay línea, y los saltos de línea de DENTRO llegan intactos', () => {
  const l = lineaDeNota(bloqueCliente({ name: 'Francisco Jiménez', phone: TEL, notes: NOTA_LARGA }));
  assert.ok(l, '🔴 SUELO: con una nota larga no sale la línea.');
  assert.equal(l.texto, NOTA_LARGA,
    '🔴 la nota se ha transformado por el camino. Se recorta sólo lo de los EXTREMOS: los saltos y ' +
      'los párrafos de dentro son del profesional y se pintan tal cual.');
  assert.equal(l.texto.split('\n').length, 6, '🔴 CONTROL del fixture: la nota de prueba debía tener 6 líneas');
});

test('SCRUM-982 · se recortan los EXTREMOS de la nota y nada más', () => {
  const l = lineaDeNota(bloqueCliente({ name: 'Ana', notes: '\n  Llamar al móvil.\n\nNo hay timbre. \n\n' }));
  assert.equal(l.texto, 'Llamar al móvil.\n\nNo hay timbre.');
});

test('SCRUM-982 · CONTROL NEGATIVO: sin nota, o sólo espacios, NO hay línea (nada de «—»)', () => {
  // Población declarada: 6 formas de «no hay nota».
  const vacias = [undefined, null, '', '   ', '\n\n', ' \t \n '];
  for (const notes of vacias) {
    const b = bloqueCliente({ name: 'Ana', phone: TEL, notes });
    assert.ok(b, `🔴 SUELO: con nombre y teléfono debería haber bloque CLIENTE (notes=${JSON.stringify(notes)})`);
    assert.equal(lineaDeNota(b), undefined,
      `🔴 se pinta una línea de nota con notes=${JSON.stringify(notes)}. Un «Nota del cliente» sin nota ` +
        'ocupa sitio para decir que no sabe.');
    assert.ok(!b.lineas.some((x) => x.etiqueta === ROTULO_FIRMADO), '🔴 aparece el rótulo sin nota');
  }
  // Y el bloque entero sigue sin existir cuando no hay NADA (regla del hueco de SCRUM-318).
  assert.equal(bloqueCliente({ name: '', phone: '', notes: '   ' }), null,
    '🔴 un cliente sin nombre, sin teléfono y con la nota en blanco produce un bloque vacío.');
});

test('SCRUM-982 · la nota NO desplaza lo de antes: nombre, teléfono y WhatsApp siguen en su orden', () => {
  const b = bloqueCliente({ name: 'Francisco Jiménez', phone: TEL, notes: 'Timbre roto' });
  assert.deepEqual(b.lineas.map((x) => x.texto),
    ['Francisco Jiménez', TEL, 'WhatsApp', 'Timbre roto'],
    '🔴 la nota cambió el orden o el contenido del bloque CLIENTE: va la ÚLTIMA, después de las acciones.');
  assert.ok(b.lineas[1].href.startsWith('tel:') && b.lineas[2].href.includes('wa.me'),
    '🔴 el teléfono o el WhatsApp han dejado de ser pulsables');
});

// ═══ ③ EL SERVIDOR: en el DETALLE, no en la lista ═══════════════════════════════════════

test('SCRUM-982 · 🔴 SUELO: los extractores VEN lo que tienen que ver', () => {
  const sf = fuenteTS(RUTA_JOBS);
  const lista = clavesDeCustomerSelect(sf);
  assert.ok(Array.isArray(lista), `🔴 CIEGO: no encuentro \`CUSTOMER_SELECT\` en ${RUTA_JOBS}.`);
  // Control positivo por nombre: las cuatro claves con las que nació (SCRUM-590), que la lista SÍ pinta.
  for (const k of ['id', 'name', 'phone', 'mobile']) {
    assert.ok(lista.includes(k), `🔴 CIEGO: el extractor no ve «${k}» en CUSTOMER_SELECT, y está.`);
  }
  const detalle = selectsDelClienteEnElDetalle(sf);
  assert.ok(Array.isArray(detalle), `🔴 CIEGO: no encuentro \`serializeJobDetail\` en ${RUTA_JOBS}.`);
  assert.ok(detalle.length >= 1, '🔴 CIEGO: `serializeJobDetail` no tiene ninguna consulta `prisma.customer.findUnique`.');
  // Control positivo: el detalle ya pedía `email` y `taxId` (SCRUM-575b) antes de este ticket.
  assert.ok(detalle.some((s) => s.includes('email') && s.includes('taxId')),
    '🔴 CIEGO: el extractor no ve `email` y `taxId` en la consulta del detalle, y estaban.');
});

test('SCRUM-982 · 🔴 `notes` viaja en el DETALLE y NO en CUSTOMER_SELECT (que alimenta la lista de 200 filas)', () => {
  const sf = fuenteTS(RUTA_JOBS);
  const detalle = selectsDelClienteEnElDetalle(sf);
  assert.ok(detalle.some((s) => s.includes('notes')),
    '🔴 la consulta del cliente en `serializeJobDetail` no pide `notes`: la ficha del Trabajo no puede ' +
      'enseñar una nota que el servidor no manda.');
  const lista = clavesDeCustomerSelect(sf);
  assert.ok(!lista.includes('notes'),
    '🔴 `notes` está en CUSTOMER_SELECT, que alimenta la LISTA (hasta 200 filas) y nada la pinta allí: ' +
      'texto libre viajando a cambio de nada, y una superficie más por la que puede salir.');
});

// ═══ ④ NINGUNA RUTA PÚBLICA LA EXPONE ════════════════════════════════════════════════════

test('SCRUM-982 · 🔴 el serializador del detalle NO se exporta y el router exporta sólo su `default`', () => {
  const sf = fuenteTS(RUTA_JOBS);
  const exps = exportacionesDe(sf);
  assert.deepEqual(exps, ['default'],
    '🔴 `jobs.routes.ts` exporta algo más que su router: ' + JSON.stringify(exps) + '. Si `serializeJobDetail` ' +
      '(o cualquier helper que lea el cliente) se exporta, otro módulo —una ruta pública, un portal— ' +
      'puede importarlo y devolver `Customer.notes` a quien no debe.');
  // El `default` es el router, no otra cosa.
  const asignacion = sf.statements.find(ts.isExportAssignment);
  assert.equal(asignacion.expression.getText(), 'router', '🔴 lo que se exporta por defecto no es `router`');
});

test('SCRUM-982 · 🔴 `serializeJobDetail` sólo se llama desde handlers de ESTE router', () => {
  const sf = fuenteTS(RUTA_JOBS);
  const llamadas = [];
  recorrer(sf, (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'serializeJobDetail') llamadas.push(n);
  });
  assert.ok(llamadas.length >= 1, '🔴 CIEGO: no encuentro ninguna llamada a `serializeJobDetail` (hoy hay una, en GET /:id).');
  for (const c of llamadas) {
    let p = c.parent; let ruta = null;
    while (p) {
      if (ts.isCallExpression(p) && /^router\.(get|post|put|patch|delete)$/.test(p.expression.getText())) { ruta = p; break; }
      p = p.parent;
    }
    assert.ok(ruta,
      '🔴 `serializeJobDetail` se llama FUERA de un handler de `router.<verbo>(…)`: en la línea ' +
        `${sf.getLineAndCharacterOfPosition(c.getStart()).line + 1}. Puede haber una salida que no pasa por /admin.`);
  }
});

test('SCRUM-982 · 🔴 ningún otro fichero de src/ importa el router de Trabajos, y `app.ts` lo monta SÓLO bajo /admin/jobs', () => {
  // ── quién importa jobs.routes (población declarada) ──
  const ficheros = ficherosDeSrc();
  assert.ok(ficheros.length > 100, `🔴 CIEGO: sólo veo ${ficheros.length} ficheros .ts en src/ (hay cientos).`);
  const importadores = [];
  for (const rel of ficheros) {
    const texto = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
    const importados = ts.preProcessFile(texto, true, true).importedFiles.map((f) => f.fileName);
    if (importados.some((f) => /(^|\/)jobs\.routes(\.[cm]?[jt]s)?$/.test(f))) importadores.push(rel);
  }
  assert.deepEqual(importadores, [RUTA_APP],
    `🔴 sobre ${ficheros.length} ficheros de src/, importan \`jobs.routes\`: ${JSON.stringify(importadores)}. ` +
      'Tiene que importarlo SÓLO `app.ts`, que es quien lo monta bajo /admin.');

  // ── cómo lo monta app.ts ──
  const app = fuenteTS(RUTA_APP);
  const usos = [];
  recorrer(app, (n) => {
    if (ts.isIdentifier(n) && n.text === 'jobsRouter' && !ts.isImportClause(n.parent)) usos.push(n);
  });
  assert.equal(usos.length, 1, `🔴 \`jobsRouter\` se usa ${usos.length} veces en app.ts; debe ser UNA: su montaje.`);
  const montaje = usos[0].parent;
  assert.ok(ts.isCallExpression(montaje) && montaje.expression.getText() === 'mountAdmin',
    '🔴 `jobsRouter` no se monta con `mountAdmin(...)`, sino con: ' + montaje.getText().slice(0, 80));
  const [, prefijo] = montaje.arguments;
  assert.ok(prefijo && ts.isStringLiteral(prefijo) && prefijo.text === '/admin/jobs',
    '🔴 el prefijo de montaje de `jobsRouter` no es exactamente `/admin/jobs`.');
  assert.equal(montaje.arguments[montaje.arguments.length - 1], usos[0], '🔴 `jobsRouter` no es el último argumento de `mountAdmin`');

  // ── y /admin exige sesión ANTES de ese montaje ──
  let auth = null;
  recorrer(app, (n) => {
    if (ts.isCallExpression(n) && n.expression.getText() === 'app.use'
        && n.arguments[0] && ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text === '/admin'
        && n.arguments[1] && n.arguments[1].getText() === 'requireAuth') auth = n;
  });
  assert.ok(auth, '🔴 CIEGO: no encuentro `app.use(\'/admin\', requireAuth)` en app.ts.');
  assert.ok(auth.getStart() < montaje.getStart(),
    '🔴 `app.use(\'/admin\', requireAuth)` va DESPUÉS del montaje de Trabajos: durante ese tramo /admin/jobs no pide sesión.');
});

// ═══ ⑤ EL DOM MONTADO: se pinta, entera, y sin marcado ══════════════════════════════════

const JOB = {
  id: 7, status: 'en_curso', createdAt: '2026-09-01T09:00:00Z', titulo: 'Revisión anual',
  asignados: [], operario: null, albaranes: [], gastos: [], notes: '', quote: { currency: 'EUR' },
  direccion: null, invoices: [], totalAceptado: 0, totalCobrado: 0,
};

async function montarDetalle(customer) {
  const banco = cargarDashboard(RAIZ);
  banco.ctx.apiRequest = async (u) => {
    if (/\/admin\/team/.test(u)) return [];
    if (/\/admin\/merchant/.test(u)) return { name: 'Epipe' };
    if (/\/admin\/partes/.test(u)) return { partes: [] };
    if (/gastos/.test(u)) return [];
    return { ...JOB, customer };
  };
  banco.ctx.appUserRole = 'admin';
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `🔴 SUELO: la vista no monta (${r.error && r.error.message}).`);
  return r;
}
const lineasDeNota = (r) => todos(r.contenedor)
  .filter((n) => String(n.className || '').split(/\s+/).includes('detail-rail-linea--nota'));

test('SCRUM-982 · 🔴 la ficha PINTA la nota entera, con su rótulo encima y sus saltos de línea', async () => {
  const r = await montarDetalle({ id: 3, name: 'Francisco Jiménez', phone: TEL, notes: NOTA_LARGA });
  // SUELO: el rail existe. Sin él, «0 líneas de nota» sería lo mismo que «la nota no se pinta».
  assert.ok(todos(r.contenedor).some((n) => n.dataset && n.dataset.bloque === 'cliente'),
    '🔴 SUELO: la ficha no pinta el bloque CLIENTE del rail, así que nada de lo de abajo mide nada.');
  const lineas = lineasDeNota(r);
  assert.equal(lineas.length, 1, `🔴 la ficha pinta ${lineas.length} líneas de nota; debe ser exactamente UNA.`);
  const [etiqueta, texto] = lineas[0].hijos;
  assert.equal(etiqueta.textContent, ROTULO_FIRMADO, '🔴 el rótulo pintado no es el firmado');
  assert.ok(String(etiqueta.className).split(/\s+/).includes('detail-rail-etiqueta'), '🔴 el rótulo no usa la etiqueta del rail');
  assert.equal(texto.textContent, NOTA_LARGA,
    '🔴 el texto pintado no es la nota tal cual: se ha recortado, resumido o partido. La nota se lee ENTERA.');
});

test('SCRUM-982 · 🔴 la nota entra por `textContent`: un marcado escrito en ella NO se convierte en nodos', async () => {
  const peligrosa = '<img src=x onerror=alert(1)> y <b>negrita</b>';
  const r = await montarDetalle({ id: 3, name: 'Ana', phone: TEL, notes: peligrosa });
  const [linea] = lineasDeNota(r);
  assert.ok(linea, '🔴 SUELO: con una nota con marcado no sale la línea.');
  const [, texto] = linea.hijos;
  assert.equal(texto.textContent, peligrosa, '🔴 el texto de la nota no se pinta literal');
  // 🔴 El control es la MISMA pantalla con una nota sin marcado: la ficha ya lleva sus propios <b>
  // (las cifras de la franja del dinero), así que buscar «hay un <b>» sobre toda la página es medir
  // otra cosa — lo mordió esta misma prueba en su primera versión. Se comparan los CENSOS de nodos.
  const control = await montarDetalle({ id: 3, name: 'Ana', phone: TEL, notes: 'nota normal sin marcado' });
  const censo = (raiz) => todos(raiz).map((n) => n.tagName).sort();
  assert.deepEqual(censo(linea), censo(lineasDeNota(control)[0]),
    '🔴 la línea de la nota con marcado tiene OTROS nodos que la misma línea con texto llano: el ' +
      'marcado escrito en la nota se ha interpretado. Texto libre que llega de fuera es texto, nunca HTML.');
  assert.deepEqual(censo(r.contenedor), censo(control.contenedor),
    '🔴 la ficha entera tiene nodos de más o de menos por culpa del marcado de la nota (¿un <img>?).');
  assert.ok(!todos(r.contenedor).some((n) => n.tagName === 'IMG'), '🔴 hay un <img> en la ficha: salió de la nota.');
});

test('SCRUM-982 · CONTROL NEGATIVO en pantalla: sin nota, ni línea ni rótulo', async () => {
  for (const notes of [null, '', '   ']) {
    const r = await montarDetalle({ id: 3, name: 'Ana', phone: TEL, notes });
    assert.ok(todos(r.contenedor).some((n) => n.dataset && n.dataset.bloque === 'cliente'),
      '🔴 SUELO: el bloque CLIENTE no se pinta (con nombre y teléfono debe).');
    assert.equal(lineasDeNota(r).length, 0, `🔴 con notes=${JSON.stringify(notes)} la ficha pinta una línea de nota`);
    assert.ok(!todos(r.contenedor).some((n) => String(n.textContent || '').trim() === ROTULO_FIRMADO),
      `🔴 con notes=${JSON.stringify(notes)} aparece el rótulo «${ROTULO_FIRMADO}» en pantalla`);
  }
});

// ═══ ⑥ EL CSS: la etiqueta encima y el texto entero (lo MIDE el navegador; aquí, que esté) ═══

test('SCRUM-982 · el CSS pone la etiqueta encima y deja el texto entero, sin un token nuevo', () => {
  const css = fs.readFileSync(path.join(RAIZ, RUTA_CSS), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const regla = (sel) => {
    const i = css.indexOf(`\n${sel} {`);
    if (i < 0) return null;
    return css.slice(i, css.indexOf('}', i) + 1);
  };
  const fila = regla('.detail-rail-linea--nota');
  assert.ok(fila, '🔴 no hay regla `.detail-rail-linea--nota`: la clase se pone y no hace nada, y la nota queda en una columna estrecha al lado del rótulo.');
  assert.match(fila, /flex-direction:\s*column/, '🔴 la etiqueta no va ENCIMA del texto');
  assert.match(fila, /align-items:\s*stretch/, '🔴 el texto no ocupa el ancho del rail');
  const texto = regla('.detail-rail-linea--nota span:not(.detail-rail-etiqueta)');
  assert.ok(texto, '🔴 no hay regla para el texto de la nota.');
  assert.match(texto, /white-space:\s*pre-line/, '🔴 los saltos de línea de la nota no se respetan en pantalla');
  assert.match(texto, /overflow-wrap:\s*anywhere/, '🔴 una palabra larga (una URL) ensancharía el rail a 360 px');
  // La nota se lee ENTERA: nada que la recorte.
  const toda = `${fila}\n${texto}`;
  assert.ok(!/(text-overflow|line-clamp|max-height|overflow:\s*hidden)/.test(toda),
    '🔴 la regla de la nota la recorta (ellipsis, clamp, altura máxima u overflow hidden). Se lee ENTERA.');
  // Ni un token nuevo: sólo valores que ya vivían en el resto del rail (nada de colores a mano).
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(toda), '🔴 hay un color escrito a mano en la regla de la nota; los colores salen de los tokens.');
});
