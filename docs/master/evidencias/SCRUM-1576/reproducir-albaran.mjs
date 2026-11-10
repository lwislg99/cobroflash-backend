// SCRUM-1576c · reproducción POR LA RUTA MONTADA de los lectores (a) que el tramo de J2 dejó
// «leído, no corrido»: los seis del albarán y el buscador. Todos son de S1: esto NO arregla nada,
// sólo mide qué sale. Hermano de `reproducir.mjs` (mismo banco, mismo veredicto, mismas fichas).
//
// Uso (con dist/ compilado; el PDF se escribe en `<cwd>/storage/albaranes`, así que se lanza
// desde un directorio temporal FUERA del árbol):
//   cd "$CLAUDE_JOB_DIR/tmp" && node <árbol>/docs/master/evidencias/SCRUM-1576/reproducir-albaran.mjs
//   … --ciego   → el control de cada caso pide un valor imposible: TODOS tienen que salir CIEGO
//                 y el proceso salir con 2. Es la prueba de que el control no es decorativo.
//
// El escenario de cada caso: el albarán se EMITE con la ficha del día (las cinco columnas
// congeladas las escribe `congelarDesdeFicha`, la función de la casa, no la sonda), y después la
// ficha cambia. Se pide la ruta dos veces —con la ficha del día y con la de hoy— y se compara.
//   control: con la ficha del día tiene que salir lo del día; si no, CIEGO (la sonda no midió).
//   LEE LO GUARDADO: con la ficha de hoy sigue saliendo lo del día.
//   LEE EL VIVO:     con la ficha de hoy sale lo de hoy.
//
// DISCRIMINACIÓN: el caso «PDF de un albarán FIRMADO v:3» es el que debe salir LEE LO GUARDADO
// (el nombre sale del sobre, SCRUM-452). Si la sonda sólo supiera decir «vivo», ese caso lo delata.
import http from 'node:http';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { montarAppReal, bancoDePrisma, sesionesDe } from '../../../../tests/_banco-camino-real.mjs';

const require = createRequire(import.meta.url);
const CIEGO_FORZADO = process.argv.includes('--ciego');
const app = await montarAppReal();
const MIO = 15763;
const ses = sesionesDe(MIO, { id: 9, role: 'tecnico', merchantId: MIO });
const { congelarDesdeFicha } = require('../../../../dist/modules/invoicing/domain/clienteCongelado.js');

const DIA = new Date('2026-08-10T10:00:00.000Z');
const FICHA_DIA = { id: 10, merchantId: MIO, name: 'Fusionado', legalName: 'Fusionado SL', taxId: 'B11111111', email: 'antes@x.test', phone: '+34600000001', mobile: null };
const FICHA_HOY = { ...FICHA_DIA, name: 'Principal', legalName: 'Principal SA', taxId: 'B22222222', email: 'hoy@x.test', phone: '+34600000002' };

const JOB = { id: 77, merchantId: MIO, customerId: 10, titulo: 'Caldera', direccion: 'C/ Mayor 1', quoteId: null, status: 'en_curso', scheduledAt: new Date(Date.now() + 86400_000), updatedAt: new Date(), operarioId: null, assignedUserId: null, assignees: [] };
const ALBARAN_EMITIDO = {
  id: 5, merchantId: MIO, jobId: 77, numero: 'ALB-2026-001', fecha: DIA, fechaEntrega: null, createdAt: DIA, updatedAt: DIA,
  estado: 'emitido', version: 1, modoValoracion: 'SIN_VALORAR', ocultarPreciosEnDocumento: false,
  lineas: [{ concepto: 'Revisión', cantidad: 1, unidad: 'ud' }], notas: null, lugarEntrega: 'C/ Mayor 1',
  invoiceId: null, pdfUrl: null, firmaToken: 'TOKEN-FIRMA-1576C', signatureUrl: null, firmadoAt: null,
  evidenciaFirma: null, firmadoPorNombre: null, firmadoPorCalidad: null, docHeaderText: null,
  ...congelarDesdeFicha(FICHA_DIA),
};
// Firmado v:3: el sobre congeló el cliente del día. Se construye a mano SÓLO el bloque que lee
// el PDF (`contenidoCongelado`); el hash no se verifica en estas rutas.
const ALBARAN_FIRMADO_V3 = {
  ...ALBARAN_EMITIDO, estado: 'firmado', firmadoAt: DIA, firmadoPorNombre: 'Fusionado', firmadoPorCalidad: 'el_propio_cliente',
  evidenciaFirma: { v: 3, canal: 'remoto', firmadoAt: DIA.toISOString(), hash: 'x', contenidoCongelado: { obra: 'C/ Mayor 1', referenciaTrabajo: 'Caldera', cliente: 'Fusionado SL', emisor: 'QA 1576c', emisorNif: 'B00000000' } },
};

