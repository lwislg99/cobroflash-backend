// tests/scrum590b-el-campo-en-la-pantalla.test.mjs — SCRUM-590 (CONT-19)
//
// DE LA PANTALLA AL NÚMERO — el viaje entero, ejecutado.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 POR QUÉ ESTE FICHERO EXISTE, Y POR QUÉ NO BASTABA EL ANTERIOR
//
// `scrum590-el-movil-es-el-canal` demuestra que, DADO un cliente con móvil, el documento sale al
// móvil. Eso deja fuera la mitad que toca al profesional: **que el móvil se pueda guardar desde la
// pantalla**. El ticket se cerró una vez con esa mitad sin construir, y un falso verde es peor que
// un falso rojo.
//
// Aquí el viaje se recorre entero y EJECUTÁNDOLO:
//
//   ① el profesional escribe el móvil EN EL MODAL DE VERDAD (el banco de vistas monta
//      `renderCustomersView` con sus scripts reales, en orden, en un solo contexto);
//   ② se pulsa Guardar y se captura EL PAYLOAD que sale por `fetch`;
//   ③ ese payload cruza la puerta REAL del servidor (`customerCreateSchema`);
//   ④ se guarda por el camino REAL (`createCustomer`, con la base doblada) y se recoge la fila
//      que se habría escrito — con su normalización de servidor incluida;
//   ⑤ esa fila se mete en el camino REAL de envío y se mira A QUÉ NÚMERO salió.
//
// Si cualquiera de los cinco eslabones se rompe, el campo es decorativo. Probar sólo ① y ② sería
// probar un formulario, no el ticket.
//
// ⛔ NO SE MANDA NINGÚN MENSAJE A NINGÚN NÚMERO REAL: la base y Meta van doblados
//    (`_envio-doblado.mjs`, `WHATSAPP_DRY_RUN=1`), y los números salen del RANGO IMPOSIBLE
//    `34 0XX…` (SCRUM-262), que ningún abonado puede tener.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { enviarPresupuestoDeVerdad, inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';
import { telefonoDePrueba, tramoNacionalDePrueba } from '../scripts/_telefonos-prueba.mjs';
import { switchFormaJuridica } from '../public/dashboard/js/switchFormaJuridica.js';

const requiere = createRequire(import.meta.url);
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODAL = path.join(RAIZ, 'public', 'dashboard', 'js', 'customersView.js');
const FICHA_360 = path.join(RAIZ, 'public', 'dashboard', 'js', 'customerDetailView.js');

/**
 * 🔴 EL RÓTULO FIRMADO POR EL FUNDADOR el 7-sep-2026, y se fija con `===`.
 *
 * No es celo: es la lección de SCRUM-575, que dejó su texto comparado por igualdad exacta para que
 * un retoque «de paso» no pudiera cambiar un literal aprobado sin que algo se pusiera rojo.
 */
const ROTULO_FIRMADO = 'Móvil (WhatsApp)';

