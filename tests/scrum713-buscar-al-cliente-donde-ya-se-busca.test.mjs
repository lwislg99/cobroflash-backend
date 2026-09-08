// tests/scrum713-buscar-al-cliente-donde-ya-se-busca.test.mjs — SCRUM-713
//
// Sin gate: lee ficheros y monta el dashboard en el banco. Ni BD, ni red, ni servidor.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 QUÉ IMPIDE ESTO
//
// LA VÍCTIMA: el profesional con 200 clientes despliega un `<select>` de 200 y baja con el dedo,
// en la pantalla que el máster quiere resuelta en 30 segundos. En la FACTURA no le pasa: allí hay
// buscador desde SCRUM-446.
//
// EL DEFECTO QUE VIGILA NO ES ÉSE. Es el arreglo fácil: escribir un TERCER autocompletado. La casa
// ya tiene seis buscadores —censados en el PASO 0 de este ticket— y ninguno nació sabiendo de los
// otros. Por eso el test que decide no es «se puede buscar», sino:
//
//   ① la interacción es LA DE `nuevaFacturaModal.js` (campo de búsqueda + el `<select>` que ya
//     estaba), no un dropdown nuevo;
//   ② la regla de comparación es LA DE `filtrarAlbaranes` («sin acentos ni mayúsculas: se escribe
//     con prisa»), y NO DIVERGE de ella — se ejercitan LAS DOS con los mismos casos;
//   ③ el origen del que se copió sigue funcionando igual.
//
// ⚠️ `nuevaFacturaModal.js` es camino de emisión (regla 38): aquí se LEE para comprobar que no ha
// cambiado. No se toca, y este fichero no lo importa ni lo ejecuta.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { cargarDashboard, pintarVista, todos, datosDeMuestra } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
const DIR_JS = path.join(RAIZ, 'public/dashboard/js');
const MODAL_FACTURA = path.join(DIR_JS, 'nuevaFacturaModal.js');
const VISTA_CLIENTES = path.join(DIR_JS, 'customersView.js');
const RUTA_BUSCADOR = path.join(DIR_JS, 'buscadorDeClientes.js');

const leer = (p) => fs.readFileSync(p, 'utf8');

/** Los literales de un fichero, por AST: los comentarios NO son literales y quedan fuera solos. */
function literalesDe(fuente, nombre) {
  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true);
  const out = [];
  const v = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(n.text);
    ts.forEachChild(n, v);
  };
  v(sf);
  return out;
}

/**
 * El módulo del buscador, o un fallo que DICE que no está.
 *
 * Se carga a demanda —y no en el nivel superior— porque si no existiera, un `require` arriba
 * mataría el fichero ENTERO y se llevaría por delante los tests que sí miden otra cosa. El total
 * bajaría sin un solo `fail` que nombrara al culpable (la lección de SCRUM-698).
 */
function moduloBuscador() {
  assert.ok(fs.existsSync(RUTA_BUSCADOR),
    '🔴 no existe `public/dashboard/js/buscadorDeClientes.js`.');
  return require_(RUTA_BUSCADOR);
}

// ── LOS CLIENTES DEL BANCO ──────────────────────────────────────────────────────────────
//
// Los dos primeros son EL CASO DEL TICKET, literal: el mismo negocio escrito por dos personas
// distintas. Si el buscador sólo encuentra al que se teclea igual, no sirve.
const FINCAS_CON_TILDE = { id: 11, name: 'Fincas García SL', phone: '34000000711', email: 'admin@fincasgarcia.es', internalRef: 'EXP-2024-A', taxId: 'B12345674' };
const FINCAS_SIN_TILDE = { id: 12, name: 'FINCAS GARCIA, S.L.', phone: '34000000712', email: 'contacto@fgarcia.com', internalRef: 'EXP-2024-B', taxId: 'B87654321' };
const TALLERES_ENE = { id: 13, name: 'Talleres Muñoz', phone: '34000000713', email: 'taller@munoz.es', internalRef: 'REF-99', taxId: 'B11223344' };
const CERRAJERIA = { id: 14, name: 'Cerrajería Ibáñez', phone: '34000000714', email: 'info@ibanez.es', internalRef: 'CERR-7', taxId: 'B55667788' };
const TODOS_LOS_CLIENTES = [FINCAS_CON_TILDE, FINCAS_SIN_TILDE, TALLERES_ENE, CERRAJERIA];

