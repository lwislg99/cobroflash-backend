// tests/scrum1005b-documentos-cliente.test.mjs — SCRUM-1005b (carril J2)
//
// DOCUMENTOS ADJUNTOS DEL CLIENTE, el SERVIDOR. Las decisiones son del fundador (SCRUM-1005
// c.22140): 10 MB por fichero, 100 MB por cliente, sólo `application/pdf`, `image/jpeg` e
// `image/png`, y al borrar un cliente se borran sus documentos. La pestaña y sus textos NO están
// aquí (1005c, regla 39): el servidor contesta CÓDIGOS, ninguna frase.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// Se llama a la RUTA REAL: el router de `dist/`, montado en Express y pedido por `node:http`
// (A10: «un test que saca el handler de su ruta prueba el handler, no la ruta»). La sesión va
// doblada y la base es una tabla en memoria que casa los `where` por TODOS sus campos, respeta
// el `select` (así se ve si la lista pide los bytes) y suma `sizeBytes` en `aggregate`.
//
// 🔴 Por qué el positivo va SEMBRADO: el primer caso demuestra que el banco SABE devolver el
// documento de un comercio cuando lo pide su dueño. Sin él, «el comercio B recibe 404» sería
// indistinguible de un banco que no devuelve nada a nadie.
//
// Los bordes salen de las constantes que exporta `customerAdmin.ts` (DOC_MAX_BYTES,
// DOCS_MAX_BYTES_POR_CLIENTE), no de literales: si el fundador mueve el tope, el test lo sigue.
// Contra el `dist/` de main (antes de 1005b) cae: ni las rutas ni las constantes existen.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { inyectarBase, moduloDeDist } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const requiere = createRequire(import.meta.url);

// Catálogo del meta-guard (SCRUM-1387 / A3, SCRUM-1731). Las dos que pide el encargo.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Sin el comercio en el `where`, una fila de otro comercio que case POR NÚMERO se cuela.
    fichero: 'src/modules/system/customerAdmin.ts',
    de: "return { merchantId, entityType: 'customer', entityId: customerId, kind: 'document' };",
    a: "return { entityType: 'customer', entityId: customerId, kind: 'document' };",
    cae: 'una fila de OTRO comercio que casa por número no se ve',
  },
  {
    // Borrar el cliente deja sus documentos huérfanos, con sus datos personales dentro.
    fichero: 'src/modules/system/customerAdmin.ts',
    de: "  if (r.count > 0) await tx.attachment.deleteMany({ where: { merchantId, entityType: 'customer', entityId: id } });\n",
    a: '',
    cae: 'borrar el cliente se lleva sus documentos',
  },
  {
    // Sin el rol en la ruta, el técnico borra un documento que no se recupera (SCRUM-1005 c.22192).
    fichero: 'src/modules/system/app/routes/customersAdmin.routes.ts',
    de: "router.delete('/:id/documentos/:docId', requireRole('admin'), async (req, res) => {",
    a: "router.delete('/:id/documentos/:docId', async (req, res) => {",
    cae: 'el técnico ve y sube, pero NO borra',
  },
];

const A = 2; // el comercio de la sesión
const B = 3; // otro comercio
const CLI_A = 10; // cliente de A
const CLI_A2 = 11; // otro cliente de A
const CLI_B = 20; // cliente de B

let customers = [];
let attachments = [];
let siguienteId = 1;

const casa = (fila, where = {}) => Object.entries(where).every(([k, v]) => fila[k] === v);
const proyecta = (fila, select) =>
  select ? Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, fila[k]])) : { ...fila };

