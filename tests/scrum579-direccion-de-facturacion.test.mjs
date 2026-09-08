// tests/scrum579-direccion-de-facturacion.test.mjs — SCRUM-579 (CONT-06)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA DIRECCIÓN DE FACTURACIÓN LLEGA HASTA LA BASE Y VUELVE. CINCO ESLABONES, CADA UNO EJECUTADO.
//
// LA VÍCTIMA tiene dos caras. Hoy —hasta este ticket— NO había dirección NINGUNA en el formulario
// de cliente: un fontanero no podía guardar dónde le factura a su cliente. Y la segunda es
// fiscal: post-SIF el domicilio del destinatario es DATO DE FACTURA. Hoy no duele porque
// `INVOICING_ES_ENABLED` está OFF; el día que se encienda, duele en producción y con documentos
// emitidos detrás.
//
// 🔴 POR QUÉ CINCO ESLABONES Y NO «existe la columna»: que la columna exista NO prueba que el
// formulario la mande, y que el formulario la mande NO prueba que se guarde, y que se guarde NO
// prueba que se relea. El eslabón que más fácil se pierde está medido y nombrado abajo: es
// `CUSTOMER_SELECT_NO_TOKEN`, un `select` EXPLÍCITO. Sin las cinco claves ahí, el alta las
// guarda y NO las devuelve — y la tanda seguiría VERDE, porque el dato sí está en la base.
// El defecto sería MUDO.
//
//   ① se ESCRIBE ..... el modal las pinta                    (banco de vistas, EJECUTADO)
//   ② se ENVÍA ....... `direccionParaPayload` + su uso       (EJECUTADA)
//   ③ se VALIDA ...... `customerCreateSchema`                (EJECUTADO)
//   ④ se GUARDA ...... el servicio pasa los datos            (AST)
//   ⑤ se RELEE ....... `CUSTOMER_SELECT_NO_TOKEN`            (AST, con su rojo)
//
// ⛔ UNA dirección, no dos. Ésta es la de FACTURACIÓN; la de la OBRA pertenece al DOCUMENTO
// (DOC-12, decisión del fundador P2 24-ago-2026). Aquí no se vigila ninguna dirección de obra.
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

/** Las cinco, con su clave de payload y su nombre FÍSICO en `customers`. */
const CAMPOS = Object.freeze([
  { clave: 'billingAddress', fisico: 'billing_address', rotulo: 'Dirección' },
  { clave: 'billingCity', fisico: 'billing_city', rotulo: 'Población' },
  { clave: 'billingPostalCode', fisico: 'billing_postal_code', rotulo: 'Código postal' },
  { clave: 'billingProvince', fisico: 'billing_province', rotulo: 'Provincia' },
  { clave: 'billingCountry', fisico: 'billing_country', rotulo: 'País' },
]);

/** Extrae una función de la vista y la devuelve EJECUTABLE (mismo método que SCRUM-598/661). */
function funcionDeLaVista(nombre) {
  const src = leer(VISTA);
  const i = src.indexOf(`function ${nombre}(`);
  assert.ok(i > 0, `🔴 no encuentro \`${nombre}\` en \`${VISTA}\`.`);
  const sf = ts.createSourceFile('x.js', src.slice(i), ts.ScriptTarget.Latest, true);
  const fn = sf.statements[0];
  assert.ok(ts.isFunctionDeclaration(fn), `🔴 lo que hay en \`${nombre}\` no es una función.`);
  // eslint-disable-next-line no-new-func
  return new Function(`${fn.getText(sf)}; return ${nombre};`)();
}

/**
 * Las claves de `CUSTOMER_SELECT_NO_TOKEN`, por AST.
 *
 * No se importa porque NO se exporta —es un `const` de módulo—, así que se lee del árbol. Un
 * comentario no es un nodo, y eso descarta por construcción el falso verde de encontrar el
 * nombre dentro de la prosa que lo explica.
 */
function clavesDelSelect(fuente) {
  const sf = ts.createSourceFile('customerAdmin.ts', fuente, ts.ScriptTarget.Latest, true);
  let claves = null;
  const recorrer = (n, fn) => { fn(n); n.forEachChild((h) => recorrer(h, fn)); };
  recorrer(sf, (n) => {
    if (claves || !ts.isVariableDeclaration(n)) return;
    if (!ts.isIdentifier(n.name) || n.name.text !== 'CUSTOMER_SELECT_NO_TOKEN') return;
    let obj = n.initializer;
    if (obj && ts.isAsExpression(obj)) obj = obj.expression; // `{...} as const`
    if (!obj || !ts.isObjectLiteralExpression(obj)) return;
    claves = obj.properties
      .map((p) => (p.name && ts.isIdentifier(p.name) ? p.name.text : null))
      .filter(Boolean);
  });
  return claves;
}

