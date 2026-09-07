// tests/scrum576-persona-vinculada-a-empresa.test.mjs — SCRUM-576 (CONT-03)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA PREGUNTA QUE DECIDE: ¿EL SISTEMA SABE QUE DOS PERSONAS SON DE LA MISMA EMPRESA?
//
// Hoy no. «Razón social (empresa, opcional)» es TEXTO LIBRE: el administrador de fincas escribe
// «Fincas García SL» al dar de alta a uno y «FINCAS GARCIA, S.L.» al dar de alta al otro, y para
// el sistema son dos cadenas que no se parecen en nada. Este fichero enseña las DOS mitades: el
// antes ciego y el después, ejecutando el camino real del navegador en los dos casos.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 QUÉ PRUEBA ESTO Y QUÉ NO — declararlo importa, porque un guard que exagera su cobertura miente
//
// SÍ: el camino del NAVEGADOR entero, ejecutado. Se monta la ficha de cliente de verdad
//     (`window.altaClienteModal.abrir`), se elige la empresa en el desplegable de verdad y se lee
//     lo que el formulario MANDARÍA. Y el camino del SERVIDOR hasta el borde de la base: el
//     esquema Zod y `examinarVinculoDeEmpresa`, los dos importados de `dist/`.
//
// NO: la escritura en Postgres. **La columna `customers.company_id` NO ESTÁ APLICADA EN NINGUNA
//     BASE** —es el punto entero de este ticket: `docs/sql/scrum-576-customers-company-id.sql`
//     está escrita y sin aplicar, y la aplica el fundador. Sin columna no hay dónde escribir, y
//     este entorno además no tiene Postgres desechable (`psql` y `docker`, ausentes; medido el
//     7-sep-2026). Lo que la base garantiza —que ese entero apunte a una fila que existe— lo
//     declara la CLAVE AJENA de esa migración, y aquí se comprueba que la migración la lleva.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** El componente compartido, cargado como CommonJS de doble vida (igual que hace SCRUM-574). */
async function piezaCompartida() {
  const mod = await import('../public/dashboard/js/switchFormaJuridica.js');
  return mod.default || mod;
}

// ── El censo de clientes que sirve el banco ────────────────────────────────────────────────
//
// Las DOS grafías son las del ticket, no inventadas para que salga bien: es cómo se escribe
// «Fincas García SL» dos veces sin querer. Los dos son PERSONA; la empresa es un contacto aparte.
const EMPRESA = { id: 7, name: 'Fincas García SL', contactKind: 'EMPRESA', legalName: 'Fincas García SL' };
const ANA = { id: 11, name: 'Ana Ruiz', contactKind: 'PERSONA', legalName: 'Fincas García SL', companyId: null };
const LUIS = { id: 12, name: 'Luis Soto', contactKind: 'PERSONA', legalName: 'FINCAS GARCIA, S.L.', companyId: null };
const CENSO = [EMPRESA, ANA, LUIS];

/** Monta la ficha de cliente de VERDAD y devuelve el desplegable de empresa ya en pantalla. */
async function abrirFicha(cliente) {
  const banco = cargarDashboard(RAIZ, { datos: CENSO });
  const r = await pintarVista(banco, 'renderCustomersView');
  const api = banco.ctx.window && banco.ctx.window.altaClienteModal;
  if (!api || typeof api.abrir !== 'function') return { banco, r, api: null, campo: null };
  api.abrir(cliente ? 'edit' : 'new', cliente || undefined);
  // El desplegable se puebla del lote ya cargado; si hiciera falta red, unos ticks la absorben.
  for (let i = 0; i < 5; i += 1) await new Promise((res) => setImmediate(res));
  const campo = todos(banco.ctx.document.body).find(
    (n) => n.tagName === 'SELECT' && n.name === 'companyId',
  );
  return { banco, r, api, campo };
}

/** Ejecuta algo con el `document` del banco puesto: los componentes crean nodos de verdad. */
async function conDom(fn) {
  const banco = cargarDashboard(RAIZ, { datos: CENSO });
  const antes = globalThis.document;
  globalThis.document = banco.ctx.document;
  try {
    return await fn(banco);
  } finally {
    if (antes === undefined) delete globalThis.document;
    else globalThis.document = antes;
  }
}

// ═══ 🔴 SUELO ════════════════════════════════════════════════════════════════════════════
//
// «No encontré ninguna ficha de persona» y «la ficha de persona no tiene el campo» dan el mismo
// verde si nadie los separa. Este bloque los separa: si el árbol no tiene ni un formulario con el
// switch, o el banco no llega a montar la ficha, esto CAE declarándose ciego — nunca pasa.

