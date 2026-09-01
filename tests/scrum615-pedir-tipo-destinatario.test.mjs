// tests/scrum615-pedir-tipo-destinatario.test.mjs — SCRUM-615 (salidas D y C)
//
// D · se le pide el tipo de destinatario al cliente que entra en la bandeja sin declararlo.
// C · mientras no esté, se avisa de que el plazo se ha calculado sin el dato.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS DOS SENTIDOS, QUE ES LO QUE PIDE EL ENCARGO
//
// Sin el dato → aparecen. Con el dato → NO aparecen. El segundo no es cortesía: un bloque que se
// pintara siempre le enseñaría el aviso a quien YA contestó, y el mecanismo pasaría de ayudar a
// ser ruido permanente. Un test que solo mide el sentido positivo no distingue «funciona» de «se
// pinta pase lo que pase».
//
// Y el control negativo de verdad: si se desactiva el mecanismo, TIENE que dejar de dispararse.
// Si no puedo demostrar eso, lo que estoy midiendo es mi sonda, no el producto.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// SE RENDERIZA DE VERDAD, NO SE LEE EL FUENTE
//
// El bloque se construye contra el DOM de mentira de `_banco-vistas.mjs` y se recorre el árbol
// resultante. Comprobar «el fichero contiene la palabra aviso» no distinguiría un nodo que se
// añade de uno que se construye y se tira.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { nodo, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(import.meta.url);
const mod = require_(path.join(RAIZ, 'public/dashboard/js/tipoDestinatarioPendiente.js'));

/** Un `document` de mentira con lo justo: crear nodos y registrar ids. */
function docDeMentira() {
  const reg = { porId: new Map(), selectoresNoSoportados: [] };
  return { createElement: (t) => nodo(t, reg) };
}

const CON_DATO = { customerId: 7, customerName: 'X', tipoDestinatario: 'EMPRESARIO', tipoDestinatarioDeclarado: 'EMPRESARIO' };
const SIN_DATO = { customerId: 8, customerName: 'Y', tipoDestinatario: 'PARTICULAR', tipoDestinatarioDeclarado: null };

const textosDe = (n) => todos(n).map((x) => x.textContent).filter((t) => typeof t === 'string' && t.length);

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-615 · SUELO: el módulo exporta lo que estos tests van a ejercer', () => {
  for (const n of ['debePedirlo', 'bloqueTipoDestinatario']) {
    assert.equal(typeof mod[n], 'function', `🔴 no se exporta \`${n}\``);
  }
  assert.equal(mod.MARCADOR, '[PENDIENTE microcopy oficial]', '🔴 el marcador no es el oficial del repo');
});

test('SCRUM-615 · SUELO: el DOM de mentira SABE construir y recorrer', () => {
  // Si `createElement` devolviera algo inerte, todo lo de abajo diría «no hay aviso» siempre —
  // y ese verde se leería igual que un producto correcto.
  const d = docDeMentira();
  const p = d.createElement('div');
  const h = d.createElement('span');
  h.textContent = 'hola';
  p.appendChild(h);
  assert.equal(todos(p).length, 2, '🔴 el recorrido no ve los hijos');
  assert.deepEqual(textosDe(p), ['hola'], '🔴 el DOM de mentira no guarda el texto');
});

// ── LA REGLA, EJECUTADA ──────────────────────────────────────────────────────────────────

test('SCRUM-615 · SIN el dato se pide · CON el dato no', () => {
  assert.equal(mod.debePedirlo(SIN_DATO), true, '🔴 no se pide a quien no lo ha declarado');
  assert.equal(mod.debePedirlo(CON_DATO), false, '🔴 se le vuelve a pedir a quien YA contestó');
  assert.equal(mod.debePedirlo({ tipoDestinatarioDeclarado: 'PARTICULAR' }), false);
});