function proyectar(fila, sel) {
  if (!sel) return { ...fila };
  return Object.fromEntries(Object.keys(sel).filter((k) => sel[k] && k in fila).map((k) => [k, fila[k]]));
}
const merchantFila = { ...ses.merchant, name: 'QA 1576c', legalName: null, taxId: 'B00000000', address: null, logoUrl: null, whatsappPhone: null, timezone: 'Europe/Madrid', country: 'ES', flags: null };
/** Las tablas que necesitan todas las rutas de albarán, con la ficha que toque. */
function tablasAlbaran(albaran, ficha) {
  return {
    authSession: ses.tabla,
    merchant: { findUnique: async (a) => proyectar(merchantFila, a?.select), findFirst: async (a) => proyectar(merchantFila, a?.select) },
    albaran: {
      findFirst: async (a) => proyectar(albaran, a?.select),
      findUnique: async (a) => proyectar(albaran, a?.select),
      findMany: async (a) => [proyectar(albaran, a?.select)],
      update: async (a) => ({ ...albaran, ...a.data }),
    },
    job: { findFirst: async (a) => proyectar(JOB, a?.select), findUnique: async (a) => proyectar(JOB, a?.select), findMany: async (a) => [proyectar(JOB, a?.select)] },
    customer: {
      findFirst: async (a) => proyectar(ficha, a?.select), findUnique: async (a) => proyectar(ficha, a?.select),
      findMany: async (a) => [proyectar(ficha, a?.select)],
    },
    auditLog: { create: async () => ({}) },
  };
}

/** GET binario (el `pedir` del banco lo pasa a utf8 y rompe el PDF). */
function pedirBytes(ruta, token) {
  return new Promise((ok, ko) => {
    const p = http.request(`${app.base}${ruta}`, { method: 'GET', agent: false, headers: { cookie: `pf_session=${token}` } }, (res) => {
      const t = []; res.on('data', (x) => t.push(x)); res.on('end', () => ok({ status: res.statusCode, bytes: Buffer.concat(t) })); res.on('error', ko);
    });
    p.on('error', ko); p.end();
  });
}
/** El texto de un PDF de pdfkit: inflar cada stream y unir los trozos de cada `TJ`. */
function textoDePdf(buf) {
  const s = buf.toString('latin1');
  const trozos = [];
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(s))) {
    const ini = m.index + m[0].length;
    const fin = s.indexOf('endstream', ini);
    if (fin < 0) break;
    let cont;
    try { cont = zlib.inflateSync(buf.subarray(ini, fin)).toString('latin1'); } catch { continue; }
    for (const tj of cont.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
      trozos.push([...tj[1].matchAll(/<([0-9a-fA-F]*)>/g)].map((h) => Buffer.from(h[1], 'hex').toString('latin1')).join(''));
    }
  }
  return trozos.join('\n');
}

const resultados = [];
async function caso(nombre, { lector, ruta, tablas, pedir, extraer, esperadoDia, carril }) {
  const salida = {};
  for (const [etiqueta, ficha] of [['dia', FICHA_DIA], ['hoy', FICHA_HOY]]) {
    bancoDePrisma().programar(tablas(ficha));
    let r;
    try { r = await pedir(); } catch (e) { r = { status: 'ERR', texto: String(e?.message || e) }; }
    let valor;
    try { valor = r.status === 200 ? extraer(r, bancoDePrisma().escrituras) : `${r.status} ${String(r.texto ?? r.bytes ?? '').slice(0, 160)}`; } catch (e) { valor = `EXTRAER FALLÓ: ${e?.message}`; }
    salida[etiqueta] = { status: r.status, valor: String(valor) };
  }
  const esperado = CIEGO_FORZADO ? '«valor imposible del --ciego»' : esperadoDia;
  const control = salida.dia.status === 200 && salida.dia.valor === esperado;
  const veredicto = !control ? 'CIEGO' : salida.hoy.valor === esperado ? 'LEE LO GUARDADO' : 'LEE EL VIVO';
  resultados.push({ nombre, lector, ruta, carril, ...salida, veredicto });
}