// Rango IMPOSIBLE (SCRUM-262). El formulario recibe el TRAMO NACIONAL —el prefijo lo pone su
// selector— y `tramoNacionalDePrueba` falla en voz alta si el índice produjera un tramo que la
// normalización convertiría en cadena vacía (dos vacíos comparan iguales y el test pasaría en
// vacío, que es el falso verde que esa función existe para impedir).
const FIJO_NACIONAL = tramoNacionalDePrueba(10000001);
const MOVIL_NACIONAL = tramoNacionalDePrueba(20000002);
const FIJO = telefonoDePrueba(10000001);   // lo que debe quedar guardado
const MOVIL = telefonoDePrueba(20000002);

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① EL FORMULARIO DE VERDAD — se monta, se escribe y se pulsa Guardar
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Monta el modal REAL, escribe lo que se le diga y devuelve el payload que salió por la red. */
async function guardarDesdeLaPantalla({ fijo = '', movil = '' }) {
  const peticiones = [];
  const banco = cargarDashboard(RAIZ, {
    datos: (url, opciones) => {
      peticiones.push({ url: String(url || ''), opciones });
      return url && /\/admin\/customers$/.test(String(url)) ? { id: 1, name: 'Cliente' } : [];
    },
  });
  assert.deepEqual(banco.fallos, [], 'un script del panel no cargó: nada de lo de abajo mediría');

  const r = await pintarVista(banco, 'renderCustomersView');
  assert.equal(r.error, null, `la vista de Clientes no montó: ${r.error && r.error.message}`);

  banco.ctx.altaClienteModal.abrirNuevo({});
  const nodos = todos(banco.ctx.document.body);
  const control = (nombre) => {
    const encontrados = nodos.filter((n) => n.name === nombre);
    assert.equal(encontrados.length, 1,
      `🔴 CIEGO: esperaba UN control llamado \`${nombre}\` en el modal y hay ${encontrados.length}. ` +
      'Sin él no se puede afirmar nada sobre lo que el profesional escribe.');
    return encontrados[0];
  };

  control('name').value = 'Reformas Ejemplo SL';
  // ⚠️ EL EMAIL SE RELLENA, y no es adorno: HOY el modal manda `email: ""` cuando está vacío y
  // `z.string().email()` lo RECHAZA — o sea que un cliente sin email NO se puede guardar desde
  // esta pantalla. Es un defecto PREEXISTENTE que este test destapó al recorrer el camino real;
  // está registrado en `docs/BUGS.md` y NO se arregla aquí (regla 37: otro carril, y arreglarlo
  // «de paso» sin registrarlo es justo lo que la casa prohíbe). Se le da un email para poder
  // medir LO DE ESTE TICKET, que es el móvil.
  control('email').value = 'cliente@ejemplo.test';
  control('phone').value = fijo;
  control('mobile').value = movil;

  const formularios = nodos.filter((n) => n.tagName === 'FORM' && (n._oyentes.submit || []).length);
  assert.equal(formularios.length, 1, '🔴 CIEGO: no encuentro el formulario del modal con su oyente de Guardar');
  formularios[0].disparar('submit');
  for (let i = 0; i < 20; i++) await new Promise((res) => setImmediate(res)); // el guardado es async

  const alta = peticiones.find((p) => /\/admin\/customers$/.test(p.url) && p.opciones?.method === 'POST');
  assert.ok(alta, `🔴 pulsar Guardar no produjo un alta. Peticiones vistas: ${JSON.stringify(peticiones.map((p) => p.url))}`);
  return JSON.parse(alta.opciones.body);
}

