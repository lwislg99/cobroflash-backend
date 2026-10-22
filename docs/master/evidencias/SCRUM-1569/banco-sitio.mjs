// Banco de un solo uso de SCRUM-1569 (J4). Fuera del repo. Receta de jv-j3a (SCRUM-914):
// PGlite en memoria + DDL de `prisma migrate diff --from-empty` + traductor minimo del cliente de Prisma.
//   node sitio.mjs <raiz-del-arbol> <carpeta-dist>
// Siembra un comercio con un cliente y un sitio con SUS SIETE CAMPOS de texto llenos, pasa por
// `suprimirMerchant` del dist indicado, y lee los siete despues. Testigo de ejecucion al final (A21).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const [raiz, dist] = process.argv.slice(2);
if (!raiz || !dist) throw new Error('uso: node sitio.mjs <raiz> <dist>');
const DIR = path.dirname(fileURLToPath(import.meta.url));

const schema = fs.readFileSync(path.join(raiz, 'prisma', 'schema.prisma'), 'utf8').replace(/\r/g, '');
const mapa = {};
let actual = null;
for (const l of schema.split('\n')) {
  const a = /^\s*model\s+(\w+)\s*\{/.exec(l);
  if (a) { actual = { tabla: a[1], campos: {} }; mapa[a[1][0].toLowerCase() + a[1].slice(1)] = actual; continue; }
  if (!actual) continue;
  if (/^\s*\}/.test(l)) { actual = null; continue; }
  const m = /^\s*@@map\("([^"]+)"\)/.exec(l);
  if (m) { actual.tabla = m[1]; continue; }
  const c = /^\s*(\w+)\s+\w+/.exec(l);
  if (c && !c[1].startsWith('@')) { const mm = /@map\("([^"]+)"\)/.exec(l); actual.campos[c[1]] = mm ? mm[1] : c[1]; }
}
console.log(`POBLACION: ${Object.keys(mapa).length} modelos · customerSite→${mapa.customerSite.tabla}.${mapa.customerSite.campos.contactName}`);

const db = new PGlite();
await db.exec(fs.readFileSync(path.join(DIR, 'esquema.sql'), 'utf8'));
const q = (s) => `"${s}"`;
function dondeSQL(modelo, where, params) {
  const t = mapa[modelo]; const partes = [];
  for (const [k, v] of Object.entries(where || {})) {
    if (!t.campos[k]) throw new Error(`campo desconocido ${modelo}.${k}`);
    params.push(v); partes.push(`${q(t.campos[k])} = $${params.length}`);
  }
  return partes.length ? partes.join(' AND ') : 'TRUE';
}
const llamadas = [];
const prisma = new Proxy({}, {
  get(_o, modelo) {
    modelo = String(modelo); const t = mapa[modelo]; if (!t) return undefined;
    return {
      async updateMany({ where, data }) {
        llamadas.push(`${modelo}:${Object.keys(data).join(',')}`);
        const p = []; const w = dondeSQL(modelo, where, p);
        const sets = Object.entries(data).map(([k, v]) => { if (!t.campos[k]) throw new Error(`campo desconocido ${modelo}.${k}`); p.push(v); return `${q(t.campos[k])} = $${p.length}`; });
        const r = await db.query(`UPDATE ${q(t.tabla)} SET ${sets.join(', ')} WHERE ${w}`, p);
        return { count: r.affectedRows ?? 0 };
      },
    };
  },
});

const ins = async (sql, p) => (await db.query(sql + ' RETURNING id', p)).rows[0].id;
const sembrar = async (n) => {
  const m = await ins(`INSERT INTO merchants (name, email, country, updated_at) VALUES ('Fontaneria QA', $1, 'ES', now())`, [`qa${n}@qa.invalid`]);
  const c = await ins(`INSERT INTO customers (merchant_id, name, phone, updated_at) VALUES ($1, 'Ana Perez', '+34644001569', now())`, [m]);
  const s = await ins(`INSERT INTO customer_sites (merchant_id, customer_id, name, address, city, postal_code, province, country, contact_name, phone, updated_at)
     VALUES ($1, $2, 'Piso 3B', 'Calle Mayor 7', 'Zamora', '49001', 'Zamora', 'ES', 'Luis el portero', '+34644001570', now())`, [m, c]);
  return { m, s };
};
// Comercio A: el que se suprime. Comercio B: el vecino, que NO se tiene que tocar (control de tenencia).
const A = await sembrar(1);
const B = await sembrar(2);
const leer = async (id) => (await db.query(`SELECT name, address, city, postal_code, province, country, contact_name, phone FROM customer_sites WHERE id = $1`, [id])).rows[0];
console.log('ANTES   A:', JSON.stringify(await leer(A.s)));

const { suprimirMerchant } = await import(pathToFileURL(path.join(dist, 'modules', 'system', 'domain', 'supresionMerchant.service.js')).href);
const r = await suprimirMerchant({ merchantId: A.m, actor: { tipo: 'pro_propietario', teamMemberId: null }, db: prisma, auditar: async () => {} });
console.log(`dist: ${dist}`);
console.log(`suprimir: ok=${r.ok} redactados=${r.redactados.map((x) => `${x.modelo}:${x.filas}`).join(' ')}${r.motivo ? ' motivo=' + r.motivo : ''}`);
console.log(`updateMany pedidos: ${llamadas.join(' | ')}`);
const dA = await leer(A.s); const dB = await leer(B.s);
console.log('DESPUES A:', JSON.stringify(dA));
console.log('DESPUES B:', JSON.stringify(dB));
const SEMBRADO = { name: 'Piso 3B', address: 'Calle Mayor 7', city: 'Zamora', postal_code: '49001', province: 'Zamora', country: 'ES', contact_name: 'Luis el portero', phone: '+34644001570' };
for (const [k, v] of Object.entries(SEMBRADO)) console.log(`  ${k.padEnd(12)} A: ${dA[k] === v ? 'EN CLARO' : 'redactado'}  · B: ${dB[k] === v ? 'intacto' : 'TOCADO'}`);
await db.close();
console.log('TESTIGO: el banco corrio entero · EXIT=0');
