// Migración de precios (8-jul-26): sube los importes de los 3 lookup_key públicos
// a la nueva tarifa creando precios NUEVOS y TRANSFIRIENDO el lookup_key (los precios
// de Stripe son inmutables; setup-stripe-prices.mjs NO sirve porque salta si el
// lookup ya existe). Los suscriptores actuales SE QUEDAN en su precio viejo (ojo con
// los founding "de por vida"): esto solo cambia lo que se cobra a NUEVOS checkouts.
//
//   yaqu_pro_monthly      29,00 → 19,90 €/mes
//   yaqu_pro_annual       290,00 → 199,00 €/año
//   yaqu_founding_monthly 14,50 → 9,90 €/mes
//
// Uso:  node scripts/migrate-stripe-prices-live.mjs           (aplica)
//       node scripts/migrate-stripe-prices-live.mjs --dry-run (solo enseña qué haría)
// Lee STRIPE_SECRET_KEY de .env / env. Con sk_live_… toca la cuenta REAL.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

for (const line of fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}

const DRY = process.argv.includes('--dry-run');
const key = process.env.STRIPE_SECRET_KEY;
if (!key) { console.error('Falta STRIPE_SECRET_KEY'); process.exit(1); }
const Stripe = require('stripe');
const stripe = new Stripe(key);
console.log(`Modo: ${key.startsWith('sk_test') ? 'TEST' : 'LIVE'}${DRY ? ' · DRY-RUN' : ''}`);

// Importes nuevos (en céntimos). Equipo NO se toca.
const TARGETS = [
  { lookup: 'yaqu_pro_monthly',      amount: 1990  },
  { lookup: 'yaqu_pro_annual',       amount: 19900 },
  { lookup: 'yaqu_founding_monthly', amount: 990   },
];

for (const t of TARGETS) {
  const found = await stripe.prices.list({ lookup_keys: [t.lookup], active: true, limit: 1 });
  const current = found.data[0];
  if (!current) {
    console.log(`! ${t.lookup}: no existe ningún precio activo con ese lookup_key — sáltalo o créalo con setup-stripe-prices.mjs.`);
    continue;
  }
  if (current.unit_amount === t.amount) {
    console.log(`= ${t.lookup}: ya está a ${t.amount / 100} € (${current.id}) — nada que hacer.`);
    continue;
  }
  const interval = current.recurring?.interval || 'month';
  console.log(`~ ${t.lookup}: ${current.unit_amount / 100} → ${t.amount / 100} € (${interval}); precio viejo ${current.id}`);
  if (DRY) continue;

  const nuevo = await stripe.prices.create({
    product: typeof current.product === 'string' ? current.product : current.product.id,
    currency: current.currency,
    unit_amount: t.amount,
    recurring: { interval },
    lookup_key: t.lookup,
    transfer_lookup_key: true, // mueve el lookup_key del viejo al nuevo
  });
  await stripe.prices.update(current.id, { active: false }); // archiva el viejo (no cancela suscripciones)
  console.log(`  + creado ${nuevo.id} y lookup_key transferido · viejo ${current.id} archivado`);
}
console.log('Listo. Redeploy en Railway para limpiar la caché en memoria de resolvePriceId.');
