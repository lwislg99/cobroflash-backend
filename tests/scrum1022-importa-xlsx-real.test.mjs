// SCRUM-1022 · CLIENTES Y COBRO · el importador de clientes lee un .xlsx REAL.
//
// Medido en SCRUM-1022 (21-sep-2026): un .xlsx subido hoy no rompía nada, pero `decodificarCsv`
// (UTF-8 estricto → cae a windows-1252, que acepta cualquier byte) convertía el binario del ZIP en
// «texto» ilegible, y el usuario acababa viendo «Dinos cuál es la columna del nombre» — un mensaje
// verdadero pero engañoso: el problema no era la columna, era que el fichero nunca fue un CSV.
//
// El fundador autorizó `read-excel-file` (regla 36, comentario 16597 de SCRUM-1022). Esta tanda la
// instala y engancha en el PUNTO DE ENTRADA de las dos rutas (`customersAdmin.routes.ts:167/193`),
// mirando la FIRMA del fichero (`PK\x03\x04` = ZIP), no la extensión. `trocearCsv`, `proponerMapeo`
// e `importarClientes` NO cambian ni una línea: reciben el mismo shape de texto de siempre.
//
// El .xlsx es REAL (ZIP/OOXML válido, abrible por Excel), construido en memoria con `archiver`
// (dependencia YA presente, `^8.0.0` — la misma que usa el export de portabilidad, ninguna nueva
// para el test), con `inlineStr` (sin `sharedStrings.xml`). Sin mocks del parseo: los handlers REALES
// del router, como en `scrum1035-cifras-del-cliente-todos-sus-documentos.test.mjs`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { ZipArchive } from 'archiver';
import { PassThrough } from 'node:stream';
import { prisma } from '../dist/core/db/prisma.js';
import routerModulo from '../dist/modules/system/app/routes/customersAdmin.routes.js';
import { pareceXlsx, xlsxATextoCsv } from '../dist/modules/system/domain/importarClientes.service.js';

const router = routerModulo.default ?? routerModulo;
const MERCHANT = 1;

// ── construir un .xlsx real ──────────────────────────────────────────────────

