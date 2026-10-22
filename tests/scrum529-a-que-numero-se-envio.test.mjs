// tests/scrum529-a-que-numero-se-envio.test.mjs — SCRUM-529
//
// CADA FILA DE UN ENVÍO DE WHATSAPP GUARDA A QUÉ NÚMERO SE MANDÓ.
//
// Hasta aquí el único rastro del destinatario era el teléfono de la ficha del cliente, que se
// corrige: el día que el profesional arreglaba un móvil mal puesto y reenviaba, desaparecía la
// única pista de a dónde había ido el envío anterior.
//
// QUÉ SE MIDE, y son tres cosas distintas:
//   ① EN MARCHA: cada sitio que apunta una fila de envío, ejercitado por el camino real de su
//      sender, y lo que le llega a la base. Son 15 apuntes directos y la reserva de la plantilla
//      (que nace ANTES de hablar con el proveedor: si no lo lleva ella, no lo lleva nadie).
//   ② EL ENTRANTE: no se mandó a ningún número. Se queda sin el dato, a propósito.
//   ③ POR ÁRBOL SINTÁCTICO: que el número sale de lo que se le da al proveedor y no de otro
//      sitio, y que el recuento de ① es la población entera y no una esquina.
//
// LA BASE Y EL PROVEEDOR SE DOBLAN con `_envio-doblado.mjs` (la base, por caché de `dist/`; el
// proveedor, con el dry-run que ya existe). Los senders son el código de producción tal cual.
//
// LO QUE ESTE TEST NO PRUEBA: que la columna exista en ninguna base, ni su tipo. Eso es del
// registro de `docs/MIGRATIONS_PENDING.md`.
//
// ⛔ Ni un byte hacia el proveedor: en dry-run no se llama, y sin dry-run el sender se para antes
// (sin credenciales). Los números son del rango imposible (SCRUM-262).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';
import { ejecutableDe } from './_guard-texto.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const TELEFONO = telefonoDePrueba(29);
// Un nombre que no está en la spec de plantillas: la validación J7 no es lo que se mide aquí, y en
// dry-run no llega al proveedor.
const PLANTILLA = { templateName: 'plantilla_de_laboratorio_529', languageCode: 'es', components: [] };

// La base se inyecta UNA vez y lo que cambia entre casos es este estado (lección de SCRUM-1436:
// los módulos que ya capturaron la base siguen contestando con la del primer caso).
const estado = { filas: [], ventana: 'cerrada', bajas: [], reservaRota: false, clientesDelNumero: [] };
inyectarBase({
  'whatsAppMessage.create': (a) => { estado.filas.push({ op: 'create', data: a.data }); return { id: 41 }; },
  'whatsAppMessage.createMany': (a) => { estado.filas.push({ op: 'createMany', data: a.data }); return { count: a.data.length }; },
  'whatsAppMessage.findFirst': (a) => (a?.where?.type === 'inbound' && estado.ventana === 'abierta' ? { id: 1 } : null),
  'customer.findMany': (a) => (a?.where?.waOptOut ? estado.bajas : estado.clientesDelNumero),
  'merchant.findUnique': () => { if (estado.reservaRota) throw new Error('la base no contesta'); return null; },
});

const { config } = moduloDeDist('../dist/core/config/env.js');
const wa = moduloDeDist('../dist/integrations/whatsapp.js');
const log = moduloDeDist('../dist/modules/messaging/domain/whatsappLog.service.js');

/** Las siete vías con apunte de fallo propio, con lo mínimo que pide cada una. */
const VIAS = Object.freeze({
  sendWhatsAppTemplate: { ...PLANTILLA },
  sendWhatsAppText: { text: 'hola' },
  sendWhatsAppButtons: { bodyText: 'cuerpo', buttons: [{ id: 'a', title: 'A' }] },
  sendWhatsAppList: { bodyText: 'cuerpo', buttonText: 'Ver', rows: [{ id: 'a', title: 'A' }] },
  sendWhatsAppCtaUrl: { bodyText: 'cuerpo', buttonText: 'Abrir', url: 'https://yaqu.app/x' },
  sendWhatsAppDocument: { link: 'https://yaqu.app/x.pdf', filename: 'x.pdf' },
  sendWhatsAppLocationRequest: { bodyText: 'cuerpo' },
});