const respuestas = {
  'customer.findFirst': ({ where, select }) => {
    const f = customers.find((c) => casa(c, where));
    return f ? proyecta(f, select) : null;
  },
  'customer.updateMany': ({ where, data }) => {
    const t = customers.filter((c) => casa(c, where));
    for (const c of t) Object.assign(c, data);
    return { count: t.length };
  },
  'customer.deleteMany': ({ where }) => {
    const antes = customers.length;
    customers = customers.filter((c) => !casa(c, where));
    return { count: antes - customers.length };
  },
  'attachment.findMany': ({ where, select }) => attachments.filter((a) => casa(a, where)).map((a) => proyecta(a, select)),
  'attachment.findFirst': ({ where, select }) => {
    const f = attachments.find((a) => casa(a, where));
    return f ? proyecta(f, select) : null;
  },
  'attachment.aggregate': ({ where, _sum }) => {
    assert.ok(_sum && _sum.sizeBytes, 'el tope por cliente se suma con aggregate._sum.sizeBytes');
    const filas = attachments.filter((a) => casa(a, where));
    return { _sum: { sizeBytes: filas.length ? filas.reduce((s, a) => s + (a.sizeBytes ?? 0), 0) : null } };
  },
  'attachment.create': ({ data, select }) => {
    const fila = { id: siguienteId++, createdAt: new Date('2026-11-19T12:00:00Z'), ...data };
    attachments.push(fila);
    return proyecta(fila, select);
  },
  'attachment.update': ({ where, data, select }) => {
    const f = attachments.find((a) => a.id === where.id);
    Object.assign(f, data);
    return proyecta(f, select);
  },
  'attachment.deleteMany': ({ where }) => {
    const antes = attachments.length;
    attachments = attachments.filter((a) => !casa(a, where));
    return { count: antes - attachments.length };
  },
};
inyectarBase(respuestas, ['../dist/modules/system/customerAdmin.js']);

const express = requiere('express');
const ca = moduloDeDist('../dist/modules/system/customerAdmin.js');
const router = moduloDeDist('../dist/modules/system/app/routes/customersAdmin.routes.js').default;

const PDF = (n) => { const b = Buffer.alloc(n, 0x20); Buffer.from('%PDF-1.7\n').copy(b); return b; };
const JPG = (n) => { const b = Buffer.alloc(n, 0); Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(b); return b; };
const PNG = (n) => { const b = Buffer.alloc(n, 0); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b); return b; };
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

function sembrar() {
  siguienteId = 100;
  customers = [
    { id: CLI_A, merchantId: A, name: 'Cliente A', companyId: null },
    { id: CLI_A2, merchantId: A, name: 'Otro de A', companyId: null },
    { id: CLI_B, merchantId: B, name: 'Cliente B', companyId: null },
  ];
  const docA = PDF(64);
  const docB = PDF(65);
  attachments = [
    // El documento de A, de su cliente: el POSITIVO sembrado.
    { id: 1, merchantId: A, entityType: 'customer', entityId: CLI_A, kind: 'document', url: '', data: docA, mime: 'application/pdf', fileName: 'contrato.pdf', sizeBytes: docA.length, sha256: sha(docA), createdAt: new Date() },
    // El de B, de su cliente.
    { id: 2, merchantId: B, entityType: 'customer', entityId: CLI_B, kind: 'document', url: '', data: docB, mime: 'application/pdf', fileName: 'de-b.pdf', sizeBytes: docB.length, sha256: sha(docB), createdAt: new Date() },
    // 🔴 Una fila de B que casa POR NÚMERO con el cliente de A (entityId = CLI_A). Sólo el
    // `merchantId` del `where` la separa (regla 2): es lo que caza la primera mutación.
    { id: 3, merchantId: B, entityType: 'customer', entityId: CLI_A, kind: 'document', url: '', data: docB, mime: 'application/pdf', fileName: 'intrusa.pdf', sizeBytes: docB.length, sha256: sha(docB), createdAt: new Date() },
    // Una foto de solicitud con el mismo número: otro `entityType`, no es un documento del cliente.
    { id: 4, merchantId: A, entityType: 'quote_request', entityId: CLI_A, kind: 'photo', url: '', data: Buffer.from('x'), mime: 'image/png', createdAt: new Date() },
  ];
}