const NS_CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
const NS_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const NS_SS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_ROFF = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function colLetter(i) {
  let n = i + 1;
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function sheetXml(filas) {
  const rows = filas.map((fila, fi) => {
    const celdas = fila.map((v, ci) => `<c r="${colLetter(ci)}${fi + 1}" t="inlineStr"><is><t>${xmlEscape(v)}</t></is></c>`).join('');
    return `<row r="${fi + 1}">${celdas}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<worksheet xmlns="${NS_SS}"><sheetData>${rows}</sheetData></worksheet>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  + `<Types xmlns="${NS_CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
  + `<Default Extension="xml" ContentType="application/xml"/>`
  + `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`
  + `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  + `<Relationships xmlns="${NS_REL}"><Relationship Id="rId1" Type="${NS_ROFF}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
const WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  + `<workbook xmlns="${NS_SS}" xmlns:r="${NS_ROFF}"><sheets><sheet name="Hoja1" sheetId="1" r:id="rId1"/></sheets></workbook>`;
const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  + `<Relationships xmlns="${NS_REL}"><Relationship Id="rId1" Type="${NS_ROFF}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;

/** Construye un .xlsx real (ZIP/OOXML válido) con UNA hoja, con `archiver` (SCRUM-25/B, sin dependencia nueva). */
async function construirXlsxReal(filas) {
  const archive = new ZipArchive({ zlib: { level: 9 } });
  const pass = new PassThrough();
  const chunks = [];
  pass.on('data', (c) => chunks.push(c));
  const fin = new Promise((resolve, reject) => { pass.on('end', resolve); archive.on('error', reject); });
  archive.pipe(pass);
  archive.append(CONTENT_TYPES, { name: '[Content_Types].xml' });
  archive.append(ROOT_RELS, { name: '_rels/.rels' });
  archive.append(WORKBOOK, { name: 'xl/workbook.xml' });
  archive.append(WORKBOOK_RELS, { name: 'xl/_rels/workbook.xml.rels' });
  archive.append(sheetXml(filas), { name: 'xl/worksheets/sheet1.xml' });
  await archive.finalize();
  await fin;
  return Buffer.concat(chunks);
}

// ── invocar los handlers reales del router (patrón de scrum1035) ─────────────

function handlerDe(path, metodo) {
  const capa = router.stack.find((l) => l.route?.path === path && l.route.methods[metodo]);
  assert.ok(capa, `no encuentro ${metodo.toUpperCase()} ${path}`);
  return capa.route.stack[capa.route.stack.length - 1].handle;
}

async function llamar(handler, body, merchantId = MERCHANT) {
  let status = 200;
  let cuerpo = null;
  const res = { status(c) { status = c; return res; }, json(b) { cuerpo = b; return res; } };
  await handler({ body, merchantId, userRole: 'admin' }, res);
  return { status, cuerpo };
}

function conClientesDoblados(clientes, fn) {
  const original = prisma.customer;
  prisma.customer = {
    findFirst: async ({ where }) => clientes.find((c) => c.merchantId === where.merchantId
      && (where.OR ?? []).some((cond) => Object.entries(cond).every(([k, v]) => (v && v.equals ? c[k]?.toLowerCase() === v.equals.toLowerCase() : c[k] === v)))) ?? null,
    create: async ({ data }) => { const c = { id: clientes.length + 1, ...data }; clientes.push(c); return c; },
  };
  return fn().finally(() => { prisma.customer = original; });
}

// ── control: la firma ────────────────────────────────────────────────────────

test('SCRUM-1022 · CONTROL: pareceXlsx distingue el ZIP de un CSV normal', async () => {
  const xlsx = await construirXlsxReal([['a']]);
  assert.equal(pareceXlsx(xlsx), true);
  assert.equal(pareceXlsx(Buffer.from('nombre;telefono\nJosé;612345678\n', 'utf8')), false);
  assert.equal(pareceXlsx(Buffer.from([])), false, 'un buffer vacío no debe reventar la comprobación');
});

test('SCRUM-1022 · CONTROL: xlsxATextoCsv da el mismo shape que decodificarCsv().texto', async () => {
  const xlsx = await construirXlsxReal([['nombre', 'telefono', 'email'], ['José García', '612345678', 'jose@example.com']]);
  const texto = await xlsxATextoCsv(xlsx);
  assert.equal(texto, 'nombre;telefono;email\r\nJosé García;612345678;jose@example.com');
});

// ── rojo → verde: la ruta real ────────────────────────────────────────────────

test('SCRUM-1022 · /import/preparar con un .xlsx real: NO cae en el mensaje engañoso de "falta nombre"', async () => {
  const xlsx = await construirXlsxReal([
    ['nombre', 'telefono', 'email'],
    ['José García', '612345678', 'jose@example.com'],
  ]);
  const { status, cuerpo } = await llamar(handlerDe('/import/preparar', 'post'), { fichero: xlsx.toString('base64') });
  assert.equal(status, 200);
  assert.equal(cuerpo.primeraFila, 'nombre;telefono;email', 'la fila que vería el usuario ya no es basura binaria');
  const porCampo = Object.fromEntries(cuerpo.columnas.map((c) => [c.campo, c.indice]));
  assert.equal(porCampo.name, 0);
  assert.equal(porCampo.phone, 1);
  assert.equal(porCampo.email, 2);
});

test('SCRUM-1022 · /import con un .xlsx real: crea el cliente (mismo camino que un CSV)', async () => {
  const xlsx = await construirXlsxReal([
    ['nombre', 'telefono', 'email'],
    ['José García', '612345678', 'jose@example.com'],
  ]);
  const clientes = [];
  const { status, cuerpo } = await conClientesDoblados(clientes, () => llamar(handlerDe('/import', 'post'), {
    fichero: xlsx.toString('base64'),
    mapeo: { name: 0, phone: 1, email: 2 },
  }));
  assert.equal(status, 200);
  assert.equal(cuerpo.creados, 1);
  assert.equal(cuerpo.rechazos.length, 0);
  assert.equal(clientes[0].name, 'José García');
  assert.equal(clientes[0].email, 'jose@example.com');
});

test('SCRUM-1022 · CONTROL POSITIVO: un CSV normal (no .xlsx) sigue exactamente igual que antes', async () => {
  const csv = Buffer.from('nombre;telefono;email\r\nAna López;699112233;ana@example.com\r\n', 'utf8');
  const { status, cuerpo } = await llamar(handlerDe('/import/preparar', 'post'), { fichero: csv.toString('base64') });
  assert.equal(status, 200);
  assert.equal(cuerpo.codificacion, 'utf-8');
  assert.equal(cuerpo.primeraFila, 'nombre;telefono;email');

  const clientes = [];
  const r = await conClientesDoblados(clientes, () => llamar(handlerDe('/import', 'post'), {
    fichero: csv.toString('base64'),
    mapeo: { name: 0, phone: 1, email: 2 },
  }));
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.creados, 1);
  assert.equal(clientes[0].name, 'Ana López');
});
