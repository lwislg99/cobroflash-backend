// scripts/verificacion-s5/idempotencia-stripe-corrida.mjs — carril de VERIFICACIÓN (sesión 5)
//
// Reproduce CORRIENDO las dos mitades de SCRUM-815 sobre la función exportada (A12.2). No monta
// la ruta: sin STRIPE_SECRET_KEY contesta 501 antes de llegar, y escribir una clave está prohibido
// (regla 9). El límite se declara, no se salta.
//
// SUELO: si no se consigue importar el manejador, el script falla declarándose CIEGO. Un «no
// reproduce» por no haber ejecutado es la peor respuesta en el camino del dinero.
const mod = await import('../../dist/modules/billing/app/routes/stripe.routes.js').catch((e) => {
  console.log('🔴 CIEGO: no se pudo importar el manejador →', e.message); process.exit(2);
});
const dup = mod.isDuplicateStripeEvent;
if (typeof dup !== 'function') { console.log('🔴 CIEGO: isDuplicateStripeEvent no está exportada.'); process.exit(2); }

// ── CONTROL POSITIVO, los dos casos SEPARADOS (si no los distingue, mide «que hay un Set») ──
const a = dup('evt_A'), b = dup('evt_B');            // dos eventos distintos → los dos se procesan
const c1 = dup('evt_C'), c2 = dup('evt_C');          // el mismo SIN fallo → el 2º se descarta
console.log('CONTROL POSITIVO a) evt_A dup=' + a + ' · evt_B dup=' + b + '  → esperado false/false');
console.log('CONTROL POSITIVO b) evt_C 1ª dup=' + c1 + ' · 2ª dup=' + c2 + '  → esperado false/true');
let malo = 0;
if (a !== false || b !== false || c1 !== false || c2 !== true) { console.log('🔴 CONTROL CAÍDO: el instrumento no mide idempotencia.'); malo = 2; }

// ── 🔴 ROJO ①: el evento se marca ANTES de trabajar, así que el reintento tras un fallo se pierde
let procesado = false;
try { if (!dup('evt_FALLO')) { throw new Error('fallo a mitad del trabajo (el catch responde 400 → Stripe reintenta)'); } } catch { /* 400 */ }
if (!dup('evt_FALLO')) procesado = true;             // el reintento de Stripe
console.log('\n🔴 ROJO ① reintento tras fallo a mitad → ' + (procesado ? 'PROCESADO (correcto)' : 'DESCARTADO como duplicado — EL COBRO SE PIERDE'));
if (!procesado) malo = malo || 1;

// ── 🔴 ROJO ②: el almacén es memoria del módulo, así que otro proceso no sabe nada
console.log('🔴 ROJO ② almacén: ' + (/prisma|await |findUnique/i.test(dup.toString()) ? 'consulta persistencia' : 'Set EN MEMORIA del módulo — un reinicio o una 2ª instancia REPROCESA'));
if (!/prisma|await |findUnique/i.test(dup.toString())) malo = malo || 1;
console.log('\nSCRUM-815 → ' + (malo === 1 ? '🔴 EXISTE HOY: las dos mitades siguen rotas.' : malo ? 'instrumento no fiable' : '✅ ya no ocurre'));
process.exit(0);