/** El banco con un merchant y la lista de clientes. `datosDeMuestra` para lo demás. */
function banco({ clientes = TODOS_LOS_CLIENTES } = {}) {
  return cargarDashboard(RAIZ, {
    datos: (url) => {
      const u = String(url || '');
      if (/\/admin\/merchant/.test(u)) return { id: 1, name: 'Fontanería Soler' };
      if (/\/admin\/customers/.test(u)) return clientes;
      return datosDeMuestra(u);
    },
  });
}

/** El `<select>` de cliente del documento. Se ancla por su `name`, que es el que viaja en el POST. */
const selectorDeCliente = (r) =>
  todos(r.contenedor).find((n) => n.tagName === 'SELECT' && n.name === 'customer_id') || null;

/**
 * EL BUSCADOR: el `<input type="search">` que vive en el MISMO bloque que el selector de cliente.
 *
 * 🔴 Se ancla por PARENTESCO y no por «el primer campo de búsqueda de la pantalla». El editor monta
 * muchos campos, y un ancla por posición daría por bueno un buscador puesto en cualquier otro
 * sitio — justo el defecto que este ticket viene a cerrar en la pantalla de al lado.
 */
function buscadorDeCliente(r) {
  const sel = selectorDeCliente(r);
  if (!sel || !sel._padre) return null;
  return todos(sel._padre).find((n) => n.tagName === 'INPUT' && n.type === 'search') || null;
}

/** Los textos de las `<option>` del selector, en orden. Es lo que el profesional lee al abrirlo. */
const opcionesDe = (sel) =>
  todos(sel).filter((n) => n.tagName === 'OPTION').map((o) => String(o.textContent || ''));

/** Teclear DE VERDAD: se escribe en el campo y se dispara el oyente que el producto registró. */
function teclear(campo, texto) {
  campo.value = texto;
  return campo.disparar('input');
}

// ═══ ① SUELO — sin esto, todo lo de abajo sería cierto sobre un conjunto vacío ════════════

test('SCRUM-713 · 🔴 SUELO: el módulo del buscador CARGA y `filtrar` se puede EJECUTAR', () => {
  const B = moduloBuscador();
  assert.equal(typeof B.filtrar, 'function', '🔴 el módulo no publica `filtrar`.');
  assert.equal(typeof B.normalizar, 'function', '🔴 el módulo no publica `normalizar`.');
  assert.ok(Array.isArray(B.filtrar(TODOS_LOS_CLIENTES, 'fin', '')),
    '🔴 `filtrar` no devuelve una lista: no se puede pintar con lo que devuelve.');
});

test('SCRUM-713 · 🔴 SUELO: el editor MONTA y el selector de cliente trae a los cuatro', async () => {
  const r = await pintarVista(banco(), 'renderQuotesView');
  assert.equal(r.error, null, `🔴 el editor ha dejado de montarse: ${r.error && r.error.message}`);
  const sel = selectorDeCliente(r);
  assert.ok(sel, '🔴 CENSO CIEGO: no encuentro el `<select name="customer_id">` en el editor.');
  const textos = opcionesDe(sel).join(' | ');
  for (const c of TODOS_LOS_CLIENTES) {
    assert.ok(textos.includes(c.name),
      `🔴 «${c.name}» no está en el selector recién montado. Si la lista no llega, los positivos `
      + 'de abajo medirían un selector vacío y pasarían solos.');
  }
});

// ═══ ② 🔴 EL ROJO CORRIDO — hoy NO se puede buscar ═══════════════════════════════════════