/** La pantalla de clientes, con el modal ABIERTO. */
async function modalDeCliente() {
  const banco = cargarDashboard(RAIZ, { datos: {} });
  // ⚠️ EL BANCO NO IMPLEMENTA `form.reset()`, y `openModal` lo llama: sin esto la vista revienta
  // y «no encuentro el campo» se confundiría con «no se monta». Se le añade un no-op DESDE AQUÍ,
  // sin tocar `tests/_banco-vistas.mjs` (es de S2, SCRUM-667). No altera lo que se mide: el
  // formulario se acaba de crear y está vacío, y España se preselecciona DESPUÉS del reset.
  const crear = banco.ctx.document.createElement;
  banco.ctx.document.createElement = function (tag) {
    const n = crear.call(this, tag);
    if (String(tag).toLowerCase() === 'form' && typeof n.reset !== 'function') n.reset = function () {};
    return n;
  };

  const r = await pintarVista(banco, 'renderCustomersView');
  assert.equal(r.error, null, `🔴 la pantalla de clientes revienta: ${r.error && r.error.message}`);

  const btn = todos(r.contenedor).find((n) => String(n._texto || '').includes('Nuevo cliente'));
  assert.ok(btn, '🔴 SUELO: no encuentro el botón que abre el modal — sin pulsarlo, el formulario '
    + 'no está en el DOM y «no existe el campo» sería un falso hallazgo.');
  btn.disparar('click');

  return { banco, body: banco.ctx.document.body };
}

const campoPorNombre = (body, nombre) => todos(body).find((n) => n.name === nombre);

// ═════════════════════════════════════════════════════════════════════════════════════════
// ESLABÓN ① · SE ESCRIBE — la pantalla se pinta de verdad
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-579 · SUELO: el modal de cliente se monta y el escáner lo ve', async () => {
  const { body } = await modalDeCliente();
  const controles = todos(body).filter((n) => n.name);
  assert.ok(controles.length >= 8,
    `🔴 ESCÁNER CIEGO: sólo veo ${controles.length} controles con nombre en el modal. Un cero aquí `
    + 'y «faltan los campos» son el mismo resultado con significados opuestos.');
});

test('SCRUM-579 · 🔴 ① LOS CINCO CAMPOS SE MONTAN, y el rojo dice CUÁL falta', async () => {
  const { body } = await modalDeCliente();
  const faltan = CAMPOS.filter((c) => !campoPorNombre(body, c.clave)).map((c) => c.clave);
  assert.deepEqual(faltan, [],
    `🔴 el formulario de cliente NO pinta: ${faltan.join(', ')}.\n`
    + '  Sin el campo, el profesional no puede escribir dónde factura a su cliente — que es la\n'
    + '  víctima de este ticket— y post-SIF ese domicilio es dato de factura.');
});

test('SCRUM-579 · 🔴 ① LOS RÓTULOS APROBADOS, LITERALES (regla 30)', async () => {
  // Los aprobó el fundador el 2-sep-2026 y están en `docs/MICROCOPY_APROBADA_SIN_APLICAR.md`.
  // Se comparan con `===` a propósito: un retoque «de paso» —abreviar «CP», añadir un
  // paréntesis— reabre una aprobación sin que nadie se entere. La propuesta de este carril era
  // «Dirección (calle y número)» y NO es la aprobada: es «Dirección» A SECAS.
  const { body } = await modalDeCliente();
  for (const c of CAMPOS) {
    const campo = campoPorNombre(body, c.clave);
    assert.ok(campo, `🔴 SUELO: falta el campo ${c.clave}, no puedo leer su rótulo.`);
    const etiqueta = todos(campo._padre).find((n) => n.tagName === 'LABEL');
    assert.ok(etiqueta, `🔴 el campo ${c.clave} no tiene etiqueta.`);
    assert.equal(etiqueta._texto, c.rotulo,
      `🔴 el rótulo de ${c.clave} dice «${etiqueta._texto}» y el aprobado es «${c.rotulo}». `
      + 'No se abrevia, no se reordena y no lleva paréntesis (regla 30).');
  }
});

