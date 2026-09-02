// tests/scrum575b-nif-cableado.test.mjs — SCRUM-575 (CONT-02) · el CABLEADO
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL VALIDADOR EXISTE Y ESTÁ PROBADO. LO QUE NO ESTABA SUJETO ES QUE ALGUIEN LO LLAME.
//
// `tests/scrum575-nif-espanol.test.mjs` prueba la ARITMÉTICA —corpus con válidos e inválidos,
// las dos copias coincidiendo, barrido amplio— y lo hace bien. Este fichero prueba otra cosa:
// que el validador esté **CABLEADO** en cada eslabón. Son preguntas distintas y se pierden por
// separado.
//
// 🔴 MEDIDO EL 2-sep-2026, ANTES de escribir esto, rompiendo cada eslabón sobre la tanda COMPLETA:
//
//     se quita el `.refine()` del ESQUEMA ....... 4638 tests · el ÚNICO fallo es el de
//                                                 SCRUM-655b, que ya venía roto de `main`.
//                                                 O sea: NADIE LO CAZA.
//     se apaga el aviso del CLIENTE ............. idéntico. NADIE LO CAZA.
//
// Dos mediciones, el mismo resultado: el servidor podía dejar de validar el NIF y la tanda
// entera seguía diciendo que todo va bien. «Mencionar no es hacer» — que `validarNifEspanol`
// exista y esté probadísimo no prueba que alguien lo invoque.
//
// LA VÍCTIMA no es de hoy y por eso el ticket tiene fecha de caducidad, no urgencia: con
// `INVOICING_ES_ENABLED` en OFF un NIF mal formado no duele. El día que se encienda, ese dato
// vuelve como RECHAZO DE REGISTRO con la factura ya emitida detrás (runbook R7), y una factura
// emitida no se edita ni se borra (regla 29). Comprobar la aritmética ahora es gratis.
//
//   ① se ESCRIBE ........... el campo y su aviso se montan        (banco de vistas, EJECUTADO)
//   ② se VALIDA en CLIENTE . el aviso se enciende y se apaga      (EJECUTADO sobre el DOM)
//   ③ se ENVÍA ............. `taxId` viaja en el payload          (fuente)
//   ④ se VALIDA en SERVIDOR  `customerCreateSchema` lo rechaza    (EJECUTADO)
//   ⑤ se GUARDA y se RELEE . `taxId` en el `select` explícito     (AST, con su rojo)
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
const ts = require_('typescript');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

const VISTA = 'public/dashboard/js/customersView.js';
const SERVICIO = 'src/modules/system/customerAdmin.ts';

const { customerCreateSchema } = await import('../dist/core/validation/schemas.js');

/**
 * EL TEXTO DEL AVISO, LITERAL. Provisional del asesor, pendiente de confirmación del fundador
 * (regla 30). Se compara con `===` a propósito: un retoque «de paso» reabriría un texto que el
 * profesional ya está viendo en pantalla.
 *
 * ⚠️ VA SIN MARCADOR y eso es deliberado: hasta este ticket el aviso pintaba
 * «[PENDIENTE microcopy oficial]» EN PRODUCCIÓN. Desde que se despliega al mergear, un marcador
 * no es una nota interna.
 */
const AVISO_ESPERADO = 'Ese NIF/CIF no es válido. Compruébalo.';

/**
 * 🔴 EL CONTROL POSITIVO, Y ES EL QUE IMPORTA: identificadores VÁLIDOS de las tres formas.
 *
 * Un validador que rechaza TODO pasa cualquier batería de rechazos. Sin esta lista, «rechaza los
 * malos» no distinguiría un validador correcto de uno roto que dice que no a todo — y el
 * profesional se quedaría sin poder guardar su propio NIF.
 *
 * ⚠️ SALEN DEL CORPUS YA FIJADO en `scrum575-nif-espanol.test.mjs`, no de mi cabeza — y no es
 * pedantería: la primera versión de esta lista llevaba `Z2345678S` y `K1234567L` **inventados
 * por mí**, y los dos tenían el control mal. El test cayó y tenía razón. Tampoco se generan
 * ejecutando el validador que se está probando: un corpus derivado del código bajo prueba diría
 * que sí a cualquier cosa que ese código acepte, incluido un error.
 */