test('SCRUM-713 · 🔴 HOY NO SE PUEDE BUSCAR: el bloque del cliente no tiene campo de búsqueda', async () => {
  const r = await pintarVista(banco(), 'renderQuotesView');
  assert.ok(buscadorDeCliente(r),
    '🔴 EL DEFECTO DEL TICKET: en el bloque «1. Cliente» del presupuesto no hay ningún '
    + '`<input type="search">`. El profesional con 200 clientes sólo puede desplegar la lista '
    + 'entera y bajar con el dedo — y en la FACTURA sí puede buscar desde SCRUM-446.');
});

test('SCRUM-713 · 🔴 HOY NO SE PUEDE BUSCAR: teclear RECORTA la lista del selector', async () => {
  const r = await pintarVista(banco(), 'renderQuotesView');
  const campo = buscadorDeCliente(r);
  assert.ok(campo, '🔴 no hay campo de búsqueda que teclear (ver el test anterior).');
  const sel = selectorDeCliente(r);
  const antes = opcionesDe(sel).length;
  const corrieron = teclear(campo, 'muñoz');
  assert.ok(corrieron > 0,
    '🔴 el campo de búsqueda existe pero NADIE ESCUCHA lo que se teclea: 0 oyentes de `input`. '
    + 'Un buscador que no reacciona es peor que no tenerlo — promete algo que no hace.');
  assert.ok(opcionesDe(sel).length < antes,
    `🔴 tras teclear «muñoz» el selector sigue con las mismas ${antes} opciones. No filtra.`);
});

// ═══ ③ ✅ POSITIVOS, UNO A UNO — no «funciona» ═══════════════════════════════════════════

/** Monta el editor, teclea y devuelve los textos de las opciones que quedan. */
async function buscar(texto, clientes = TODOS_LOS_CLIENTES) {
  const r = await pintarVista(banco({ clientes }), 'renderQuotesView');
  const campo = buscadorDeCliente(r);
  assert.ok(campo, '🔴 no hay campo de búsqueda en el bloque del cliente.');
  teclear(campo, texto);
  return { textos: opcionesDe(selectorDeCliente(r)), r };
}

test('SCRUM-713 · ✅ POSITIVO 1/7 · NOMBRE PARCIAL: «fin» encuentra a los dos Fincas', async () => {
  const { textos } = await buscar('fin');
  assert.ok(textos.some((t) => t.includes(FINCAS_CON_TILDE.name)), '🔴 «fin» no encuentra «Fincas García SL».');
  assert.ok(textos.some((t) => t.includes(FINCAS_SIN_TILDE.name)), '🔴 «fin» no encuentra «FINCAS GARCIA, S.L.».');
  assert.ok(!textos.some((t) => t.includes(TALLERES_ENE.name)),
    '🔴 «fin» trae también a «Talleres Muñoz»: el filtro no filtra, sólo reordena.');
});

test('SCRUM-713 · ✅ POSITIVO 2/7 · ACENTOS: «garcia» SIN tilde encuentra «Fincas García SL»', async () => {
  const { textos } = await buscar('garcia');
  assert.ok(textos.some((t) => t.includes(FINCAS_CON_TILDE.name)),
    '🔴 EL CASO DEL TICKET: se teclea «garcia» y el cliente guardado como «Fincas García SL» no '
    + 'aparece. El profesional no sabe con qué tilde lo guardó quien lo dio de alta.');
});

test('SCRUM-713 · ✅ POSITIVO 3/7 · ACENTOS AL REVÉS: «garcía» CON tilde encuentra al que no la tiene', async () => {
  const { textos } = await buscar('garcía');
  assert.ok(textos.some((t) => t.includes(FINCAS_SIN_TILDE.name)),
    '🔴 se teclea «garcía» y no aparece «FINCAS GARCIA, S.L.». La normalización tiene que ir en '
    + 'LOS DOS lados de la comparación, no sólo en el dato guardado.');
});

test('SCRUM-713 · ✅ POSITIVO 4/7 · MAYÚSCULAS: da igual cómo se teclee y cómo se guardara', async () => {
  const enMayus = await buscar('FINCAS');
  assert.ok(enMayus.textos.some((t) => t.includes(FINCAS_CON_TILDE.name)),
    '🔴 «FINCAS» en mayúsculas no encuentra «Fincas García SL».');
  const enMinus = await buscar('fincas garcia');
  assert.ok(enMinus.textos.some((t) => t.includes(FINCAS_SIN_TILDE.name)),
    '🔴 «fincas garcia» en minúsculas no encuentra «FINCAS GARCIA, S.L.».');
});