/** Pide a la ruta real como el comercio `merchantId`. Devuelve estado, cabeceras y cuerpo crudo. */
async function pedir(metodo, ruta, { cuerpo, tipo, nombre, merchantId = A, rol = 'admin' } = {}) {
  const app = express();
  app.use(express.json({ limit: '2mb' })); // el parser global de la casa (src/app.ts): 2 MB
  app.use((req, _res, next) => { Object.assign(req, reqDeSesion({ rol, merchantId })); next(); });
  app.use('/admin/customers', router);
  const srv = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)); });
  const callar = console.error; console.error = () => {};
  try {
    return await new Promise((ok, ko) => {
      const datos = cuerpo ?? Buffer.alloc(0);
      const cab = { 'content-length': datos.length };
      if (tipo) cab['content-type'] = tipo;
      if (nombre !== undefined) cab['x-nombre-fichero'] = nombre;
      const pet = http.request({ host: '127.0.0.1', port: srv.address().port, path: ruta, method: metodo, headers: cab }, (res) => {
        const trozos = [];
        res.on('data', (c) => trozos.push(c));
        res.on('end', () => {
          const crudo = Buffer.concat(trozos);
          let json;
          try { json = crudo.length ? JSON.parse(crudo.toString('utf8')) : undefined; } catch { json = undefined; }
          ok({ status: res.statusCode, headers: res.headers, crudo, json });
        });
      });
      pet.on('error', ko);
      pet.end(datos);
    });
  } finally {
    console.error = callar;
    await new Promise((ok) => srv.close(ok));
  }
}

const subir = (cli, cuerpo, tipo = 'application/pdf', nombre = 'doc.pdf', opciones = {}) =>
  pedir('POST', `/admin/customers/${cli}/documentos`, { cuerpo, tipo, nombre: encodeURIComponent(nombre), ...opciones });

test('SCRUM-1005b · ✅ control del banco: el dueño SÍ ve su documento sembrado (positivo)', async () => {
  sembrar();
  const r = await pedir('GET', `/admin/customers/${CLI_A}/documentos`);
  assert.equal(r.status, 200, `la lista contesta ${r.status}`);
  const ids = r.json.documentos.map((d) => d.id);
  assert.deepEqual(ids, [1], '🔴 el banco no devuelve el documento sembrado de A: «404 para B» no probaría nada');
});

test('SCRUM-1005b · la lista no lleva los bytes y sí el nombre y el tamaño', async () => {
  sembrar();
  const r = await pedir('GET', `/admin/customers/${CLI_A}/documentos`);
  const [d] = r.json.documentos;
  assert.equal('data' in d, false, '🔴 la lista devuelve los bytea: con 100 MB por cliente eso es la lista entera en memoria');
  assert.equal(d.fileName, 'contrato.pdf');
  assert.equal(d.sizeBytes, 64);
  assert.equal(d.mime, 'application/pdf');
});

test('SCRUM-1005b · 🔴 tenancy: el comercio B recibe 404 con el cliente y el documento de A', async () => {
  sembrar();
  const lista = await pedir('GET', `/admin/customers/${CLI_A}/documentos`, { merchantId: B });
  assert.equal(lista.status, 404);
  const desc = await pedir('GET', `/admin/customers/${CLI_A}/documentos/1`, { merchantId: B });
  assert.equal(desc.status, 404);
  assert.equal(desc.crudo.includes(Buffer.from('%PDF')), false, '🔴 B se ha llevado los bytes de A');
  const borra = await pedir('DELETE', `/admin/customers/${CLI_A}/documentos/1`, { merchantId: B });
  assert.equal(borra.status, 404);
  assert.ok(attachments.some((a) => a.id === 1), '🔴 B ha borrado el documento de A');
  const antes = attachments.length;
  const sube = await subir(CLI_A, PDF(10), 'application/pdf', 'x.pdf', { merchantId: B });
  assert.equal(sube.status, 404);
  assert.equal(attachments.length, antes, '🔴 B ha colgado un documento en el cliente de A');
});