test('SCRUM-615 · 🔴 se mira lo DECLARADO, nunca lo RESUELTO', () => {
  // El error que mataría el mecanismo en silencio: `tipoDestinatario` con NULL ya vale
  // `PARTICULAR`, así que mirarlo a él haría que no se preguntara NUNCA y nada lo diría.
  const resueltoPeroNoDeclarado = { tipoDestinatario: 'PARTICULAR', tipoDestinatarioDeclarado: null };
  assert.equal(
    mod.debePedirlo(resueltoPeroNoDeclarado), true,
    '🔴 SE ESTÁ MIRANDO EL VALOR RESUELTO: con NULL ya vale PARTICULAR y no se preguntaría jamás',
  );
});

test('SCRUM-615 · fail-safe hacia PREGUNTAR: un valor no declarable cuenta como «no consta»', () => {
  // La columna es `text` sin CHECK: puede contener cualquier cosa. Callar de más deja un plazo
  // legal apoyado en una suposición; preguntar de más solo molesta.
  for (const basura of ['particular', 'AUTONOMO', '', undefined]) {
    assert.equal(mod.debePedirlo({ tipoDestinatarioDeclarado: basura }), true, `🔴 ${JSON.stringify(basura)} se toma por declarado`);
  }
});

// ── LOS DOS SENTIDOS, SOBRE EL NODO RENDERIZADO ──────────────────────────────────────────

test('SCRUM-615 · ✅ C+D · SIN el dato: el bloque SE PINTA, con aviso y con pregunta', () => {
  const bloque = mod.bloqueTipoDestinatario({ cliente: SIN_DATO, doc: docDeMentira() });
  assert.ok(bloque, '🔴 no se pinta nada a quien no ha declarado el tipo');

  const nodos = todos(bloque);
  // C: el aviso, con el marcador.
  assert.ok(
    nodos.some((n) => n.className === 'tipo-destinatario-aviso' && n.textContent === mod.MARCADOR),
    '🔴 falta el aviso (salida C) o no lleva el marcador oficial',
  );
  // D: la pregunta, con sus tres opciones.
  const select = nodos.find((n) => n.tagName === 'SELECT');
  assert.ok(select, '🔴 falta el select (salida D)');
  const opciones = select.hijos.map((o) => o.value);
  assert.deepEqual(opciones, ['', 'PARTICULAR', 'EMPRESARIO'], '🔴 las opciones no son las tres del campo');
});

test('SCRUM-615 · ✅ C+D · CON el dato: NO se pinta NADA (el sentido que suele faltar)', () => {
  const bloque = mod.bloqueTipoDestinatario({ cliente: CON_DATO, doc: docDeMentira() });
  assert.equal(
    bloque, null,
    '🔴 SE LE ESTÁ ENSEÑANDO EL AVISO A QUIEN YA CONTESTÓ: el bloque se pinta pase lo que pase',
  );
});

test('SCRUM-615 · 🔴 CONTROL NEGATIVO DEL MECANISMO: sin la condición, no habría diferencia', () => {
  // Se compara el MISMO renderizador contra los dos clientes. Si el mecanismo estuviera
  // desactivado —devolviendo siempre nodo, o siempre null— los dos lados coincidirían y este
  // test caería. Es lo que separa «funciona» de «mi sonda dice que sí».
  const conDato = mod.bloqueTipoDestinatario({ cliente: CON_DATO, doc: docDeMentira() });
  const sinDato = mod.bloqueTipoDestinatario({ cliente: SIN_DATO, doc: docDeMentira() });
  assert.notEqual(
    conDato === null, sinDato === null,
    '🔴 EL MECANISMO NO DISTINGUE: da lo mismo tener el dato que no tenerlo',
  );
});

// ── EL CAMINO DE GUARDADO ────────────────────────────────────────────────────────────────