const pedirJson = (ruta, token = ses.PROPIETARIO) => () => app.pedir(ruta, { token });
/** Lo que pinta la página pública: el texto que sigue a «Hola, » o «Gracias, ». */
const saludo = (prefijo) => (r) => (r.texto.match(new RegExp(`${prefijo}, ([^<.\\s]*)`)) || [])[1] ?? 'sin saludo';

// ── 1 · Lista de albaranes · `albaranes.routes.ts:154` → columna «cliente» de `albaranesListado.ts:234`
await caso('lista de albaranes · columna «cliente»', {
  lector: 'src/modules/jobs/app/routes/albaranes.routes.ts:154', carril: 'S1',
  ruta: 'GET /admin/albaranes', pedir: pedirJson('/admin/albaranes'),
  tablas: (f) => tablasAlbaran(ALBARAN_EMITIDO, f),
  extraer: (r) => { const filas = Array.isArray(r.json) ? r.json : (r.json?.albaranes ?? r.json?.filas ?? []); return filas[0]?.cliente ?? `sin fila (${Object.keys(r.json ?? {})})`; },
  esperadoDia: 'Fusionado SL',
});

// ── 2 · Ficha del albarán · `albaranes.routes.ts:865` → `customer.name` de la respuesta
await caso('ficha del albarán · customer.name', {
  lector: 'src/modules/jobs/app/routes/albaranes.routes.ts:865', carril: 'S1',
  ruta: 'GET /admin/albaranes/5', pedir: pedirJson('/admin/albaranes/5'),
  tablas: (f) => tablasAlbaran(ALBARAN_EMITIDO, f),
  extraer: (r) => r.json?.customer?.name ?? `sin customer (${Object.keys(r.json ?? {}).slice(0, 12)})`,
  esperadoDia: 'Fusionado',
});

// ── 3 · Página pública de firma · `albaranPublic.routes.ts:244` → «Hola, X»
await caso('página pública de firma (emitido) · «Hola, X»', {
  lector: 'src/modules/jobs/app/routes/albaranPublic.routes.ts:244', carril: 'S1',
  ruta: 'GET /albaran/:token', pedir: () => app.pedir('/albaran/TOKEN-FIRMA-1576C'),
  tablas: (f) => tablasAlbaran(ALBARAN_EMITIDO, f),
  extraer: saludo('Hola'), esperadoDia: 'Fusionado',
});
// ── 3b · La misma página con el albarán YA FIRMADO (v:3) · «Gracias, X»
await caso('página pública (ya firmado v:3) · «Gracias, X»', {
  lector: 'src/modules/jobs/app/routes/albaranPublic.routes.ts:244', carril: 'S1',
  ruta: 'GET /albaran/:token', pedir: () => app.pedir('/albaran/TOKEN-FIRMA-1576C'),
  tablas: (f) => tablasAlbaran(ALBARAN_FIRMADO_V3, f),
  extraer: saludo('Gracias'), esperadoDia: 'Fusionado',
});

// ── 4 · PDF del albarán emitido sin firmar · `albaran.service.ts:800` → «Receptor: X» y el NIF
const receptor = (r) => { const t = textoDePdf(r.bytes); const i = t.indexOf('Receptor: '); if (i < 0) return `sin «Receptor» (${t.length} car.)`; return t.slice(i + 'Receptor: '.length).split('\n').map((l) => l.trim()).filter(Boolean)[0] ?? 'sin nombre'; };
const nifDe = (r) => { const t = textoDePdf(r.bytes); return ['B11111111', 'B22222222'].filter((n) => t.includes(n)).join(',') || 'sin NIF'; };
await caso('PDF del albarán EMITIDO · línea «Receptor»', {
  lector: 'src/modules/jobs/domain/albaran.service.ts:800', carril: 'S1',
  ruta: 'GET /admin/albaranes/5/pdf', pedir: () => pedirBytes('/admin/albaranes/5/pdf', ses.PROPIETARIO),
  tablas: (f) => tablasAlbaran(ALBARAN_EMITIDO, f), extraer: receptor, esperadoDia: 'Fusionado SL',
});
await caso('PDF del albarán EMITIDO · NIF del cliente', {
  lector: 'src/modules/jobs/domain/albaran.service.ts:800', carril: 'S1',
  ruta: 'GET /admin/albaranes/5/pdf', pedir: () => pedirBytes('/admin/albaranes/5/pdf', ses.PROPIETARIO),
  tablas: (f) => tablasAlbaran(ALBARAN_EMITIDO, f), extraer: nifDe, esperadoDia: 'B11111111',
});
// ── 4b · DISCRIMINACIÓN: el PDF de un FIRMADO v:3 tiene que leer el nombre del sobre.
await caso('PDF del albarán FIRMADO v:3 · línea «Receptor» (control: debe leer lo guardado)', {
  lector: 'src/modules/jobs/domain/albaran.service.ts:800', carril: 'S1',
  ruta: 'GET /admin/albaranes/5/pdf', pedir: () => pedirBytes('/admin/albaranes/5/pdf', ses.PROPIETARIO),
  tablas: (f) => tablasAlbaran(ALBARAN_FIRMADO_V3, f), extraer: receptor, esperadoDia: 'Fusionado SL',
});