const VALIDOS = Object.freeze([
  ['12345678Z', 'DNI'],
  ['00000000T', 'DNI'],
  ['X1234567L', 'NIE'],
  ['Y1234567X', 'NIE'],
  ['Z1234567R', 'NIE'],
  ['A58818501', 'CIF con dígito de control'],
  ['B12345674', 'CIF con dígito de control'],
  ['P1234567D', 'CIF con letra de control'],
]);

/** Mal formados de verdad: la forma es plausible y el control NO cuadra. */
const INVALIDOS = Object.freeze(['12345678A', 'X1234567A', 'A58818500', 'P1234567A', 'ABCDEFGHI']);

async function modalDeCliente() {
  const banco = cargarDashboard(RAIZ, { datos: {} });
  // El banco no implementa `form.reset()` y `openModal` lo llama. Se le añade un no-op DESDE
  // AQUÍ, sin tocar `tests/_banco-vistas.mjs` (S2). Ver la misma nota en `scrum579`.
  const crear = banco.ctx.document.createElement;
  banco.ctx.document.createElement = function (tag) {
    const n = crear.call(this, tag);
    if (String(tag).toLowerCase() === 'form' && typeof n.reset !== 'function') n.reset = function () {};
    return n;
  };
  const r = await pintarVista(banco, 'renderCustomersView');
  assert.equal(r.error, null, `🔴 la pantalla de clientes revienta: ${r.error && r.error.message}`);
  const btn = todos(r.contenedor).find((n) => String(n._texto || '').includes('Nuevo cliente'));
  assert.ok(btn, '🔴 SUELO: no encuentro el botón que abre el modal.');
  btn.disparar('click');
  const body = banco.ctx.document.body;
  return {
    body,
    campo: todos(body).find((n) => n.name === 'taxId'),
    aviso: todos(body).find((n) => String(n.className || '').includes('aviso-nif')),
  };
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · el control positivo del propio corpus
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-575b · SUELO: el corpus de VÁLIDOS no está vacío y el validador los ACEPTA', async () => {
  const { validarNifEspanol } = await import('../dist/core/validation/nifEspanol.js');

  assert.ok(VALIDOS.length >= 8,
    `🔴 sólo ${VALIDOS.length} identificadores válidos: un censo de válidos que se vacía deja de `
    + 'distinguir un validador correcto de uno que dice que NO a todo.');

  const rechazados = VALIDOS.filter(([v]) => !validarNifEspanol(v).valido);
  assert.deepEqual(rechazados.map(([v, q]) => `${v} (${q})`), [],
    '🔴 EL VALIDADOR RECHAZA IDENTIFICADORES BUENOS. El profesional no podría guardar su propio '
    + 'NIF, y un validador que dice que no a todo pasa cualquier prueba de rechazo.');

  // Y la contraria, para que el corpus no sea una lista de cosas que aceptaría cualquiera.
  const colados = INVALIDOS.filter((v) => validarNifEspanol(v).valido);
  assert.deepEqual(colados, [], '🔴 se cuelan identificadores con el dígito de control mal.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ESLABÓN ① y ② · SE ESCRIBE Y EL CLIENTE AVISA — sobre el DOM de verdad
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-575b · 🔴 ① el campo NIF/CIF y su aviso SE MONTAN', async () => {
  const { campo, aviso } = await modalDeCliente();
  assert.ok(campo, '🔴 el modal no pinta el campo `taxId`.');
  assert.ok(aviso, '🔴 el modal no pinta el aviso de NIF: el profesional no vería nunca el error.');
  assert.equal(aviso.hidden, true, '🔴 el aviso nace ENCENDIDO: acusaría antes de escribir nada.');
});

test('SCRUM-575b · 🔴 EL TEXTO DEL AVISO, LITERAL Y SIN MARCADOR (regla 30)', async () => {
  const { aviso } = await modalDeCliente();
  assert.equal(aviso._texto, AVISO_ESPERADO,
    `🔴 el aviso dice «${aviso._texto}» y el texto del asesor es «${AVISO_ESPERADO}».`);
  assert.equal(/PENDIENTE|\[.*\]/.test(String(aviso._texto)), false,
    '🔴 el aviso volvió a llevar un MARCADOR. Producción despliega al mergear: eso lo ve un '
    + 'profesional en su pantalla, no es una nota interna.');
});