test('SCRUM-713 · ✅ POSITIVO 5/7 · TELÉFONO: el buscador resuelve por el número', async () => {
  const { textos } = await buscar('0713');
  assert.ok(textos.some((t) => t.includes(TALLERES_ENE.name)),
    '🔴 no se encuentra por teléfono, y el placeholder que se reutiliza PROMETE que se puede '
    + '(«Buscar por nombre, teléfono, email o referencia…»). Una frase falsa en pantalla.');
});

test('SCRUM-713 · ✅ POSITIVO 6/7 · EMAIL: el buscador resuelve por el correo', async () => {
  const { textos } = await buscar('ibanez.es');
  assert.ok(textos.some((t) => t.includes(CERRAJERIA.name)), '🔴 no se encuentra por email.');
});

test('SCRUM-713 · ✅ POSITIVO 7/7 · REFERENCIA INTERNA: el nº de expediente encuentra al cliente', async () => {
  const { textos } = await buscar('EXP-2024-A');
  assert.ok(textos.some((t) => t.includes(FINCAS_CON_TILDE.name)),
    '🔴 no se encuentra por `internalRef`. Es el cuarto campo del `OR` de `listCustomers` y el '
    + 'motivo de SCRUM-588: guardar el expediente sin poder buscarlo es no guardarlo.');
});

test('SCRUM-713 · ⛔ EL NIF **NO** SE BUSCA, y se fija para que nadie lo añada en silencio', async () => {
  // El patrón elegido —el de `nuevaFacturaModal.js`— resuelve contra `listCustomers`, cuyo `OR`
  // tiene CUATRO campos y `taxId` no está entre ellos. Buscar aquí por NIF haría que el mismo
  // campo respondiera distinto en dos pantallas, y dejaría MINTIENDO al placeholder aprobado, que
  // enumera exactamente lo que se puede buscar. Si se quiere, se amplía en `listCustomers` Y en el
  // texto — las dos cosas, y el texto es del fundador (regla 30).
  const { textos } = await buscar('B12345674');
  assert.ok(!textos.some((t) => t.includes(FINCAS_CON_TILDE.name)),
    '🔴 se está buscando por NIF. No es que sea peor: es que el placeholder en pantalla NO lo dice '
    + 'y `listCustomers` no lo hace, así que la misma búsqueda daría resultados distintos en el '
    + 'presupuesto y en la lista de clientes.');
});

// ═══ ④ ✅ NEGATIVO — una búsqueda sin resultados DICE algo ═══════════════════════════════

test('SCRUM-713 · ✅ NEGATIVO: sin resultados se lee un texto, no un hueco', async () => {
  const B = moduloBuscador();
  const { textos } = await buscar('zzzz-no-existe');
  assert.ok(textos.some((t) => t.includes(B.TEXTOS.sinResultados)),
    `🔴 tras una búsqueda sin resultados el selector no dice «${B.TEXTOS.sinResultados}». Se queda `
    + 'en blanco, y el profesional no sabe si no hay nadie o si la pantalla se ha roto.');
});

test('SCRUM-713 · ✅ NEGATIVO: no se vuelca NINGÚN identificador interno a la cara del usuario', async () => {
  const { textos } = await buscar('zzzz-no-existe');
  const pegado = textos.join(' | ');
  assert.ok(!pegado.includes('__'),
    `🔴 hay un identificador interno en pantalla: ${pegado}. El valor centinela del alta rápida `
    + '(`__alta_cliente__`, SCRUM-591) es un `value`, NUNCA un texto que alguien lea.');
  assert.ok(!/\bundefined\b|\bnull\b|\bNaN\b/.test(pegado),
    `🔴 la pantalla escribe «undefined»/«null»/«NaN»: ${pegado}`);
});