/** Monta UN caso y lo deshace. `meta`: 'responde' = dry-run · 'sin-configurar' = sin credenciales. */
async function caso({ meta, ventana = 'cerrada', bajas = [], reservaRota = false }, cuerpo) {
  Object.assign(estado, { filas: [], ventana, bajas, reservaRota, clientesDelNumero: [] });
  const antes = { dry: process.env.WHATSAPP_DRY_RUN, id: config.WHATSAPP_PHONE_NUMBER_ID, token: config.WHATSAPP_ACCESS_TOKEN };
  globalThis.__waDryRunOutbox = [];
  if (meta === 'responde') {
    process.env.WHATSAPP_DRY_RUN = '1';
  } else {
    delete process.env.WHATSAPP_DRY_RUN;
    config.WHATSAPP_PHONE_NUMBER_ID = '';
    config.WHATSAPP_ACCESS_TOKEN = '';
  }
  try {
    const resultado = await cuerpo();
    await new Promise((r) => setImmediate(r)); // los apuntes son fire-and-forget
    return { resultado, filas: estado.filas.slice(), buzon: globalThis.__waDryRunOutbox.slice() };
  } finally {
    process.env.WHATSAPP_DRY_RUN = antes.dry;
    config.WHATSAPP_PHONE_NUMBER_ID = antes.id;
    config.WHATSAPP_ACCESS_TOKEN = antes.token;
    delete globalThis.__waDryRunOutbox;
  }
}

const enviar = (via, extra = {}) => wa[via]({ to: TELEFONO, merchantId: MERCHANT, ...VIAS[via], ...extra });

// ── 0 · SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-529 · SUELO: dist exporta las ocho vías y el doble de la base recoge lo que se apunta', async () => {
  for (const via of [...Object.keys(VIAS), 'sendWhatsAppWindowFirst']) {
    assert.equal(typeof wa[via], 'function', `CIEGO: dist no exporta ${via}`);
  }
  // Control del instrumento: un apunte directo llega al doble. Sin esto, «0 filas» abajo no diría nada.
  const c = await caso({ meta: 'responde' }, () => log.recordWaMessage({ merchantId: MERCHANT, type: 'service', toPhone: TELEFONO }));
  assert.equal(c.filas.length, 1, 'CIEGO: el doble de la base no recoge los apuntes');
});

// ── 1 · EN MARCHA: cada apunte de envío lleva el número ──────────────────────────────────────

test('SCRUM-529 · 🔴 el envío que NO sale deja su fila con el número, en las siete vías que apuntan el fallo', async () => {
  const vistas = [];
  for (const via of Object.keys(VIAS)) {
    const c = await caso({ meta: 'sin-configurar' }, () => enviar(via));
    assert.equal(c.resultado.ok, false, `${via}: sin credenciales no puede salir`);
    assert.equal(c.buzon.length, 0, `${via}: no tenía que llegar al proveedor`);
    assert.equal(c.filas.length, 1, `${via}: se esperaba UNA fila y hay ${c.filas.length}`);
    assert.equal(c.filas[0].data.status, 'failed', `${via}: la fila es la del fallo`);
    assert.equal(c.filas[0].data.toPhone, TELEFONO, `${via}: la fila del fallo no dice a qué número iba`);
    vistas.push(via);
  }
  assert.equal(vistas.length, 7, 'población: siete vías');
});

test('SCRUM-529 · 🔴 el envío que SALE deja su fila con el número, en las cinco vías de servicio que lo apuntan', async () => {
  const vias = ['sendWhatsAppButtons', 'sendWhatsAppList', 'sendWhatsAppCtaUrl', 'sendWhatsAppDocument', 'sendWhatsAppLocationRequest'];
  for (const via of vias) {
    const c = await caso({ meta: 'responde' }, () => enviar(via));
    assert.equal(c.resultado.ok, true, `${via}: en dry-run sale`);
    assert.deepEqual(c.buzon.map((e) => e.to), [TELEFONO], `${via}: el número que se le dio al proveedor`);
    assert.equal(c.filas.length, 1, `${via}: se esperaba UNA fila y hay ${c.filas.length}`);
    assert.equal(c.filas[0].data.status, 'sent', `${via}: la fila es la del envío`);
    assert.equal(c.filas[0].data.toPhone, c.buzon[0].to, `${via}: la fila no guarda el número que se le dio al proveedor`);
  }
});

test('SCRUM-529 · 🔴 la RESERVA de la plantilla nace con el número, antes de hablar con el proveedor', async () => {
  const c = await caso({ meta: 'responde' }, () => enviar('sendWhatsAppTemplate', { log: { customerId: CLIENTE } }));
  assert.equal(c.resultado.ok, true);
  assert.equal(c.filas.length, 1, 'con reserva hay UNA fila: la reserva, que luego se resuelve');
  assert.equal(c.filas[0].data.status, 'queued', 'la fila es la reserva');
  assert.equal(c.filas[0].data.toPhone, TELEFONO, 'la reserva no dice a qué número va');
  assert.equal(c.filas[0].data.toPhone, c.buzon[0].to, 'y es el mismo que se le dio al proveedor');
});