test('SCRUM-615 · elegir un tipo declarable AVISA al guardador, con el valor elegido', () => {
  const elegidos = [];
  const bloque = mod.bloqueTipoDestinatario({
    cliente: SIN_DATO, doc: docDeMentira(),
    alElegir: (v, c) => elegidos.push([v, c.customerId]),
  });
  const select = todos(bloque).find((n) => n.tagName === 'SELECT');
  select.value = 'EMPRESARIO';
  select.disparar('change');
  assert.deepEqual(elegidos, [['EMPRESARIO', 8]], '🔴 no llega el valor elegido al guardador');
});

test('SCRUM-615 · 🔴 «Sin clasificar» NO se guarda: no es una declaración', () => {
  // Guardarlo convertiría un NULL legítimo («nadie lo ha dicho») en un NULL «confirmado» que
  // tampoco ha dicho nadie — y encima dejaría de preguntarse si algún día se leyera como tal.
  const elegidos = [];
  const bloque = mod.bloqueTipoDestinatario({
    cliente: SIN_DATO, doc: docDeMentira(), alElegir: (v) => elegidos.push(v),
  });
  const select = todos(bloque).find((n) => n.tagName === 'SELECT');
  select.value = '';
  select.disparar('change');
  assert.deepEqual(elegidos, [], '🔴 se está guardando «Sin clasificar» como si fuera una respuesta');
});

// ── EL COPY: NI UNA PALABRA NUEVA ────────────────────────────────────────────────────────

test('SCRUM-615 · 🔴 los cuatro textos del campo son los que YA existen, letra a letra', () => {
  // El censo de ranuras manda: reutilizar hace que las 4 decisiones sirvan a un TERCER sitio en
  // vez de crear una quinta versión del mismo rótulo. Se compara con `===`, nunca con includes().
  const fuenteLista = readFuente('public/dashboard/js/customersView.js');
  const fuenteFicha = readFuente('public/dashboard/js/customerDetailView.js');

  assert.equal(mod.ETIQUETA, 'Tipo de cliente');
  assert.deepEqual(mod.OPCIONES.map((o) => o.texto), ['Sin clasificar', 'Particular', 'Empresa / profesional']);

  // Y que esos textos SIGAN estando en los dos formularios: si alguien los cambia allí y no aquí,
  // este test cae y obliga a cambiarlos en los tres sitios a la vez.
  for (const t of [mod.ETIQUETA, ...mod.OPCIONES.map((o) => o.texto)]) {
    const enLista = contieneTextoExacto(fuenteLista, t);
    const enFicha = contieneTextoExacto(fuenteFicha, t);
    assert.ok(enLista, `🔴 «${t}» ya no está en customersView.js: los tres sitios han divergido`);
    assert.ok(enFicha, `🔴 «${t}» ya no está en customerDetailView.js: los tres sitios han divergido`);
  }
});

test('SCRUM-615 · 🔴 el módulo no escribe NI UN texto de producto propio', () => {
  // Todo literal visible tiene que ser o uno de los cuatro reutilizados, o el marcador.
  const permitidos = new Set([mod.MARCADOR, mod.ETIQUETA, ...mod.OPCIONES.map((o) => o.texto)]);
  const bloque = mod.bloqueTipoDestinatario({ cliente: SIN_DATO, doc: docDeMentira() });
  for (const t of textosDe(bloque)) {
    assert.ok(permitidos.has(t), `🔴 TEXTO NUEVO SIN APROBAR en pantalla: «${t}» (regla 30)`);
  }
});

// ── ayudas ───────────────────────────────────────────────────────────────────────────────

function readFuente(rel) {
  return require_('node:fs').readFileSync(path.join(RAIZ, rel), 'utf8');
}

/**
 * ¿Aparece este texto como CONTENIDO exacto de un rótulo? Se busca entre delimitadores —comillas
 * o `>`…`<`— y NO con `includes` sobre el fuente pelado: «Particular» está dentro de «Particulares»
 * y de cualquier comentario, y eso daría por bueno un texto que ya no existe.
 */
function contieneTextoExacto(fuente, texto) {
  const esc = texto.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  return new RegExp(`(["'>])${esc}(["'<])`).test(fuente);
}