// ═══ ⑤ SUELO DE CERO CLIENTES — la pantalla lo dice, no parece rota ══════════════════════

test('SCRUM-713 · 🔴 SUELO: con CERO clientes la pantalla LO DICE y ofrece la salida', async () => {
  const B = moduloBuscador();
  const r = await pintarVista(banco({ clientes: [] }), 'renderQuotesView');
  assert.equal(r.error, null, `🔴 con cero clientes el editor revienta: ${r.error && r.error.message}`);
  const sel = selectorDeCliente(r);
  assert.ok(sel, '🔴 con cero clientes ni siquiera hay selector: la pantalla SÍ parece rota.');
  const textos = opcionesDe(sel);
  assert.ok(textos.some((t) => t.includes(B.TEXTOS.sinNinguno)),
    `🔴 con cero clientes no se lee «${B.TEXTOS.sinNinguno}». Un desplegable con una sola entrada y `
    + 'sin explicación es indistinguible de una pantalla a medio cargar.');
  assert.ok(textos.some((t) => t.includes('+ Nuevo cliente')),
    '🔴 con cero clientes NO hay salida: falta «+ Nuevo cliente» (SCRUM-591). Decirle al '
    + 'profesional que no tiene clientes sin ofrecerle crear uno es dejarlo encerrado.');
});

// ═══ ⑥ NO ROMPER LO QUE YA FUNCIONA ══════════════════════════════════════════════════════

test('SCRUM-713 · 🔴 EL ORIGEN SIGUE IGUAL: `nuevaFacturaModal.js` conserva su buscador', () => {
  // Camino de emisión (regla 38): se LEE. Lo que se comprueba es que copiar el patrón no se haya
  // hecho MOVIÉNDOLO — el defecto clásico de «reutilizar» extrayendo del sitio que funcionaba.
  const lits = literalesDe(leer(MODAL_FACTURA), 'nuevaFacturaModal.js');
  assert.ok(lits.includes('search'),
    '🔴 el modal de factura ha perdido su `type = "search"`. El patrón se COPIA, no se muda.');
  assert.ok(lits.includes('Busca por nombre…'),
    '🔴 el modal de factura ha perdido su placeholder aprobado.');
  assert.ok(lits.some((l) => l.includes('/admin/customers')),
    '🔴 el modal de factura ya no llama a `/admin/customers`: su buscador dejó de resolver.');
});

test('SCRUM-713 · 🔴 SCRUM-591 SIGUE VIVO: «+ Nuevo cliente» es la PRIMERA opción tras el placeholder', async () => {
  const r = await pintarVista(banco(), 'renderQuotesView');
  const textos = opcionesDe(selectorDeCliente(r));
  assert.equal(textos[1], '+ Nuevo cliente',
    `🔴 «+ Nuevo cliente» ya no es la segunda entrada (hoy: ${JSON.stringify(textos.slice(0, 3))}). `
    + 'El asesor lo colocó ahí el 3-sep-2026 y dejó escrito el motivo: en un `<select>` con '
    + 'doscientos clientes, el final de la lista no existe.');
});

test('SCRUM-713 · 🔴 EL CLIENTE YA ELEGIDO NO DESAPARECE al buscar otra cosa', async () => {
  const r = await pintarVista(banco(), 'renderQuotesView');
  const sel = selectorDeCliente(r);
  const campo = buscadorDeCliente(r);
  assert.ok(campo, '🔴 no hay campo de búsqueda en el bloque del cliente.');
  sel.value = String(TALLERES_ENE.id);
  teclear(campo, 'fincas');
  assert.ok(opcionesDe(sel).some((t) => t.includes(TALLERES_ENE.name)),
    '🔴 el cliente seleccionado ha desaparecido de la lista al buscar otra cosa: su `<option>` ya '
    + 'no está, así que el `<select>` enseña un valor que no puede mostrar y el documento pierde '
    + 'al cliente por teclear — con la tanda en verde.');
  assert.equal(String(sel.value), String(TALLERES_ENE.id),
    '🔴 buscar ha DESELECCIONADO al cliente ya elegido. La vista previa se queda sin nombre.');
});