test('SCRUM-575b · 🔴 ② EL CLIENTE AVISA: se enciende con uno malo y se apaga con uno bueno', async () => {
  const { campo, aviso } = await modalDeCliente();

  // Uno MALO: el aviso aparece. Es el eslabón que se midió suelto — apagarlo no lo cazaba nadie.
  campo.value = '12345678A';
  campo.disparar('blur');
  assert.equal(aviso.hidden, false,
    '🔴 con un NIF mal formado el aviso NO aparece: el cliente no está llamando al validador.');

  // Uno BUENO: se apaga. Sin esto, un aviso clavado en «encendido» pasaría el caso de arriba.
  campo.value = '12345678Z';
  campo.disparar('blur');
  assert.equal(aviso.hidden, true,
    '🔴 con un NIF correcto el aviso SIGUE encendido: acusa a quien lo ha escrito bien.');

  // 🔴 Y EL VACÍO NO ACUSA. Validar no es obligar: el campo es opcional.
  campo.value = '';
  campo.disparar('blur');
  assert.equal(aviso.hidden, true,
    '🔴 el campo VACÍO enciende el aviso: eso convierte un campo opcional en obligatorio sin que '
    + 'nadie lo haya decidido.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ESLABÓN ③ · SE ENVÍA
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-575b · ③ `taxId` viaja en el payload', () => {
  assert.match(leer(VISTA), /taxId: fieldTaxId\.input\.value\.trim\(\) \|\| null,/,
    '🔴 el payload ya no manda `taxId`: el servidor no tendría nada que validar.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ESLABÓN ④ · EL SERVIDOR ES EL QUE MANDA — ejecutado
// ═════════════════════════════════════════════════════════════════════════════════════════
const CLIENTE = (extra = {}) => ({ name: 'Fontanería QA', ...extra });

test('SCRUM-575b · 🔴 ④ EL SERVIDOR RECHAZA lo mal formado (y el cliente no es la defensa)', () => {
  // El defecto de CONT-05 demostró EN ESTA MISMA PANTALLA que una regla que sólo vive en el
  // formulario no se cumple: el rótulo pedía «E.164 sin +» y se guardaron dos formatos el mismo
  // día. El cliente avisa antes; el servidor es el que manda.
  for (const malo of INVALIDOS) {
    assert.throws(() => customerCreateSchema.parse(CLIENTE({ taxId: malo })),
      `🔴 el servidor ACEPTA «${malo}», que tiene el control mal. Con el flag fiscal encendido `
      + 'eso vuelve como rechazo de registro con la factura ya emitida detrás (runbook R7).');
  }
});

test('SCRUM-575b · 🔴 ④ EL CONTROL POSITIVO EN LA PUERTA: los buenos PASAN', () => {
  // Sin esto, el caso de arriba lo aprobaría un esquema que rechazara cualquier `taxId`.
  for (const [bueno, que] of VALIDOS) {
    const r = customerCreateSchema.parse(CLIENTE({ taxId: bueno }));
    assert.equal(r.taxId, bueno, `🔴 la puerta rechaza «${bueno}» (${que}), que es válido.`);
  }
});

test('SCRUM-575b · 🔴 ④ VALIDAR NO ES OBLIGAR: el vacío CRUZA la puerta', () => {
  // El control negativo que más importa del ticket: convertir un campo opcional en obligatorio
  // sería cambiar el producto sin que nadie lo decidiera, y es el modo de fallo más fácil de
  // introducir sin querer al añadir una validación.
  for (const vacio of [undefined, null, '']) {
    assert.doesNotThrow(() => customerCreateSchema.parse(CLIENTE(vacio === undefined ? {} : { taxId: vacio })),
      `🔴 con taxId = ${JSON.stringify(vacio)} la puerta se queja: el campo es OPCIONAL.`);
  }
});

test('SCRUM-575b · ④ se valida la FORMA, no la EXISTENCIA', () => {
  // `A58818501` está bien construido. Que el esquema lo acepte NO dice que esa empresa exista, y
  // este caso está para que nadie lea el verde de arriba como si lo dijera.
  assert.equal(customerCreateSchema.parse(CLIENTE({ taxId: 'A58818501' })).taxId, 'A58818501');
  assert.equal(leer('src/core/validation/nifEspanol.ts').includes('fetch('), false,
    '🔴 el validador hace una petición de red: esto valida FORMA, no existencia (regla del ticket).');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ESLABÓN ⑤ · SE GUARDA Y SE RELEE
// ═════════════════════════════════════════════════════════════════════════════════════════
/** Las claves de `CUSTOMER_SELECT_NO_TOKEN`, por AST (no se exporta). */
function clavesDelSelect(fuente) {
  const sf = ts.createSourceFile('customerAdmin.ts', fuente, ts.ScriptTarget.Latest, true);
  let claves = null;
  const recorrer = (n, fn) => { fn(n); n.forEachChild((h) => recorrer(h, fn)); };
  recorrer(sf, (n) => {
    if (claves || !ts.isVariableDeclaration(n)) return;
    if (!ts.isIdentifier(n.name) || n.name.text !== 'CUSTOMER_SELECT_NO_TOKEN') return;
    let obj = n.initializer;
    if (obj && ts.isAsExpression(obj)) obj = obj.expression;
    if (!obj || !ts.isObjectLiteralExpression(obj)) return;
    claves = obj.properties.map((p) => (p.name && ts.isIdentifier(p.name) ? p.name.text : null)).filter(Boolean);
  });
  return claves;
}

test('SCRUM-575b · 🔴 ⑤ `taxId` se RELEE: si no, el profesional lo reescribiría cada vez', () => {
  const fuente = leer(SERVICIO);
  const claves = clavesDelSelect(fuente);
  assert.ok(Array.isArray(claves) && claves.length >= 10,
    `🔴 ESCÁNER CIEGO sobre el select: veo ${claves ? claves.length : 0} claves.`);
  assert.ok(claves.includes('taxId'),
    '🔴 `taxId` no está en el `select` explícito: se guardaría y no se devolvería, y la ficha '
    + 'volvería vacía sin que nada fallara.');

  // 🔴 EL ROJO POR EL MECANISMO, sobre una copia EN MEMORIA.
  const mutilada = fuente.replace('taxId: true,', '');
  assert.notEqual(mutilada, fuente, '🔴 la mutación no ha tocado el fuente: no prueba nada.');
  assert.equal(clavesDelSelect(mutilada).includes('taxId'), false,
    '🔴 DETECTOR TAUTOLÓGICO: sigue diciendo que sí con la clave quitada.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL VIAJE ENTERO Y EL CONTROL NEGATIVO
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-575b · 🔴 EL VIAJE ENTERO de un NIF bueno, y el corte de uno malo', () => {
  // Bueno: cruza la puerta, sobrevive al viaje de ida y vuelta y está en el select que lo devuelve.
  const validado = customerCreateSchema.parse(CLIENTE({ taxId: 'B12345674' }));
  const releido = JSON.parse(JSON.stringify(validado));
  assert.equal(releido.taxId, 'B12345674', '🔴 el NIF se pierde en el viaje.');
  assert.ok(clavesDelSelect(leer(SERVICIO)).includes('taxId'),
    '🔴 sobrevive hasta la base pero no se relee.');

  // Malo: NO llega. El corte está en la puerta, no en la pantalla.
  assert.throws(() => customerCreateSchema.parse(CLIENTE({ taxId: 'B12345670' })),
    '🔴 un NIF con el control mal ha completado el viaje entero.');
});

test('SCRUM-575b · 🔴 CONTROL NEGATIVO: tocar otro campo del cliente NO tumba esto', () => {
  // Si el guard se quejara de un cambio legítimo en otra parte de la ficha, alguien lo
  // desactivaría — y entonces tampoco protegería el NIF, que es lo suyo.
  const fuente = leer(SERVICIO);
  const sinRecargo = fuente.replace('  recargoEquivalencia: true,', '');
  assert.notEqual(sinRecargo, fuente, '🔴 la mutación no ha tocado el fuente.');
  assert.ok(clavesDelSelect(sinRecargo).includes('taxId'),
    '🔴 el detector del NIF se queja de que se toque `recargoEquivalencia`, que no es lo suyo.');

  // Y el esquema sigue aceptando un cliente sin NIF pero con otros campos tocados.
  assert.doesNotThrow(() => customerCreateSchema.parse(CLIENTE({ recargoEquivalencia: true })));
});