// ── 5 · Precarga offline · `precarga.service.ts:335` → `clienteNombre` del paquete
await caso('precarga offline · clienteNombre', {
  lector: 'src/modules/jobs/domain/precarga.service.ts:335', carril: 'S1',
  ruta: 'GET /admin/precarga', pedir: pedirJson('/admin/precarga'),
  tablas: (f) => tablasAlbaran(ALBARAN_EMITIDO, f),
  extraer: (r) => r.json?.albaranes?.[0]?.clienteNombre ?? `sin albarán (estado ${r.json?.estado}, ${r.json?.motivo ?? ''})`,
  esperadoDia: 'Fusionado',
});

// ── 6 · El sobre de la firma · `albaran.service.ts:642` → `evidenciaFirma.contenidoCongelado.cliente`
// que ESCRIBE `POST /albaran/:token/firmar`. Se lee del registro de escrituras del doble: nada
// toca una base. Lo que se mide: si la ficha cambió entre EMITIR y FIRMAR, ¿qué sella?
const FIRMA_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
await caso('sobre de la firma (POST firmar) · contenidoCongelado.cliente sellado', {
  lector: 'src/modules/jobs/domain/albaran.service.ts:642', carril: 'S1 · STOP (sellado, SCRUM-577)',
  ruta: 'POST /albaran/:token/firmar',
  pedir: () => app.pedir('/albaran/TOKEN-FIRMA-1576C/firmar', { metodo: 'POST', cuerpo: { version: 1, signatureData: FIRMA_PNG, firmadoPorNombre: 'Fusionado', firmadoPorCalidad: 'el_propio_cliente' } }),
  tablas: (f) => tablasAlbaran(ALBARAN_EMITIDO, f),
  extraer: (_r, escrituras) => { const u = escrituras.find((e) => e.modelo === 'albaran' && e.op === 'update' && e.args?.data?.evidenciaFirma); return u ? `${u.args.data.evidenciaFirma.contenidoCongelado?.cliente}` : 'sin escritura del sobre'; },
  esperadoDia: 'Fusionado SL',
});

// ── 7 · Buscador · `search.routes.ts:86` (repetición del caso 3 de `reproducir.mjs`)
const facturaEmitida = { id: 1, merchantId: MIO, number: 'F-2026-0001', createdAt: DIA, status: 'pending', total: 121, currency: 'EUR', customerId: 10, ...congelarDesdeFicha(FICHA_DIA) };
await caso('buscador · nombre del cliente de una factura emitida', {
  lector: 'src/modules/search/app/routes/search.routes.ts:86', carril: 'S1',
  ruta: 'GET /admin/search?q=F-2026', pedir: pedirJson('/admin/search?q=F-2026'),
  tablas: (f) => ({
    authSession: ses.tabla, customer: { findMany: async () => [] }, quote: { findMany: async () => [] },
    invoice: { findMany: async (a) => { const fila = proyectar(facturaEmitida, a?.select); if (a?.select?.customer) fila.customer = proyectar(f, a.select.customer.select); return [fila]; } },
  }),
  extraer: (r) => `${r.json?.invoices?.[0]?.customer?.name}`, esperadoDia: 'Fusionado',
});

for (const x of resultados) {
  console.log(`${x.veredicto}\t${x.nombre}\t[${x.carril}]\n\t${x.ruta} · ${x.lector}\n\tficha del día → ${x.dia.status} «${x.dia.valor}»\n\tficha de hoy  → ${x.hoy.status} «${x.hoy.valor}»`);
}
const n = (v) => resultados.filter((x) => x.veredicto === v).length;
console.log(`POBLACIÓN: ${resultados.length} casos · LEE EL VIVO ${n('LEE EL VIVO')} · LEE LO GUARDADO ${n('LEE LO GUARDADO')} · CIEGO ${n('CIEGO')}${CIEGO_FORZADO ? ' · (--ciego)' : ''}`);
await app.cerrar();
process.exit(n('CIEGO') ? 2 : 0);