/** El payload cruza la puerta del servidor y se guarda por el camino real. Devuelve la fila. */
function guardarEnElServidor(payload) {
  const escritas = [];
  inyectarBase(
    { 'customer.create': (args) => ({ id: CLIENTE, ...args.data }) },
    ['../dist/modules/system/customerAdmin.js'],
  );
  const { customerCreateSchema } = moduloDeDist('../dist/core/validation/schemas.js');
  const validado = customerCreateSchema.parse(payload); // ③ la puerta REAL: lanza si no pasa

  // ④ el camino REAL de alta, con su normalización de servidor (`normalizarIdentificadores`).
  const { createCustomer } = moduloDeDist('../dist/modules/system/customerAdmin.js');
  return { validado, createCustomer, escritas };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL RÓTULO
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-590b · 🔴 el rótulo FIRMADO está, LITERAL, en los DOS formularios de cliente', () => {
  const modal = fs.readFileSync(MODAL, 'utf8');
  const ficha = fs.readFileSync(FICHA_360, 'utf8');

  // Comparado con `===` contra la constante, no con un `includes` laxo: es un texto firmado.
  const casa = /const ROTULO_MOVIL = "([^"]*)";/.exec(modal);
  assert.ok(casa, '🔴 el modal ya no declara `ROTULO_MOVIL`');
  assert.equal(casa[1], ROTULO_FIRMADO,
    '🔴 el rótulo firmado por el fundador ha cambiado. No se retoca «de paso»: se vuelve a firmar.');

  // 🔴 EL `>` NO VA PEGADO A LA ETIQUETA, y lo exige el trinquete de SCRUM-553 con razón: un
  // `<label>` literal deja de encontrar el rótulo en cuanto alguien le añade un atributo
  // (`<label for="…">`), y lo hace EN SILENCIO — el guard pasaría a verde sin vigilar nada.
  // El rótulo lleva paréntesis, que en una expresión regular son grupos: se escapan los
  // metacaracteres antes de montarla, o «Móvil (WhatsApp)» casaría con «MóvilWhatsApp».
  const literal = ROTULO_FIRMADO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(ficha, new RegExp(`<label[^>]*>${literal}</label>`),
    '🔴 la ficha 360 no lleva el rótulo firmado, o lo lleva con otra grafía. Los DOS formularios '
    + 'dicen lo mismo o el profesional ve dos productos distintos.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CONTROL QUE DECIDE
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-590b · 🔴 EL QUE DECIDE: se guarda un móvil DESDE LA PANTALLA y el documento sale A ESE NÚMERO', async () => {
  // ①② la pantalla
  const payload = await guardarDesdeLaPantalla({ fijo: FIJO_NACIONAL, movil: MOVIL_NACIONAL });
  assert.equal(payload.phone, FIJO, 'el fijo no viajó como se tecleó (prefijo + número)');
  assert.equal(payload.mobile, MOVIL,
    `🔴 el móvil NO viaja en el alta. Payload: ${JSON.stringify(payload)}`);

  // ③④ la puerta y el guardado
  const { validado, createCustomer } = guardarEnElServidor(payload);
  assert.equal(validado.mobile, MOVIL, '🔴 el esquema del servidor se come el móvil');
  const fila = await createCustomer(MERCHANT, validado);
  assert.equal(fila.mobile, MOVIL, '🔴 lo que se guarda no lleva el móvil que se tecleó');
  assert.equal(fila.phone, FIJO, 'el fijo tiene que seguir guardándose igual');

  // ⑤ EL ENVÍO, por el camino real
  const { resultado, destinos, buzon } = await enviarPresupuestoDeVerdad({
    cliente: { id: CLIENTE, name: fila.name, phone: fila.phone, mobile: fila.mobile },
  });
  assert.ok(buzon.length > 0,
    `CIEGO: el camino de envío no produjo ni un mensaje (${JSON.stringify(resultado)}). Sin salida `
    + 'no se puede afirmar a qué número fue.');
  assert.equal(resultado.ok, true, `el envío falló: ${JSON.stringify(resultado)}`);
  assert.ok(destinos.includes(MOVIL),
    `🔴 el documento NO salió al móvil que el profesional guardó. Destinos: ${JSON.stringify(destinos)}`);

  // EL SENTIDO CONTRARIO, PEGADO: y NO salió al fijo.
  assert.ok(!destinos.includes(FIJO),
    `🔴 el documento salió TAMBIÉN al fijo (${FIJO}). Destinos: ${JSON.stringify(destinos)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ✅ POSITIVO · el campo es OPCIONAL y no puede volverse obligatorio de rebote
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-590b · ✅ POSITIVO: sólo teléfono fijo — se guarda igual que hoy y el documento le llega', async () => {
  const payload = await guardarDesdeLaPantalla({ fijo: FIJO_NACIONAL, movil: '' });

  // 🔴 LA CLAVE `mobile` NO PUEDE VIAJAR VACÍA. Medido ejecutando el esquema: `""` y `null` lo
  // RECHAZAN, así que mandar el vacío haría que guardar un cliente SIN móvil devolviera un 400 —
  // un campo opcional que rompe el guardado del cliente entero es obligatorio de rebote.
  assert.ok(!('mobile' in payload),
    `🔴 el móvil vacío VIAJA en el payload (${JSON.stringify(payload.mobile)}): el campo se ha `
    + 'vuelto obligatorio de rebote y un cliente sin móvil ya no se puede guardar.');

  const { validado, createCustomer } = guardarEnElServidor(payload);
  const fila = await createCustomer(MERCHANT, validado);
  assert.equal(fila.phone, FIJO);

  const { resultado, destinos } = await enviarPresupuestoDeVerdad({
    cliente: { id: CLIENTE, name: 'Juan Pérez', phone: fila.phone, mobile: fila.mobile ?? null },
  });
  assert.equal(resultado.ok, true, `el envío falló: ${JSON.stringify(resultado)}`);
  assert.deepEqual([...new Set(destinos)], [FIJO],
    `🔴 un cliente con un solo número tiene que seguir recibiendo ahí. Destinos: ${JSON.stringify(destinos)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ✅ NEGATIVO · la baja sobre el MÓVIL manda, con el fijo limpio
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-590b · ✅ NEGATIVO: con el opt-out sobre el MÓVIL no se manda, aunque el fijo esté limpio', async () => {
  const payload = await guardarDesdeLaPantalla({ fijo: FIJO_NACIONAL, movil: MOVIL_NACIONAL });
  const { validado, createCustomer } = guardarEnElServidor(payload);
  const fila = await createCustomer(MERCHANT, validado);

  const { resultado, buzon } = await enviarPresupuestoDeVerdad({
    cliente: { id: CLIENTE, name: fila.name, phone: fila.phone, mobile: fila.mobile },
    // La fila dada de baja lleva el móvil y NO tiene fijo: así el bloqueo sólo puede venir del
    // móvil. Con la comprobación anterior —que miraba sólo `phone`— aquí no habría coincidido nada.
    dadosDeBaja: [{ phone: null, mobile: MOVIL }],
  });
  assert.equal(resultado.ok, false, '🔴 se envió a un número dado de baja');
  assert.equal(resultado.reason, 'wa_opt_out', `el motivo debería ser la baja: ${JSON.stringify(resultado)}`);
  assert.equal(buzon.length, 0, '🔴 no debería salir NADA');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL LADO · Empresa y Persona
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-590b · el campo se ve en los DOS lados (Empresa y Persona) — medido, no supuesto', () => {
  // La regla se EJECUTA, no se lee: `SOLO_EMPRESA` es la lista de los que el lado Persona esconde.
  assert.deepEqual(switchFormaJuridica.SOLO_EMPRESA, ['legalName'],
    '🔴 la lista de campos que dependen del lado ha cambiado. Si el móvil entrara ahí, una ficha '
    + 'marcada como Persona escondería el número por el que se le escribe.');
  assert.equal(switchFormaJuridica.SOLO_EMPRESA.includes('mobile'), false,
    '🔴 el móvil se esconde en el lado Persona: un móvil es canal de contacto, no forma jurídica.');

  // Y el modal NO se lo pasa a `aplicarLado`, que es lo que de verdad decide en pantalla.
  const modal = fs.readFileSync(MODAL, 'utf8');
  for (const bloque of modal.split('aplicarLado(').slice(1)) {
    const mapa = bloque.slice(0, bloque.indexOf('}'));
    assert.equal(/\bmobile\b/.test(mapa), false,
      '🔴 el campo del móvil se está pasando al conmutador de lado: dejaría de verse en Persona.');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⛔ LA PROHIBICIÓN · el móvil NO entra en la deduplicación
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-590b · ⛔ el móvil NO se ha metido en la deduplicación — sigue en la mesa del fundador', () => {
  // Se ejecuta la función del producto, no se lee: un móvil que coincida con el teléfono de otro
  // cliente NO puede avisar todavía, porque esa decisión no es de esta sesión.
  const { buscarCoincidencias } = requiere('../dist/modules/system/domain/identificadoresDuplicados.js');

  // CONTROL POSITIVO del instrumento: por `phone` SÍ coincide. Sin esto, un «no coincide» podría
  // significar que la función está rota y el test pasaría sin medir nada.
  assert.ok(buscarCoincidencias({ id: 1, phone: FIJO }, [{ id: 2, phone: FIJO }]).length > 0,
    '🔴 CIEGO: la deduplicación no coincide ni por teléfono; lo de abajo no probaría nada.');

  assert.deepEqual(buscarCoincidencias({ id: 1, mobile: MOVIL }, [{ id: 2, phone: MOVIL }]), [],
    '🔴 el móvil ha entrado en la deduplicación. Es una decisión del fundador, no de este PR: '
    + 'una línea en `IDENTIFICADORES` y el cruce sale solo, pero se decide antes.');

  // Y el modal no lo manda a preguntar.
  const modal = fs.readFileSync(MODAL, 'utf8');
  const bloque = modal.slice(modal.indexOf('async function comprobarDuplicados'), modal.indexOf('function buildModal'));
  assert.ok(bloque.length > 200, '🔴 SUELO: no encuentro la comprobación de duplicados');
  assert.equal(/params\.set\(\s*["']mobile["']/.test(bloque), false,
    '🔴 el formulario está preguntando por el móvil en la comprobación de duplicados.');
});