test('SCRUM-1005b · 🔴 una fila de OTRO comercio que casa por número no se ve, ni se descarga, ni se borra', async () => {
  sembrar();
  const r = await pedir('GET', `/admin/customers/${CLI_A}/documentos`);
  assert.equal(r.json.documentos.some((d) => d.id === 3), false,
    '🔴 FUGA ENTRE INQUILINOS: la lista de A enseña una fila de B porque su entityId coincide POR NÚMERO');
  const d = await pedir('GET', `/admin/customers/${CLI_A}/documentos/3`);
  assert.equal(d.status, 404, '🔴 A descarga un documento de B');
  const b = await pedir('DELETE', `/admin/customers/${CLI_A}/documentos/3`);
  assert.equal(b.status, 404);
  assert.ok(attachments.some((a) => a.id === 3), '🔴 A ha borrado una fila de B');
});

test('SCRUM-1005b · tope por fichero: DOC_MAX_BYTES entra, DOC_MAX_BYTES + 1 no (FICHERO_DEMASIADO_GRANDE)', async () => {
  assert.equal(typeof ca.DOC_MAX_BYTES, 'number', 'customerAdmin no exporta DOC_MAX_BYTES');
  sembrar();
  const justo = await subir(CLI_A, PDF(ca.DOC_MAX_BYTES));
  assert.equal(justo.status, 201, `un fichero de exactamente el tope contesta ${justo.status} ${justo.crudo.toString().slice(0, 120)}`);
  sembrar();
  const antes = attachments.length;
  const pasa = await subir(CLI_A, PDF(ca.DOC_MAX_BYTES + 1));
  assert.equal(pasa.status, 413);
  assert.equal(pasa.json?.error, 'FICHERO_DEMASIADO_GRANDE');
  assert.equal(attachments.length, antes);
});

test('SCRUM-1005b · un fichero de más de 2 MB entra (el parser global de 2 MB no lo lee)', async () => {
  sembrar();
  const dosMasUno = 2 * 1024 * 1024 + 1;
  assert.ok(dosMasUno < ca.DOC_MAX_BYTES, 'el caso sólo vale si 2 MB + 1 cabe en el tope');
  const r = await subir(CLI_A, PDF(dosMasUno), 'application/pdf', 'grande.pdf');
  assert.equal(r.status, 201, `contesta ${r.status}`);
  const fila = attachments.find((a) => a.id === r.json.documento.id);
  assert.equal(fila.sizeBytes, dosMasUno);
  assert.equal(Buffer.from(fila.data).length, dosMasUno, '🔴 se han guardado menos bytes de los subidos');
});

test('SCRUM-1005b · tope por cliente: hasta DOCS_MAX_BYTES_POR_CLIENTE entra, un byte más no (TOPE_DEL_CLIENTE)', async () => {
  assert.equal(typeof ca.DOCS_MAX_BYTES_POR_CLIENTE, 'number');
  const preparar = (quedan) => {
    sembrar();
    // El cliente A ya tiene el sembrado (64 B); se le añade lo que falte hasta dejar `quedan` libres.
    const usado = attachments.filter((a) => a.merchantId === A && a.entityType === 'customer' && a.entityId === CLI_A).reduce((s, a) => s + a.sizeBytes, 0);
    attachments.push({ id: 50, merchantId: A, entityType: 'customer', entityId: CLI_A, kind: 'document', url: '', data: null, mime: 'application/pdf', fileName: 'relleno.pdf', sizeBytes: ca.DOCS_MAX_BYTES_POR_CLIENTE - quedan - usado, sha256: 'relleno', createdAt: new Date() });
  };
  preparar(100);
  const justo = await subir(CLI_A, PDF(100));
  assert.equal(justo.status, 201, `llenar el tope exacto contesta ${justo.status}`);
  preparar(100);
  const pasa = await subir(CLI_A, PDF(101));
  assert.equal(pasa.status, 409);
  assert.equal(pasa.json?.error, 'TOPE_DEL_CLIENTE');
  // El tope es POR CLIENTE: otro cliente del mismo comercio no se ve afectado.
  const otro = await subir(CLI_A2, PDF(101));
  assert.equal(otro.status, 201, '🔴 el tope de un cliente ha cerrado la subida a otro');
});

