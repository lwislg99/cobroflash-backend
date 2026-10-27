// docs/master/evidencias/SCRUM-1251/sha-antes-despues.mjs — SCRUM-1251b (J1)
//
// Pide `GET /admin/evidencias.zip` a la app REAL (`dist/app.js`, banco de SCRUM-597, sin base) para un
// merchant fabricado (1251: 2 facturas en el 3T-2026, ninguna en el 4T) e imprime las cabeceras de
// recuento y el sha256 de CADA fichero del ZIP. Se corre con el `dist/` de antes y con el de después:
// las líneas `fichero` tienen que salir idénticas y sólo cambiar las de cabecera.
//
// Uso, desde la raíz del árbol: node docs/master/evidencias/SCRUM-1251/sha-antes-despues.mjs
import http from 'node:http';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { montarAppReal, bancoDePrisma, sesionesDe } from '../../../../tests/_banco-camino-real.mjs';

const app = await montarAppReal();
const ses = sesionesDe(1251, { id: 9, role: 'tecnico', merchantId: 1251 });
const DIA = new Date('2026-08-10T10:00:00.000Z');
const f = (id, number) => ({
  id, merchantId: 1251, number, createdAt: DIA, paidAt: DIA, type: 'F1', total: 121, currency: 'EUR',
  status: 'paid', customerId: null, customerName: null, customerLegalName: null, customerTaxId: null,
  quoteId: null, chargeId: null, albaranRefs: null, lines: [{ concept: 'Trabajo', qty: 1, price: 100, tax: 0.21 }],
});
const FACTURAS = [f(1, 'F-2026-0001'), f(2, 'F-2026-0002')];
bancoDePrisma().programar({
  authSession: ses.tabla,
  merchant: { findUnique: async () => ({ ...ses.merchant, country: 'ES', taxId: 'B00000000', legalName: 'Banco 1251 SL', timezone: 'Europe/Madrid', flags: null, criterioCaja: null }) },
  invoice: {
    findMany: async (a) => FACTURAS.filter((x) => {
      if (x.merchantId !== a?.where?.merchantId) return false;
      for (const [k, r] of Object.entries(a?.where ?? {})) {
        if (r && typeof r === 'object' && x[k] instanceof Date && ((r.gte && x[k] < r.gte) || (r.lte && x[k] > r.lte))) return false;
      }
      return true;
    }),
  },
});

const pedir = (ruta) => new Promise((ok, ko) => {
  http.request(`${app.base}${ruta}`, { agent: false, headers: { cookie: `pf_session=${ses.PROPIETARIO}` } }, (res) => {
    const t = []; res.on('data', (c) => t.push(c)); res.on('end', () => ok({ h: res.headers, b: Buffer.concat(t) }));
  }).on('error', ko).end();
});

function ficheros(buf) {
  let fin = buf.length - 22; while (buf.readUInt32LE(fin) !== 0x06054b50) fin--;
  const out = []; let p = buf.readUInt32LE(fin + 16);
  for (let n = buf.readUInt16LE(fin + 10); n > 0; n--) {
    const ln = buf.readUInt16LE(p + 28); const loc = buf.readUInt32LE(p + 42);
    const d = loc + 30 + buf.readUInt16LE(loc + 26) + buf.readUInt16LE(loc + 28);
    const crudo = buf.subarray(d, d + buf.readUInt32LE(p + 20));
    out.push([buf.toString('utf8', p + 46, p + 46 + ln), buf.readUInt16LE(p + 10) === 8 ? zlib.inflateRawSync(crudo) : crudo]);
    p += 46 + ln + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return out;
}

for (const tri of [3, 4]) {
  const { h, b } = await pedir(`/admin/evidencias.zip?year=2026&quarter=${tri}`);
  console.log(`T${tri} · cabecera X-Yaqu-Filas=${h['x-yaqu-filas'] ?? '(ausente)'} X-Yaqu-Miradas=${h['x-yaqu-miradas'] ?? '(ausente)'}`);
  for (const [nombre, c] of ficheros(b)) console.log(`T${tri} · fichero ${nombre} ${crypto.createHash('sha256').update(c).digest('hex')}`);
}
await app.cerrar();