// SCRUM-1509g · Este caso decía «el tope es best-effort: sale igual». El fundador lo cambió en
// SCRUM-1509 c.19620 («Ok que el tope bloquee»): sin reserva NO sale. Lo que el 529 fija sigue en
// pie —la fila que queda lleva el número—, ahora sobre la fila del corte.
test('SCRUM-529 · 🔴 la plantilla SIN reserva (la base no contestó al tope) NO sale, y la fila del corte lleva el número', async () => {
  const c = await caso({ meta: 'responde', reservaRota: true }, () => enviar('sendWhatsAppTemplate'));
  assert.equal(c.resultado.ok, false, 'sin poder comprobar el tope, la plantilla no sale (c.19620)');
  assert.equal(c.resultado.reason, 'tope_no_comprobable');
  assert.equal(c.buzon.length, 0, 'no se le ha dado nada al proveedor');
  assert.equal(c.filas.length, 1);
  assert.equal(c.filas[0].data.status, 'failed', 'la fila es la del corte');
  assert.equal(c.filas[0].data.error, 'tope_no_comprobable');
  assert.equal(c.filas[0].data.type, 'template');
  assert.equal(c.filas[0].data.toPhone, TELEFONO, 'la fila del corte no dice a qué número se iba a mandar');
});

test('SCRUM-529 · 🔴 ventana-first: la fila del corte por baja lleva el número', async () => {
  const c = await caso(
    { meta: 'responde', bajas: [{ phone: `+${TELEFONO}`, mobile: null }] },
    () => wa.sendWhatsAppWindowFirst({ to: TELEFONO, merchantId: MERCHANT, customerId: CLIENTE, windowText: 't', template: PLANTILLA }),
  );
  assert.equal(c.resultado.reason, 'wa_opt_out', 'el caso tiene que ser el del corte, no otro');
  assert.equal(c.buzon.length, 0);
  assert.equal(c.filas.length, 1);
  assert.equal(c.filas[0].data.error, 'wa_opt_out');
  assert.equal(c.filas[0].data.toPhone, TELEFONO, 'la fila del corte no dice a qué número se iba a mandar');
});

test('SCRUM-529 · 🔴 ventana-first: la fila del envío por ventana lleva el número', async () => {
  const c = await caso(
    { meta: 'responde', ventana: 'abierta' },
    () => wa.sendWhatsAppWindowFirst({ to: TELEFONO, merchantId: MERCHANT, customerId: CLIENTE, windowText: 't', template: PLANTILLA }),
  );
  assert.equal(c.resultado.via, 'window', 'el caso tiene que ser el de la ventana, no la plantilla');
  assert.equal(c.filas.length, 1);
  assert.equal(c.filas[0].data.type, 'service');
  assert.equal(c.filas[0].data.status, 'sent');
  assert.equal(c.filas[0].data.toPhone, c.buzon[0].to);
});

// ── 2 · Lo que se queda SIN número, y por qué ────────────────────────────────────────────────

test('SCRUM-529 · el ENTRANTE no lleva número: nadie le mandó nada', async () => {
  Object.assign(estado, { filas: [], clientesDelNumero: [{ id: CLIENTE, merchantId: MERCHANT }] });
  await log.recordInboundWaMessage(TELEFONO);
  estado.clientesDelNumero = [];
  assert.equal(estado.filas.length, 1, 'CIEGO: el entrante no llegó a apuntarse');
  assert.equal(estado.filas[0].op, 'createMany');
  assert.equal(estado.filas[0].data.length, 1);
  assert.equal(estado.filas[0].data[0].type, 'inbound');
  assert.equal('toPhone' in estado.filas[0].data[0], false, 'un entrante no tiene destinatario que guardar');
});

test('SCRUM-529 · un apunte sin número guarda NULL, no un valor inventado', async () => {
  const c = await caso({ meta: 'responde' }, () => log.recordWaMessage({ merchantId: MERCHANT, type: 'service' }));
  assert.equal(c.filas.length, 1);
  assert.equal(c.filas[0].data.toPhone, null);
});

// ── 3 · Por árbol sintáctico: de dónde sale el número, y sobre cuántos sitios ────────────────