test('SCRUM-1005b · formatos: PDF, JPEG y PNG entran; SVG, HTML y un HTML disfrazado de PDF no (FORMATO_NO_ADMITIDO)', async () => {
  assert.deepEqual([...ca.DOC_MIME_ADMITIDOS].sort(), ['application/pdf', 'image/jpeg', 'image/png']);
  sembrar();
  assert.equal((await subir(CLI_A, PDF(200), 'application/pdf', 'a.pdf')).status, 201);
  assert.equal((await subir(CLI_A, JPG(200), 'image/jpeg', 'b.jpg')).status, 201);
  assert.equal((await subir(CLI_A, PNG(200), 'image/png', 'c.png')).status, 201);
  const antes = attachments.length;
  const svg = await subir(CLI_A, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'), 'image/svg+xml', 'd.svg');
  assert.equal(svg.status, 415);
  assert.equal(svg.json?.error, 'FORMATO_NO_ADMITIDO');
  const html = await subir(CLI_A, Buffer.from('<html><script>1</script></html>'), 'text/html', 'e.html');
  assert.equal(html.status, 415);
  assert.equal(html.json?.error, 'FORMATO_NO_ADMITIDO');
  const disfrazado = await subir(CLI_A, Buffer.from('<html><script>1</script></html>'), 'application/pdf', 'f.pdf');
  assert.equal(disfrazado.status, 415, '🔴 se acepta un HTML que dice ser PDF: el tipo lo decide la cabecera del cliente');
  assert.equal(attachments.length, antes);
});

test('SCRUM-1005b · idempotente por sha256: subir dos veces el mismo fichero no crea una copia', async () => {
  sembrar();
  const doc = PDF(300);
  const r1 = await subir(CLI_A, doc, 'application/pdf', 'uno.pdf');
  assert.equal(r1.status, 201);
  const antes = attachments.length;
  const r2 = await subir(CLI_A, doc, 'application/pdf', 'uno.pdf');
  assert.equal(r2.status, 200, 'la repetida contesta 200: no se ha creado nada');
  assert.equal(r2.json.already, true);
  assert.equal(r2.json.documento.id, r1.json.documento.id);
  assert.equal(attachments.length, antes, '🔴 la subida repetida ha creado una copia');
  // Y no cruza de cliente: el mismo fichero en OTRO cliente sí se crea.
  const r3 = await subir(CLI_A2, doc, 'application/pdf', 'uno.pdf');
  assert.equal(r3.status, 201);
});

test('SCRUM-1005b · sin nombre o sin bytes: NOMBRE_NO_VALIDO y FICHERO_VACIO', async () => {
  sembrar();
  const sinNombre = await pedir('POST', `/admin/customers/${CLI_A}/documentos`, { cuerpo: PDF(50), tipo: 'application/pdf' });
  assert.equal(sinNombre.status, 400);
  assert.equal(sinNombre.json?.error, 'NOMBRE_NO_VALIDO');
  const vacio = await subir(CLI_A, Buffer.alloc(0));
  assert.equal(vacio.status, 400);
  assert.equal(vacio.json?.error, 'FICHERO_VACIO');
});

test('SCRUM-1005b · la descarga va como adjunto, con nosniff y con el nombre saneado', async () => {
  sembrar();
  const doc = PDF(120);
  const malo = '..\\..\\"evil"\r\nSet-Cookie: x=1; ñandú.pdf';
  const s = await subir(CLI_A, doc, 'application/pdf', malo);
  assert.equal(s.status, 201);
  const id = s.json.documento.id;
  const nombreGuardado = attachments.find((a) => a.id === id).fileName;
  assert.doesNotMatch(nombreGuardado, /[\\/"\r\n]/, `el nombre guardado no está saneado: ${JSON.stringify(nombreGuardado)}`);
  const r = await pedir('GET', `/admin/customers/${CLI_A}/documentos/${id}`);
  assert.equal(r.status, 200);
  assert.equal(r.headers['content-type'], 'application/pdf');
  assert.equal(r.headers['x-content-type-options'], 'nosniff');
  const cd = r.headers['content-disposition'];
  assert.match(cd, /^attachment;/, `Content-Disposition: ${cd}`);
  assert.doesNotMatch(cd, /[\r\n]/);
  assert.equal(r.headers['set-cookie'], undefined, '🔴 el nombre del fichero ha inyectado una cabecera');
  assert.match(cd, /filename\*=UTF-8''/, 'lleva el nombre en UTF-8 (filename*)');
  assert.ok(r.crudo.equals(doc), '🔴 los bytes descargados no son los subidos');
});

test('SCRUM-1005b · borrar un documento: 204 y sólo ése', async () => {
  sembrar();
  const r = await pedir('DELETE', `/admin/customers/${CLI_A}/documentos/1`);
  assert.equal(r.status, 204);
  assert.equal(attachments.some((a) => a.id === 1), false);
  assert.ok(attachments.some((a) => a.id === 2) && attachments.some((a) => a.id === 3) && attachments.some((a) => a.id === 4));
});

// Decisión del fundador, SCRUM-1005 c.22192: «ver y subir, todo el equipo; borrar, solo admin». Por la
// ruta REAL (con su `requireRole`), no por el handler suelto: así cae si alguien quita el rol (SCRUM-1344).
test('SCRUM-1005b · 🔴 permisos: el técnico ve y sube, pero NO borra (403), y el documento sigue', async () => {
  sembrar();
  const lista = await pedir('GET', `/admin/customers/${CLI_A}/documentos`, { rol: 'tecnico' });
  assert.equal(lista.status, 200, 'el técnico VE la lista de documentos');
  const subida = await subir(CLI_A, Buffer.from('%PDF-1.4 tecnico'), 'application/pdf', 'boletin.pdf', { rol: 'tecnico' });
  assert.equal(subida.status, 201, 'el técnico SUBE un documento');
  const baja = await pedir('DELETE', `/admin/customers/${CLI_A}/documentos/1`, { rol: 'tecnico' });
  assert.equal(baja.status, 403, 'el técnico NO borra un documento: es de admin');
  assert.ok(attachments.some((a) => a.id === 1), 'tras el 403, el documento sigue ahí');
  const admin = await pedir('DELETE', `/admin/customers/${CLI_A}/documentos/1`, { rol: 'admin' });
  assert.equal(admin.status, 204, 'el admin SÍ lo borra (control positivo del mismo camino)');
});

test('SCRUM-1005b · 🔴 borrar el cliente se lleva sus documentos, y sólo los suyos', async () => {
  sembrar();
  attachments.push({ id: 60, merchantId: A, entityType: 'customer', entityId: CLI_A2, kind: 'document', url: '', data: null, mime: 'application/pdf', fileName: 'otro.pdf', sizeBytes: 1, sha256: 'o', createdAt: new Date() });
  const r = await pedir('DELETE', `/admin/customers/${CLI_A}`);
  assert.equal(r.status, 204);
  assert.equal(customers.some((c) => c.id === CLI_A), false, 'el cliente no se ha borrado');
  assert.equal(attachments.some((a) => a.merchantId === A && a.entityType === 'customer' && a.entityId === CLI_A), false,
    '🔴 BORRAR EL CLIENTE DEJA SUS DOCUMENTOS HUÉRFANOS, con sus datos personales dentro (c.22140)');
  assert.ok(attachments.some((a) => a.id === 60), '🔴 se ha llevado los documentos de OTRO cliente');
  assert.ok(attachments.some((a) => a.id === 3), '🔴 se ha llevado una fila de OTRO comercio que casaba por número');
  assert.ok(attachments.some((a) => a.id === 4), '🔴 se ha llevado una foto de solicitud (otro entityType)');
});

test('SCRUM-1005b · borrar un cliente de otro comercio no toca sus documentos', async () => {
  sembrar();
  const r = await pedir('DELETE', `/admin/customers/${CLI_B}`);
  assert.equal(r.status, 404);
  assert.ok(attachments.some((a) => a.id === 2), '🔴 borrar un cliente ajeno ha borrado sus documentos');
});
