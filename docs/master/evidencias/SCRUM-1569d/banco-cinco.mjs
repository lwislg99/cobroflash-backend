// Banco de un solo uso de SCRUM-1569d (J3). Derivado de `../SCRUM-1569/banco-sitio.mjs` (J4), misma
// receta: PGlite en memoria + DDL de `prisma migrate diff --from-empty` + traductor minimo del cliente.
//   node banco-cinco.mjs <raiz-del-arbol> <carpeta-dist> <esquema.sql>
// Se corre desde una copia en una carpeta con `@electric-sql/pglite` (el arbol no lo trae).
//
// Siembra DOS comercios iguales (A se suprime, B es el vecino que no se toca) con los cinco campos que
// decidio el fundador en SCRUM-1569 c.20142 RELLENOS, mas los que ya se redactaban (control positivo)
// y los que siguen SIN DECIDIR (control negativo: anonimizar de mas tambien es un fallo).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const [raiz, dist, esquemaSql] = process.argv.slice(2);
if (!raiz || !dist || !esquemaSql) throw new Error('uso: node banco-cinco.mjs <raiz> <dist> <esquema.sql>');

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
console.log(`POBLACION: ${Object.keys(mapa).length} modelos · merchant→${mapa.merchant.tabla} · customer→${mapa.customer.tabla} · customerSite→${mapa.customerSite.tabla}`);

const db = new PGlite();
await db.exec(fs.readFileSync(esquemaSql, 'utf8'));
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

// Lo sembrado, por columna REAL de la base. Las cinco de c.20142 van marcadas.
const MERCHANT = { name: 'Fontaneria QA', iban: 'ES9121000418450200051332', clabe: '032180000118359719', bizum_phone: '+34611001569', whatsapp_phone: '+34611001570', country: 'ES' };
const CUSTOMER = { name: 'Ana Perez', phone: '+34944001569', mobile: '+34644001569' };
const SITIO = { name: 'Piso 3B', address: 'Calle Mayor 7', city: 'Zamora', postal_code: '49001', province: 'Zamora', country: 'ES', contact_name: 'Luis el portero', phone: '+34644001570' };
const CINCO = ['merchants.iban', 'merchants.clabe', 'merchants.bizum_phone', 'customers.mobile', 'customer_sites.name'];
const YA_ESTABAN = ['merchants.name', 'merchants.whatsapp_phone', 'customers.name', 'customers.phone', 'customer_sites.contact_name', 'customer_sites.phone'];
const SIN_DECIDIR = ['merchants.country', 'customer_sites.address', 'customer_sites.city', 'customer_sites.postal_code', 'customer_sites.province', 'customer_sites.country'];

const ins = async (sql, p) => (await db.query(sql + ' RETURNING id', p)).rows[0].id;
const sembrar = async (n) => {
  const m = await ins(`INSERT INTO merchants (name, email, country, iban, clabe, bizum_phone, whatsapp_phone, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
    [MERCHANT.name, `qa${n}@qa.invalid`, MERCHANT.country, MERCHANT.iban, MERCHANT.clabe, MERCHANT.bizum_phone, MERCHANT.whatsapp_phone]);
  const c = await ins(`INSERT INTO customers (merchant_id, name, phone, mobile, updated_at) VALUES ($1, $2, $3, $4, now())`,
    [m, CUSTOMER.name, CUSTOMER.phone, CUSTOMER.mobile]);
  const s = await ins(`INSERT INTO customer_sites (merchant_id, customer_id, name, address, city, postal_code, province, country, contact_name, phone, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())`,
    [m, c, SITIO.name, SITIO.address, SITIO.city, SITIO.postal_code, SITIO.province, SITIO.country, SITIO.contact_name, SITIO.phone]);
  return { m, c, s };
};
const A = await sembrar(1);
const B = await sembrar(2);

const leer = async (x) => {
  const m = (await db.query(`SELECT ${Object.keys(MERCHANT).join(', ')} FROM merchants WHERE id = $1`, [x.m])).rows[0];
  const c = (await db.query(`SELECT ${Object.keys(CUSTOMER).join(', ')} FROM customers WHERE id = $1`, [x.c])).rows[0];
  const s = (await db.query(`SELECT ${Object.keys(SITIO).join(', ')} FROM customer_sites WHERE id = $1`, [x.s])).rows[0];
  const out = {};
  for (const [k, v] of Object.entries(m)) out[`merchants.${k}`] = v;
  for (const [k, v] of Object.entries(c)) out[`customers.${k}`] = v;
  for (const [k, v] of Object.entries(s)) out[`customer_sites.${k}`] = v;
  return out;
};
const sembrado = await leer(A);
// CONTROL de la siembra: si una de las cinco nace vacia, «redactado» y «no sembrado» se leen igual.
for (const k of [...CINCO, ...YA_ESTABAN, ...SIN_DECIDIR]) {
  if (typeof sembrado[k] !== 'string' || !sembrado[k]) throw new Error(`SIEMBRA ROTA: ${k} nacio vacio`);
}

const { suprimirMerchant } = await import(pathToFileURL(path.join(dist, 'modules', 'system', 'domain', 'supresionMerchant.service.js')).href);
const r = await suprimirMerchant({ merchantId: A.m, actor: { tipo: 'pro_propietario', teamMemberId: null }, db: prisma, auditar: async () => {} });
console.log(`dist: ${dist}`);
console.log(`suprimir: ok=${r.ok} redactados=${r.redactados.map((x) => `${x.modelo}:${x.filas}`).join(' ')}${r.motivo ? ' motivo=' + r.motivo : ''}`);
console.log(`updateMany pedidos: ${llamadas.join(' | ')}`);
const dA = await leer(A); const dB = await leer(B);

const fila = (grupo, k) => `  ${grupo.padEnd(11)} ${k.padEnd(28)} A: ${dA[k] === sembrado[k] ? 'EN CLARO ' : 'redactado'} · B: ${dB[k] === sembrado[k] ? 'intacto' : 'TOCADO'}`;
for (const k of CINCO) console.log(fila('CINCO', k));
for (const k of YA_ESTABAN) console.log(fila('YA_ESTABAN', k));
for (const k of SIN_DECIDIR) console.log(fila('SIN_DECIDIR', k));

const enClaro = CINCO.filter((k) => dA[k] === sembrado[k]);
const yaRotos = YA_ESTABAN.filter((k) => dA[k] === sembrado[k]);
const deMas = SIN_DECIDIR.filter((k) => dA[k] !== sembrado[k]);
const vecino = Object.keys(sembrado).filter((k) => dB[k] !== sembrado[k]);
console.log(`RECUENTO: de las ${CINCO.length} de c.20142, ${enClaro.length} EN CLARO · control positivo ${YA_ESTABAN.length - yaRotos.length}/${YA_ESTABAN.length} redactados · control negativo ${deMas.length}/${SIN_DECIDIR.length} tocados · vecino ${vecino.length} tocados`);
await db.close();
console.log('TESTIGO: el banco corrio entero · EXIT=0');