/** Las llamadas a `nombre(...)` de un fichero de `src/`, con el texto de su propiedad `toPhone`. */
function llamadas(rutaRelativa, nombre) {
  const ts = createRequire(import.meta.url)('typescript');
  const fuente = fs.readFileSync(path.join(RAIZ, rutaRelativa), 'utf8');
  const arbol = ts.createSourceFile(rutaRelativa, fuente, ts.ScriptTarget.Latest, true);
  const fuera = [];
  const visita = (nodo) => {
    if (ts.isCallExpression(nodo) && ts.isIdentifier(nodo.expression) && nodo.expression.text === nombre) {
      const objeto = nodo.arguments.find((a) => ts.isObjectLiteralExpression(a));
      const prop = objeto?.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText(arbol) === 'toPhone');
      fuera.push({
        linea: arbol.getLineAndCharacterOfPosition(nodo.getStart(arbol)).line + 1,
        toPhone: prop ? prop.initializer.getText(arbol) : null,
      });
    }
    ts.forEachChild(nodo, visita);
  };
  visita(arbol);
  return fuera;
}

test('SCRUM-529 · 🔴 todo apunte de envío del canal toma el número de lo que se le da al proveedor', () => {
  const apuntes = llamadas('src/integrations/whatsapp.ts', 'recordWaMessage');
  const reservas = llamadas('src/integrations/whatsapp.ts', 'reservarPlantilla');
  // SUELO: los casos de arriba ejercitan 15 apuntes (7 fallos, 5 envíos, la plantilla sin reserva
  // y los dos de ventana-first) y una reserva. Si aquí hay más, hay un apunte que nadie ejercita.
  assert.equal(apuntes.length, 15,
    `hay ${apuntes.length} apuntes en el canal y los casos en marcha cubren 15: añade el caso del nuevo`);
  assert.equal(reservas.length, 1, `hay ${reservas.length} reservas y los casos en marcha cubren una`);
  const mal = [...apuntes, ...reservas].filter((l) => l.toPhone !== 'params.to');
  assert.deepEqual(mal, [],
    'el número guardado tiene que ser el que se le da al proveedor (`params.to`), no el de la ficha '
    + 'del cliente ni ningún otro: ' + JSON.stringify(mal));
});

test('SCRUM-529 · el instrumento de árbol distingue un apunte sin número de uno con él', () => {
  // Control sobre el servicio, donde se sabe la respuesta: no llama a `recordWaMessage` (la define).
  assert.deepEqual(llamadas('src/modules/messaging/domain/whatsappLog.service.ts', 'recordWaMessage'), []);
  // Y ve un nombre que sí se llama allí, sin `toPhone` en sus argumentos.
  const otras = llamadas('src/modules/messaging/domain/whatsappLog.service.ts', 'plantillasDeHoy');
  assert.equal(otras.length >= 2, true, 'CIEGO: no ve llamadas que sí están');
  assert.equal(otras.every((l) => l.toPhone === null), true);
});

// ── 4 · El esquema dice lo mismo que el DDL aplicado ─────────────────────────────────────────

test('SCRUM-529 · la columna del esquema es la del DDL: opcional, sin valor por defecto', () => {
  const esquema = fs.readFileSync(path.join(RAIZ, 'prisma', 'schema.prisma'), 'utf8').replace(/\r/g, '');
  const modelo = /\nmodel WhatsAppMessage \{\n([\s\S]*?)\n\}/.exec(esquema);
  assert.ok(modelo, 'CIEGO: no encuentro el modelo WhatsAppMessage');
  const lineas = modelo[1].split('\n').filter((l) => /^\s*toPhone\s/.test(l));
  assert.equal(lineas.length, 1, 'una sola declaración de la columna');
  // El comentario de la línea se quita con el filtro de la casa (SCRUM-700): uno propio que corte
  // en cualquier barra doble ciega lo que venga detrás de una URL.
  // Con suelo (SCRUM-1395): si el filtro se quedara ciego, `toPhone` no sobreviviría y esto lanza.
  const sinComentario = ejecutableDe(lineas[0], {
    ancla: 'toPhone', donde: 'prisma/schema.prisma · WhatsAppMessage', almohadillaEsComentario: false,
  }).trimEnd();
  assert.match(sinComentario, /^\s*toPhone\s+String\?\s+@map\("to_phone"\)$/,
    'opcional y sin `@default`: NULL es «no se sabe», y un valor por defecto lo inventaría');
  const ddl = fs.readFileSync(path.join(RAIZ, 'docs', 'sql', 'scrum-529-to-phone.sql'), 'utf8');
  assert.match(ddl, /\nALTER TABLE "whatsapp_messages"\s+ADD COLUMN IF NOT EXISTS "to_phone" TEXT;/);
});
