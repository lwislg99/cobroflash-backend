// SCRUM-678b — ¿falta HOY el secreto del webhook de Stripe Connect en producción?
//
// Se le manda a cada webhook un POST SIN FIRMA y se lee qué contesta. Los tres son fail-closed:
// una petición sin firma se rechaza antes de tocar nada, así que esto no escribe ni cobra.
// Lo que cambia es CON QUÉ rechaza, y eso delata si la variable está puesta:
//
//   /webhooks/stripe-connect   500 «Missing STRIPE_CONNECT_WEBHOOK_SECRET»  -> la variable FALTA
//                              400 «No stripe-signature header…»            -> la variable ESTÁ
//   /webhooks/stripe           el CONTROL: su secreto lleva meses puesto, tiene que dar el 400.
//   /webhooks/<no existe>      el otro control: un 404 prueba que el 500 no es «cualquier ruta».
//   /webhooks/mp               contesta 200 ANTES de verificar, siempre: desde fuera NO se puede
//                              saber si MP_WEBHOOK_SECRET está. Se pide para dejarlo dicho.
//
// ⚠️ Lo que NO mide: que el valor puesto sea el secreto CORRECTO. Un 400 dice «hay una variable»,
// no «la firma verifica». Eso sólo lo prueba un evento de prueba mandado desde el panel de Stripe.
//
// Ni un secreto, ni una credencial, ni una sesión. Uso:
//   node docs/master/evidencias/scrum678/sonda-produccion-678b.mjs [https://yaqu.app]
const BASE = (process.argv[2] || 'https://yaqu.app').replace(/\/+$/, '');

const RUTAS = [
  '/webhooks/stripe',
  '/webhooks/stripe-connect',
  '/webhooks/mp',
  '/webhooks/no-existe-678b',
];

async function pedir(ruta) {
  const res = await fetch(BASE + ruta, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
    redirect: 'manual',
  });
  const cuerpo = (await res.text()).replace(/\s+/g, ' ').slice(0, 120);
  return { ruta, status: res.status, cuerpo };
}

console.log(`POBLACION: ${RUTAS.length} rutas de ${BASE}, un POST sin firma a cada una.\n`);

const version = await fetch(`${BASE}/version`).then((r) => r.text()).catch(() => '(sin respuesta)');
console.log(`version   ${version.trim()}`);

const r = {};
for (const ruta of RUTAS) {
  const x = await pedir(ruta);
  r[ruta] = x;
  console.log(`${ruta.padEnd(26)} [HTTP ${x.status}]  ${x.cuerpo}`);
}

const control = r['/webhooks/stripe'];
const noExiste = r['/webhooks/no-existe-678b'];
const connect = r['/webhooks/stripe-connect'];

// Sin los dos controles el resultado no vale: un 500 de todo el servidor y un 500 «falta la
// variable» se leerían igual.
const controlesBien =
  control.status === 400 && /stripe-signature/i.test(control.cuerpo) && noExiste.status === 404;

let veredicto;
if (!controlesBien) veredicto = 'CIEGO';
else if (connect.status === 500 && connect.cuerpo.includes('Missing STRIPE_CONNECT_WEBHOOK_SECRET')) veredicto = 'FALTA';
else if (connect.status === 400 && /stripe-signature/i.test(connect.cuerpo)) veredicto = 'ESTA';
else veredicto = 'CIEGO';

console.log('\nVEREDICTO:');
console.log(`  controles (400 con firma ausente en /webhooks/stripe, 404 en la que no existe) .... ${controlesBien}`);
console.log({
  FALTA: '  🔴 STRIPE_CONNECT_WEBHOOK_SECRET FALTA: el webhook de Connect rechaza todo con 500.',
  ESTA: '  ✅ STRIPE_CONNECT_WEBHOOK_SECRET está puesta. Falta probar que es la correcta: evento de prueba desde Stripe.',
  CIEGO: '  ⚠️ NO HE PODIDO MIRAR: los controles o la respuesta no son los esperados. No es un «está bien».',
}[veredicto]);
console.log('  MP_WEBHOOK_SECRET: no se puede medir desde fuera (la ruta contesta 200 antes de verificar).');

// 0 = la variable está · 1 = falta · 2 = no he podido mirar.
// `process.exitCode` y no `process.exit()`: en Windows, salir con conexiones de `fetch` aún
// cerrándose mata el proceso con una aserción de libuv y el código que sale no es éste.
const salida = { ESTA: 0, FALTA: 1, CIEGO: 2 }[veredicto];
console.log(`\nEXIT=${salida}`);
process.exitCode = salida;