test('SCRUM-579 · 🔴 ① EL PAÍS: selector reusado, España por defecto y «no consta» posible', async () => {
  const { body } = await modalDeCliente();
  const pais = campoPorNombre(body, 'billingCountry');
  assert.equal(pais.tagName, 'SELECT', '🔴 el país no es un selector.');

  // Reusa `prefijosPais.js` (SCRUM-578): ~200 países por CERO bytes de datos nuevos, porque el
  // nombre lo pone `Intl.DisplayNames` y no viaja en el fichero. Ninguna librería (regla 36).
  assert.ok(pais.hijos.length > 100,
    `🔴 el selector de país sólo tiene ${pais.hijos.length} opciones: no está reusando la lista.`);

  // España PRESELECCIONADA — en el FORMULARIO, que es donde se decidió. La columna es nullable y
  // sin DEFAULT: un default habría declarado por el profesional que sus clientes son españoles.
  assert.equal(pais.value, 'ES', '🔴 el alta no nace con España preseleccionada.');

  // Y se puede volver a «no consta»: sin la opción vacía, elegir un país sería irreversible.
  const vacia = pais.hijos.find((o) => o.value === '');
  assert.ok(vacia, '🔴 el selector no deja volver a «no consta»: falta la opción vacía.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ESLABÓN ② · SE ENVÍA — y aquí se decide «ausente ≠ vacío»
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-579 · 🔴 ② AUSENTE ≠ VACÍO: lo vacío viaja como `null`, NUNCA como `""`', () => {
  const paraPayload = funcionDeLaVista('direccionParaPayload');

  // Lo declarado viaja tal cual, recortado.
  assert.equal(paraPayload('Calle Mayor 3'), 'Calle Mayor 3');
  assert.equal(paraPayload('  Calle Mayor 3  '), 'Calle Mayor 3');
  assert.equal(paraPayload('ES'), 'ES');

  // 🔴 LA MITAD QUE DECIDE. `""` sería un TERCER estado que no significa nada y que nadie ha
  // declarado: con él, un cliente sin dirección y otro «con la dirección en blanco» quedarían
  // indistinguibles para cualquier lectura útil —un `IS NOT NULL` diría que el segundo TIENE
  // dirección— y el dato dejaría de servir para saber a quién le falta el domicilio.
  for (const vacio of ['', '   ', '\t', null, undefined]) {
    assert.equal(paraPayload(vacio), null,
      `🔴 con ${JSON.stringify(vacio)} ha viajado algo que no es \`null\`. «No consta» y «en `
      + 'blanco» tienen que llegar iguales a la base, y ese valor es `null`.');
  }
});

test('SCRUM-579 · ② MENCIONAR NO ES HACER: el payload USA la regla, en los cinco', () => {
  // Que `direccionParaPayload` exista no prueba que nadie la llame. Sin esto, los casos de
  // arriba seguirían verdes con el formulario mandando `.value` en crudo — y entonces un campo
  // vacío llegaría como `""` y toda la distinción de arriba sería decorativa.
  const src = leer(VISTA);
  for (const c of CAMPOS) {
    assert.ok(src.includes(`${c.clave}: direccionParaPayload(`),
      `🔴 el payload no pasa \`${c.clave}\` por \`direccionParaPayload\`.`);
  }
  const usos = src.split('direccionParaPayload(').length - 1;
  assert.equal(usos, 6,
    `🔴 \`direccionParaPayload\` se usa ${usos} veces (se esperan 6: su declaración y los cinco `
    + 'campos del payload).');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ESLABÓN ③ · SE VALIDA — ejecutado de verdad
// ═════════════════════════════════════════════════════════════════════════════════════════
const CLIENTE = (extra = {}) => ({ name: 'Fontanería QA', ...extra });

test('SCRUM-579 · ③ el esquema DEJA PASAR las cinco — y sigue borrando lo que NO declara', () => {
  const dir = {
    billingAddress: 'Calle Mayor 3', billingCity: 'Cuenca', billingPostalCode: '16001',
    billingProvince: 'Cuenca', billingCountry: 'ES',
  };
  const r = customerCreateSchema.parse(CLIENTE(dir));
  for (const c of CAMPOS) {
    assert.equal(r[c.clave], dir[c.clave],
      `🔴 el esquema BORRA \`${c.clave}\`: \`z.object\` quita las claves que no declara, así que `
      + 'el campo llegaría hasta la puerta y moriría ahí, en silencio.');
  }

  // 🔴 EL CONTROL QUE DA VALOR AL DE ARRIBA: pasan porque están DECLARADAS, no porque zod deje
  // pasar cualquier cosa. Sin esto, el verde anterior no distinguiría las dos causas.
  const r2 = customerCreateSchema.parse(CLIENTE({ campoQueNadieHaDeclarado: 'x' }));
  assert.equal('campoQueNadieHaDeclarado' in r2, false,
    '🔴 el esquema NO está borrando lo desconocido: entonces el caso de arriba no prueba que las '
    + 'cinco estén declaradas, sólo que zod es permisivo.');
});

test('SCRUM-579 · 🔴 ③ `null` CRUZA LA PUERTA, y ausente sigue ausente', () => {
  // Es «ausente ≠ vacío» en el sitio donde se podría perder sin que se note: un `.default("")`
  // convertiría el silencio en un dato, y el dato sería falso.
  const r = customerCreateSchema.parse(CLIENTE({ billingAddress: null }));
  assert.equal(r.billingAddress, null, '🔴 un `null` explícito no ha cruzado la puerta.');

  const sin = customerCreateSchema.parse(CLIENTE());
  for (const c of CAMPOS) {
    assert.equal(c.clave in sin, false,
      `🔴 un cliente SIN dirección ha salido del esquema CON la clave \`${c.clave}\`.`);
  }
});

test('SCRUM-579 · ③ el país es ISO de dos letras, no un nombre traducido', () => {
  // Guardar «España» sería guardar una TRADUCCIÓN: el mismo cliente se llamaría «España» o
  // «Spain» según quién lo diera de alta. El resto del sistema ya usa ISO (`Merchant.country`
  // = `ES`, medido) y el nombre lo pone el navegador.
  assert.equal(customerCreateSchema.parse(CLIENTE({ billingCountry: 'FR' })).billingCountry, 'FR');
  assert.throws(() => customerCreateSchema.parse(CLIENTE({ billingCountry: 'España' })),
    '🔴 el esquema acepta un nombre de país donde espera un ISO de dos letras.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ESLABONES ④ y ⑤ · SE GUARDA Y SE RELEE — el que más fácil se pierde
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SCRUM-580 (2-sep-2026) · ESTE GUARD PIDIÓ QUE SE MIDIERA LA CADENA, Y SE MIDIÓ.
//
// Decía literalmente: «hay que volver a medir la cadena, porque un filtro por el medio se comería
// la dirección sin que nadie lo viera». CONT-07 metió un segundo normalizador
// (`normalizarEtiquetas`) y el guard cayó — hizo exactamente su trabajo.
//
// Lo que se midió: **ninguno de los dos filtra**. Los dos devuelven `{ ...data, campo }`, así que
// la propiedad que este guard protege sigue en pie.
//
// ⚠️ Y NO SE RELAJA: se cambia una cadena LITERAL por la PROPIEDAD que de verdad importa, que es
// más fuerte. Antes vigilaba una llamada exacta —y habría dado verde a un `normalizarIdentificadores`
// reescrito para filtrar, mientras cae con un normalizador nuevo que NO filtra: las dos respuestas
// al revés—. Ahora vigila que el alta ESPARZA los datos validados y que **ningún** eslabón de la
// cadena escoja campos a mano. Eso vale con o sin CONT-07 delante.
test('SCRUM-579 · ④ lo validado es lo que se ESCRIBE (el alta no filtra por su cuenta)', () => {
  const src = leer(SERVICIO);

  // ① El alta escribe un SPREAD de la cadena de normalizadores, no un objeto escogido a mano.
  const alta = src.slice(src.indexOf('export async function createCustomer'), src.indexOf('export async function ensurePortalToken'));
  assert.ok(alta.length > 50, '🔴 CIEGO: no encuentro el alta; lo de abajo no probaría nada.');
  assert.match(alta, /data: \{ \.\.\.normalizar[A-Za-z]*\([\s\S]*?\bdata\)[\s\S]*?, merchantId, portalToken: generatePortalToken\(\) \}/,
    '🔴 el alta ya no escribe los datos validados tal cual: un filtro por el medio se comería la '
    + 'dirección —o las etiquetas— sin que nadie lo viera.');

  // ② Y NINGÚN eslabón de la cadena filtra: todos devuelven `{ ...data, … }`.
  const normalizadores = [...src.matchAll(/function (normalizar[A-Za-z]*)<[^>]*>\([^)]*\)[^{]*\{([\s\S]*?)\n\}/g)];
  // SUELO: si el detector no encuentra normalizadores, «ninguno filtra» sería «no supe mirar».
  assert.ok(normalizadores.length >= 1,
    `🔴 ESCÁNER CIEGO: veo ${normalizadores.length} normalizadores en la cadena del alta.`);
  for (const m of normalizadores) {
    assert.match(m[2], /\.\.\.data/,
      `🔴 \`${m[1]}\` NO esparce \`...data\`: está escogiendo campos a mano, y lo que no escoja se `
      + 'pierde en silencio entre lo validado y lo que se guarda.');
  }
});

test('SCRUM-579 · 🔴 ⑤ EL ESLABÓN MUDO: las cinco están en `CUSTOMER_SELECT_NO_TOKEN`', () => {
  const fuente = leer(SERVICIO);
  const claves = clavesDelSelect(fuente);

  // SUELO: sin población no hay veredicto. Si el AST no encuentra el objeto, «faltan las cinco»
  // se leería igual que «no supe mirar», y son la noticia contraria.
  assert.ok(Array.isArray(claves) && claves.length >= 10,
    `🔴 ESCÁNER CIEGO sobre \`CUSTOMER_SELECT_NO_TOKEN\`: veo ${claves ? claves.length : 0} claves.`);

  const faltan = CAMPOS.filter((c) => !claves.includes(c.clave)).map((c) => c.clave);
  assert.deepEqual(faltan, [],
    `🔴 EL DEFECTO MUDO: faltan en el \`select\` explícito: ${faltan.join(', ')}.\n`
    + '  El alta las GUARDARÍA y no las devolvería: la pantalla se recargaría vacía y el\n'
    + '  profesional volvería a escribir la dirección. Y la tanda seguiría VERDE, porque el dato\n'
    + '  SÍ está en la base. Éste es el eslabón que decide si el ticket queda alcanzable.');

  // 🔴 EL ROJO POR EL MECANISMO: se quita una del fuente EN MEMORIA y el detector cambia de
  // respuesta. Un detector que no sabe decir «no» no vigila nada.
  const mutilada = fuente.replace('  billingCity: true,\n', '');
  assert.notEqual(mutilada, fuente, '🔴 la mutación no ha tocado el fuente: no prueba nada.');
  assert.equal(clavesDelSelect(mutilada).includes('billingCity'), false,
    '🔴 DETECTOR TAUTOLÓGICO: sigue diciendo que sí con la clave quitada.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL VIAJE ENTERO, y el control negativo
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-579 · 🔴 EL VIAJE ENTERO: se escribe, se envía, se valida, se guarda y se RELEE', () => {
  const paraPayload = funcionDeLaVista('direccionParaPayload');

  // ② lo que el profesional teclea (con espacios de más, como se teclea de verdad)…
  const enElPayload = {
    billingAddress: paraPayload('  Calle Mayor 3  '),
    billingCity: paraPayload('Cuenca'),
    billingPostalCode: paraPayload('16001'),
    billingProvince: paraPayload('Cuenca'),
    billingCountry: paraPayload('ES'),
  };

  // ③ …cruza la puerta…
  const validado = customerCreateSchema.parse(CLIENTE(enElPayload));

  // ④/⑤ …y sobrevive al viaje de ida y vuelta por la base (`Json`/columnas es lo mismo aquí: lo
  // que se guarda se serializa) Y está en el `select` que lo devuelve.
  const releido = JSON.parse(JSON.stringify(validado));
  const claves = clavesDelSelect(leer(SERVICIO));

  for (const c of CAMPOS) {
    assert.equal(releido[c.clave], enElPayload[c.clave],
      `🔴 \`${c.clave}\` se pierde en el viaje.`);
    assert.ok(claves.includes(c.clave),
      `🔴 \`${c.clave}\` sobrevive hasta la base pero NO se relee: el profesional no la vería.`);
  }
  assert.equal(releido.billingAddress, 'Calle Mayor 3', '🔴 no se recortaron los espacios.');
});

test('SCRUM-579 · 🔴 CONTROL NEGATIVO: tocar otro campo del cliente NO tumba esto', () => {
  // Si el guard se quejara de un cambio legítimo en otra parte de la ficha, alguien lo
  // desactivaría — y entonces tampoco protegería la dirección, que es lo suyo.
  const fuente = leer(SERVICIO);
  const sinRecargo = fuente.replace('  recargoEquivalencia: true,', '');
  assert.notEqual(sinRecargo, fuente, '🔴 la mutación no ha tocado el fuente.');

  const claves = clavesDelSelect(sinRecargo);
  const faltan = CAMPOS.filter((c) => !claves.includes(c.clave));
  assert.deepEqual(faltan, [],
    '🔴 el detector de la dirección se queja de que se toque `recargoEquivalencia`, que no es lo '
    + 'suyo.');
});
