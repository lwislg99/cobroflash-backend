// V0-4 — Crea (idempotente) los productos/precios de suscripción en Stripe (W1):
//   yaqu_pro_monthly      → YaQu Pro 29 €/mes
//   yaqu_pro_annual       → YaQu Pro 290 €/año
//   yaqu_founding_monthly → YaQu Pro · Founding 14,50 €/mes (20 plazas, de por vida)
//   yaqu_equipo_monthly   → YaQu Equipo 59 €/mes (NO se lista en ninguna página)
// Uso: node scripts/setup-stripe-prices.mjs   (lee STRIPE_SECRET_KEY de .env / env)
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

for (const line of fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}

const key = process.env.STRIPE_SECRET_KEY;
if (!key) { console.error('Falta STRIPE_SECRET_KEY'); process.exit(1); }
const Stripe = require('stripe');
const stripe = new Stripe(key);
console.log(`Modo: ${key.startsWith('sk_test') ? 'TEST' : 'LIVE'}`);

const SPECS = [
  { lookup: 'yaqu_pro_monthly',      product: 'YaQu Pro',            amount: 2900,  interval: 'month' },
  { lookup: 'yaqu_pro_annual',       product: 'YaQu Pro',            amount: 29000, interval: 'year'  },
  { lookup: 'yaqu_founding_monthly', product: 'YaQu Pro · Founding', amount: 1450,  interval: 'month' },
  { lookup: 'yaqu_equipo_monthly',   product: 'YaQu Equipo',         amount: 5900,  interval: 'month' },
];

const products = new Map();
async function ensureProduct(name) {
  if (products.has(name)) return products.get(name);
  const existing = await stripe.products.search({ query: `name:'${name}' AND active:'true'` });
  const p = existing.data[0] ?? (await stripe.products.create({ name }));
  products.set(name, p);
  return p;
}

for (const spec of SPECS) {
  const found = await stripe.prices.list({ lookup_keys: [spec.lookup], active: true, limit: 1 });
  if (found.data[0]) {
    console.log(`= ${spec.lookup}: ya existe (${found.data[0].id}, ${found.data[0].unit_amount / 100} ${found.data[0].currency.toUpperCase()})`);
    continue;
  }
  const product = await ensureProduct(spec.product);
  const price = await stripe.prices.create({
    product: product.id,
    currency: 'eur',
    unit_amount: spec.amount,
    recurring: { interval: spec.interval },
    lookup_key: spec.lookup,
  });
  console.log(`+ ${spec.lookup}: creado ${price.id} (${spec.amount / 100} EUR/${spec.interval})`);
}
console.log('Listo.');