// ═══ ⑦ EL TRINQUETE DE LA COPIA — front y dominio no pueden divergir ═════════════════════

test('SCRUM-713 · 🔴 LA COPIA NO DIVERGE: la normalización del front da LO MISMO que la del dominio', () => {
  // El front vanilla (regla 4) no puede importar de `src/`, así que la regla queda escrita DOS
  // veces. Es la misma situación que `tagsDe` en `filtroClientes.js`, y se sostiene igual: un test
  // que EJERCITA las dos con los mismos casos. Sin esto, la copia envejece en silencio.
  const B = moduloBuscador();
  const { filtrarAlbaranes } = require_(path.join(RAIZ, 'dist/modules/jobs/domain/albaranesListado.js'));

  // El dominio no exporta su `normalizar`: se ejercita POR COMPORTAMIENTO, que es lo que importa.
  // Cada pareja es «lo guardado» y «lo tecleado», escritos distinto A PROPÓSITO.
  const PAREJAS = [
    ['Fincas García SL', 'garcia'],
    ['FINCAS GARCIA, S.L.', 'garcía'],
    ['Cerrajería Ibáñez', 'ibanez'],
    ['Talleres Muñoz', 'MUNOZ'],
    ['Electricidad Ávila', 'avila'],
  ];
  for (const [guardado, tecleado] of PAREJAS) {
    const dominio = filtrarAlbaranes([{ numero: 'A-1', cliente: guardado, trabajo: '' }], tecleado).length === 1;
    const front = B.normalizar(guardado).includes(B.normalizar(tecleado));
    assert.equal(front, dominio,
      `🔴 «${tecleado}» sobre «${guardado}»: el dominio dice ${dominio} y el front dice ${front}. `
      + 'Las dos copias de la regla han divergido, y la pantalla del presupuesto ya no encuentra '
      + 'lo que encuentra la de albaranes.');
    assert.ok(front,
      `🔴 «${tecleado}» no encuentra «${guardado}». Ésa es la búsqueda que el ticket pide arreglar.`);
  }
});

// ═══ ⑧ MICROCOPY — regla 30: ni un literal estrenado ═════════════════════════════════════

test('SCRUM-713 · 🔴 REGLA 30: los textos YA ESTABAN en pantalla, ninguno se estrena', () => {
  const B = moduloBuscador();
  const enClientes = literalesDe(leer(VISTA_CLIENTES), 'customersView.js');
  const claves = Object.keys(B.TEXTOS);
  assert.ok(claves.length >= 3,
    `🔴 CENSO CIEGO: \`TEXTOS\` sólo declara ${claves.length} entradas. Si un literal se pinta sin `
    + 'pasar por aquí, este guard no lo ve y la regla 30 deja de estar vigilada.');
  for (const clave of claves) {
    const texto = B.TEXTOS[clave];
    assert.ok(enClientes.includes(texto),
      `🔴 «${texto}» (TEXTOS.${clave}) NO existe en \`customersView.js\`. Es microcopy NUEVO y este `
      + 'ticket tiene prohibido estrenarlo (regla 30): se propone al fundador y se para.');
  }
});

test('SCRUM-713 · 🔴 el editor NO estrena un dropdown propio: reutiliza el `<select>` que ya estaba', async () => {
  const r = await pintarVista(banco(), 'renderQuotesView');
  const sel = selectorDeCliente(r);
  assert.ok(sel, '🔴 ha desaparecido el `<select name="customer_id">`.');
  const hayDropdown = todos(r.contenedor).some((n) =>
    String(n.className || '').split(/\s+/).includes('pf-autocomplete') && n._padre === sel._padre);
  assert.ok(!hayDropdown,
    '🔴 se ha montado un `pf-autocomplete` en el bloque del cliente. Ése es el autocompletado de '
    + 'PRODUCTOS: reutilizarlo aquí obliga a cambiar el `<select>` por un `<input>`, y con él se '
    + 'van los doce sitios que leen `fieldCustomer.select.value` y el «+ Nuevo cliente».');
});