test('SCRUM-576 · 🔴 SUELO: hay fichas de persona en el árbol y el banco las monta', async () => {
  const dirJs = path.join(RAIZ, 'public/dashboard/js');
  const fichas = fs.readdirSync(dirJs)
    .filter((f) => f.endsWith('.js') && f !== 'switchFormaJuridica.js')
    .filter((f) => /switchFormaJuridica\s*\(/.test(fs.readFileSync(path.join(dirJs, f), 'utf8')));
  assert.ok(fichas.length >= 2,
    `🔴 CIEGO: encontré ${fichas.length} formularios que montan el switch Empresa/Persona, y ` +
    'SCRUM-574 dejó DOS (el modal de la lista y el de la ficha 360). Si no hay lado Persona, ' +
    'nada de lo que este fichero comprueba debajo significa nada. No es un fallo del producto: ' +
    'es que la medida no está mirando donde cree.');

  const { r, api, campo } = await abrirFicha(ANA);
  assert.equal(r.error, null, `🔴 la vista de Clientes revienta: ${r.error && r.error.message}`);
  assert.ok(api, '🔴 CIEGO: la vista no publica `altaClienteModal`, así que no puedo abrir ninguna ficha.');
  assert.ok(campo, '🔴 la ficha de una PERSONA no tiene el campo «Empresa». Es el ticket entero.');
});

// ═══ 🔴 EL CONTROL QUE DECIDE ════════════════════════════════════════════════════════════

test('SCRUM-576 · 🔴 EL ANTES: dos personas de la misma empresa, y el sistema NO lo sabe', async () => {
  // Lo que el sistema tiene HOY para saberlo es la razón social, y es texto libre.
  assert.notEqual(ANA.legalName, LUIS.legalName,
    'suelo del suelo: si las dos grafías fueran iguales, este test no estaría midiendo nada.');

  // Y no es que «casi» coincidan: no hay NADA en el dato que las relacione. Ésta es la ceguera.
  const { empresasElegibles } = await piezaCompartida();
  const soloConRazonSocial = empresasElegibles([ANA, LUIS], null);
  assert.equal(soloConRazonSocial.length, 0,
    '🔴 dos personas con razón social escrita NO son dos empresas elegibles. Si lo fueran, el ' +
    'sistema estaría deduciendo «esto es una empresa» de un campo de texto — que es exactamente ' +
    'lo que el fundador prohibió el 24-ago-2026.');
});

test('SCRUM-576 · 🔴 EL DESPUÉS: las dos fichas mandan el MISMO id, no dos cadenas parecidas', async () => {
  // DOS fichas montadas por separado, como en la vida real: dos altas en dos momentos distintos.
  const uno = await abrirFicha(ANA);
  const dos = await abrirFicha(LUIS);
  assert.ok(uno.campo && dos.campo, '🔴 CIEGO: alguna de las dos fichas no tiene el campo.');

  // En cada una se elige «Fincas García SL» — la MISMA empresa, elegida dos veces por separado.
  const opcionDe = (campo) => campo.hijos.find((o) => o.textContent === EMPRESA.name);
  const a = opcionDe(uno.campo);
  const b = opcionDe(dos.campo);
  assert.ok(a && b,
    '🔴 el desplegable no ofrece la empresa. Ofrece: ' +
    uno.campo.hijos.map((o) => o.textContent).join(' | '));

  uno.campo.value = a.value;
  dos.campo.value = b.value;

  // 🔴 LA RESPUESTA. Lo que las dos fichas mandarían al servidor.
  assert.equal(uno.campo.value, dos.campo.value,
    '🔴 dos personas vinculadas a la misma empresa mandan valores DISTINTOS. El ticket entero ' +
    'era que dejaran de ser dos cadenas parecidas.');
  assert.equal(Number(uno.campo.value), EMPRESA.id,
    '🔴 lo que viaja no es el id de la empresa. Un nombre que viaja es texto libre con otro disfraz.');

  // Y lo que garantiza que ese entero señale a una fila que EXISTE no es el navegador: es la
  // clave ajena de la migración. Sin ella, `company_id` sería un entero suelto.
  const sql = fs.readFileSync(path.join(RAIZ, 'docs/sql/scrum-576-customers-company-id.sql'), 'utf8');
  assert.match(sql, /FOREIGN KEY\s*\(\s*"company_id"\s*\)\s*REFERENCES\s+"customers"\s*\(\s*"id"\s*\)/,
    '🔴 la migración no declara la clave ajena. Sin ella la base admite un `company_id` que no ' +
    'apunta a nadie, y «son la misma empresa» vuelve a ser una coincidencia.');
  assert.match(sql, /ON DELETE SET NULL/,
    '🔴 borrar la empresa se llevaría por delante a las personas. Pierden el vínculo, no la ficha.');
});

// ═══ ✅ EL POSITIVO: una persona SIN empresa sigue funcionando exactamente igual ═══════════

test('SCRUM-576 · ✅ POSITIVO: sin empresa, el campo lee `null` y no estorba', async () => {
  const { campo } = await abrirFicha({ ...ANA, companyId: null });
  assert.ok(campo, '🔴 CIEGO: no hay campo que leer.');
  assert.equal(campo.value, '',
    '🔴 una persona sin empresa aparece con una elegida. Eso es DECLARAR por el profesional.');

  const { selectorDeEmpresa } = await piezaCompartida();
  await conDom(() => {
    // Se ejerce el componente directamente: sin nada elegido devuelve `null`, nunca `''` ni `0`.
    const s = selectorDeEmpresa({ clientes: CENSO });
    assert.equal(s.leer(), null, '🔴 «sin empresa» no viaja como `null`: «ausente ≠ vacío».');
    assert.ok(s.nodo.querySelector('option'), 'suelo: el desplegable tiene su opción vacía.');
  });
});

test('SCRUM-576 · ✅ POSITIVO: el campo NO se vuelve obligatorio de rebote', async () => {
  const { customerCreateSchema } = await import('../dist/core/validation/schemas.js');
  // Un alta sin `companyId` — el 100 % de las altas de hoy — sigue siendo válida.
  assert.ok(customerCreateSchema.safeParse({ name: 'Ana Ruiz' }).success,
    '🔴 un alta sin empresa deja de validar. El campo es OPCIONAL.');
  assert.ok(customerCreateSchema.safeParse({ name: 'Ana Ruiz', companyId: null }).success,
    '🔴 `null` (no pertenece a ninguna empresa) deja de validar.');
  assert.ok(customerCreateSchema.safeParse({ name: 'Ana Ruiz', companyId: 7 }).success,
    'suelo: un vínculo legítimo sí valida, así que los dos de arriba no pasan por casualidad.');

  const { examinarVinculoDeEmpresa } = await import('../dist/modules/system/customerAdmin.js');
  assert.equal(examinarVinculoDeEmpresa(11, undefined), 'no-tocar',
    '🔴 una edición parcial que no manda el campo lo estaría tocando. `undefined` ≠ `null`.');
  assert.equal(examinarVinculoDeEmpresa(11, null), 'desvincular',
    '🔴 no se puede quitar la empresa. Elegir una sería irreversible.');
});

// ═══ ✅ EL NEGATIVO: la ficha de EMPRESA no gana el campo ══════════════════════════════════

test('SCRUM-576 · ✅ NEGATIVO: en el lado EMPRESA el campo se esconde', async () => {
  // `debeEsconderDelLado(ladoDeclarado, ladoDelCampo, tieneValor)` — los TRES obligatorios, sin
  // ninguna caída por defecto. La firma de dos argumentos (`debeEsconder`) sigue existiendo como
  // el caso particular de SCRUM-574, y su suite la ejerce; aquí se prueba la general.
  const { debeEsconderDelLado, debeEsconder, SOLO_PERSONA, SOLO_EMPRESA } = await piezaCompartida();

  assert.deepEqual(SOLO_PERSONA, ['companyId'],
    '🔴 ha cambiado qué campos son solo de Persona.');
  assert.deepEqual(SOLO_EMPRESA, ['legalName'],
    '🔴 el reparto de SCRUM-574 se ha movido: tiene que seguir intacto.');

  assert.equal(debeEsconderDelLado('EMPRESA', 'PERSONA', false), true,
    '🔴 LA FICHA DE EMPRESA GANA EL CAMPO. Con dos sitios donde declarar el vínculo, uno puede ' +
    'decir lo contrario que el otro y nada dice cuál manda.');
  assert.equal(debeEsconderDelLado('PERSONA', 'PERSONA', false), false,
    'suelo: en su propio lado sí se ve, así que el de arriba no esconde por esconder.');
  assert.equal(debeEsconderDelLado(null, 'PERSONA', false), false,
    '🔴 sin declarar se esconde: eso es tratar «nadie lo ha dicho» como «es una empresa».');
  assert.equal(debeEsconderDelLado('EMPRESA', 'PERSONA', true), false,
    '🔴 SE ESTÁ ESCONDIENDO UN DATO ESCRITO (invariante ②). Un dato invisible es un dato que ' +
    'nadie va a corregir y que sigue viajando.');

  // 🔴 Y LA VIEJA SIGUE SIGNIFICANDO LO MISMO. Generalizar la regla no puede cambiar de lado los
  // campos que SCRUM-574 ya repartía: eso escondería «razón social» donde antes se veía.
  assert.equal(debeEsconder('PERSONA', false), true,
    '🔴 el caso particular de SCRUM-574 ha cambiado de significado al generalizar.');
  assert.equal(debeEsconder('EMPRESA', false), false,
    '🔴 idem por el otro lado.');
});

test('SCRUM-576 · ✅ NEGATIVO: y se esconde EN EL DOM, no solo en la regla', async () => {
  const { selectorDeEmpresa, aplicarLado } = await piezaCompartida();
  await conDom(() => {
    const s = selectorDeEmpresa({ clientes: CENSO });
    aplicarLado('EMPRESA', { companyId: s.nodo });
    assert.equal(s.nodo.hidden, true, '🔴 la regla dice que sí y el DOM enseña el campo igual.');
    aplicarLado('PERSONA', { companyId: s.nodo });
    assert.equal(s.nodo.hidden, false, 'suelo: en el lado Persona vuelve a verse.');
  });
});

// ═══ LO QUE NO PUEDE SIGNIFICAR NADA ══════════════════════════════════════════════════════

test('SCRUM-576 · un cliente no puede pertenecerse a sí mismo', async () => {
  const { examinarVinculoDeEmpresa } = await import('../dist/modules/system/customerAdmin.js');
  assert.equal(examinarVinculoDeEmpresa(11, 11), 'es-el-propio-cliente',
    '🔴 «esta persona pertenece a sí misma» pasa. No significa nada y la base lo admitiría: la ' +
    'clave ajena sólo exige que la fila exista, y la fila existe.');
  assert.equal(examinarVinculoDeEmpresa(null, 11), 'hay-que-consultar',
    'en un ALTA no hay id propio todavía, así que no hay a qué apuntarse: se consulta y ya.');
  assert.equal(examinarVinculoDeEmpresa(11, 7), 'hay-que-consultar',
    'suelo: un vínculo normal sí llega a la consulta.');

  const { customerCreateSchema } = await import('../dist/core/validation/schemas.js');
  for (const malo of [0, -3, 1.5]) {
    assert.equal(customerCreateSchema.safeParse({ name: 'X', companyId: malo }).success, false,
      `🔴 companyId ${malo} valida. Los ids de customers son enteros positivos; esto no es ` +
      '«otra empresa», es un dato roto.');
  }
});

test('SCRUM-576 · y el desplegable no se ofrece a sí mismo', async () => {
  const { empresasElegibles } = await piezaCompartida();
  const conmigo = empresasElegibles(CENSO, EMPRESA.id);
  assert.equal(conmigo.some((c) => c.id === EMPRESA.id), false,
    '🔴 al editar la ficha de una empresa, el desplegable la ofrece a ella misma.');
  assert.equal(empresasElegibles(CENSO, null).length, 1,
    'suelo: sin excluir a nadie sí sale, así que la exclusión de arriba no es una lista vacía.');
});

// ═══ EL QUINTO ESLABÓN — el que ya se perdió en SCRUM-579, SCRUM-580 y SCRUM-587 ═══════════

test('SCRUM-576 · el `select` del servidor DEVUELVE `companyId`', async () => {
  const fuente = fs.readFileSync(path.join(RAIZ, 'src/modules/system/customerAdmin.ts'), 'utf8');
  const desde = fuente.indexOf('const CUSTOMER_SELECT_NO_TOKEN');
  const hasta = fuente.indexOf('export async function listCustomers');
  assert.ok(desde > 0 && hasta > desde, '🔴 CIEGO: no encuentro el `select` en el fuente.');
  const select = fuente.slice(desde, hasta);

  assert.ok(/^\s*companyId:\s*true,/m.test(select),
    '🔴 el vínculo se guardaría y `getCustomer` devolvería un cliente SIN empresa: la ficha se ' +
    'recargaría vacía, el profesional volvería a elegirla — y la tanda seguiría VERDE, porque el ' +
    'dato SÍ está en la base. Es el defecto mudo que ya pasó tres veces (579, 580, 587).');
  assert.ok(!/^\s*(company|people):\s*true,/m.test(select),
    '🔴 se está exponiendo la RELACIÓN, no el entero. El lado inverso `people` existe sólo porque ' +
    'Prisma lo exige; sacarlo crearía el segundo sitio que este ticket evita.');
});
